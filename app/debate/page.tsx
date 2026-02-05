"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Search, Share2, RefreshCw, TrendingUp, TrendingDown, Minus, MessageCircle, Zap, Shield, ChevronDown, Globe, BarChart3, Landmark, Factory, Briefcase, AlertTriangle } from "lucide-react"
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
// AI 토론 생성 — 6개 주제 라운드
// ═══════════════════════════════════════════════════════════════

function generateDebate(
  market: Record<string, MarketQuote>,
  stocks: Record<string, MarketQuote>,
  date: string
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

  const nvda = stocks.nvda
  const googl = stocks.googl
  const amd = stocks.amd
  const meta = stocks.meta
  const amzn = stocks.amzn
  const tsla = stocks.tsla
  const smh = stocks.smh
  const xle = stocks.xle
  const xlu = stocks.xlu
  const xlp = stocks.xlp
  const lmt = stocks.lmt

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

  const msgs: DebateMessage[] = []
  let id = 0
  const add = (speaker: DebateMessage["speaker"], name: string, text: string, topic?: string) => {
    msgs.push({ id: String(++id), speaker, name, text, topic })
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. 오프닝 — 시장 개관
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  add("moderator", "사회자", 
    `${date} 시장 브리핑을 시작합니다. 오늘 S&P 500 ${fmt(sp?.price)} (${pct(sp?.changePercent)}), 나스닥 ${fmt(nasdaq?.price)} (${pct(nasdaq?.changePercent)}), 다우 ${fmt(dow?.price)} (${pct(dow?.changePercent)})로 마감했습니다. 국내 코스피 ${fmt(kospi?.price)} (${pct(kospi?.changePercent)}), 코스닥 ${fmt(kosdaq?.price)} (${pct(kosdaq?.changePercent)})입니다. 오늘은 6가지 핵심 주제를 집중 토론합니다.`,
    "opening"
  )

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. 지정학·관세 리스크
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  add("moderator", "사회자",
    "🌍 첫 번째 주제 — 트럼프 관세와 지정학적 리스크입니다. 최근 미국이 캐나다·멕시코 25%, 중국 추가 10% 관세를 발동했고, 철강·알루미늄 25% 보편관세, 반도체·의약품 25% 관세도 예고된 상황입니다.",
    "geopolitics"
  )

  add("bear", "신중론자 🐻",
    `관세 리스크를 가장 먼저 짚어야 합니다. 트럼프 행정부의 IEEPA 발동은 전례 없는 강도예요. 캐나다·멕시코 25%, 중국 10% 추가에 이어 철강·알루미늄 보편관세, 반도체·의약품에까지 25% 관세가 예고됐습니다. 이건 단순 협상 카드가 아니라 구조적 무역 질서 재편입니다. ${nasdaq && nasdaq.changePercent < -0.3 ? `오늘 나스닥 ${pct(nasdaq.changePercent)} 하락의 상당 부분이 이 불확실성에서 비롯됐다고 봅니다.` : "시장이 아직 관세 충격을 완전히 반영하지 못했을 수 있어요."}`,
    "geopolitics"
  )

  add("bull", "낙관론자 🐂",
    `관세 우려는 인정하지만, 트럼프 1기 때도 마찬가지였습니다. 캐나다·멕시코 관세는 이미 한 달 유예된 전례가 있고, 실제 시행 여부는 협상 진행에 달려 있어요. 시장은 '트럼프 관세 = 협상 지렛대'라는 학습 효과가 있습니다. ${dow && dow.changePercent > 0 ? `다우가 ${pct(dow.changePercent)}로 선방한 것도 시장이 관세를 이미 가격에 반영하고 있다는 증거입니다.` : "과거에도 최악의 관세 시나리오보다 실제는 완화된 결과가 나왔습니다."}`,
    "geopolitics"
  )

  add("bear", "신중론자 🐻",
    `하지만 이번엔 범위가 다릅니다. 반도체와 의약품까지 25% 관세를 예고한 건 처음이에요. 한국·대만·일본 반도체 수출기업에 직격탄이고, 글로벌 공급망 재편 비용이 기업 마진을 압박할 겁니다. 러시아-우크라이나, 중동 긴장까지 겹치면 지정학적 리스크 프리미엄이 더 높아질 수밖에 없습니다.`,
    "geopolitics"
  )

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. 기업 실적 — 빅테크 & 반도체
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  add("moderator", "사회자",
    `📊 두 번째 주제 — 기업 실적입니다. ${googl ? `알파벳(구글)이 ${pct(googl.changePercent)} 움직였고,` : ""} ${amd ? `AMD가 ${pct(amd.changePercent)},` : ""} ${nvda ? `엔비디아가 ${pct(nvda.changePercent)}을 기록했습니다.` : "주요 빅테크 실적 시즌이 한창입니다."} AI 투자 사이클의 지속 가능성이 핵심 쟁점입니다.`,
    "earnings"
  )

  // 구글 실적 분석
  if (googl) {
    if (googl.changePercent < -2) {
      add("bear", "신중론자 🐻",
        `알파벳 실적이 시장 기대에 미치지 못했습니다. ${pct(googl.changePercent)} 하락은 단순 실적 미스가 아니라, AI에 쏟아붓는 천문학적 투자(연간 $900억+ CAPEX)가 정말 수익으로 돌아올지에 대한 의구심을 반영합니다. 클라우드 성장 둔화 시그널이 나온다면 AI 밸류에이션 전체에 재평가 압력이 올 수 있어요.`,
        "earnings"
      )
      add("bull", "낙관론자 🐂",
        `알파벳 하락은 과도한 기대치 때문이지, 실적 자체가 나쁜 건 아닙니다. 매출은 전년 대비 18% 성장했고, EPS도 컨센서스를 상회했어요. CAPEX 확대는 AI 인프라 선점 투자이고, 구글 검색의 AI 통합이 실제 수익으로 전환되고 있습니다. ${nvda && nvda.changePercent > 0 ? `엔비디아가 ${pct(nvda.changePercent)} 상승한 건 AI 투자 수혜가 실재한다는 증거죠.` : "장기 성장 스토리는 여전히 유효합니다."}`,
        "earnings"
      )
    } else if (googl.changePercent > 2) {
      add("bull", "낙관론자 🐂",
        `알파벳이 ${pct(googl.changePercent)}로 강세입니다! AI 투자가 클라우드와 검색 수익으로 전환되고 있다는 증거예요. 시장이 빅테크의 AI 전략에 신뢰를 보내고 있습니다.`,
        "earnings"
      )
    } else {
      add("bull", "낙관론자 🐂",
        `알파벳은 연간 매출 $1,000억 이상을 안정적으로 유지하면서 AI 투자를 확대하고 있어요. 구글 검색의 AI 모드가 75M+ DAU를 확보했고, 유튜브 수익도 견조합니다. 현재 밸류에이션은 성장 대비 합리적 수준이에요.`,
        "earnings"
      )
    }
  }

  // AMD 실적 분석
  if (amd && amd.changePercent < -3) {
    add("bear", "신중론자 🐻",
      `AMD ${pct(amd.changePercent)} 급락은 무시할 수 없는 신호입니다. 실적은 컨센서스를 넘겼지만, AI 가이던스가 시장 기대에 못 미쳤어요. 엔비디아 독주 체제에서 AMD의 AI 칩 경쟁력에 의문이 제기되는 거죠. ${smh ? `반도체 ETF(SMH)도 ${pct(smh.changePercent)}로 약세인데,` : ""} 반도체 업황 회복 낙관론에 제동이 걸렸습니다.`,
      "earnings"
    )
    add("bull", "낙관론자 🐂",
      `AMD 하락은 기대치가 너무 높았던 탓이에요. 데이터센터 매출이 전년 대비 69% 성장했고, 게이밍·PC 사업도 견조합니다. AI 칩 시장 자체가 커지고 있어서 엔비디아와의 경쟁 구도보다 파이 확대에 주목해야 합니다. 과매도 구간에서 매수 기회가 될 수 있어요.`,
      "earnings"
    )
  } else if (amd) {
    add("moderator", "사회자",
      `AMD는 데이터센터 사업 성장이 핵심인데, AI 칩 가이던스에 대한 시장 기대가 매우 높은 상황입니다. ${pct(amd.changePercent)} 움직임이었습니다.`,
      "earnings"
    )
  }

  // 빅테크 CAPEX 논쟁
  add("bear", "신중론자 🐻",
    `빅테크 전체적으로 보면, 메타·마이크로소프트·알파벳의 2025년 누적 CAPEX가 $2,280억을 넘어섭니다. 전년 대비 55% 증가예요. AI 투자 회수 기간이 장기화되면 잉여현금흐름 악화→밸류에이션 재평가가 불가피합니다. 지금 S&P 500 PER이 22배로 코로나 유동성 장세 수준이에요.`,
    "earnings"
  )

  add("bull", "낙관론자 🐂",
    `CAPEX 우려는 매번 나오지만, 빅테크 캐시플로우가 투자를 충분히 소화하고 있습니다. 알파벳만 봐도 분기 순이익 $340억에 달해요. AI 인프라는 향후 10년의 성장 엔진이고, 지금 투자하지 않으면 경쟁에서 뒤처집니다. ${nvda && nvda.changePercent > 0 ? `엔비디아 ${pct(nvda.changePercent)} 상승이 AI 수요가 실재함을 보여주고 있어요.` : "실제 AI 수요 지표는 견고합니다."}`,
    "earnings"
  )

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4. 금리·환율·달러
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  add("moderator", "사회자",
    `🏛️ 세 번째 주제 — 금리와 환율입니다. ${t10 ? `10년물 금리 ${t10.price.toFixed(2)}% (${pct(t10.changePercent)}),` : ""} ${dollar ? `달러 인덱스 ${fmt(dollar.price, 1)} (${pct(dollar.changePercent)}),` : ""} ${krw ? `원/달러 환율 ${fmt(krw.price, 0)}원 (${pct(krw.changePercent)})입니다.` : ""}`,
    "macro"
  )

  if (t10) {
    add("bear", "신중론자 🐻",
      `금리 환경이 여전히 긴축적입니다. 10년물 ${t10.price.toFixed(2)}%는 ${t10.price > 4.5 ? "4.5% 위에서 고착되고 있어 주식 밸류에이션에 심각한 부담입니다." : "높은 수준을 유지하며 연준의 금리 인하 기대를 제한하고 있어요."} 관세 부과에 따른 인플레이션 재가속 우려까지 있어서, 연준이 올해 금리 인하를 2회 이상 할 수 있을지 불투명합니다. ${dollarStrong ? `달러 강세(인덱스 ${fmt(dollar?.price, 1)})가 이머징 마켓 자금 유출을 가속화하고 있어요.` : ""}`,
      "macro"
    )
    add("bull", "낙관론자 🐂",
      `${t10.changePercent < 0 ? `오늘 금리가 하락세를 보인 건 긍정적 시그널입니다. 재무부가 국채 발행 규모를 유지하기로 해 수급 우려가 완화됐어요.` : "금리가 높긴 하지만 시장은 이미 적응하고 있습니다."} 핵심은 연준의 방향성인데, 고용 시장 둔화 시그널이 나오면 하반기 금리 인하 가능성이 높아집니다. ${krw ? `원/달러 ${fmt(krw.price, 0)}원은 한국 수출기업의 가격 경쟁력을 높여주는 측면도 있어요.` : ""}`,
      "macro"
    )
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 5. 원자재·에너지·섹터 로테이션
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  add("moderator", "사회자",
    `⛽ 네 번째 주제 — 원자재와 에너지입니다. ${gold ? `금 $${fmt(gold.price)} (${pct(gold.changePercent)}),` : ""} ${oil ? `WTI $${fmt(oil.price)} (${pct(oil.changePercent)})입니다.` : ""} ${defenseStrong ? " 방어주와 에너지 섹터의 상대적 강세도 주목됩니다." : ""}`,
    "commodity"
  )

  if (goldUp) {
    add("bear", "신중론자 🐻",
      `금 가격 상승(${pct(gold?.changePercent)})은 시장의 공포를 반영합니다. 지정학적 불안, 인플레이션 헤지, 중앙은행의 금 매수 트렌드까지 — 안전자산 수요가 구조적으로 증가하고 있어요. 이건 주식시장의 리스크 프리미엄이 높아졌다는 의미입니다.`,
      "commodity"
    )
  } else if (gold) {
    add("moderator", "사회자",
      `금은 $${fmt(gold.price)}에서 안정세를 보이고 있습니다. 안전자산 수요와 달러 강세가 상충하는 구간이에요.`,
      "commodity"
    )
  }

  if (oilDown) {
    add("bear", "신중론자 🐻",
      `유가 하락(${pct(oil?.changePercent)})은 글로벌 수요 둔화 시그널로 읽어야 합니다. 관세 전쟁이 교역량을 줄이면 에너지 수요도 위축됩니다. 한국처럼 에너지 수입 의존도 높은 나라엔 양날의 검이에요 — 원가는 내려가지만, 수출 둔화가 더 큰 문제죠.`,
      "commodity"
    )
    add("bull", "낙관론자 🐂",
      `유가 하락은 기업과 소비자에게 긍정적입니다. 에너지 비용 하락→소비 여력 증가→경기 지지 효과가 있어요. 과도한 경기 침체 우려보다 실질 소비 데이터를 봐야 합니다.`,
      "commodity"
    )
  } else if (oilUp) {
    add("bull", "낙관론자 🐂",
      `유가 상승(${pct(oil?.changePercent)})은 글로벌 수요가 살아있다는 반증입니다. ${xle ? `에너지 섹터(XLE)가 ${pct(xle.changePercent)}로 강세인 것도` : "에너지주의 강세도"} 경기 침체 시나리오가 과장됐음을 시사해요.`,
      "commodity"
    )
    add("bear", "신중론자 🐻",
      `유가 상승이 인플레이션 재가속으로 이어질 수 있다는 점도 고려해야 합니다. 연준의 금리 인하 여지를 더 좁히는 요인이에요.`,
      "commodity"
    )
  }

  // 섹터 로테이션
  if (defenseStrong) {
    add("moderator", "사회자",
      `${xle ? `에너지 섹터 ${pct(xle.changePercent)},` : ""} ${xlu ? `유틸리티 ${pct(xlu.changePercent)},` : ""} ${lmt ? `록히드마틴 ${pct(lmt.changePercent)}` : ""} — 방어주와 가치주로의 섹터 로테이션 신호가 보입니다. ${dow && dow.changePercent > (nasdaq?.changePercent ?? 0) ? "다우가 나스닥 대비 선방한 것도 같은 맥락이에요." : ""}`,
      "commodity"
    )
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 6. 한국 시장 특화 분석
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  add("moderator", "사회자",
    `🇰🇷 다섯 번째 주제 — 한국 시장입니다. ${kospi ? `코스피 ${fmt(kospi.price)} (${pct(kospi.changePercent)}),` : ""} ${kosdaq ? `코스닥 ${fmt(kosdaq.price)} (${pct(kosdaq.changePercent)})입니다.` : ""} ${krw ? `원/달러 환율 ${fmt(krw.price, 0)}원.` : ""} 외국인 순매도와 정치적 불안정도 변수입니다.`,
    "korea"
  )

  if (krDown) {
    add("bear", "신중론자 🐻",
      `한국 시장이 다중 악재에 시달리고 있습니다. 첫째, ${krw && krwWeak ? `원/달러 ${fmt(krw.price, 0)}원대의 원화 약세가 외국인 투자 심리를 크게 위축시키고 있어요. 1,450원 돌파 시 추가 이탈 가속 가능성이 큽니다.` : "달러 강세에 따른 외국인 순매도 압력이 큽니다."} 둘째, 반도체 관세 25% 예고는 삼성·SK에 직격탄이에요. 셋째, 정치 불안정이 기업 지배구조 개선에 대한 기대를 후퇴시키면서 코리아 디스카운트를 심화시키고 있습니다.`,
      "korea"
    )
    add("bull", "낙관론자 🐂",
      `한국 시장의 단기 상황은 어렵지만, 밸류에이션 매력이 매우 큽니다. ${kospi ? `코스피 ${fmt(kospi.price)}은 PBR 0.9배 수준으로 역사적 하단에 가까워요.` : ""} 한국은 글로벌 AI 투자 사이클의 핵심 공급자입니다 — HBM, 파운드리, 장비 모두 한국이 빠질 수 없어요. ${krw && krwWeak ? "환율이 높을수록 수출기업 원화 환산 실적은 오히려 좋아집니다." : ""} 저PER 가치주 중심으로 선별적 접근이 유효합니다.`,
      "korea"
    )
  } else {
    add("bull", "낙관론자 🐂",
      `한국 시장은 글로벌 AI 사이클의 핵심 축입니다. HBM 메모리, 파운드리, 반도체 장비 — 미국 빅테크의 CAPEX 확대가 결국 한국 기업 매출로 이어져요. ${kospi ? `코스피 ${fmt(kospi.price)} 수준에서` : ""} PBR 기준 저평가 매력이 분명합니다.`,
      "korea"
    )
    add("bear", "신중론자 🐻",
      `코리아 디스카운트의 근본 원인인 지배구조 문제와 지정학적 리스크(북한, 한중 관계)는 여전합니다. ${krw ? `원/달러 ${fmt(krw.price, 0)}원대 환율도 외국인 투자자에겐 환차손 리스크예요.` : ""} 반도체 관세 리스크까지 반영하면 보수적 접근이 필요합니다.`,
      "korea"
    )
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 7. 투자 전략 제안
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  add("moderator", "사회자",
    "💼 마지막 주제 — 투자 전략입니다. 오늘 논의를 종합해서 각자의 전략을 제안해 주세요.",
    "strategy"
  )

  if (veryHighVix) {
    add("bear", "신중론자 🐻",
      `VIX ${fmt(vix?.price, 1)}은 극도의 불안 구간입니다. 현금 비중 50% 이상 유지, 나머지는 금 ETF(GLD), 단기 국채(SHY), 배당주(XLU, XLP) 중심으로 방어하세요. 관세 불확실성이 해소될 때까지 공격적 매수는 위험합니다. 분할 매수도 3개월 이상 간격을 두고 천천히.`,
      "strategy"
    )
    add("bull", "낙관론자 🐂",
      `공포가 극대일 때가 역사적 최고의 매수 타이밍이었습니다. VIX 30+ 이후 12개월 평균 수익률은 +20%가 넘어요. 다만 한 번에 올인은 금물 — 5회 분할 매수로 접근하되, 실적이 검증된 빅테크와 AI 인프라주 위주로. 방산(LMT)과 에너지(XLE)도 지정학 헤지로 일부 편입하세요.`,
      "strategy"
    )
  } else if (highVix) {
    add("bull", "낙관론자 🐂",
      `변동성이 높아진 만큼 기회도 커졌습니다. 추천 전략: ①AI 수혜주(NVDA, AVGO) 분할 매수, ②관세 내성이 강한 미국 내수주(서비스, 헬스케어), ③에너지·방산으로 분산. 한국은 저PER 가치주와 HBM 관련주 선별 매수. 현금 20% 유지로 추가 하락에 대비.`,
      "strategy"
    )
    add("bear", "신중론자 🐻",
      `현금 30-40% 유지가 핵심입니다. ①금 ETF(GLD)로 인플레·지정학 헤지, ②배당주(유틸리티, 필수소비재)로 하방 방어, ③채권(7~10년물) 비중 확대. 관세·금리·실적 세 가지 불확실성이 모두 해소될 때까지 공격 비중을 줄이세요. 미주도감에서 올그린 종목을 체크하면서 진짜 우량주만 관찰 리스트에 넣으세요.`,
      "strategy"
    )
  } else {
    add("bull", "낙관론자 🐂",
      `비교적 안정적 환경에서 성장주에 집중할 때입니다. ①AI 인프라 핵심(NVDA, AVGO, 데이터센터 전력), ②빅테크 실적 개선주, ③한국 반도체·HBM 관련주. 다만 관세 리스크에 대비해 에너지(XLE), 방산(LMT)으로 10~15% 분산하고, 미주도감 올그린 종목도 체크해보세요!`,
      "strategy"
    )
    add("bear", "신중론자 🐻",
      `변동성이 낮을 때 리스크 관리를 준비하는 게 현명합니다. ①과도한 밸류에이션(PER 30배+) 종목은 일부 차익실현, ②섹터 분산(기술 비중 40% 이하), ③금·채권 비중 15~20% 확보. 트럼프 관세 확대와 금리 변동 시나리오별 포트폴리오 스트레스 테스트도 해두세요.`,
      "strategy"
    )
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 마무리
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  add("moderator", "사회자",
    `깊이 있는 토론이었습니다. 오늘의 핵심: ①관세 불확실성이 시장의 최대 변수, ②빅테크 실적은 AI CAPEX 회수 가능성이 쟁점, ③한국은 환율·정치·관세 삼중고 속 밸류에이션 매력. 다양한 관점을 참고하되, 자신의 투자 원칙을 지키세요. 내일 또 만나겠습니다! 📊`,
    "opening"
  )

  return msgs
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
// 토픽 배지 컴포넌트
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

// ═══════════════════════════════════════════════════════════════
// 토론 말풍선 컴포넌트
// ═══════════════════════════════════════════════════════════════

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
            <div className={`w-6 h-6 rounded-full ${c.avatar} flex items-center justify-center flex-shrink-0`}>
              {c.icon}
            </div>
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
        <div className={`w-8 h-8 rounded-full ${c.avatar} flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm`}>
          {c.icon}
        </div>
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
  const chatEndRef = useRef<HTMLDivElement>(null)

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

    try {
      const res = await fetch("/api/debate")
      if (!res.ok) throw new Error("데이터 로딩 실패")
      const data: MarketAPIResponse = await res.json()
      setMarketData(data.marketData)
      setStockData(data.stockData)
      setDate(data.date)

      const debate = generateDebate(data.marketData, data.stockData || {}, data.date)
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

  // 스트리밍 효과
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

  // 시세 카테고리
  const usMarkets = ["sp500", "nasdaq", "dow"]
  const krMarkets = ["kospi", "kosdaq", "usdkrw"]
  const macroMarkets = ["vix", "treasury10Y", "dollarIndex", "gold", "oil"]
  const keyStockKeys = ["nvda", "googl", "amd", "meta", "amzn", "tsla", "avgo", "smh", "xle", "lmt"]

  // 토픽 전환 감지 (배지 표시용)
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

      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-4 py-3">
        <div className="flex items-center gap-2 max-w-2xl mx-auto">
          <Button variant="ghost" size="icon" className="rounded-full flex-shrink-0" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div
            className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded-full bg-muted/50 border cursor-pointer hover:bg-muted transition-colors"
            onClick={() => setIsSearchOpen(true)}
          >
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
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-2 block">US Market</span>
              {usMarkets.map(key => marketData[key] && <PriceCard key={key} data={marketData[key]} />)}
            </div>
            <div className="py-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-2 block">KR Market</span>
              {krMarkets.map(key => marketData[key] && <PriceCard key={key} data={marketData[key]} />)}
            </div>
            {showAllMarkets && (
              <div className="py-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-2 block">Macro</span>
                {macroMarkets.map(key => marketData[key] && <PriceCard key={key} data={marketData[key]} />)}
              </div>
            )}
            {showStocks && stockData && (
              <div className="py-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-2 block">Key Stocks</span>
                {keyStockKeys.map(key => stockData[key] && <PriceCard key={key} data={stockData[key]} />)}
              </div>
            )}
          </div>

          <div className="flex border-t divide-x divide-border">
            <button
              onClick={() => setShowAllMarkets(!showAllMarkets)}
              className="flex-1 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAllMarkets ? "rotate-180" : ""}`} />
              {showAllMarkets ? "매크로 접기" : "매크로 지표"}
            </button>
            <button
              onClick={() => setShowStocks(!showStocks)}
              className="flex-1 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
            >
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
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-400" /> 낙관론
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-400" /> 신중론
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {messages.slice(0, visibleCount).map((msg, i) => (
              <DebateBubble
                key={msg.id}
                message={msg}
                isNew={i === visibleCount - 1 && isStreaming}
                showTopic={getShowTopic(i)}
              />
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

        {/* 면책 조항 */}
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
          <p className="text-sm text-muted-foreground">AI 분석가들이 6개 주제 토론을 준비하고 있습니다...</p>
          <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
            {["지정학·관세", "기업 실적", "금리·환율", "원자재·에너지", "한국 시장", "투자 전략"].map((t, i) => (
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
