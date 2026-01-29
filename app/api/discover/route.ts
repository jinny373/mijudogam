import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// ═══════════════════════════════════════════════════════════════
// 인기 종목 리스트 (60개)
// ═══════════════════════════════════════════════════════════════

const POPULAR_STOCKS = [
  // 빅테크 (7)
  { ticker: "AAPL", name: "애플", sector: "기술" },
  { ticker: "MSFT", name: "마이크로소프트", sector: "기술" },
  { ticker: "GOOGL", name: "구글", sector: "기술" },
  { ticker: "AMZN", name: "아마존", sector: "기술" },
  { ticker: "META", name: "메타", sector: "기술" },
  { ticker: "NVDA", name: "엔비디아", sector: "반도체" },
  { ticker: "TSLA", name: "테슬라", sector: "자동차" },
  
  // 반도체 (8)
  { ticker: "AMD", name: "AMD", sector: "반도체" },
  { ticker: "AVGO", name: "브로드컴", sector: "반도체" },
  { ticker: "QCOM", name: "퀄컴", sector: "반도체" },
  { ticker: "MU", name: "마이크론", sector: "반도체" },
  { ticker: "INTC", name: "인텔", sector: "반도체" },
  { ticker: "TSM", name: "TSMC", sector: "반도체" },
  { ticker: "ASML", name: "ASML", sector: "반도체" },
  { ticker: "MRVL", name: "마벨테크", sector: "반도체" },
  
  // AI/소프트웨어 (8)
  { ticker: "PLTR", name: "팔란티어", sector: "AI" },
  { ticker: "CRM", name: "세일즈포스", sector: "소프트웨어" },
  { ticker: "ADBE", name: "어도비", sector: "소프트웨어" },
  { ticker: "ORCL", name: "오라클", sector: "소프트웨어" },
  { ticker: "NOW", name: "서비스나우", sector: "소프트웨어" },
  { ticker: "SNOW", name: "스노우플레이크", sector: "소프트웨어" },
  { ticker: "PANW", name: "팔로알토", sector: "보안" },
  { ticker: "CRWD", name: "크라우드스트라이크", sector: "보안" },
  
  // AI 인프라/에너지 (6)
  { ticker: "IREN", name: "아이렌", sector: "AI인프라" },
  { ticker: "VRT", name: "버티브", sector: "AI인프라" },
  { ticker: "ETN", name: "이튼", sector: "AI인프라" },
  { ticker: "CEG", name: "컨스털레이션", sector: "에너지" },
  { ticker: "VST", name: "비스트라", sector: "에너지" },
  { ticker: "CORZ", name: "코어사이언티픽", sector: "AI인프라" },
  
  // 금융 (6)
  { ticker: "V", name: "비자", sector: "금융" },
  { ticker: "MA", name: "마스터카드", sector: "금융" },
  { ticker: "JPM", name: "JP모건", sector: "금융" },
  { ticker: "GS", name: "골드만삭스", sector: "금융" },
  { ticker: "BRK-B", name: "버크셔해서웨이", sector: "금융" },
  { ticker: "AXP", name: "아멕스", sector: "금융" },
  
  // 헬스케어 (6)
  { ticker: "UNH", name: "유나이티드헬스", sector: "헬스케어" },
  { ticker: "JNJ", name: "존슨앤존슨", sector: "헬스케어" },
  { ticker: "LLY", name: "일라이릴리", sector: "헬스케어" },
  { ticker: "ABBV", name: "애브비", sector: "헬스케어" },
  { ticker: "PFE", name: "화이자", sector: "헬스케어" },
  { ticker: "MRK", name: "머크", sector: "헬스케어" },
  
  // 소비재 (8)
  { ticker: "COST", name: "코스트코", sector: "소비재" },
  { ticker: "WMT", name: "월마트", sector: "소비재" },
  { ticker: "MCD", name: "맥도날드", sector: "소비재" },
  { ticker: "HD", name: "홈디포", sector: "소비재" },
  { ticker: "NKE", name: "나이키", sector: "소비재" },
  { ticker: "SBUX", name: "스타벅스", sector: "소비재" },
  { ticker: "TGT", name: "타겟", sector: "소비재" },
  { ticker: "LOW", name: "로우스", sector: "소비재" },
  
  // 에너지 (4)
  { ticker: "XOM", name: "엑슨모빌", sector: "에너지" },
  { ticker: "CVX", name: "쉐브론", sector: "에너지" },
  { ticker: "COP", name: "코노코필립스", sector: "에너지" },
  { ticker: "SLB", name: "슐럼버거", sector: "에너지" },
  
  // 미디어/통신 (4)
  { ticker: "NFLX", name: "넷플릭스", sector: "미디어" },
  { ticker: "DIS", name: "디즈니", sector: "미디어" },
  { ticker: "T", name: "AT&T", sector: "통신" },
  { ticker: "VZ", name: "버라이즌", sector: "통신" },
  
  // 기타 인기 (3)
  { ticker: "UBER", name: "우버", sector: "플랫폼" },
  { ticker: "ABNB", name: "에어비앤비", sector: "플랫폼" },
  { ticker: "COIN", name: "코인베이스", sector: "핀테크" },
];

