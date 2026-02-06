"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Search, Share2, RefreshCw, TrendingUp, TrendingDown, Minus, MessageCircle, Zap, Shield, ChevronDown, Globe, BarChart3, Landmark, Factory, Briefcase, AlertTriangle, Bitcoin } from "lucide-react"
import { trackDiscussionScrollEnd } from "@/lib/analytics"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { HeaderSearchModal } from "@/components/header-search-modal"

// ═══════════════════════════════════════════════════════════════
// 타입 정의
// ═══════════════════════════════════════════════════════════════

interface MarketQuote {
  name: string
  price: number
  change: number
  changePercent: number
}

interface MarketAPIResponse {
  date: string
  marketData: Record<string, MarketQuote>
  stockData: Record<string, MarketQuote>
  lastUpdated: string
}

interface DebateMessage {
  id: string
  speaker: "bull" | "bear" | "moderator"
  name: string
  text: string
  topic?: string
}

// ═══════════════════════════════════════════════════════════════
// 토론 주제별 아이콘 / 색상
// ═══════════════════════════════════════════════════════════════

const TOPIC_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  opening: { icon: <Zap className="h-3.5 w-3.5" />, label: "오프닝", color: "bg-amber-100 text-amber-700" },
  geopolitics: { icon: <Globe className="h-3.5 w-3.5" />, label: "지정학·관세", color: "bg-purple-100 text-purple-700" },
  earnings: { icon: <BarChart3 className="h-3.5 w-3.5" />, label: "기업 실적", color: "bg-emerald-100 text-emerald-700" },
  macro: { icon: <Landmark className="h-3.5 w-3.5" />, label: "금리·환율", color: "bg-sky-100 text-sky-700" },
  commodity: { icon: <Factory className="h-3.5 w-3.5" />, label: "원자재·에너지", color: "bg-orange-100 text-orange-700" },
  crypto: { icon: <Bitcoin className="h-3.5 w-3.5" />, label: "코인·가상자산", color: "bg-yellow-100 text-yellow-700" },
  korea: { icon: <AlertTriangle className="h-3.5 w-3.5" />, label: "한국 시장", color: "bg-rose-100 text-rose-700" },
  strategy: { icon: <Briefcase className="h-3.5 w-3.5" />, label: "투자 전략", color: "bg-indigo-100 text-indigo-700" },
}

// ═══════════════════════════════════════════════════════════════
// 헬퍼 함수
// ═══════════════════════════════════════════════════════════════

function fmt(n: number | undefined, digits = 2): string {
  if (n === undefined || n === null) return "N/A"
  return n.toLocaleString("en-US", { maximumFractionDigits: digits })
}

function pct(n: number | undefined): string {
  if (n === undefined || n === null) return "N/A"
  const sign = n >= 0 ? "+" : ""
  return `${sign}${n.toFixed(2)}%`
}

// ═══════════════════════════════════════════════════════════════
// 종합 한마디 생성
// ═══════════════════════════════════════════════════════════════

function generateSummaryVerdict(
  market: Record<string, MarketQuote>,
  stocks: Record<string, MarketQuote>
): { emoji: string; headline: string; detail: string; tone: "danger" | "caution" | "neutral" | "positive" } {
  const sp = market.sp500
  const nasdaq = market.nasdaq
  const vix = market.vix
  const btc = market.btc
  const kospi = market.kospi
  const krw = market.usdkrw

  const spPct = sp?.changePercent ?? 0
  const nasPct = nasdaq?.changePercent ?? 0
  const vixLvl = vix?.price ?? 0
  const btcPct = btc?.changePercent ?? 0
  const kospiPct = kospi?.changePercent ?? 0

  // 패닉 (VIX 30+ 또는 미국 -2% 이상)
  if (vixLvl > 30 || spPct < -2 || nasPct < -3) {
    return {
      emoji: "🚨",
      headline: "시장 공포 극대화 — 패닉 매도 주의",
      detail: `VIX ${fmt(vixLvl, 1)}에 S&P ${pct(spPct)} 하락. 관세·실적 불안이 동시 폭발. 현금 비중 확대하고 분할 매수 기회 포착.`,
      tone: "danger"
    }
  }

  // 약세 (미·한 동반 하락 + 코인도 약세)
  if (spPct < -0.3 && kospiPct < -0.5) {
    const cryptoNote = btcPct < -2 ? ` 비트코인도 ${pct(btcPct)}로 위험자산 동반 약세.` : ""
    return {
      emoji: "⚠️",
      headline: "미·한 동반 약세 — 관세·실적 불안 지속",
      detail: `S&P ${pct(spPct)}, 코스피 ${pct(kospiPct)} 하락.${cryptoNote} 관세 불확실성과 빅테크 실적 우려가 시장을 짓누르는 중. 방어적 포지션 유지 권장.`,
      tone: "caution"
    }
  }

  // 미국만 약세
  if (spPct < -0.3 || nasPct < -0.5) {
    return {
      emoji: "📉",
      headline: "미국 시장 조정 — 기술주 중심 약세",
      detail: `나스닥 ${pct(nasPct)}, S&P ${pct(spPct)}. ${vixLvl > 20 ? `VIX ${fmt(vixLvl, 1)}로 불안 심리 확대.` : "아직 패닉은 아니나 관세·금리 변수 주시."} 단기 변동성에 흔들리지 말고 펀더멘털 중심 대응.`,
      tone: "caution"
    }
  }

  // 상승세
  if (spPct > 0.5 && nasPct > 0.5) {
    return {
      emoji: "🚀",
      headline: "미국 시장 강세 — 위험자산 선호 확대",
      detail: `S&P ${pct(spPct)}, 나스닥 ${pct(nasPct)} 상승. ${btcPct > 1 ? `비트코인도 ${pct(btcPct)}로 동반 강세.` : ""} 실적 호조와 금리 안정이 랠리를 뒷받침. 과열 징후 모니터링 필요.`,
      tone: "positive"
    }
  }

  // 보합
  return {
    emoji: "🔍",
    headline: "시장 방향 탐색 중 — 관망세 우세",
    detail: `S&P ${pct(spPct)}, 나스닥 ${pct(nasPct)}로 보합권. ${krw && krw.price > 1400 ? `원/달러 ${fmt(krw.price, 0)}원대 환율 부담 지속.` : ""} 관세 협상 결과와 경제 지표에 따라 방향 결정될 전망.`,
    tone: "neutral"
  }
}

// ═══════════════════════════════════════════════════════════════
// AI 토론 생성 — 7개 주제 라운드
// ═══════════════════════════════════════════════════════════════

