"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Search, Share2, RefreshCw, TrendingUp, TrendingDown, Minus, MessageCircle, Zap, Shield, ChevronDown, Globe, BarChart3, Landmark, Factory, Briefcase, AlertTriangle, Bitcoin } from "lucide-react"
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

  // ━━━━━━━━━ 2. 지정학·관세 ━━━━━━━━━

  add("moderator", "사회자",
    "🌍 첫 번째 주제 — 트럼프 관세와 지정학적 리스크입니다. 캐나다·멕시코 25%, 중국 추가 10%, 반도체·의약품 25% 관세 예고까지 — 시장의 최대 변수입니다.",
    "geopolitics"
  )

  add("bear", "신중론자 🐻",
    `관세 리스크를 최우선으로 봐야 합니다. IEEPA 발동은 전례 없는 강도예요. 캐나다·멕시코 25%에 이어 반도체·의약품 25% 관세까지 예고됐는데, 이건 글로벌 공급망의 구조적 재편을 의미합니다. ${nasdaq && nasdaq.changePercent < -0.3 ? `나스닥 ${pct(nasdaq.changePercent)} 하락의 상당 부분이 이 불확실성 때문이에요.` : "시장이 관세 충격을 아직 완전 반영 못했을 수 있습니다."} 러시아-우크라이나, 중동 긴장까지 겹치면 리스크 프리미엄이 더 올라갑니다.`,
    "geopolitics"
  )

  add("bull", "낙관론자 🐂",
    `관세 우려는 인정하지만, 트럼프 1기 학습효과가 있습니다. 캐나다·멕시코 관세는 이미 유예된 전례가 있고, '관세 = 협상 지렛대'라는 패턴이 반복되고 있어요. ${dow && dow.changePercent > (nasdaq?.changePercent ?? 0) ? `다우가 나스닥 대비 선방한 건 시장이 이미 적응 중이라는 증거입니다.` : "과거에도 최악 시나리오보다 완화된 결과가 나왔어요."} 핵심은 관세가 실제 시행되느냐 여부입니다.`,
    "geopolitics"
  )

  add("bear", "신중론자 🐻",
    `이번엔 범위가 다릅니다. 반도체·의약품 25%는 처음이에요. 한국·대만·일본 반도체 기업에 직격탄이고, 글로벌 공급망 재편 비용이 기업 마진을 압박할 겁니다. '협상용'이라 해도 불확실성 자체가 기업 투자 결정을 지연시키는 실질적 피해입니다.`,
    "geopolitics"
  )

  // ━━━━━━━━━ 3. 기업 실적 ━━━━━━━━━

  add("moderator", "사회자",
    `📊 두 번째 주제 — 기업 실적입니다 (${usTimeLabel}). ${googl ? `알파벳 ${pct(googl.changePercent)},` : ""} ${amd ? `AMD ${pct(amd.changePercent)},` : ""} ${nvda ? `엔비디아 ${pct(nvda.changePercent)}.` : ""} AI 투자 사이클의 지속 가능성이 쟁점입니다.`,
    "earnings"
  )

  if (googl && googl.changePercent < -2) {
    add("bear", "신중론자 🐻",
      `알파벳 ${pct(googl.changePercent)} 하락이 중요한 시그널입니다. 연간 $900억+ CAPEX를 AI에 쏟아붓는데, 클라우드 성장이 기대에 못 미치면 AI 밸류에이션 전체에 재평가 압력이 옵니다. 빅테크 2025년 누적 CAPEX $2,280억 — 이게 정말 수익으로 돌아올까요?`,
      "earnings"
    )
    add("bull", "낙관론자 🐂",
      `알파벳 하락은 과도한 기대치 탓이지 실적 자체가 나쁜 건 아닙니다. 매출 전년비 18% 성장, EPS 컨센서스 상회. AI 검색이 75M+ DAU 확보했고, CAPEX는 10년 성장 엔진 투자예요. ${nvda && nvda.changePercent > 0 ? `엔비디아 ${pct(nvda.changePercent)} 상승이 AI 수요 실재를 증명합니다.` : ""}`,
      "earnings"
    )
  } else if (googl && googl.changePercent > 2) {
    add("bull", "낙관론자 🐂",
      `알파벳 ${pct(googl.changePercent)} 강세! AI 투자가 클라우드·검색 수익으로 전환되는 증거예요. 빅테크의 AI 전략에 시장이 신뢰를 보내고 있습니다.`,
      "earnings"
    )
  } else {
    add("bull", "낙관론자 🐂",
      `빅테크 실적은 AI 투자 수익 전환이 핵심 관전 포인트입니다. 구글 AI 검색 75M+ DAU, 유튜브 견조. 엔비디아 CAPEX 수혜는 실적으로 확인되고 있어요.`,
      "earnings"
    )
  }

  if (amd && amd.changePercent < -3) {
    add("bear", "신중론자 🐻",
      `AMD ${pct(amd.changePercent)} 급락은 경고등입니다. AI 가이던스가 기대 미달 — 엔비디아 독주 체제에서 AMD의 경쟁력에 의문이 제기됐어요. ${smh ? `반도체 ETF(SMH)도 ${pct(smh.changePercent)}.` : ""} 반도체 업황 회복 낙관론에 제동입니다.`,
      "earnings"
    )
    add("bull", "낙관론자 🐂",
      `AMD 하락은 기대치가 너무 높았던 탓입니다. 데이터센터 매출 전년비 69% 성장, 게이밍·PC 견조. AI 칩 시장 파이 자체가 커지고 있어 과매도 구간에서 매수 기회일 수 있어요.`,
      "earnings"
    )
  }

  add("bear", "신중론자 🐻",
    `빅테크 CAPEX 논쟁의 핵심 — 메타·마이크로소프트·알파벳 2025년 누적 $2,280억+, 전년비 55% 증가. AI 투자 회수 장기화 시 잉여현금흐름 악화→밸류에이션 재평가 불가피. S&P 500 PER 22배는 코로나 유동성 장세 수준이에요.`,
    "earnings"
  )

  add("bull", "낙관론자 🐂",
    `CAPEX 우려는 매번 나오지만 빅테크 캐시플로우가 충분히 소화합니다. 알파벳 분기 순이익 $340억. AI 인프라는 10년 성장 엔진이고, 지금 안 하면 경쟁에서 탈락해요. HBM 가격 +80% 상승이 공급 병목과 실수요를 동시에 증명합니다.`,
    "earnings"
  )

  // ━━━━━━━━━ 4. 금리·환율 ━━━━━━━━━

  add("moderator", "사회자",
    `🏛️ 세 번째 주제 — 금리와 환율. ${t10 ? `10년물 ${t10.price.toFixed(2)}% (${pct(t10.changePercent)}),` : ""} ${dollar ? `달러 인덱스 ${fmt(dollar.price, 1)} (${pct(dollar.changePercent)})은 ${usTimeLabel},` : ""} ${krw ? `원/달러 ${fmt(krw.price, 0)}원 (${pct(krw.changePercent)})은 ${krTimeLabel}.` : ""}`,
    "macro"
  )

  if (t10) {
    add("bear", "신중론자 🐻",
      `금리 환경이 긴축적입니다. 10년물 ${t10.price.toFixed(2)}%는 ${t10.price > 4.5 ? "4.5% 위에서 고착 — 주식 밸류에이션에 심각한 부담." : "높은 수준 유지 중."} 관세에 따른 인플레이션 재가속 우려로 연준 금리인하가 올해 2회 가능할지 불투명합니다. ${dollarStrong ? `달러 강세(${fmt(dollar?.price, 1)})가 이머징 자금 유출을 가속화하고,` : ""} ${krwWeak ? `원/달러 ${fmt(krw?.price, 0)}원대는 한국 시장에 추가 부담이에요.` : ""}`,
      "macro"
    )
    add("bull", "낙관론자 🐂",
      `${t10.changePercent < 0 ? "오늘 금리 하락은 긍정 시그널 —" : "금리가 높지만"} 시장은 이미 적응 중입니다. 고용 둔화 시그널이 나오면 하반기 금리인하 가능성이 높아져요. ${krw ? `원/달러 ${fmt(krw.price, 0)}원은 수출기업 원화환산 실적에 오히려 긍정적인 면도 있습니다.` : ""} 관세 인플레 우려는 일시적일 가능성이 높아요.`,
      "macro"
    )
  }

  // ━━━━━━━━━ 5. 원자재·에너지 ━━━━━━━━━

  add("moderator", "사회자",
    `⛽ 네 번째 주제 — 원자재·에너지 (${usTimeLabel}). ${gold ? `금 $${fmt(gold.price)} (${pct(gold.changePercent)}),` : ""} ${oil ? `WTI $${fmt(oil.price)} (${pct(oil.changePercent)}).` : ""} ${defenseStrong ? " 방어주·에너지 섹터 상대 강세 주목." : ""}`,
    "commodity"
  )

  if (goldUp) {
    add("bear", "신중론자 🐻",
      `금 상승(${pct(gold?.changePercent)})은 안전자산 선호 심리 확대 — 지정학 불안, 인플레 헤지, 중앙은행 금 매수 트렌드. 리스크 프리미엄 상승의 증거입니다.`,
      "commodity"
    )
  }

  if (oilDown) {
    add("bear", "신중론자 🐻",
      `유가 하락(${pct(oil?.changePercent)})은 글로벌 수요 둔화 시그널. 관세가 교역량을 줄이면 에너지 수요도 위축됩니다.`,
      "commodity"
    )
    add("bull", "낙관론자 🐂",
      `유가 하락은 기업·소비자에게 긍정적 — 에너지 비용↓ → 소비 여력↑ → 경기 지지. 과도한 침체 우려보다 실질 소비 데이터를 봐야 합니다.`,
      "commodity"
    )
  } else if (oilUp) {
    add("bull", "낙관론자 🐂",
      `유가 상승(${pct(oil?.changePercent)})은 글로벌 수요가 살아있다는 반증. ${xle ? `에너지 섹터(XLE) ${pct(xle.changePercent)} 강세도` : "에너지주 강세도"} 경기침체 시나리오가 과장됐음을 시사해요.`,
      "commodity"
    )
  }

  if (defenseStrong) {
    add("moderator", "사회자",
      `${xle ? `에너지 ${pct(xle.changePercent)},` : ""} ${xlu ? `유틸리티 ${pct(xlu.changePercent)},` : ""} ${lmt ? `록히드마틴 ${pct(lmt.changePercent)}` : ""} — 방어주·가치주 로테이션 신호. ${dow && dow.changePercent > (nasdaq?.changePercent ?? 0) ? "다우 > 나스닥 선방도 같은 맥락." : ""}`,
      "commodity"
    )
  }

  // ━━━━━━━━━ 6. 코인·가상자산 (NEW) ━━━━━━━━━

  add("moderator", "사회자",
    `₿ 다섯 번째 주제 — 코인과 가상자산입니다 (${cryptoTimeLabel}). ${btc ? `비트코인 $${fmt(btc.price, 0)} (${pct(btc.changePercent)}),` : ""} ${eth ? `이더리움 $${fmt(eth.price, 0)} (${pct(eth.changePercent)}),` : ""} ${sol ? `솔라나 $${fmt(sol.price, 1)} (${pct(sol.changePercent)}).` : ""} 주식 시장과의 상관관계가 핵심 쟁점입니다.`,
    "crypto"
  )

  if (cryptoCorrelated) {
    // 미국주식 & 코인 동반 하락
    add("bear", "신중론자 🐻",
      `오늘 비트코인 ${pct(btc?.changePercent)}로 주식과 동반 하락 — 이게 핵심입니다. ETF 기관자금 유입 이후 비트코인-나스닥 상관계수가 0.4~0.6으로 높아졌어요. '디지털 금' 역할은 약화됐고, 위험자산 회피 시 함께 빠집니다. 분산 효과를 기대하고 코인을 편입하면 오히려 하방 리스크가 증폭돼요.`,
      "crypto"
    )
    add("bull", "낙관론자 🐂",
      `동반 하락은 단기 상관이지 구조적 관계가 아닙니다. 비트코인-S&P 상관계수는 -0.3~0.6까지 변동폭이 크고, 금리인하 사이클 진입 시 상관이 낮아지는 패턴이 있어요. ${btc ? `$${fmt(btc.price, 0)} 수준은` : "현재 가격대는"} 장기 CAGR 200%(5년) 관점에서 여전히 매력적. 다만 포트폴리오 5~10% 이내로 비중 조절이 핵심입니다.`,
      "crypto"
    )
  } else if (btcDown) {
    // 코인만 약세
    add("bear", "신중론자 🐻",
      `비트코인 ${pct(btc?.changePercent)} 하락 — 관세 불확실성과 달러 강세가 위험자산 전반을 압박하고 있어요. 코인 시장 거래량 감소 추세도 경고 신호입니다. 변동성이 주식의 2배인 자산을 굳이 편입할 이유가 있을까요?`,
      "crypto"
    )
    add("bull", "낙관론자 🐂",
      `조정은 건강한 시장에서 나타나는 현상입니다. ${btc ? `비트코인 $${fmt(btc.price, 0)}은` : "현재 가격은"} 트럼프 정부의 친코인 정책(비트코인 전략적 비축, 규제 완화)이라는 구조적 호재가 있어요. ${sol ? `솔라나 등 AI+블록체인 융합 테마도 장기 성장성이 있습니다.` : ""} 공포에 매도하면 기회를 놓칩니다.`,
      "crypto"
    )
  } else if (btcUp) {
    // 코인 강세
    add("bull", "낙관론자 🐂",
      `비트코인 ${pct(btc?.changePercent)} 상승! ${eth ? `이더리움도 ${pct(eth.changePercent)}로 동반 강세.` : ""} ETF 자금 유입이 지속되고, 트럼프 정부의 친코인 정책이 장기 지지선을 높이고 있어요. 포트폴리오에 5~10% 비중으로 위험자산 노출을 늘릴 시점입니다.`,
      "crypto"
    )
    add("bear", "신중론자 🐻",
      `코인 랠리에 과도하게 올라탈 필요는 없습니다. 주식 대비 변동성 2배 — 상승할 때 좋아 보이지만 하락 시 4~5% 급락이 일상입니다. 한국 투자자라면 코인보다 저평가된 코스피 가치주가 더 효율적인 선택일 수 있어요.`,
      "crypto"
    )
  } else {
    // 코인 보합
    add("bull", "낙관론자 🐂",
      `코인 시장은 비교적 안정적 흐름입니다. ${btc ? `비트코인 $${fmt(btc.price, 0)}은` : ""} 기관 ETF 유입과 트럼프 친코인 정책으로 하방이 지지되고 있어요. 장기 관점에서 포트폴리오 5% 내외 편입은 합리적입니다.`,
      "crypto"
    )
    add("bear", "신중론자 🐻",
      `안정적으로 보이지만, 주식-코인 상관성이 높아진 지금 분산 효과는 제한적입니다. 같은 리스크를 2배 변동성으로 감수하는 셈이에요. 주식 포트가 이미 성장주 중심이라면 코인 비중은 최소화하고, 오히려 금이나 채권으로 진짜 분산을 추구하세요.`,
      "crypto"
    )
  }

  // ━━━━━━━━━ 7. 한국 시장 ━━━━━━━━━

  add("moderator", "사회자",
    `🇰🇷 여섯 번째 주제 — 한국 시장 (${krTimeLabel}). ${kospi ? `코스피 ${fmt(kospi.price)} (${pct(kospi.changePercent)}),` : ""} ${kosdaq ? `코스닥 ${fmt(kosdaq.price)} (${pct(kosdaq.changePercent)}).` : ""} ${krw ? `원/달러 ${fmt(krw.price, 0)}원.` : ""} 외국인 매도·정치 불안정·반도체 관세가 변수입니다.`,
    "korea"
  )

  if (krDown) {
    add("bear", "신중론자 🐻",
      `한국이 다중 악재에 시달리고 있습니다. ${krwWeak ? `①원/달러 ${fmt(krw?.price, 0)}원대 원화 약세로 외국인 이탈 가속(순매도 1조+ 예상),` : "①외국인 순매도 압력,"} ②반도체 관세 25% 예고는 삼성·SK 직격탄, ③정치 불안정이 지배구조 개선 기대를 후퇴시키며 코리아 디스카운트 심화. 악재의 삼중고입니다.`,
      "korea"
    )
    add("bull", "낙관론자 🐂",
      `단기 상황은 어렵지만 밸류에이션이 매우 매력적입니다. ${kospi ? `코스피 ${fmt(kospi.price)}은 PBR 0.9배, 역사적 하단.` : ""} 한국은 AI 투자 사이클의 핵심 공급자 — HBM, 파운드리, 장비 모두 한국이 빠질 수 없어요. ${krwWeak ? "환율이 높을수록 수출 실적은 오히려 개선됩니다." : ""} 저PER 가치주 선별 매수 유효.`,
      "korea"
    )
  } else {
    add("bull", "낙관론자 🐂",
      `한국은 AI 사이클의 핵심 축입니다. HBM, 파운드리 — 빅테크 CAPEX 확대가 한국 기업 매출로 이어져요. ${kospi ? `코스피 ${fmt(kospi.price)}` : "현재 수준에서"} PBR 기준 저평가 매력 분명.`,
      "korea"
    )
    add("bear", "신중론자 🐻",
      `코리아 디스카운트 근본 원인(지배구조, 지정학)은 변함없습니다. ${krw ? `원/달러 ${fmt(krw.price, 0)}원대 환율도 외국인에겐 환차손 리스크.` : ""} 반도체 관세까지 반영하면 보수적 접근 필요.`,
      "korea"
    )
  }

  // ━━━━━━━━━ 8. 투자 전략 ━━━━━━━━━

  add("moderator", "사회자",
    "💼 마지막 주제 — 투자 전략. 오늘 논의를 종합한 각자의 전략을 제안해 주세요.",
    "strategy"
  )

  if (veryHighVix) {
    add("bear", "신중론자 🐻",
      `VIX ${fmt(vix?.price, 1)}은 극도의 불안 구간. ①현금 50%+ 유지, ②금 ETF(GLD)·단기국채(SHY)·배당주(XLU, XLP) 방어, ③관세 불확실성 해소까지 공격적 매수 금지. 코인도 리스크 축소. 분할매수는 3개월 이상 간격으로 천천히.`,
      "strategy"
    )
    add("bull", "낙관론자 🐂",
      `공포 극대가 역사적 최고의 매수 타이밍입니다. VIX 30+ 이후 12개월 평균 수익률 +20%. 5회 분할매수로 ①빅테크·AI 인프라(NVDA, AVGO), ②방산(LMT)·에너지(XLE) 지정학 헤지, ③한국 저PER 가치주. 비트코인은 5% 이내 유지.`,
      "strategy"
    )
  } else if (highVix) {
    add("bull", "낙관론자 🐂",
      `변동성 확대 = 기회 확대. ①AI 수혜주(NVDA, AVGO) 분할매수, ②관세 내성 강한 미국 내수주(서비스·헬스케어), ③에너지·방산 분산. 한국은 저PER 가치주·HBM 관련주. 코인은 비트코인 5% 이내. 현금 20% 유지로 추가 하락 대비.`,
      "strategy"
    )
    add("bear", "신중론자 🐻",
      `현금 30~40% 유지가 핵심. ①금 ETF(GLD) 인플레·지정학 헤지, ②배당주(유틸리티·필수소비재) 하방방어, ③채권(7~10년물) 비중 확대. 관세·금리·실적 세 불확실성 해소까지 공격 비중 축소. 미주도감 올그린 종목 체크하며 진짜 우량주만 관찰.`,
      "strategy"
    )
  } else {
    add("bull", "낙관론자 🐂",
      `안정적 환경에서 성장주 집중. ①AI 인프라(NVDA, AVGO, 데이터센터 전력), ②빅테크 실적개선주, ③한국 반도체·HBM 관련주. 관세 헤지로 에너지(XLE)·방산(LMT) 10~15% 분산. 비트코인 5~10% 편입 고려. 미주도감 올그린 종목도 체크하세요!`,
      "strategy"
    )
    add("bear", "신중론자 🐻",
      `변동성이 낮을 때 리스크 관리 준비. ①PER 30배+ 종목 일부 차익실현, ②섹터 분산(기술 비중 40% 이하), ③금·채권 15~20%. 코인은 변동성 2배이므로 비중 최소화. 트럼프 관세 확대 시나리오별 포트폴리오 스트레스 테스트 해두세요.`,
      "strategy"
    )
  }

  // ━━━━━━━━━ 마무리 ━━━━━━━━━

  // 종합 한마디 (핵심 요약)
  const summaryPoints: string[] = []
  summaryPoints.push("①관세 불확실성이 시장의 최대 변수")
  summaryPoints.push("②빅테크 AI CAPEX 회수 가능성이 실적 쟁점")
  if (btc) summaryPoints.push(`③비트코인 $${fmt(btc.price, 0)} — 주식 상관↑로 분산효과 제한적`)
  summaryPoints.push(`${btc ? "④" : "③"}한국은 환율·정치·관세 삼중고 속 밸류에이션 매력`)

  add("moderator", "사회자",
    `오늘의 핵심 요약: ${summaryPoints.join(", ")}. 다양한 관점을 참고하되, 자신의 투자 원칙을 지키세요. 내일 또 만나겠습니다! 📊`,
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