// ═══════════════════════════════════════════════════════════════
// 신호등 계산 (stock API와 동일한 로직)
// ═══════════════════════════════════════════════════════════════

interface SignalResult {
  earning: "good" | "normal" | "bad";
  debt: "good" | "normal" | "bad";
  growth: "good" | "normal" | "bad";
  valuation: "good" | "normal" | "bad";
}

function getStatusForSignal(
  value: number,
  thresholds: { good: number; bad: number },
  higherIsBetter: boolean = true
): "green" | "yellow" | "red" {
  if (higherIsBetter) {
    if (value >= thresholds.good) return "green";
    if (value <= thresholds.bad) return "red";
    return "yellow";
  } else {
    if (value <= thresholds.good) return "green";
    if (value >= thresholds.bad) return "red";
    return "yellow";
  }
}

function statusToSignal(status: "green" | "yellow" | "red"): "good" | "normal" | "bad" {
  if (status === "green") return "good";
  if (status === "yellow") return "normal";
  return "bad";
}

async function calculateSignalsForTicker(ticker: string): Promise<SignalResult | null> {
  try {
    const [quote, quoteSummary, fundamentals] = await Promise.all([
      yahooFinance.quote(ticker),
      yahooFinance.quoteSummary(ticker, {
        modules: [
          "financialData",
          "defaultKeyStatistics",
          "incomeStatementHistory",
          "incomeStatementHistoryQuarterly",
          "cashflowStatementHistory",
          "balanceSheetHistoryQuarterly",
        ],
      }),
      yahooFinance.fundamentalsTimeSeries(ticker, {
        period1: new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        period2: new Date().toISOString().split('T')[0],
        type: 'quarterly',
        module: 'all',
      }).catch(() => []),
    ]);
    
    const financialData = quoteSummary.financialData;
    const keyStats = quoteSummary.defaultKeyStatistics;
    const incomeHistory = quoteSummary.incomeStatementHistory?.incomeStatementHistory || [];
    const incomeQuarterly = quoteSummary.incomeStatementHistoryQuarterly?.incomeStatementHistory || [];
    const cashflowHistory = quoteSummary.cashflowStatementHistory?.cashflowStatements || [];
    const balanceSheetQuarterly = quoteSummary.balanceSheetHistoryQuarterly?.balanceSheetStatements || [];
    
    const fundamentalsData = Array.isArray(fundamentals) ? fundamentals : [];
    const fundamentalsQuarterly = fundamentalsData
      .filter((f: any) => f.date)
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-8);
    
    // ROE
    const roe = financialData?.returnOnEquity || 0;
    
    // OCF
    const ocfFromHistory = cashflowHistory.length > 0 
      ? (cashflowHistory[0]?.totalCashFromOperatingActivities || 0) 
      : 0;
    const isNegativeOCF = ocfFromHistory < 0;
    
    // 매출 (pre-revenue 체크용)
    const actualRevenue = incomeHistory.length > 0 ? (incomeHistory[0]?.totalRevenue || 0) : 0;
    const isPreRevenueCompany = actualRevenue === 0 || actualRevenue < 1000000;
    
    // 연간 순이익 (턴어라운드 체크용)
    const netIncomeCurrentYear = incomeHistory.length > 0 ? (incomeHistory[0]?.netIncome || 0) : 0;
    const isAnnualLoss = netIncomeCurrentYear < 0;
    
    // 분기별 매출/이익 추이
    let quarterlyTrend: { quarter: string; revenue: number; netIncome: number }[] = [];
    if (incomeQuarterly.length > 0) {
      quarterlyTrend = incomeQuarterly.slice(0, 4).map((q: any) => {
        const quarter = q.endDate ? new Date(q.endDate) : null;
        const quarterLabel = quarter 
          ? `${quarter.getFullYear()}Q${Math.ceil((quarter.getMonth() + 1) / 3)}`
          : "N/A";
        return {
          quarter: quarterLabel,
          revenue: q.totalRevenue || 0,
          netIncome: q.netIncome || 0,
        };
      }).reverse();
    }
    
    // 최신 분기 흑자 체크
    const latestQuarterNetIncome = quarterlyTrend.length > 0 
      ? quarterlyTrend[quarterlyTrend.length - 1].netIncome 
      : null;
    const isLatestQuarterProfit = latestQuarterNetIncome !== null && latestQuarterNetIncome > 0;
    const isTurnaroundInProgress = isAnnualLoss && isLatestQuarterProfit;
    
    // 부채비율
    const debtToEquityRaw = financialData?.debtToEquity || 0;
    const debtToEquity = debtToEquityRaw / 100;
    
    let quarterlyDebtTrend: { debtToEquity: number | null }[] = [];
    if (balanceSheetQuarterly.length > 0) {
      quarterlyDebtTrend = balanceSheetQuarterly.slice(0, 4).map((q: any) => {
        const shortTermDebt = q.shortLongTermDebt || q.shortTermDebt || 0;
        const longTermDebt = q.longTermDebt || 0;
        const totalDebt = shortTermDebt + longTermDebt;
        const totalEquity = q.totalStockholderEquity || q.stockholdersEquity || 0;
        const debtToEquityQ = totalEquity > 0 ? totalDebt / totalEquity : null;
        return { debtToEquity: debtToEquityQ };
      }).reverse();
    } else if (fundamentalsQuarterly.length > 0) {
      quarterlyDebtTrend = fundamentalsQuarterly.slice(-4).map((f: any) => {
        const totalDebt = f.quarterlyTotalDebt || f.totalDebt || 
                          (f.quarterlyLongTermDebt || 0) + (f.quarterlyCurrentDebt || 0) || 0;
        const totalEquity = f.quarterlyStockholdersEquity || f.stockholdersEquity || 
                            f.quarterlyTotalEquityGrossMinorityInterest || 0;
        const debtToEquityQ = totalEquity > 0 ? totalDebt / totalEquity : null;
        return { debtToEquity: debtToEquityQ };
      });
    }
    
    const latestQuarterDebt = quarterlyDebtTrend.length > 0 
      ? quarterlyDebtTrend[quarterlyDebtTrend.length - 1] 
      : null;
    const latestQuarterDebtToEquity = latestQuarterDebt?.debtToEquity ?? debtToEquity;
    const hasQuarterlyDebtData = quarterlyDebtTrend.length > 0 && latestQuarterDebt?.debtToEquity !== null;
    const displayDebtToEquity = hasQuarterlyDebtData ? latestQuarterDebtToEquity : debtToEquity;
    
    // 성장률
    let revenueGrowthCalc: number | null = null;
    
    if (incomeHistory.length >= 2) {
      const currentRev = incomeHistory[0]?.totalRevenue || 0;
      const previousRev = incomeHistory[1]?.totalRevenue || 0;
      if (previousRev > 0) {
        revenueGrowthCalc = (currentRev - previousRev) / Math.abs(previousRev);
      }
    } else if (fundamentalsQuarterly.length >= 5) {
      const recentFour = fundamentalsQuarterly.slice(-4);
      const previousFour = fundamentalsQuarterly.slice(-8, -4);
      
      const revenueCurrentYear = recentFour.reduce((sum: number, f: any) => 
        sum + (f.quarterlyTotalRevenue || f.totalRevenue || 0), 0);
      const revenuePreviousYear = previousFour.reduce((sum: number, f: any) => 
        sum + (f.quarterlyTotalRevenue || f.totalRevenue || 0), 0);
      
      if (revenuePreviousYear > 0) {
        revenueGrowthCalc = (revenueCurrentYear - revenuePreviousYear) / Math.abs(revenuePreviousYear);
      }
    } else {
      revenueGrowthCalc = financialData?.revenueGrowth || null;
    }
    
    const hasRevenueGrowthData = revenueGrowthCalc !== null && !isNaN(revenueGrowthCalc);
    const revenueGrowth = revenueGrowthCalc ?? 0;
    
    // 분기별 성장률 fallback
    let fallbackGrowthRate: number | null = null;
    if (quarterlyTrend.length >= 2) {
      const latest = quarterlyTrend[quarterlyTrend.length - 1];
      const prev = quarterlyTrend[quarterlyTrend.length - 2];
      if (prev.revenue > 0) {
        fallbackGrowthRate = (latest.revenue - prev.revenue) / prev.revenue;
      }
    }
    const canUseQuarterlyGrowth = !hasRevenueGrowthData && fallbackGrowthRate !== null;
    
    // PER
    const trailingPER = keyStats?.trailingPE || quote?.trailingPE || 0;
    const forwardPER = keyStats?.forwardPE || financialData?.forwardPE || 0;
    const per = trailingPER > 0 ? trailingPER : forwardPER;
    const isNegativePER = per < 0;
    
    // EARNING
    let earningStatus: "green" | "yellow" | "red";
    if (isPreRevenueCompany) {
      earningStatus = "yellow";
    } else if (isTurnaroundInProgress) {
      earningStatus = "yellow";
    } else if (isNegativeOCF) {
      earningStatus = "red";
    } else {
      earningStatus = getStatusForSignal(roe, { good: 0.15, bad: 0.05 }, true);
    }
    
    // DEBT
    const debtStatus = getStatusForSignal(displayDebtToEquity, { good: 0.5, bad: 1.5 }, false);
    
    // GROWTH
    let growthStatus: "green" | "yellow" | "red";
    if (isPreRevenueCompany) {
      growthStatus = "yellow";
    } else if (hasRevenueGrowthData) {
      if (revenueGrowth > 0.15) growthStatus = "green";
      else if (revenueGrowth > 0) growthStatus = "yellow";
      else growthStatus = "red";
    } else if (canUseQuarterlyGrowth && fallbackGrowthRate !== null) {
      if (fallbackGrowthRate > 0.15) growthStatus = "green";
      else if (fallbackGrowthRate > 0) growthStatus = "yellow";
      else growthStatus = "red";
    } else {
      growthStatus = "yellow";
    }
    
    // VALUATION
    let valuationStatus: "green" | "yellow" | "red";
    if (isNegativePER) {
      valuationStatus = "yellow";
    } else {
      valuationStatus = getStatusForSignal(per, { good: 40, bad: 60 }, false);
    }
    
    return {
      earning: statusToSignal(earningStatus),
      debt: statusToSignal(debtStatus),
      growth: statusToSignal(growthStatus),
      valuation: statusToSignal(valuationStatus),
    };
  } catch (error) {
    console.error(`calculateSignalsForTicker error for ${ticker}:`, error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// API 핸들러
// ═══════════════════════════════════════════════════════════════

export async function GET() {
  try {
    // 10개씩 배치 처리 (타임아웃 방지)
    const batchSize = 10;
    const results: { ticker: string; name: string; sector: string; signals: SignalResult | null }[] = [];

    for (let i = 0; i < POPULAR_STOCKS.length; i += batchSize) {
      const batch = POPULAR_STOCKS.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (stock) => {
          const signals = await calculateSignalsForTicker(stock.ticker);
          return {
            ...stock,
            signals,
          };
        })
      );
      results.push(...batchResults);
    }

    // 유효한 결과만 필터링
    const validResults = results.filter(r => r.signals !== null);

    // 올그린 (4개 모두 good)
    const allGreen = validResults.filter(r => 
      r.signals!.earning === "good" &&
      r.signals!.debt === "good" &&
      r.signals!.growth === "good" &&
      r.signals!.valuation === "good"
    );

    // 응답 (거의 올그린 제거)
    const response = {
      allGreen: allGreen.map(r => ({
        ticker: r.ticker,
        name: r.name,
        sector: r.sector,
        signals: r.signals,
      })),
      totalChecked: POPULAR_STOCKS.length,
      validCount: validResults.length,
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
