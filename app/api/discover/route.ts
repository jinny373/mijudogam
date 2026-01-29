import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// ═══════════════════════════════════════════════════════════════
// 인기 종목 리스트 (신호등 체크 대상)
// ═══════════════════════════════════════════════════════════════

const POPULAR_STOCKS = [
  // 빅테크
  { ticker: "AAPL", name: "애플", sector: "기술" },
  { ticker: "MSFT", name: "마이크로소프트", sector: "기술" },
  { ticker: "GOOGL", name: "구글", sector: "기술" },
  { ticker: "AMZN", name: "아마존", sector: "기술" },
  { ticker: "META", name: "메타", sector: "기술" },
  { ticker: "NVDA", name: "엔비디아", sector: "반도체" },
  { ticker: "TSLA", name: "테슬라", sector: "자동차" },
  
  // 반도체
  { ticker: "AMD", name: "AMD", sector: "반도체" },
  { ticker: "AVGO", name: "브로드컴", sector: "반도체" },
  { ticker: "QCOM", name: "퀄컴", sector: "반도체" },
  { ticker: "MU", name: "마이크론", sector: "반도체" },
  { ticker: "INTC", name: "인텔", sector: "반도체" },
  { ticker: "TSM", name: "TSMC", sector: "반도체" },
  { ticker: "ASML", name: "ASML", sector: "반도체" },
  
  // AI/소프트웨어
  { ticker: "PLTR", name: "팔란티어", sector: "AI" },
  { ticker: "CRM", name: "세일즈포스", sector: "소프트웨어" },
  { ticker: "ADBE", name: "어도비", sector: "소프트웨어" },
  { ticker: "ORCL", name: "오라클", sector: "소프트웨어" },
  { ticker: "NOW", name: "서비스나우", sector: "소프트웨어" },
  { ticker: "SNOW", name: "스노우플레이크", sector: "소프트웨어" },
  
  // 금융
  { ticker: "V", name: "비자", sector: "금융" },
  { ticker: "MA", name: "마스터카드", sector: "금융" },
  { ticker: "JPM", name: "JP모건", sector: "금융" },
  { ticker: "GS", name: "골드만삭스", sector: "금융" },
  { ticker: "BRK-B", name: "버크셔해서웨이", sector: "금융" },
  
  // 헬스케어
  { ticker: "UNH", name: "유나이티드헬스", sector: "헬스케어" },
  { ticker: "JNJ", name: "존슨앤존슨", sector: "헬스케어" },
  { ticker: "LLY", name: "일라이릴리", sector: "헬스케어" },
  { ticker: "PFE", name: "화이자", sector: "헬스케어" },
  { ticker: "ABBV", name: "애브비", sector: "헬스케어" },
  
  // 소비재
  { ticker: "COST", name: "코스트코", sector: "소비재" },
  { ticker: "WMT", name: "월마트", sector: "소비재" },
  { ticker: "NKE", name: "나이키", sector: "소비재" },
  { ticker: "SBUX", name: "스타벅스", sector: "소비재" },
  { ticker: "MCD", name: "맥도날드", sector: "소비재" },
  { ticker: "HD", name: "홈디포", sector: "소비재" },
  
  // 에너지/유틸리티
  { ticker: "XOM", name: "엑슨모빌", sector: "에너지" },
  { ticker: "CVX", name: "쉐브론", sector: "에너지" },
  { ticker: "NEE", name: "넥스트에라", sector: "유틸리티" },
  
  // 기타 인기
  { ticker: "NFLX", name: "넷플릭스", sector: "미디어" },
  { ticker: "DIS", name: "디즈니", sector: "미디어" },
  { ticker: "COIN", name: "코인베이스", sector: "핀테크" },
  { ticker: "UBER", name: "우버", sector: "플랫폼" },
  { ticker: "ABNB", name: "에어비앤비", sector: "플랫폼" },
  
  // AI 인프라
  { ticker: "VRT", name: "버티브", sector: "인프라" },
  { ticker: "ETN", name: "이튼", sector: "인프라" },
  { ticker: "CEG", name: "컨스털레이션", sector: "에너지" },
];

// ═══════════════════════════════════════════════════════════════
// 신호등 계산 함수 (기존 stock API와 동일한 로직)
// ═══════════════════════════════════════════════════════════════

interface SignalResult {
  earning: "good" | "normal" | "bad";
  debt: "good" | "normal" | "bad";
  growth: "good" | "normal" | "bad";
  valuation: "good" | "normal" | "bad";
}