function generateDebate(
  market: Record<string, MarketQuote>,
  stocks: Record<string, MarketQuote>,
  date: string,
  lastUpdated?: string
): DebateMessage[] {
  const sp = market.sp500
  const nasdaq = market.nasdaq
  const dow = market.dow
  const vix = market.vix
  const t10 = market.treasury10Y
  const dollar = market.dollarIndex
  const gold = market.gold
  const oil = market.oil
  const kospi = market.kospi
  const kosdaq = market.kosdaq
  const krw = market.usdkrw
  const btc = market.btc
  const eth = market.eth
  const sol = market.sol

  const nvda = stocks.nvda
  const googl = stocks.googl
  const amd = stocks.amd
  const smh = stocks.smh
  const xle = stocks.xle
  const xlu = stocks.xlu
  const lmt = stocks.lmt

  // ── 시간 기준 라벨 생성 ──
  // KST 기준으로 미국 장 상태를 판별해서 각 주제별 데이터 시점을 표시
  const now = lastUpdated ? new Date(lastUpdated) : new Date()
  const kstHour = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" })).getHours()
  // 미국 장: KST 23:30~06:00 (서머타임 22:30~05:00)
  // KST 06시 이후 ~ 23시 이전이면 미국 장 마감 상태
  const usMarketClosed = kstHour >= 6 && kstHour < 22
  const usTimeLabel = usMarketClosed ? "어젯밤 미국 장 마감 기준" : "미국 장 실시간"
  const krTimeLabel = "오늘 한국 장 마감 기준"
  const cryptoTimeLabel = "현재 실시간 시세"

  // 상황 플래그
  const usDown = (sp?.changePercent ?? 0) < -0.3 || (nasdaq?.changePercent ?? 0) < -0.3
  const usUp = (sp?.changePercent ?? 0) > 0.3 || (nasdaq?.changePercent ?? 0) > 0.3
  const krDown = (kospi?.changePercent ?? 0) < -0.5
  const highVix = (vix?.price ?? 0) > 20
  const veryHighVix = (vix?.price ?? 0) > 30
  const dollarStrong = (dollar?.changePercent ?? 0) > 0.2
  const goldUp = (gold?.changePercent ?? 0) > 0.3
  const oilDown = (oil?.changePercent ?? 0) < -1
  const oilUp = (oil?.changePercent ?? 0) > 1
  const krwWeak = (krw?.price ?? 0) > 1450
  const semiWeak = (smh?.changePercent ?? 0) < -1 || (amd?.changePercent ?? 0) < -3
  const defenseStrong = (xle?.changePercent ?? 0) > 0.5 || (lmt?.changePercent ?? 0) > 0.5 || (xlu?.changePercent ?? 0) > 0.3
  const btcDown = (btc?.changePercent ?? 0) < -2
  const btcUp = (btc?.changePercent ?? 0) > 2
  const cryptoCorrelated = usDown && btcDown

  const msgs: DebateMessage[] = []
  let id = 0
  const add = (speaker: DebateMessage["speaker"], name: string, text: string, topic?: string) => {
    msgs.push({ id: String(++id), speaker, name, text, topic })
  }

  // ━━━━━━━━━ 1. 오프닝 ━━━━━━━━━

  add("moderator", "사회자",
    `${date} 시장 브리핑을 시작합니다. ${usMarketClosed ? "미국은 어젯밤 마감가, 한국은 오늘 장 마감가, 코인은 실시간 기준입니다." : "미국 장이 열려 있어 실시간 시세를 반영합니다."} S&P 500 ${fmt(sp?.price)} (${pct(sp?.changePercent)}), 나스닥 ${fmt(nasdaq?.price)} (${pct(nasdaq?.changePercent)}), 다우 ${fmt(dow?.price)} (${pct(dow?.changePercent)}). 코스피 ${fmt(kospi?.price)} (${pct(kospi?.changePercent)}), 코스닥 ${fmt(kosdaq?.price)} (${pct(kosdaq?.changePercent)}). ${btc ? `비트코인 $${fmt(btc.price, 0)} (${pct(btc.changePercent)}).` : ""} 오늘 7가지 핵심 주제를 집중 토론합니다.`,
    "opening"
  )

  // ━━━━━━━━━ 2. 지정학·관세 (5스텝) ━━━━━━━━━

  add("moderator", "사회자",
    "🌍 첫 번째 주제 — 트럼프 관세와 지정학적 리스크입니다. 캐나다·멕시코 25%, 중국 추가 10%, 반도체·의약품 25% 관세 예고까지. 포트폴리오를 어떻게 조정해야 할까요?",
    "geopolitics"
  )

  // Step 1: 🐻 주장
  add("bear", "신중론자 🐻",
    `관세 리스크를 최우선으로 봐야 합니다. IEEPA 발동은 전례 없는 강도예요. 반도체·의약품 25%는 처음이고, 한국·대만·일본 기업에 직격탄입니다. ${nasdaq && nasdaq.changePercent < -0.3 ? `나스닥 ${pct(nasdaq.changePercent)} 하락이 이 불확실성을 반영해요.` : "시장이 충격을 완전 반영 못했을 수 있습니다."} 현금 비중 20% 이상 확대하고 에너지·방산으로 헤지해야 합니다.`,
    "geopolitics"
  )

  // Step 2: 🐂 주장
  add("bull", "낙관론자 🐂",
    `관세 우려는 인정하지만, 트럼프 1기 학습효과가 있습니다. 캐나다·멕시코 관세는 이미 유예된 전례가 있고, '관세 = 협상 지렛대' 패턴이 반복돼요. ${dow && dow.changePercent > (nasdaq?.changePercent ?? 0) ? `다우가 나스닥 대비 선방한 건 시장이 적응 중이라는 증거입니다.` : ""} 현금 비중 20%는 과도해요 — 오히려 관세 내성 강한 NVDA 같은 AI 인프라주를 분할 매수할 타이밍입니다.`,
    "geopolitics"
  )

  // Step 3: 🐻 반박/절충
  add("bear", "신중론자 🐻",
    `NVDA 분할 매수? 반도체 25% 관세가 예고된 상황에서 성급합니다. 다만 '협상 지렛대' 가능성은 인정해요. 절충안을 제시하면 — 관세 뉴스 확정 전까지 신규 매수는 자제하되, 기존 보유분은 유지하고 에너지(XLE) 15%로 지정학 헤지를 거는 게 현실적입니다.`,
    "geopolitics"
  )

  // Step 4: 🐂 응답
  add("bull", "낙관론자 🐂",
    `에너지 헤지는 동의합니다. 다만 관세 확정을 기다리면 주가는 이미 반영돼 있을 거예요. '확정 전 분할 매수 시작, 확정 후 비중 확대'가 더 효율적이라고 봅니다. XLE 10~15% + NVDA 분할 3회, 이 정도면 양쪽 리스크를 다 커버할 수 있어요.`,
    "geopolitics"
  )

  // Step 5: 사회자 정리
  add("moderator", "사회자",
    `정리하면 — 양측 모두 관세 불확실성이 최대 변수임에 동의합니다. 합의점: ①에너지·방산(XLE, LMT)으로 10~15% 헤지, ②신규 공격 매수는 관세 뉴스 확인 후 분할로, ③기존 우량주 보유분은 유지. 관세 뉴스를 매일 모니터링하세요.`,
    "geopolitics"
  )

  // ━━━━━━━━━ 3. 기업 실적 (5스텝) ━━━━━━━━━

  add("moderator", "사회자",
    `📊 두 번째 주제 — 기업 실적입니다 (${usTimeLabel}). ${googl ? `알파벳 ${pct(googl.changePercent)},` : ""} ${amd ? `AMD ${pct(amd.changePercent)},` : ""} ${nvda ? `엔비디아 ${pct(nvda.changePercent)}.` : ""} 빅테크 AI CAPEX $2,280억 — 매수 vs 관망?`,
    "earnings"
  )

  // Step 1: 🐻 주장
  if (amd && amd.changePercent < -3) {
    add("bear", "신중론자 🐻",
      `AMD ${pct(amd.changePercent)} 급락이 경고등입니다. AI 가이던스 기대 미달, 엔비디아 독주 체제 확인. ${googl && googl.changePercent < -2 ? `알파벳도 ${pct(googl.changePercent)} — ` : ""}빅테크 CAPEX $2,280억 중 투자 회수 시그널이 아직 약해요. S&P PER 22배는 과열 구간. PER 30배 이상 종목은 차익실현해야 합니다.`,
      "earnings"
    )
  } else {
    add("bear", "신중론자 🐻",
      `빅테크 CAPEX 논쟁이 핵심입니다. 메타·MS·알파벳 2025년 누적 $2,280억, 전년비 55% 증가. ${googl && googl.changePercent < -2 ? `알파벳 ${pct(googl.changePercent)} 하락이 시장 우려를 보여줘요.` : "AI 투자 회수 장기화 시 밸류에이션 재평가 불가피."} S&P PER 22배는 과열. 차익실현으로 현금 확보하세요.`,
      "earnings"
    )
  }

  // Step 2: 🐂 주장
  if (googl && googl.changePercent > 2) {
    add("bull", "낙관론자 🐂",
      `알파벳 ${pct(googl.changePercent)} 강세가 AI 투자 전환을 증명합니다! 매출 전년비 18% 성장, AI 검색 75M+ DAU. CAPEX는 10년 성장 엔진 투자예요. ${nvda ? `엔비디아 ${pct(nvda.changePercent)}도 AI 수요 실재를 확인해요.` : ""} 차익실현보다 AI 인프라주 분할 매수가 정답입니다.`,
      "earnings"
    )
  } else {
    add("bull", "낙관론자 🐂",
      `CAPEX 우려는 매번 나오지만, 빅테크 캐시플로우가 충분히 소화합니다. 알파벳 분기 순이익 $340억, AI 검색 75M+ DAU. ${amd && amd.changePercent < -3 ? `AMD 급락은 기대치 과잉 탓이지 AI 시장 자체가 축소된 건 아닙니다. 데이터센터 매출 전년비 69% 성장이에요.` : ""} HBM 가격 +80%가 실수요를 증명합니다. 과매도 구간에서 AI 인프라(NVDA, AVGO) 분할 매수 기회입니다.`,
      "earnings"
    )
  }

  // Step 3: 🐻 반박/절충
  add("bear", "신중론자 🐻",
    `AI 수요가 실재하는 건 인정합니다. 다만 문제는 속도예요 — $2,280억 투자 대비 수익 전환이 2~3년 걸릴 수 있고, 그 사이 금리가 높으면 밸류에이션 부담이 커져요. 절충안은 이렇습니다: AI 인프라 매수 자체는 동의하되, 5회 분할로 천천히. 그리고 PER 30배 이상 고평가 종목은 일부 차익실현해서 현금을 확보하는 게 안전합니다.`,
    "earnings"
  )

  // Step 4: 🐂 응답
  add("bull", "낙관론자 🐂",
    `5회 분할 매수, 좋은 접근입니다. 다만 차익실현 대상은 신중해야 해요 — NVDA, AVGO처럼 CAPEX 직접 수혜주는 유지하고, 밸류에이션만 높고 실적 개선이 불확실한 종목 위주로 정리하는 게 맞습니다. '전부 팔아라'가 아니라 '옥석을 가려라'예요.`,
    "earnings"
  )

  // Step 5: 사회자 정리
  add("moderator", "사회자",
    `정리 — AI CAPEX는 장기 성장 투자라는 점에 양측 동의. 합의점: ①AI 인프라(NVDA, AVGO)는 5회 분할 매수, ②PER 30배+ 실적 불확실 종목은 일부 차익실현, ③실적 발표 시즌에 수익 전환 데이터를 확인하며 비중 조절.`,
    "earnings"
  )

  // ━━━━━━━━━ 4. 금리·환율 (5스텝) ━━━━━━━━━

  add("moderator", "사회자",
    `🏛️ 세 번째 주제 — 금리와 환율. ${t10 ? `10년물 ${t10.price.toFixed(2)}% (${pct(t10.changePercent)}),` : ""} ${dollar ? `달러 인덱스 ${fmt(dollar.price, 1)} (${pct(dollar.changePercent)})은 ${usTimeLabel},` : ""} ${krw ? `원/달러 ${fmt(krw.price, 0)}원 (${pct(krw.changePercent)})은 ${krTimeLabel}.` : ""} 포트폴리오에 어떤 영향을 줄까요?`,
    "macro"
  )

  if (t10) {
    // Step 1: 🐻
    add("bear", "신중론자 🐻",
      `금리 환경이 긴축적입니다. 10년물 ${t10.price.toFixed(2)}%는 ${t10.price > 4.5 ? "4.5% 위에서 고착 — 성장주 밸류에이션에 직접 타격." : "여전히 높은 수준."} 관세발 인플레 재가속으로 연준 금리인하가 올해 2회도 불투명해요. ${krwWeak ? `원/달러 ${fmt(krw?.price, 0)}원대 약세는 외국인 이탈을 가속화합니다.` : ""} 채권(7~10년물) 비중 15~20%로 방어하세요.`,
      "macro"
    )

    // Step 2: 🐂
    add("bull", "낙관론자 🐂",
      `${t10.changePercent < 0 ? "오늘 금리 하락이 긍정 시그널이에요 —" : "금리가 높지만"} 시장은 이미 적응 중입니다. 고용 둔화 시그널이 나오면 하반기 금리인하 가능성이 열려요. ${krw ? `원/달러 ${fmt(krw.price, 0)}원은 수출기업 실적에 오히려 긍정적이고,` : ""} 채권 15~20%는 과도합니다 — 주식 비중을 줄이면 반등 수익을 놓쳐요.`,
      "macro"
    )

    // Step 3: 🐻 절충
    add("bear", "신중론자 🐻",
      `수출 실적 개선은 맞지만, 환차손으로 외국인이 빠지면 주가 자체가 안 올라요. 절충하면 — 채권 10~15%로 줄이되, 단기채(2년 이하) 중심으로 금리 하락 시 전환 유연성을 확보하는 건 어떨까요? ${dollarStrong ? "달러 강세 지속 시 이머징 자금 유출은 계속될 겁니다." : ""}`,
      "macro"
    )

    // Step 4: 🐂 응답
    add("bull", "낙관론자 🐂",
      `단기채 중심 채권 10~15%, 합리적인 절충입니다. 여기에 덧붙이면 — 금리인하 시그널 나올 때 빠르게 주식 비중을 늘릴 준비를 해두세요. 고용 지표, FOMC 발언이 전환점이 될 겁니다.`,
      "macro"
    )

    // Step 5: 사회자 정리
    add("moderator", "사회자",
      `정리 — 금리 고착과 환율 부담에 양측 동의. 합의점: ①단기채 중심 채권 10~15% 편입, ②금리인하 시그널(고용 둔화, FOMC) 시 주식 비중 확대 준비, ③원/달러 환율은 수출주 수혜 vs 외국인 이탈 양면 모니터링.`,
      "macro"
    )
  }

  // ━━━━━━━━━ 5. 원자재·에너지 (5스텝) ━━━━━━━━━

  add("moderator", "사회자",
    `⛽ 네 번째 주제 — 원자재·에너지 (${usTimeLabel}). ${gold ? `금 $${fmt(gold.price)} (${pct(gold.changePercent)}),` : ""} ${oil ? `WTI $${fmt(oil.price)} (${pct(oil.changePercent)}).` : ""} ${defenseStrong ? `방어주·에너지 섹터 상대 강세 — ${xle ? `XLE ${pct(xle.changePercent)},` : ""} ${lmt ? `록히드마틴 ${pct(lmt.changePercent)}.` : ""}` : ""} 방어 수단으로서의 가치, 어떻게 보시나요?`,
    "commodity"
  )

  // Step 1: 🐻
  add("bear", "신중론자 🐻",
    `${goldUp ? `금 상승(${pct(gold?.changePercent)})이 시장 불안을 대변합니다. ` : ""}${oilDown ? `유가 하락(${pct(oil?.changePercent)})은 글로벌 수요 둔화 시그널이에요. 관세가 교역량을 줄이면 에너지 수요도 위축됩니다.` : oilUp ? `유가 상승(${pct(oil?.changePercent)})은 인플레 압력을 높여 금리인하를 더 어렵게 만들어요.` : "원자재 시장의 불확실성이 높습니다."} 금 ETF(GLD) 5~10%로 지정학·인플레 헤지가 필수입니다.`,
    "commodity"
  )

  // Step 2: 🐂
  add("bull", "낙관론자 🐂",
    `${oilDown ? "유가 하락은 기업·소비자에게 긍정적입니다 — 에너지 비용 절감이 소비 여력을 높여요." : oilUp ? `유가 상승(${pct(oil?.changePercent)})은 글로벌 수요가 살아있다는 반증이에요. ${xle ? `에너지 섹터(XLE) ${pct(xle.changePercent)} 강세가` : "에너지주 강세가"} 경기침체 과장론을 반박합니다.` : "에너지 섹터는 관세 환경에서 상대적 안전지대예요."} 금보다는 에너지(XLE) 10~15%가 수익 + 방어 두 마리 토끼를 잡을 수 있습니다.`,
    "commodity"
  )

  // Step 3: 🐻 절충
  add("bear", "신중론자 🐻",
    `에너지 섹터의 상대 강세는 인정합니다. ${defenseStrong && dow ? `다우 > 나스닥 선방도 같은 맥락이에요. ` : ""}다만 금과 에너지는 역할이 달라요 — 금은 극단적 위기 시 보험이고, 에너지는 경기 순환 베팅입니다. 양자택일이 아니라 금 5% + 에너지 10%, 이중 헤지가 가장 안전합니다.`,
    "commodity"
  )

  // Step 4: 🐂 응답
  add("bull", "낙관론자 🐂",
    `금 5% + 에너지 10%의 이중 헤지, 동의합니다. 여기에 방산(LMT)도 3~5% 추가하면 지정학 리스크를 더 넓게 커버할 수 있어요. ${lmt ? `록히드마틴 ${pct(lmt.changePercent)}처럼` : "방산주는"} 관세와 무관하게 방어예산 확대 수혜를 받으니까요.`,
    "commodity"
  )

  // Step 5: 사회자 정리
  add("moderator", "사회자",
    `정리 — 양측 모두 원자재·방어 섹터의 헤지 필요성에 동의. 합의점: ①금 ETF(GLD) 5%로 극단 위기 보험, ②에너지(XLE) 10~15%로 경기 방어+수익, ③방산(LMT) 3~5% 지정학 헤지. 기술주 편중 포트의 균형추 역할입니다.`,
    "commodity"
  )

  // ━━━━━━━━━ 6. 코인·가상자산 (5스텝) ━━━━━━━━━

  add("moderator", "사회자",
    `₿ 다섯 번째 주제 — 코인과 가상자산입니다 (${cryptoTimeLabel}). ${btc ? `비트코인 $${fmt(btc.price, 0)} (${pct(btc.changePercent)}),` : ""} ${eth ? `이더리움 $${fmt(eth.price, 0)} (${pct(eth.changePercent)}),` : ""} ${sol ? `솔라나 $${fmt(sol.price, 1)} (${pct(sol.changePercent)}).` : ""} 포트폴리오에 편입해야 할까요?`,
    "crypto"
  )

  // Step 1: 🐻
  if (cryptoCorrelated || btcDown) {
    add("bear", "신중론자 🐻",
      `${cryptoCorrelated ? `비트코인 ${pct(btc?.changePercent)}로 주식과 동반 하락 — 이게 핵심입니다.` : `비트코인 ${pct(btc?.changePercent)} 하락.`} ETF 기관자금 유입 이후 비트코인-나스닥 상관계수가 0.4~0.6으로 높아졌어요. '디지털 금' 역할은 약화됐고, 변동성은 주식의 2배. 분산 효과가 없는 자산에 5~10% 넣을 이유가 없습니다. 비중 0%, 대신 진짜 금으로 가세요.`,
      "crypto"
    )
  } else if (btcUp) {
    add("bear", "신중론자 🐻",
      `비트코인 ${pct(btc?.changePercent)} 상승에 흥분하기 전에 — 변동성이 주식의 2배입니다. 오늘 +5%면 내일 -5%가 일상이에요. 주식-코인 상관계수 0.4~0.6인 지금, 성장주 중심 포트에 코인까지 더하면 분산이 아니라 리스크 집중입니다. 최소화 또는 0%를 권합니다.`,
      "crypto"
    )
  } else {
    add("bear", "신중론자 🐻",
      `코인이 안정적으로 보여도 근본적 문제는 변함없습니다. 주식-코인 상관계수 0.4~0.6 — 분산 효과 제한적이에요. 같은 리스크를 2배 변동성으로 감수하는 셈입니다. 성장주 중심 포트라면 코인 대신 금·채권으로 진짜 분산을 추구하세요. 비중 최소화 권장.`,
      "crypto"
    )
  }

  // Step 2: 🐂
  if (btcUp) {
    add("bull", "낙관론자 🐂",
      `비트코인 ${pct(btc?.changePercent)} 상승이 추세를 보여줍니다. ${eth ? `이더리움도 ${pct(eth.changePercent)} 동반 강세.` : ""} ETF 자금 유입 지속, 트럼프 정부 친코인 정책(전략적 비축, 규제 완화)이 장기 지지선을 높이고 있어요. 5~10% 편입으로 위험자산 노출을 늘릴 타이밍입니다. 0%는 기회비용이 너무 커요.`,
      "crypto"
    )
  } else {
    add("bull", "낙관론자 🐂",
      `상관계수가 높아졌다는 건 단기 현상이지 구조적 관계가 아닙니다. 비트코인-S&P 상관은 -0.3~0.6까지 변동하고, 금리인하 사이클 진입 시 낮아지는 패턴이 있어요. ${btc ? `$${fmt(btc.price, 0)} 수준에서` : ""} 장기 CAGR 200%(5년) 관점은 여전히 매력적. 트럼프 친코인 정책도 구조적 호재. 5% 편입은 합리적입니다.`,
      "crypto"
    )
  }

  // Step 3: 🐻 절충
  add("bear", "신중론자 🐻",
    `트럼프 친코인 정책은 인정합니다 — 구조적으로 하방 지지가 생긴 건 맞아요. 다만 5%도 변동성 2배면 포트 전체 변동에 10% 영향을 줍니다. 절충안: 비트코인만 3% 이내, 그리고 주식-코인 상관계수가 0.5 이상 유지되면 축소하는 룰을 정해두세요. 감정 매매 방지가 핵심이에요.`,
    "crypto"
  )

  // Step 4: 🐂 응답
  add("bull", "낙관론자 🐂",
    `3% + 상관계수 모니터링 룰, 좋은 프레임워크입니다. ${btc ? `$${fmt(btc.price, 0)}` : "현재 가격"} 근처에서 진입하되, 알트코인은 배제하고 비트코인 단일 편입이 리스크 관리에 유리해요. 상관 0.5 이하로 떨어지면 5%까지 확대하는 단계적 접근이 가장 합리적입니다.`,
    "crypto"
  )

  // Step 5: 사회자 정리
  add("moderator", "사회자",
    `정리 — 양측 모두 코인의 분산 효과 제한에 동의. 합의점: ①비트코인만 3% 이내 편입 (알트코인 배제), ②주식-코인 상관계수 0.5 이상이면 축소, 0.5 이하면 5%까지 확대, ③감정 매매 방지를 위한 사전 룰 설정이 핵심.`,
    "crypto"
  )

  // ━━━━━━━━━ 7. 한국 시장 (5스텝) ━━━━━━━━━

  add("moderator", "사회자",
    `🇰🇷 여섯 번째 주제 — 한국 시장 (${krTimeLabel}). ${kospi ? `코스피 ${fmt(kospi.price)} (${pct(kospi.changePercent)}),` : ""} ${kosdaq ? `코스닥 ${fmt(kosdaq.price)} (${pct(kosdaq.changePercent)}).` : ""} ${krw ? `원/달러 ${fmt(krw.price, 0)}원.` : ""} 한국 시장 비중을 어떻게 가져가야 할까요?`,
    "korea"
  )

  if (krDown) {
    // Step 1: 🐻
    add("bear", "신중론자 🐻",
      `한국이 삼중고에 시달리고 있습니다. ${krwWeak ? `①원/달러 ${fmt(krw?.price, 0)}원대 원화 약세로 외국인 이탈 가속,` : "①외국인 순매도 압력,"} ②반도체 관세 25% 예고가 삼성·SK 직격탄, ③정치 불안정이 코리아 디스카운트를 심화시키고 있어요. 한국 비중은 최소화하고, 미국 직접 투자가 더 효율적입니다.`,
      "korea"
    )

    // Step 2: 🐂
    add("bull", "낙관론자 🐂",
      `단기 악재는 맞지만 밸류에이션이 극단적으로 매력적입니다. ${kospi ? `코스피 ${fmt(kospi.price)}은 PBR 0.9배, 역사적 하단이에요.` : ""} 한국은 AI CAPEX의 핵심 공급자 — HBM, 파운드리, 장비 모두 한국이 빠질 수 없습니다. ${krwWeak ? "환율이 높을수록 수출 실적은 오히려 개선돼요." : ""} 최소화가 아니라 저PER 가치주 선별 매수가 정답입니다.`,
      "korea"
    )

    // Step 3: 🐻 절충
    add("bear", "신중론자 🐻",
      `밸류에이션 매력은 인정합니다 — PBR 0.9배는 확실히 싸요. 다만 '싼 데는 이유가 있다'는 걸 잊으면 안 됩니다. 절충안: 한국 전체 비중은 10~15%로 제한하되, HBM 직접 수혜주(SK하이닉스 등)만 선별. ${krwWeak ? `원/달러 ${fmt(krw?.price, 0)}원 돌파 시엔 추가 매수를 중단하는 가이드라인을 두세요.` : "환율 상황을 계속 모니터링하세요."}`,
      "korea"
    )

    // Step 4: 🐂 응답
    add("bull", "낙관론자 🐂",
      `10~15% 한도 + HBM 선별, 합리적입니다. 여기에 밸류에이션 트리거를 추가하면 — PBR 0.85배 이하에서 추가 매수, 1.0배 이상에서 일부 차익실현. 이런 기계적 룰이 감정을 배제하고 최적 타이밍을 잡게 해줍니다.`,
      "korea"
    )
  } else {
    // Step 1: 🐂 (한국 안정 시)
    add("bull", "낙관론자 🐂",
      `한국은 AI 사이클의 핵심 축입니다. HBM, 파운드리 — 빅테크 CAPEX 확대가 한국 기업 매출로 직결돼요. ${kospi ? `코스피 ${fmt(kospi.price)}` : "현재"} PBR 기준 저평가 매력이 분명합니다. 한국 반도체 관련주 15~20% 비중을 권합니다.`,
      "korea"
    )

    // Step 2: 🐻
    add("bear", "신중론자 🐻",
      `코리아 디스카운트 근본 원인은 변함없습니다 — 지배구조, 지정학, 정치 리스크. ${krw ? `원/달러 ${fmt(krw.price, 0)}원대 환율도 외국인에겐 환차손 리스크예요.` : ""} 반도체 관세까지 반영하면 15~20%는 과도합니다. 10% 이내가 적절해요.`,
      "korea"
    )

    // Step 3: 🐂 절충
    add("bull", "낙관론자 🐂",
      `디스카운트 요인은 인정합니다. 절충하면 — 한국 10~15%로 하되, 글로벌 공급망에서 대체 불가능한 기업(HBM, 파운드리)에 집중. 정치 리스크가 해소되면 비중 확대할 여지를 남겨두는 거예요.`,
      "korea"
    )

    // Step 4: 🐻 응답
    add("bear", "신중론자 🐻",
      `HBM 집중은 동의합니다. 다만 관세 뉴스 확정 전까지는 신규 매수보다 관찰 우선. 기존 보유분은 유지하되 추가 매수는 반도체 관세 결과를 확인한 후에 진행하세요.`,
      "korea"
    )
  }

  // Step 5: 사회자 정리
  add("moderator", "사회자",
    `정리 — ${krDown ? `한국 삼중고 속에서도 밸류에이션 매력에 양측 동의. 합의점: ①한국 비중 10~15% 한도, ②HBM 직접 수혜주 선별 집중, ③PBR 기준(0.85~1.0) 기계적 매매 룰 설정, ④환율 급등 시 추가 매수 중단.` : `한국의 AI 공급망 가치에 양측 동의. 합의점: ①한국 10~15%, HBM·파운드리 집중, ②반도체 관세 확정 후 비중 조절, ③코리아 디스카운트 해소 시 확대 여지 확보.`}`,
    "korea"
  )

  // ━━━━━━━━━ 8. 투자 전략 (5스텝) ━━━━━━━━━

  add("moderator", "사회자",
    "💼 마지막 주제 — 오늘 토론을 종합한 투자 전략입니다. 각자의 포트폴리오 배분안을 제시해 주세요.",
    "strategy"
  )

  // Step 1: 🐻 전략
  if (veryHighVix) {
    add("bear", "신중론자 🐻",
      `VIX ${fmt(vix?.price, 1)}은 극도의 불안 구간. 제 배분안: 현금 40%, 채권(단기) 15%, 금(GLD) 5%, 에너지·방산(XLE, LMT) 15%, 주식(AI 인프라) 22%, 코인 3%. 핵심은 현금을 최대로 확보하고 3개월 이상 분할 매수 기회를 기다리는 것입니다.`,
      "strategy"
    )
  } else if (highVix) {
    add("bear", "신중론자 🐻",
      `변동성 경계 구간입니다. 제 배분안: 현금 25%, 채권(단기) 15%, 금(GLD) 5%, 에너지·방산 15%, 미국 주식 30%, 한국 가치주 7%, 코인 3%. 관세·금리·실적 세 가지 불확실성이 해소되기 전까진 방어 비중을 유지해야 합니다.`,
      "strategy"
    )
  } else {
    add("bear", "신중론자 🐻",
      `안정기에 리스크 관리를 준비하세요. 제 배분안: 현금 15%, 채권 10%, 금 5%, 에너지·방산 10%, 미국 주식 45%, 한국 가치주 12%, 코인 3%. PER 30배+ 종목은 일부 차익실현하고 섹터 분산(기술 비중 40% 이하)을 유지하세요.`,
      "strategy"
    )
  }

  // Step 2: 🐂 전략
  if (veryHighVix) {
    add("bull", "낙관론자 🐂",
      `공포 극대가 역사적 최고의 매수 타이밍입니다. VIX 30+ 이후 12개월 평균 수익률 +20%. 제 배분안: 현금 15%, 채권 5%, 금 5%, 에너지·방산 15%, AI 인프라(NVDA, AVGO) 40%, 한국 HBM 15%, 코인 5%. 5회 분할매수로 공포를 기회로 전환하세요.`,
      "strategy"
    )
  } else if (highVix) {
    add("bull", "낙관론자 🐂",
      `변동성 확대 = 기회 확대. 제 배분안: 현금 10%, 채권 5%, 금 5%, 에너지·방산 10%, AI 인프라(NVDA, AVGO) 40%, 한국 HBM 15%, 내수주 10%, 코인 5%. 관세 내성 강한 미국 내수주도 혼합하면서, AI 핵심주 비중을 유지합니다.`,
      "strategy"
    )
  } else {
    add("bull", "낙관론자 🐂",
      `안정기에 성장주 집중하세요. 제 배분안: 현금 5%, 채권 5%, 금 5%, 에너지·방산 10%, AI 인프라(NVDA, AVGO, 전력) 45%, 한국 반도체 15%, 빅테크 10%, 코인 5%. 미주도감 올그린 종목도 체크해서 우량주를 확인하세요!`,
      "strategy"
    )
  }

  // Step 3: 🐻 반박/절충
  add("bear", "신중론자 🐻",
    `${veryHighVix ? "VIX 30+ 이후 +20%는 맞지만 그 전에 -30%까지 빠진 적도 있어요." : highVix ? "AI 40%는 관세 변수를 과소평가한 배분입니다." : "AI 45%는 섹터 집중 리스크가 너무 높아요."} 양측 안을 절충하면 — AI 인프라 30~35%, 에너지·방산 12%, 한국 HBM 10%, 채권 10%, 금 5%, 코인 3%, 현금 ${highVix || veryHighVix ? "20%" : "15%"}. 이 정도면 공격과 방어의 균형이 잡힙니다.`,
    "strategy"
  )

  // Step 4: 🐂 응답
  add("bull", "낙관론자 🐂",
    `절충안의 큰 틀은 동의합니다. 다만 AI 인프라는 최소 35%를 확보해야 해요 — 이건 단기 트레이딩이 아니라 10년 성장 사이클 투자니까요. 35% AI + 12% 에너지·방산 + 10% 한국 HBM + 10% 채권 + 5% 금 + 3% 코인 + 현금 ${highVix || veryHighVix ? "25% — 공포가 가라앉으면 현금을 AI로 전환" : "25%"}. 미주도감에서 올그린 종목을 확인하며 진짜 우량주만 담으세요.`,
    "strategy"
  )

  // Step 5: 사회자 정리
  const cashPct = veryHighVix ? "25~40%" : highVix ? "20~25%" : "15~25%"
  add("moderator", "사회자",
    `오늘의 종합 합의안: AI 인프라(NVDA, AVGO) 30~35%, 에너지·방산(XLE, LMT) 10~15%, 한국 HBM 10~15%, 채권(단기) 10%, 금(GLD) 5%, 코인(BTC) 3%, 현금 ${cashPct}. 비중은 관세 뉴스·금리 시그널에 따라 유동적으로 조절하세요. 핵심은 방향이 아니라 리스크 관리입니다.`,
    "strategy"
  )

  // ━━━━━━━━━ 마무리 ━━━━━━━━━

  const summaryPoints: string[] = []
  summaryPoints.push("①관세 → 에너지·방산 10~15% 헤지")
  summaryPoints.push("②AI CAPEX → 인프라주 5회 분할 매수")
  if (btc) summaryPoints.push(`③코인 → BTC 3% 이내, 상관 0.5↑ 시 축소`)
  summaryPoints.push(`${btc ? "④" : "③"}한국 → HBM 선별 10~15%, PBR 기준 룰`)

  add("moderator", "사회자",
    `오늘의 액션 플랜: ${summaryPoints.join(", ")}. 다양한 관점을 참고하되, 자신의 투자 원칙을 지키세요. 내일 또 만나겠습니다! 📊`,
    "opening"
  )

  return msgs
}

// ═══════════════════════════════════════════════════════════════
// 종합 한마디 카드 컴포넌트
// ═══════════════════════════════════════════════════════════════

function SummaryVerdictCard({ verdict }: { verdict: { emoji: string; headline: string; detail: string; tone: string } }) {
  const toneStyles: Record<string, string> = {
    danger: "from-red-950 to-red-900 text-red-50",
    caution: "from-amber-950 to-amber-900 text-amber-50",
    neutral: "from-slate-900 to-slate-800 text-slate-50",
    positive: "from-emerald-950 to-emerald-900 text-emerald-50",
  }
  const bgStyle = toneStyles[verdict.tone] || toneStyles.neutral

  return (
    <Card className="overflow-hidden">
      <div className={`bg-gradient-to-r ${bgStyle} p-5`}>
        <div className="flex items-start gap-3">
          <span className="text-3xl flex-shrink-0 mt-0.5">{verdict.emoji}</span>
          <div className="min-w-0">
            <h3 className="font-bold text-base leading-snug mb-2">{verdict.headline}</h3>
            <p className="text-sm leading-relaxed opacity-90">{verdict.detail}</p>
          </div>
        </div>
      </div>
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════
// 시세 카드 컴포넌트
// ═══════════════════════════════════════════════════════════════

function PriceCard({ data }: { data: MarketQuote }) {
  const isUp = data.changePercent > 0
  const isFlat = Math.abs(data.changePercent) < 0.05
  const sign = isUp ? "+" : ""

  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm font-medium text-foreground truncate mr-3">{data.name}</span>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-sm tabular-nums font-semibold">
          {data.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}
        </span>
        <span className={`text-xs tabular-nums font-bold px-1.5 py-0.5 rounded ${
          isFlat ? "text-gray-500 bg-gray-100" :
          isUp ? "text-red-600 bg-red-50" : "text-blue-600 bg-blue-50"
        }`}>
          {isFlat ? (
            <span className="flex items-center gap-0.5"><Minus className="h-3 w-3" />0.00%</span>
          ) : (
            <span className="flex items-center gap-0.5">
              {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {sign}{data.changePercent.toFixed(2)}%
            </span>
          )}
        </span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 토픽 배지 / 토론 말풍선
// ═══════════════════════════════════════════════════════════════

function TopicBadge({ topic }: { topic?: string }) {
  if (!topic || !TOPIC_CONFIG[topic]) return null
  const c = TOPIC_CONFIG[topic]
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${c.color}`}>
      {c.icon}
      {c.label}
    </span>
  )
}

function DebateBubble({ message, isNew, showTopic }: { message: DebateMessage; isNew: boolean; showTopic: boolean }) {
  const config = {
    bull: {
      bg: "bg-red-50 border-red-200",
      avatar: "bg-gradient-to-br from-red-400 to-orange-400",
      nameColor: "text-red-700",
      icon: <TrendingUp className="h-3.5 w-3.5 text-white" />,
    },
    bear: {
      bg: "bg-blue-50 border-blue-200",
      avatar: "bg-gradient-to-br from-blue-400 to-indigo-500",
      nameColor: "text-blue-700",
      icon: <Shield className="h-3.5 w-3.5 text-white" />,
    },
    moderator: {
      bg: "bg-amber-50/80 border-amber-200",
      avatar: "bg-gradient-to-br from-amber-400 to-yellow-500",
      nameColor: "text-amber-700",
      icon: <MessageCircle className="h-3.5 w-3.5 text-white" />,
    },
  }
  const c = config[message.speaker]

  if (message.speaker === "moderator") {
    return (
      <div className={`flex flex-col items-center gap-2 ${isNew ? "animate-in fade-in slide-in-from-bottom-2 duration-500" : ""}`}>
        {showTopic && <TopicBadge topic={message.topic} />}
        <div className={`w-full rounded-xl border p-3.5 ${c.bg}`}>
          <div className="flex items-center gap-2 mb-1.5">
            <div className={`w-6 h-6 rounded-full ${c.avatar} flex items-center justify-center flex-shrink-0`}>{c.icon}</div>
            <span className={`text-xs font-bold ${c.nameColor}`}>{message.name}</span>
          </div>
          <p className="text-sm text-foreground/80 leading-relaxed">{message.text}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col items-start gap-2 ${isNew ? "animate-in fade-in slide-in-from-bottom-2 duration-500" : ""}`}>
      <div className="flex items-start gap-2.5 w-full">
        <div className={`w-8 h-8 rounded-full ${c.avatar} flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm`}>{c.icon}</div>
        <div className="flex-1 min-w-0">
          <span className={`text-xs font-bold ${c.nameColor} mb-1 block`}>{message.name}</span>
          <div className={`rounded-2xl rounded-tl-md border p-3.5 ${c.bg}`}>
            <p className="text-sm text-foreground leading-relaxed">{message.text}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 메인 페이지 컴포넌트
// ═══════════════════════════════════════════════════════════════

export default function DebatePage() {
  const router = useRouter()
  const [marketData, setMarketData] = useState<Record<string, MarketQuote> | null>(null)
  const [stockData, setStockData] = useState<Record<string, MarketQuote> | null>(null)
  const [date, setDate] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [messages, setMessages] = useState<DebateMessage[]>([])
  const [visibleCount, setVisibleCount] = useState(0)
  const [isStreaming, setIsStreaming] = useState(false)
  const [showAllMarkets, setShowAllMarkets] = useState(false)
  const [showStocks, setShowStocks] = useState(false)
  const [showCrypto, setShowCrypto] = useState(false)
  const [summaryVerdict, setSummaryVerdict] = useState<ReturnType<typeof generateSummaryVerdict> | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>("")
  const chatEndRef = useRef<HTMLDivElement>(null)

  // 시세 카드용 시간 라벨 계산
  const getTimeLabels = () => {
    const now = lastUpdated ? new Date(lastUpdated) : new Date()
    const kstHour = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" })).getHours()
    const usMarketClosed = kstHour >= 6 && kstHour < 22
    return {
      us: usMarketClosed ? "전일 마감" : "실시간",
      kr: "당일 마감",
      crypto: "실시간",
      macro: usMarketClosed ? "전일 마감" : "실시간",
      stocks: usMarketClosed ? "전일 마감" : "실시간",
    }
  }
  const timeLabels = getTimeLabels()

  const handleShare = async () => {
    const url = window.location.href
    const title = "AI 시장 토론 - 미주도감"
    if (navigator.share) {
      try { await navigator.share({ title, url }) } catch {}
    } else {
      await navigator.clipboard.writeText(url)
      alert("링크가 복사되었어요!")
    }
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    setMessages([])
    setVisibleCount(0)
    setIsStreaming(false)
    setSummaryVerdict(null)

    try {
      const res = await fetch("/api/debate")
      if (!res.ok) throw new Error("데이터 로딩 실패")
      const data: MarketAPIResponse = await res.json()
      setMarketData(data.marketData)
      setStockData(data.stockData)
      setDate(data.date)
      setLastUpdated(data.lastUpdated || new Date().toISOString())

      // 종합 한마디 생성
      setSummaryVerdict(generateSummaryVerdict(data.marketData, data.stockData || {}))

      // 토론 생성
      const debate = generateDebate(data.marketData, data.stockData || {}, data.date, data.lastUpdated)
      setMessages(debate)
      setIsStreaming(true)
    } catch (err) {
      setError("시장 데이터를 불러오는 중 오류가 발생했어요")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (!isStreaming || visibleCount >= messages.length) {
      if (visibleCount >= messages.length && isStreaming) setIsStreaming(false)
      return
    }
    const timer = setTimeout(() => setVisibleCount(prev => prev + 1), 800 + Math.random() * 600)
    return () => clearTimeout(timer)
  }, [isStreaming, visibleCount, messages.length])

  useEffect(() => {
    if (visibleCount > 2) chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [visibleCount])

// 스크롤 끝까지 도달 시 이벤트
useEffect(() => {
  const handleScroll = () => {
    const scrollHeight = document.documentElement.scrollHeight;
    const scrollTop = document.documentElement.scrollTop;
    const clientHeight = document.documentElement.clientHeight;
    
    if (scrollTop + clientHeight >= scrollHeight - 100) {
      trackDiscussionScrollEnd();
    }
  };
  
  window.addEventListener('scroll', handleScroll);
  return () => window.removeEventListener('scroll', handleScroll);
}, []);

  const usMarkets = ["sp500", "nasdaq", "dow"]
  const krMarkets = ["kospi", "kosdaq", "usdkrw"]
  const macroMarkets = ["vix", "treasury10Y", "dollarIndex", "gold", "oil"]
  const cryptoMarkets = ["btc", "eth", "sol"]
  const keyStockKeys = ["nvda", "googl", "amd", "meta", "amzn", "tsla", "avgo", "smh", "xle", "lmt"]

  const getShowTopic = (idx: number): boolean => {
    if (idx === 0) return true
    const prevTopic = messages[idx - 1]?.topic
    const curTopic = messages[idx]?.topic
    return curTopic !== prevTopic && messages[idx]?.speaker === "moderator"
  }

  if (loading) return <LoadingSkeleton />
  if (error) return <ErrorState error={error} onRetry={fetchData} />
  if (!marketData) return null

  return (
    <div className="min-h-screen bg-background pb-20">
      <HeaderSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-4 py-3">
        <div className="flex items-center gap-2 max-w-2xl mx-auto">
          <Button variant="ghost" size="icon" className="rounded-full flex-shrink-0" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded-full bg-muted/50 border cursor-pointer hover:bg-muted transition-colors" onClick={() => setIsSearchOpen(true)}>
            <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-muted-foreground truncate">종목 검색</span>
          </div>
          <Button variant="ghost" size="icon" className="rounded-full flex-shrink-0" onClick={handleShare}>
            <Share2 className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-amber-500" />
            <h1 className="text-xl font-bold">AI 시장 토론</h1>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={fetchData}>
            <RefreshCw className="h-3.5 w-3.5" />
            새로고침
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{date}</p>

        {/* ★ 종합 한마디 카드 — 상단 고정 */}
        {summaryVerdict && <SummaryVerdictCard verdict={summaryVerdict} />}

        {/* 토론 주제 프리뷰 */}
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(TOPIC_CONFIG).filter(([k]) => k !== "opening").map(([key, cfg]) => (
            <span key={key} className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full ${cfg.color}`}>
              {cfg.icon}
              {cfg.label}
            </span>
          ))}
        </div>

        {/* 시세 요약 */}
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30">
            <h2 className="text-sm font-bold">📈 오늘의 시세</h2>
          </div>
          <div className="px-4 divide-y divide-border/50">
            <div className="py-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-2 block">US Market · {timeLabels.us}</span>
              {usMarkets.map(key => marketData[key] && <PriceCard key={key} data={marketData[key]} />)}
            </div>
            <div className="py-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-2 block">KR Market · {timeLabels.kr}</span>
              {krMarkets.map(key => marketData[key] && <PriceCard key={key} data={marketData[key]} />)}
            </div>
            {showCrypto && (
              <div className="py-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-2 block">Crypto · {timeLabels.crypto}</span>
                {cryptoMarkets.map(key => marketData[key] && <PriceCard key={key} data={marketData[key]} />)}
              </div>
            )}
            {showAllMarkets && (
              <div className="py-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-2 block">Macro · {timeLabels.macro}</span>
                {macroMarkets.map(key => marketData[key] && <PriceCard key={key} data={marketData[key]} />)}
              </div>
            )}
            {showStocks && stockData && (
              <div className="py-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-2 block">Key Stocks · {timeLabels.stocks}</span>
                {keyStockKeys.map(key => stockData[key] && <PriceCard key={key} data={stockData[key]} />)}
              </div>
            )}
          </div>
          <div className="flex border-t divide-x divide-border">
            <button onClick={() => setShowCrypto(!showCrypto)} className="flex-1 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1">
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showCrypto ? "rotate-180" : ""}`} />
              {showCrypto ? "코인 접기" : "코인"}
            </button>
            <button onClick={() => setShowAllMarkets(!showAllMarkets)} className="flex-1 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1">
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAllMarkets ? "rotate-180" : ""}`} />
              {showAllMarkets ? "매크로 접기" : "매크로"}
            </button>
            <button onClick={() => setShowStocks(!showStocks)} className="flex-1 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1">
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showStocks ? "rotate-180" : ""}`} />
              {showStocks ? "종목 접기" : "주요 종목"}
            </button>
          </div>
        </Card>

        {/* 토론 카드 */}
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b bg-gradient-to-r from-red-50 via-amber-50 to-blue-50">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold flex items-center gap-1.5">
                <MessageCircle className="h-4 w-4" />
                오늘의 시장 토론
              </h2>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> 낙관론</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> 신중론</span>
              </div>
            </div>
          </div>
          <div className="p-4 space-y-4">
            {messages.slice(0, visibleCount).map((msg, i) => (
              <DebateBubble key={msg.id} message={msg} isNew={i === visibleCount - 1 && isStreaming} showTopic={getShowTopic(i)} />
            ))}
            {isStreaming && visibleCount < messages.length && (
              <div className="flex items-center gap-2 py-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-xs text-muted-foreground">분석 중...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </Card>

        <p className="text-[11px] text-muted-foreground text-center leading-relaxed pt-2">
          본 토론은 AI가 시장 데이터를 기반으로 생성한 콘텐츠입니다.<br />
          투자 권유가 아니며, 투자 판단의 책임은 본인에게 있습니다.
        </p>
      </main>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 로딩 & 에러 상태
// ═══════════════════════════════════════════════════════════════

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-center gap-2 max-w-2xl mx-auto">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-10 flex-1 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </header>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="relative mb-6">
            <div className="text-5xl animate-pulse">🐂</div>
            <div className="absolute -right-6 top-0 text-3xl animate-pulse" style={{ animationDelay: "400ms" }}>⚡</div>
            <div className="absolute -left-6 top-0 text-3xl animate-pulse" style={{ animationDelay: "200ms" }}>🐻</div>
          </div>
          <h2 className="text-lg font-bold mb-2">시장 데이터를 분석하고 있어요</h2>
          <p className="text-sm text-muted-foreground">AI 분석가들이 7개 주제 토론을 준비하고 있습니다...</p>
          <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
            {["지정학·관세", "기업 실적", "금리·환율", "원자재·에너지", "코인·가상자산", "한국 시장", "투자 전략"].map((t, i) => (
              <span key={t} className="text-[10px] px-2 py-1 rounded-full bg-muted text-muted-foreground animate-pulse" style={{ animationDelay: `${i * 200}ms` }}>
                {t}
              </span>
            ))}
          </div>
          <div className="mt-6 flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-400 animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      </div>
    </div>
  )
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="p-6 text-center max-w-sm">
        <p className="text-4xl mb-4">😢</p>
        <p className="text-lg font-semibold mb-2">오류가 발생했어요</p>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <Button onClick={onRetry}>다시 시도</Button>
      </Card>
    </div>
  )
}