function getStatus(
  value: number,
  thresholds: { good: number; bad: number },
  higherIsBetter: boolean = true
): "good" | "normal" | "bad" {
  if (higherIsBetter) {
    if (value >= thresholds.good) return "good";
    if (value <= thresholds.bad) return "bad";
    return "normal";
  } else {
    if (value <= thresholds.good) return "good";
    if (value >= thresholds.bad) return "bad";
    return "normal";
  }
}

async function calculateSignals(ticker: string): Promise<SignalResult | null> {
  try {
    const [quote, quoteSummary] = await Promise.all([
      yahooFinance.quote(ticker),
      yahooFinance.quoteSummary(ticker, {
        modules: [
          "financialData",
          "defaultKeyStatistics",
          "incomeStatementHistory",
          "balanceSheetHistoryQuarterly",
        ],
      }),
    ]);

    const financialData = quoteSummary.financialData;
    const keyStats = quoteSummary.defaultKeyStatistics;
    const incomeHistory = quoteSummary.incomeStatementHistory?.incomeStatementHistory || [];

    // 1. 돈 버는 능력 (ROE)
    const roe = (financialData?.returnOnEquity || 0) * 100;
    const earning = getStatus(roe, { good: 15, bad: 5 }, true);

    // 2. 빚 관리 (부채비율)
    const debtToEquity = (financialData?.debtToEquity || 0) / 100;
    let debt: "good" | "normal" | "bad";
    if (debtToEquity <= 0.5) debt = "good";
    else if (debtToEquity >= 2) debt = "bad";
    else debt = "normal";

    // 3. 성장 가능성 (매출 성장률)
    let revenueGrowth = 0;
    if (incomeHistory.length >= 2) {
      const currentRev = incomeHistory[0]?.totalRevenue || 0;
      const previousRev = incomeHistory[1]?.totalRevenue || 0;
      if (previousRev > 0) {
        revenueGrowth = ((currentRev - previousRev) / Math.abs(previousRev)) * 100;
      }
    } else {
      revenueGrowth = (financialData?.revenueGrowth || 0) * 100;
    }
    const growth = getStatus(revenueGrowth, { good: 10, bad: 0 }, true);

    // 4. 현재 몸값 (PER)
    const forwardPE = keyStats?.forwardPE || quote.forwardPE || 0;
    const trailingPE = keyStats?.trailingPE || quote.trailingPE || 0;
    const pe = forwardPE || trailingPE;
    
    let valuation: "good" | "normal" | "bad";
    if (pe <= 0) valuation = "normal"; // 적자 기업
    else if (pe <= 15) valuation = "good";
    else if (pe >= 40) valuation = "bad";
    else valuation = "normal";

    return { earning, debt, growth, valuation };
  } catch (error) {
    console.error(`Signal calculation error for ${ticker}:`, error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// API 핸들러
// ═══════════════════════════════════════════════════════════════

export async function GET() {
  try {
    // 모든 종목의 신호등 계산 (병렬)
    const results = await Promise.all(
      POPULAR_STOCKS.map(async (stock) => {
        const signals = await calculateSignals(stock.ticker);
        return {
          ...stock,
          signals,
        };
      })
    );

    // 유효한 결과만 필터링
    const validResults = results.filter(r => r.signals !== null);

    // 올그린 (4개 모두 good)
    const allGreen = validResults.filter(r => 
      r.signals!.earning === "good" &&
      r.signals!.debt === "good" &&
      r.signals!.growth === "good" &&
      r.signals!.valuation === "good"
    );

    // 3개 good (거의 올그린)
    const threeGreen = validResults.filter(r => {
      const goodCount = [
        r.signals!.earning,
        r.signals!.debt,
        r.signals!.growth,
        r.signals!.valuation,
      ].filter(s => s === "good").length;
      return goodCount === 3;
    });

    // 응답
    const response = {
      allGreen: allGreen.map(r => ({
        ticker: r.ticker,
        name: r.name,
        sector: r.sector,
        signals: r.signals,
      })),
      threeGreen: threeGreen.map(r => ({
        ticker: r.ticker,
        name: r.name,
        sector: r.sector,
        signals: r.signals,
        // 어떤 지표가 good이 아닌지 표시
        notGood: Object.entries(r.signals!)
          .filter(([_, v]) => v !== "good")
          .map(([k, _]) => k)[0],
      })),
      totalChecked: POPULAR_STOCKS.length,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error("Discover API Error:", error);
    return NextResponse.json(
      { error: "데이터를 불러오는 중 오류가 발생했어요" },
      { status: 500 }
    );
  }
}
