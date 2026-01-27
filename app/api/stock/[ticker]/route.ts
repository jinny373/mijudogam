import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// 신호등 판단 기준
function getStatus(
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

// 숫자 포맷 - N/A 대신 친절한 한국어
function formatPercent(value: number | null | undefined, naText: string = "데이터 없음"): string {
  if (value === null || value === undefined || isNaN(value)) return naText;
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

function formatPercentNoSign(value: number | null | undefined, naText: string = "데이터 없음"): string {
  if (value === null || value === undefined || isNaN(value)) return naText;
  return `${(value * 100).toFixed(1)}%`;
}

function formatRatio(value: number | null | undefined, naText: string = "데이터 없음"): string {
  if (value === null || value === undefined || isNaN(value)) return naText;
  return `${value.toFixed(1)}배`;
}

function formatCurrency(value: number | null | undefined, naText: string = "데이터 없음"): string {
  if (value === null || value === undefined || isNaN(value)) return naText;
  const sign = value < 0 ? "-" : "";
  const absValue = Math.abs(value);
  if (absValue >= 1e12) return `${sign}$${(absValue / 1e12).toFixed(1)}T`;
  if (absValue >= 1e9) return `${sign}$${(absValue / 1e9).toFixed(1)}B`;
  if (absValue >= 1e6) return `${sign}$${(absValue / 1e6).toFixed(1)}M`;
  return `${sign}$${absValue.toFixed(0)}`;
}

// 성장률 직접 계산
function calculateGrowth(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current === 0 && previous === 0) return null;
  if (!previous || previous === 0) return null;
  if (current === null || current === undefined) return 0;
  return (current - previous) / Math.abs(previous);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;
    const symbol = ticker.toUpperCase();

    // Yahoo Finance API 호출 - v9.22: fundamentalsTimeSeries 추가 (분기 데이터 안정적 제공)
    const [quote, quoteSummary, fundamentals] = await Promise.all([
      yahooFinance.quote(symbol),
      yahooFinance.quoteSummary(symbol, {
        modules: [
          "summaryProfile",
          "financialData",
          "defaultKeyStatistics",
          "incomeStatementHistory",
          "incomeStatementHistoryQuarterly",
          "cashflowStatementHistory",
          "cashflowStatementHistoryQuarterly",
          "balanceSheetHistoryQuarterly",
        ],
      }),
      // v9.22: fundamentalsTimeSeries로 분기 재무제표 데이터 가져오기
      yahooFinance.fundamentalsTimeSeries(symbol, {
        period1: new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3년 전
        period2: new Date().toISOString().split('T')[0],
        type: 'quarterly',
        module: 'all',  // 필수 파라미터!
      }).catch(() => []), // 실패해도 빈 배열 반환
    ]);

    if (!quote) {
      return NextResponse.json(
        { error: "종목을 찾을 수 없어요" },
        { status: 404 }
      );
    }

    const profile = quoteSummary.summaryProfile;
    const financialData = quoteSummary.financialData;
    const keyStats = quoteSummary.defaultKeyStatistics;
    const incomeHistory = quoteSummary.incomeStatementHistory?.incomeStatementHistory || [];
    const incomeQuarterly = quoteSummary.incomeStatementHistoryQuarterly?.incomeStatementHistory || [];
    const cashflowHistory = quoteSummary.cashflowStatementHistory?.cashflowStatements || [];
    const cashflowQuarterly = quoteSummary.cashflowStatementHistoryQuarterly?.cashflowStatements || [];
    // v9.21: 분기별 대차대조표 (부채비율 계산용)
    const balanceSheetQuarterly = quoteSummary.balanceSheetHistoryQuarterly?.balanceSheetStatements || [];

    // v9.22: fundamentalsTimeSeries에서 분기 데이터 추출
    const fundamentalsData = Array.isArray(fundamentals) ? fundamentals : [];
    
    // fundamentalsTimeSeries 데이터를 분기별로 정리
    const fundamentalsQuarterly = fundamentalsData
      .filter((f: any) => f.date)
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-8); // 최근 8분기

    // 기본 정보
    const basicInfo = {
      name: quote.shortName || quote.longName || symbol,
      ticker: symbol,
      exchange: quote.exchange || "NASDAQ",
      price: quote.regularMarketPrice || 0,
      change: quote.regularMarketChange || 0,
      changePercent: quote.regularMarketChangePercent || 0,
      sector: profile?.sector || "Technology",
      industry: profile?.industry || "",
    };

    // 재무 지표 추출
    const roe = financialData?.returnOnEquity || 0;
    const operatingMargin = financialData?.operatingMargins || 0;
    const profitMargin = financialData?.profitMargins || 0;
    
    // 부채비율: Yahoo Finance API는 이미 퍼센트(%)로 제공
    // 예: 7.12 = 7.12% → /100 하면 0.0712 (비율)
    const debtToEquityRaw = financialData?.debtToEquity || 0;
    const debtToEquity = debtToEquityRaw / 100; // 비율로 변환 (0.0712)
    
    const currentRatio = financialData?.currentRatio || 0;
    
    // PER: Trailing(TTM, 실제 실적 기준) 우선 사용
    // - trailingPE: 최근 12개월 실제 이익 기준 (Yahoo Finance 기본 표시)
    // - forwardPE: 애널리스트 예상 이익 기준
    const trailingPER = keyStats?.trailingPE || quote.trailingPE || 0;
    const forwardPER = keyStats?.forwardPE || 0;
    const per = trailingPER > 0 ? trailingPER : forwardPER; // TTM 우선, 없으면 Forward
    const perType = trailingPER > 0 ? "TTM" : (forwardPER > 0 ? "Forward" : "");
    
    const peg = keyStats?.pegRatio || 0; // Forward 기준
    const pbr = keyStats?.priceToBook || 0;

    // 💵 현금흐름 데이터 (financialData에서 직접 가져오기)
    const operatingCashflow = financialData?.operatingCashflow || 0;
    const freeCashflow = financialData?.freeCashflow || 0;

    // 현금흐름 히스토리에서도 가져오기 (더 정확한 데이터)
    let ocfFromHistory = operatingCashflow;
    let fcfFromHistory = freeCashflow;
    let ocfPrevYear = 0;
    
    if (cashflowHistory.length >= 1) {
      const latest = cashflowHistory[0];
      ocfFromHistory = latest?.totalCashFromOperatingActivities || operatingCashflow;
      // v9.24: FCF = OCF - CapEx (capex가 0이면 financialData 사용)
      const capex = latest?.capitalExpenditures || 0;
      if (capex !== 0) {
        fcfFromHistory = ocfFromHistory + capex; // capex는 보통 음수
      } else if (freeCashflow !== 0) {
        // capex 데이터가 없으면 financialData.freeCashflow 사용
        fcfFromHistory = freeCashflow;
      } else {
        // 둘 다 없으면 null로 표시 (계산 불가)
        fcfFromHistory = null as any;
      }
    }
    if (cashflowHistory.length >= 2) {
      const prev = cashflowHistory[1];
      ocfPrevYear = prev?.totalCashFromOperatingActivities || 0;
    }

    // 📊 연간 데이터 성장률 계산
    // v9.22: Yahoo Finance API가 2024.11월부터 incomeStatementHistory 데이터를 잘 안 줌
    // → fundamentalsTimeSeries 또는 financialData를 fallback으로 사용
    let revenueGrowth: number | null = 0;
    let earningsGrowth: number | null = 0;
    let revenueCurrentYear = 0;
    let revenuePreviousYear = 0;
    let netIncomeCurrentYear = 0;
    let netIncomePreviousYear = 0;
    let currentFiscalYear = "";
    let previousFiscalYear = "";
    let latestFiscalYear = new Date().getFullYear().toString();
    let isPreRevenueCompany = false;

    if (incomeHistory.length >= 2) {
      // 연간 재무제표 히스토리가 있으면 직접 계산
      const current = incomeHistory[0];
      const previous = incomeHistory[1];

      revenueCurrentYear = current?.totalRevenue || 0;
      revenuePreviousYear = previous?.totalRevenue || 0;
      netIncomeCurrentYear = current?.netIncome || 0;
      netIncomePreviousYear = previous?.netIncome || 0;

      if (current?.endDate) {
        currentFiscalYear = new Date(current.endDate).getFullYear().toString();
        latestFiscalYear = currentFiscalYear;
      }
      if (previous?.endDate) {
        previousFiscalYear = new Date(previous.endDate).getFullYear().toString();
      }

      revenueGrowth = calculateGrowth(revenueCurrentYear, revenuePreviousYear);
      earningsGrowth = calculateGrowth(netIncomeCurrentYear, netIncomePreviousYear);
      
      // 매출이 0인데 financialData에는 있으면 그걸 사용
      if (revenueCurrentYear === 0 && financialData?.totalRevenue) {
        revenueCurrentYear = financialData.totalRevenue;
      }
    } else if (fundamentalsQuarterly.length >= 5) {
      // v9.22: incomeHistory가 없으면 fundamentalsTimeSeries에서 연간 성장률 계산
      // 최근 4분기 합산 vs 그 전 4분기 합산으로 YoY 계산
      const recentFour = fundamentalsQuarterly.slice(-4);
      const previousFour = fundamentalsQuarterly.slice(-8, -4);
      
      revenueCurrentYear = recentFour.reduce((sum: number, f: any) => 
        sum + (f.quarterlyTotalRevenue || f.totalRevenue || 0), 0);
      revenuePreviousYear = previousFour.reduce((sum: number, f: any) => 
        sum + (f.quarterlyTotalRevenue || f.totalRevenue || 0), 0);
      netIncomeCurrentYear = recentFour.reduce((sum: number, f: any) => 
        sum + (f.quarterlyNetIncome || f.netIncome || 0), 0);
      netIncomePreviousYear = previousFour.reduce((sum: number, f: any) => 
        sum + (f.quarterlyNetIncome || f.netIncome || 0), 0);
      
      // 최신 분기 날짜로 연도 추출
      const latestFundamentals = fundamentalsQuarterly[fundamentalsQuarterly.length - 1];
      if (latestFundamentals?.date) {
        latestFiscalYear = new Date(latestFundamentals.date).getFullYear().toString();
        currentFiscalYear = latestFiscalYear;
      }
      
      revenueGrowth = calculateGrowth(revenueCurrentYear, revenuePreviousYear);
      earningsGrowth = calculateGrowth(netIncomeCurrentYear, netIncomePreviousYear);
    } else {
      // ⚠️ 둘 다 없으면 financialData에서 가져오기
      revenueCurrentYear = financialData?.totalRevenue || 0;
      revenueGrowth = financialData?.revenueGrowth || null;
      earningsGrowth = financialData?.earningsGrowth || null;
      netIncomeCurrentYear = financialData?.netIncomeToCommon || 0;
    }
    
    // 매출 없음 판단: 실제로 매출이 0인지 확인
    // financialData.totalRevenue도 확인해서 fallback
    const actualRevenue = revenueCurrentYear || financialData?.totalRevenue || 0;
    isPreRevenueCompany = actualRevenue === 0;

    // 📈 분기별 추이 데이터 (최근 4분기)
    // v9.22: incomeQuarterly가 비어있으면 fundamentalsTimeSeries 사용
    let quarterlyTrend: { quarter: string; revenue: number; netIncome: number; operatingIncome: number }[] = [];
    
    if (incomeQuarterly.length > 0) {
      // 기존 방식: incomeStatementHistoryQuarterly
      quarterlyTrend = incomeQuarterly.slice(0, 4).map((q: any) => {
        const quarter = q.endDate ? new Date(q.endDate) : null;
        const quarterLabel = quarter 
          ? `${quarter.getFullYear()}Q${Math.ceil((quarter.getMonth() + 1) / 3)}`
          : "N/A";
        return {
          quarter: quarterLabel,
          revenue: q.totalRevenue || 0,
          netIncome: q.netIncome || 0,
          operatingIncome: q.operatingIncome || 0,
        };
      }).reverse();
    } else if (fundamentalsQuarterly.length > 0) {
      // v9.22: fundamentalsTimeSeries에서 분기 데이터 추출
      quarterlyTrend = fundamentalsQuarterly.slice(-4).map((f: any) => {
        const quarter = f.date ? new Date(f.date) : null;
        const quarterLabel = quarter 
          ? `${quarter.getFullYear()}Q${Math.ceil((quarter.getMonth() + 1) / 3)}`
          : "N/A";
        return {
          quarter: quarterLabel,
          revenue: f.quarterlyTotalRevenue || f.totalRevenue || 0,
          netIncome: f.quarterlyNetIncome || f.netIncome || 0,
          operatingIncome: f.quarterlyOperatingIncome || f.operatingIncome || 0,
        };
      });
    }

    // 🆕 분기별 성장률 계산 (전년 데이터 없을 때 대체용)
    let quarterlyGrowthSummary = "";
    let latestQoQGrowth: number | null = null;
    
    if (quarterlyTrend.length >= 2) {
      const latest = quarterlyTrend[quarterlyTrend.length - 1];
      const previous = quarterlyTrend[quarterlyTrend.length - 2];
      
      if (latest.revenue > 0 && previous.revenue > 0) {
        latestQoQGrowth = (latest.revenue - previous.revenue) / previous.revenue;
        
        // 분기별 추이 요약 생성
        const growthTrend = quarterlyTrend.slice(1).map((q, i) => {
          const prev = quarterlyTrend[i];
          if (prev.revenue > 0 && q.revenue > 0) {
            const growth = ((q.revenue - prev.revenue) / prev.revenue) * 100;
            return growth > 0 ? `+${growth.toFixed(1)}%` : `${growth.toFixed(1)}%`;
          }
          return null;
        }).filter(Boolean);
        
        if (growthTrend.length > 0) {
          quarterlyGrowthSummary = `최근 분기 추이: ${growthTrend.join(' → ')}`;
        }
      }
    }
    
    // 분기별 YoY 성장률 (같은 분기 전년 대비)
    // v9.22: fundamentalsTimeSeries에서도 YoY 계산 가능
    let quarterlyYoYGrowth: number | null = null;
    const quarterlyDataSource = incomeQuarterly.length > 0 ? incomeQuarterly : fundamentalsQuarterly;
    
    if (quarterlyDataSource.length >= 5) {
      const latestQ = incomeQuarterly.length > 0 ? incomeQuarterly[0] : fundamentalsQuarterly[fundamentalsQuarterly.length - 1];
      const sameQLastYear = incomeQuarterly.length > 0 ? incomeQuarterly[4] : fundamentalsQuarterly[fundamentalsQuarterly.length - 5];
      
      const latestRevenue = latestQ?.totalRevenue || latestQ?.quarterlyTotalRevenue || 0;
      const lastYearRevenue = sameQLastYear?.totalRevenue || sameQLastYear?.quarterlyTotalRevenue || 0;
      
      if (latestRevenue > 0 && lastYearRevenue > 0) {
        quarterlyYoYGrowth = (latestRevenue - lastYearRevenue) / lastYearRevenue;
      }
    }

    // 분기별 현금흐름 추이
    const quarterlyOCF = cashflowQuarterly.slice(0, 4).map((q: any) => {
      const quarter = q.endDate ? new Date(q.endDate) : null;
      const quarterLabel = quarter 
        ? `${quarter.getFullYear()}Q${Math.ceil((quarter.getMonth() + 1) / 3)}`
        : "N/A";
      return {
        quarter: quarterLabel,
        ocf: q.totalCashFromOperatingActivities || 0,
      };
    }).reverse();

    // v9.22: 분기별 부채비율 계산 (balanceSheetQuarterly 또는 fundamentalsTimeSeries 사용)
    let quarterlyDebtTrend: { quarter: string; totalDebt: number; totalEquity: number; debtToEquity: number | null; currentRatio: number | null }[] = [];
    
    if (balanceSheetQuarterly.length > 0) {
      // 기존 방식: balanceSheetHistoryQuarterly
      quarterlyDebtTrend = balanceSheetQuarterly.slice(0, 4).map((q: any) => {
        const quarter = q.endDate ? new Date(q.endDate) : null;
        const quarterLabel = quarter 
          ? `${quarter.getFullYear()}Q${Math.ceil((quarter.getMonth() + 1) / 3)}`
          : "N/A";
        
        const shortTermDebt = q.shortLongTermDebt || q.shortTermDebt || 0;
        const longTermDebt = q.longTermDebt || 0;
        const totalDebt = shortTermDebt + longTermDebt;
        const totalEquity = q.totalStockholderEquity || q.stockholdersEquity || 0;
        const debtToEquityQ = totalEquity > 0 ? totalDebt / totalEquity : null;
        
        return {
          quarter: quarterLabel,
          totalDebt,
          totalEquity,
          debtToEquity: debtToEquityQ,
          currentRatio: q.totalCurrentAssets && q.totalCurrentLiabilities 
            ? q.totalCurrentAssets / q.totalCurrentLiabilities 
            : null,
        };
      }).reverse();
    } else if (fundamentalsQuarterly.length > 0) {
      // v9.22: fundamentalsTimeSeries에서 부채비율 데이터 추출
      quarterlyDebtTrend = fundamentalsQuarterly.slice(-4).map((f: any) => {
        const quarter = f.date ? new Date(f.date) : null;
        const quarterLabel = quarter 
          ? `${quarter.getFullYear()}Q${Math.ceil((quarter.getMonth() + 1) / 3)}`
          : "N/A";
        
        // fundamentalsTimeSeries 필드명
        const totalDebt = f.quarterlyTotalDebt || f.totalDebt || 
                          (f.quarterlyLongTermDebt || 0) + (f.quarterlyCurrentDebt || 0) || 0;
        const totalEquity = f.quarterlyStockholdersEquity || f.stockholdersEquity || 
                            f.quarterlyTotalEquityGrossMinorityInterest || 0;
        const debtToEquityQ = totalEquity > 0 ? totalDebt / totalEquity : null;
        
        const currentAssets = f.quarterlyCurrentAssets || f.currentAssets || 0;
        const currentLiabilities = f.quarterlyCurrentLiabilities || f.currentLiabilities || 0;
        const currentRatioQ = currentLiabilities > 0 ? currentAssets / currentLiabilities : null;
        
        return {
          quarter: quarterLabel,
          totalDebt,
          totalEquity,
          debtToEquity: debtToEquityQ,
          currentRatio: currentRatioQ,
        };
      });
    }

    // 최신 분기 부채비율 (있으면 사용, 없으면 연간 데이터 사용)
    const latestQuarterDebt = quarterlyDebtTrend.length > 0 
      ? quarterlyDebtTrend[quarterlyDebtTrend.length - 1] 
      : null;
    const latestQuarterDebtToEquity = latestQuarterDebt?.debtToEquity ?? debtToEquity;
    const latestQuarterCurrentRatio = latestQuarterDebt?.currentRatio ?? currentRatio;
    const latestDebtQuarterLabel = latestQuarterDebt?.quarter || `${latestFiscalYear}년`;
    const hasQuarterlyDebtData = quarterlyDebtTrend.length > 0 && latestQuarterDebt?.debtToEquity !== null;

    // 🆕 최신 분기 흑자/적자 체크 (연간 데이터와 별도)
    const latestQuarterNetIncome = quarterlyTrend.length > 0 
      ? quarterlyTrend[quarterlyTrend.length - 1].netIncome 
      : null;
    const latestQuarterOperatingIncome = quarterlyTrend.length > 0 
      ? quarterlyTrend[quarterlyTrend.length - 1].operatingIncome 
      : null;
    const prevQuarterNetIncome = quarterlyTrend.length > 1 
      ? quarterlyTrend[quarterlyTrend.length - 2].netIncome 
      : null;
    
    // 연간은 적자지만 최신 분기는 흑자인 경우 (턴어라운드)
    const isAnnualLoss = netIncomeCurrentYear < 0;
    const isLatestQuarterProfit = latestQuarterNetIncome !== null && latestQuarterNetIncome > 0;
    const isLatestQuarterOperatingProfit = latestQuarterOperatingIncome !== null && latestQuarterOperatingIncome > 0;
    const isTurnaroundInProgress = isAnnualLoss && isLatestQuarterProfit;
    
    // 최신 분기 흑자 전환 (이전 분기 적자 → 이번 분기 흑자)
    const justTurnedProfitThisQuarter = prevQuarterNetIncome !== null && prevQuarterNetIncome < 0 && isLatestQuarterProfit;

    const isLossCompany = netIncomeCurrentYear < 0;
    const isNegativePER = per < 0;
    const isNegativeOCF = ocfFromHistory < 0;
    const isNegativeFCF = fcfFromHistory < 0;

    // 💰 돈 버는 능력 (현금흐름 추가!)
    // summary와 statusText 기준 통일: ROE 15% 이상이면 "우수"
    // 🆕 최신 분기 턴어라운드 반영
    const getEarningSummary = () => {
      if (isPreRevenueCompany) return "아직 매출이 없는 연구개발 단계 기업이에요. 제품 출시 전이라 수익성 평가가 어려워요.";
      
      // 🆕 턴어라운드 케이스: 연간 적자지만 최신 분기 흑자
      if (isTurnaroundInProgress) {
        return "연간 기준으로는 아직 적자지만, 최신 분기에 흑자 전환에 성공했어요! 이 추세가 지속될지 지켜봐야 해요.";
      }
      
      if (isNegativeOCF) return "장부상 이익은 있지만, 실제 영업활동에서 현금이 빠져나가고 있어요. 이익의 질을 확인해야 해요.";
      if (roe > 0.2) return "자기자본 대비 이익률이 매우 높아요. 주주 돈으로 효율적으로 돈을 잘 벌고 있어요.";
      if (roe > 0.15) return "돈을 잘 벌고 있어요. ROE가 15% 이상이면 우량 기업으로 평가받아요.";
      if (roe > 0.05) return "수익은 내고 있지만 특별히 높지는 않아요. 업종 평균과 비교해 보세요.";
      if (roe < 0) return "현재 적자 상태예요. 적자가 일시적인지, 구조적인지 확인이 필요해요.";
      return "수익성이 낮은 편이에요. 마진 개선 여지가 있는지 살펴보세요.";
    };

    const earningPower = {
      id: "earning",
      title: "돈 버는 능력",
      emoji: "💰",
      // 🆕 턴어라운드 케이스: 연간 적자여도 최신 분기 흑자면 yellow (희망적)
      status: isPreRevenueCompany 
        ? "yellow" 
        : isTurnaroundInProgress
          ? "yellow"  // 턴어라운드 중 = 노란불 (지켜봐야 함)
          : (isNegativeOCF ? "red" : getStatus(roe, { good: 0.15, bad: 0.05 }, true)),
      statusText: isPreRevenueCompany 
        ? "연구개발 단계" 
        : isTurnaroundInProgress
          ? "흑자 전환 중 🎉"
          : isNegativeOCF
            ? "현금흐름 주의"
            : (roe > 0.15 ? "우수" : roe > 0.05 ? "보통" : "주의"),
      summary: getEarningSummary(),
      mainValue: formatPercentNoSign(roe, "데이터 없음"),
      mainLabel: "ROE",
      // v9.21: 분기 데이터 있으면 최근 분기 기준으로 표시
      average: quarterlyTrend.length > 0 
        ? `${quarterlyTrend[quarterlyTrend.length - 1]?.quarter || latestFiscalYear} 기준`
        : `${latestFiscalYear}년 연간 기준`,
      metrics: [
        {
          name: "ROE (자기자본이익률)",
          description: "💡 내 돈(자본)으로 얼마나 벌었나? 높을수록 효율적",
          value: formatPercentNoSign(roe, "데이터 없음"),
          status: roe > 0.15 ? "green" : roe > 0.05 ? "yellow" : "red",
          benchmark: `📅 ${latestFiscalYear}년 연간`,
          interpretation: `${roe > 0.15 ? "우수 (15%↑)" : roe > 0.05 ? "보통 (5~15%)" : roe > 0 ? "낮음 (5%↓)" : "적자"}`,
        },
        {
          name: "영업이익률",
          description: "💡 본업에서 매출 100원당 얼마가 남나?",
          value: isPreRevenueCompany ? "아직 매출 없음" : formatPercentNoSign(operatingMargin, "데이터 없음"),
          status: isPreRevenueCompany ? "yellow" : getStatus(operatingMargin, { good: 0.1, bad: 0.05 }, true),
          benchmark: `📅 ${latestFiscalYear}년 연간`,
          interpretation: isPreRevenueCompany 
            ? "매출이 없어 계산 불가" 
            : `${operatingMargin > 0.15 ? "우수 (15%↑)" : operatingMargin > 0.1 ? "양호 (10%↑)" : operatingMargin > 0.05 ? "보통" : operatingMargin > 0 ? "낮음" : "적자"}`,
        },
        {
          name: "순이익률",
          description: "💡 모든 비용 제하고 최종적으로 얼마가 남나?",
          value: isPreRevenueCompany ? "아직 매출 없음" : formatPercentNoSign(profitMargin, "데이터 없음"),
          status: isPreRevenueCompany ? "yellow" : getStatus(profitMargin, { good: 0.1, bad: 0.03 }, true),
          benchmark: `📅 ${latestFiscalYear}년 연간`,
          interpretation: isPreRevenueCompany 
            ? "매출이 없어 계산 불가" 
            : `${profitMargin > 0.1 ? "우수 (10%↑)" : profitMargin > 0.05 ? "양호 (5%↑)" : profitMargin > 0 ? "보통" : "적자"}`,
        },
        // 🆕 현금흐름 지표 추가
        {
          name: "영업현금흐름 (OCF)",
          description: "💡 영업활동으로 실제 들어온 현금. 순이익보다 중요!",
          value: formatCurrency(ocfFromHistory, "데이터 없음"),
          status: ocfFromHistory > 0 ? "green" : "red",
          benchmark: `📅 ${latestFiscalYear}년 연간`,
          interpretation: ocfFromHistory > 0 
            ? "✅ 현금 유입 중"
            : "⚠️ 현금 유출 중 (주의)",
        },
        {
          name: "잉여현금흐름 (FCF)",
          description: "💡 투자 후 남는 현금. 배당/자사주매입 여력",
          value: formatCurrency(fcfFromHistory, "데이터 없음"),
          status: fcfFromHistory > 0 ? "green" : fcfFromHistory > -1e9 ? "yellow" : "red",
          benchmark: `📅 ${latestFiscalYear}년 연간`,
          interpretation: fcfFromHistory > 0 
            ? "✅ 투자 후 현금 남음"
            : "투자에 현금 사용 중",
        },
      ],
      // 분기별 추이 추가
      quarterlyTrend: quarterlyTrend.length > 0 ? {
        label: "최근 4분기 순이익 추이",
        data: quarterlyTrend.map(q => ({
          quarter: q.quarter,
          value: formatCurrency(q.netIncome, "-"),
          raw: q.netIncome,
        })),
      } : null,
      whyImportant: [
        "ROE가 높으면 주주 돈으로 효율적으로 돈을 번다는 의미예요",
        "💡 순이익이 좋아도 현금흐름(OCF)이 마이너스면 위험 신호예요",
        "영업현금흐름이 계속 마이너스면 언젠가 자금난이 올 수 있어요",
      ],
      caution: isNegativeOCF ? [
        "⚠️ 장부상 이익은 있지만, 실제 현금이 빠져나가고 있어요",
        "현금흐름이 마이너스인 이유를 확인해보세요",
      ] : undefined,
    };

    // 🏦 빚 관리 - v9.22: financialData.debtToEquity는 mrq(최근 분기) 값
    // Yahoo Finance의 debtToEquity, currentRatio는 이미 최근 분기 기준!
    const displayDebtToEquity = hasQuarterlyDebtData ? latestQuarterDebtToEquity : debtToEquity;
    const displayCurrentRatio = hasQuarterlyDebtData ? latestQuarterCurrentRatio : currentRatio;
    
    // 최신 분기 라벨 결정 (quarterlyTrend에서 가져오거나, 현재 날짜 기준)
    const latestQuarterFromTrend = quarterlyTrend.length > 0 
      ? quarterlyTrend[quarterlyTrend.length - 1].quarter 
      : null;
    const currentQuarterLabel = latestQuarterFromTrend || `${new Date().getFullYear()}Q${Math.ceil((new Date().getMonth() + 1) / 3)}`;
    
    // v9.22: financialData는 mrq(최근 분기) 기준이므로, 분기 라벨로 표시
    const debtQuarterLabel = hasQuarterlyDebtData ? latestDebtQuarterLabel : currentQuarterLabel;
    const isDebtDataFromMRQ = !hasQuarterlyDebtData && debtToEquity > 0; // financialData에서 왔으면 mrq
    
    const debtManagement = {
      id: "debt",
      title: "빚 관리",
      emoji: "🏦",
      status: getStatus(displayDebtToEquity, { good: 0.5, bad: 1.5 }, false),
      statusText: displayDebtToEquity < 0.5 ? "우수" : displayDebtToEquity < 1.5 ? "보통" : "주의",
      summary: displayDebtToEquity < 0.3
        ? "자본 대비 빚 부담이 매우 적어요. 재무 건전성이 좋고 금리 인상에도 안전해요."
        : displayDebtToEquity < 0.5
          ? "빚을 잘 관리하고 있어요. 자본 대비 부채가 적당한 수준이에요."
          : displayDebtToEquity < 1
            ? "빚이 어느 정도 있지만 관리 가능한 수준이에요. 업종 특성을 고려해야 해요."
            : displayDebtToEquity < 1.5
              ? "빚이 좀 많은 편이에요. 이자 비용이 이익을 갉아먹을 수 있어요."
              : "빚이 많아서 재무 위험이 있어요. 금리 인상이나 실적 악화 시 취약해요.",
      mainValue: formatPercentNoSign(displayDebtToEquity, "데이터 없음"),
      mainLabel: "부채비율",
      // v9.22: financialData는 mrq(최근 분기) 기준
      average: isDebtDataFromMRQ 
        ? `${debtQuarterLabel} 기준 (최근 분기)`
        : (hasQuarterlyDebtData 
            ? `${latestDebtQuarterLabel} 기준`
            : `${latestFiscalYear}년 재무제표 기준`),
      metrics: [
        {
          name: "부채비율 (빚 ÷ 자본)",
          description: "💡 내 돈 대비 빚이 얼마나 있나? 낮을수록 안전",
          value: formatPercentNoSign(displayDebtToEquity, "데이터 없음"),
          status: getStatus(displayDebtToEquity, { good: 0.5, bad: 1.5 }, false),
          benchmark: isDebtDataFromMRQ ? `📅 ${debtQuarterLabel} (최근 분기)` : (hasQuarterlyDebtData ? `📅 ${latestDebtQuarterLabel}` : `📅 ${latestFiscalYear}년 연간`),
          interpretation: `${displayDebtToEquity < 0.3 ? "우수 (30%↓)" : displayDebtToEquity < 0.5 ? "양호 (50%↓)" : displayDebtToEquity < 1 ? "보통 (100%↓)" : "높음 (100%↑)"}`,
        },
        {
          name: "유동비율 (단기 지급 능력)",
          description: "💡 1년 내 갚을 빚 대비 현금 여유. 1배 이상 필요",
          value: formatRatio(displayCurrentRatio, "데이터 없음"),
          status: getStatus(displayCurrentRatio, { good: 1.5, bad: 1 }, true),
          benchmark: isDebtDataFromMRQ ? `📅 ${debtQuarterLabel} (최근 분기)` : (hasQuarterlyDebtData ? `📅 ${latestDebtQuarterLabel}` : `📅 ${latestFiscalYear}년 연간`),
          interpretation: `${displayCurrentRatio > 2 ? "우수 (2배↑)" : displayCurrentRatio > 1.5 ? "양호 (1.5배↑)" : displayCurrentRatio > 1 ? "보통 (1배↑)" : "주의 (1배↓)"}`,
        },
        // v9.22: 분기별 부채 추이 - 데이터 없으면 표시 안 함
        ...(quarterlyDebtTrend.length >= 2 && quarterlyDebtTrend.some(q => q.debtToEquity !== null) ? [{
          name: "📈 분기별 부채비율 추이",
          description: "💡 최근 4분기 부채 변화. 감소 추세면 좋아요",
          value: quarterlyDebtTrend.map(q => q.quarter.replace(/^\d{4}/, "'" + q.quarter.slice(2, 4))).join(' → '),
          status: (latestQuarterDebtToEquity < debtToEquity) ? "green" : 
                  (latestQuarterDebtToEquity > debtToEquity * 1.2) ? "red" : "yellow",
          benchmark: quarterlyDebtTrend.map(q => 
            q.debtToEquity !== null ? formatPercentNoSign(q.debtToEquity, "-") : "-"
          ).join(' → '),
          interpretation: latestQuarterDebtToEquity < debtToEquity 
            ? "부채 감소 추세 👍" 
            : latestQuarterDebtToEquity > debtToEquity * 1.2 
              ? "부채 증가 추세 ⚠️" 
              : "비슷한 수준 유지",
        }] : []),
      ],
      // v9.22: 분기별 부채 추이 - 유효한 데이터 있을 때만
      quarterlyTrend: quarterlyDebtTrend.length > 0 && quarterlyDebtTrend.some(q => q.debtToEquity !== null) ? {
        label: "최근 4분기 부채비율 추이",
        data: quarterlyDebtTrend.map(q => ({
          quarter: q.quarter,
          value: q.debtToEquity !== null ? formatPercentNoSign(q.debtToEquity, "-") : "-",
          raw: q.debtToEquity,
        })),
      } : null,
      whyImportant: [
        "빚이 많으면 금리 인상 시 이자 부담이 커져요",
        "유동비율이 낮으면 단기 자금난 위험이 있어요",
      ],
    };

    // 🚀 성장 가능성
    const growthYearLabel = previousFiscalYear && currentFiscalYear 
      ? `${previousFiscalYear} → ${currentFiscalYear}` 
      : `${latestFiscalYear}년 기준`;
    
    // 성장률 데이터 유무 확인
    const hasRevenueGrowthData = revenueGrowth !== null;
    const hasEarningsGrowthData = earningsGrowth !== null;
    const revenueGrowthValue = revenueGrowth ?? 0;
    const earningsGrowthValue = earningsGrowth ?? 0;
    
    // 매출은 있는데 연간 성장률 데이터만 없는 경우 → 분기별로 대체
    const hasRevenueButNoGrowthData = actualRevenue > 0 && !hasRevenueGrowthData;
    const hasQuarterlyData = quarterlyTrend.length >= 2;
    const canUseQuarterlyGrowth = hasRevenueButNoGrowthData && (quarterlyYoYGrowth !== null || latestQoQGrowth !== null);
    
    // 분기별 대체 성장률 (YoY 우선, 없으면 QoQ)
    const fallbackGrowthRate = quarterlyYoYGrowth ?? latestQoQGrowth;
    const fallbackGrowthType = quarterlyYoYGrowth !== null ? "전년 동기 대비" : "전분기 대비";
    
    // 적자 관련 상태 판단
    const isCurrentlyLoss = netIncomeCurrentYear < 0;
    const wasPreviouslyLoss = netIncomePreviousYear < 0;
    const turnedProfitable = wasPreviouslyLoss && !isCurrentlyLoss;
    const lossExpanded = wasPreviouslyLoss && isCurrentlyLoss && netIncomeCurrentYear < netIncomePreviousYear;
    
    // 성장 상태 결정 (분기별 데이터 활용)
    const getGrowthStatus = () => {
      if (isPreRevenueCompany) return "yellow";
      
      // 연간 성장률 있으면 사용
      if (hasRevenueGrowthData) {
        if (revenueGrowthValue > 0.15) return "green";
        if (revenueGrowthValue > 0) return "yellow";
        return "red";
      }
      
      // 분기별 대체 가능하면 사용
      if (canUseQuarterlyGrowth && fallbackGrowthRate !== null) {
        if (fallbackGrowthRate > 0.15) return "green";
        if (fallbackGrowthRate > 0) return "yellow";
        return "red";
      }
      
      return "yellow"; // 데이터 부족
    };
    
    const getGrowthStatusText = () => {
      if (isPreRevenueCompany) return "연구개발 단계";
      
      // 연간 또는 분기별 성장률로 판단
      const growthRate = hasRevenueGrowthData ? revenueGrowthValue : fallbackGrowthRate;
      
      if (growthRate === null) return "데이터 부족";
      if (growthRate > 0.5) return "초고속 성장";
      if (growthRate > 0.15) return "고성장";
      if (growthRate > 0) return "성장중";
      if (growthRate > -0.1) return "정체";
      return "역성장";
    };
    
    const getGrowthSummary = () => {
      if (isPreRevenueCompany) return "아직 매출이 없는 연구개발 단계예요. 제품 출시나 상업화 시점이 중요해요.";
      
      // 연간 성장률 있으면 사용
      if (hasRevenueGrowthData) {
        if (revenueGrowthValue > 0.5) return "폭발적으로 성장하고 있어요! 고성장 기업은 프리미엄 밸류에이션을 받을 수 있어요.";
        if (revenueGrowthValue > 0.3) return "빠르게 성장하고 있어요. 시장점유율 확대나 신사업 확장이 잘 되고 있어요.";
        if (revenueGrowthValue > 0.1) return "꾸준히 성장하고 있어요. 안정적인 성장세를 유지하고 있어요.";
        if (revenueGrowthValue > 0) return "느리게 성장하고 있어요. 성숙기 기업이거나 경쟁이 치열한 시장일 수 있어요.";
        if (revenueGrowthValue > -0.1) return "성장이 멈춘 상태예요. 새로운 성장 동력이 필요해 보여요.";
        return "매출이 줄어들고 있어요. 시장 환경이나 경쟁력에 문제가 있는지 확인해 보세요.";
      }
      
      // 분기별 대체 가능하면 사용
      if (canUseQuarterlyGrowth && fallbackGrowthRate !== null) {
        const prefix = fallbackGrowthType === "전년 동기 대비" ? "최근 분기 기준" : "전분기 대비";
        if (fallbackGrowthRate > 0.3) return `${prefix} 빠르게 성장하고 있어요. 실적 개선이 뚜렷해요.`;
        if (fallbackGrowthRate > 0.1) return `${prefix} 꾸준히 성장하고 있어요. 긍정적인 흐름이에요.`;
        if (fallbackGrowthRate > 0) return `${prefix} 완만하게 성장하고 있어요.`;
        if (fallbackGrowthRate > -0.1) return `${prefix} 보합세예요. 성장 모멘텀이 약해요.`;
        return `${prefix} 매출이 감소했어요. 일시적인지 추세적인지 확인이 필요해요.`;
      }
      
      // 분기별 추이만 있으면 추이로 표시
      if (hasQuarterlyData && quarterlyGrowthSummary) {
        return quarterlyGrowthSummary;
      }
      
      return `연간 매출 ${formatCurrency(actualRevenue)} (성장률 데이터 부족)`;
    };
    
    // 순이익 성장률 해석 (적자 기업 특별 처리)
    const getEarningsInterpretation = () => {
      if (!hasEarningsGrowthData) return "데이터가 부족해요";
      if (turnedProfitable) return "🎉 흑자 전환 성공!";
      if (lossExpanded) return "⚠️ 적자가 확대되고 있어요";
      if (isCurrentlyLoss) return "아직 적자 상태예요";
      if (earningsGrowthValue > 1) return "이익 2배 이상 급증!";
      if (earningsGrowthValue > revenueGrowthValue) return "이익이 더 빠르게 성장";
      if (earningsGrowthValue > 0) return "이익 증가 중";
      return "이익 감소 중";
    };
    
    // 순이익 성장률 표시값 (적자 기업은 구체적 금액 포함)
    const getEarningsGrowthDisplay = () => {
      if (!hasEarningsGrowthData) return "데이터 없음";
      if (turnedProfitable) {
        return `흑자 전환! (${formatCurrency(netIncomeCurrentYear)})`;
      }
      if (lossExpanded) {
        return `적자 확대 (${formatCurrency(netIncomePreviousYear)} → ${formatCurrency(netIncomeCurrentYear)})`;
      }
      if (isCurrentlyLoss && !wasPreviouslyLoss) {
        return `적자 전환 (${formatCurrency(netIncomeCurrentYear)})`;
      }
      return formatPercent(earningsGrowthValue, "데이터 없음");
    };
    
    // 순이익 성장률 상태 (적자 기업은 다르게)
    const getEarningsGrowthStatus = () => {
      if (!hasEarningsGrowthData) return "yellow";
      if (turnedProfitable) return "green";
      if (lossExpanded) return "red";
      if (isCurrentlyLoss) return "yellow";
      return getStatus(earningsGrowthValue, { good: 0.15, bad: 0 }, true);
    };
    
    // 데이터 기준 연도 표시
    const dataYearLabel = latestFiscalYear ? `${latestFiscalYear}년 기준` : "최근 12개월 기준";

    // 분기별 성장률 문자열 생성
    const getQuarterlyGrowthString = () => {
      if (quarterlyTrend.length < 2) return null;
      
      const growthRates: string[] = [];
      for (let i = 1; i < quarterlyTrend.length; i++) {
        const prev = quarterlyTrend[i - 1];
        const curr = quarterlyTrend[i];
        if (prev.revenue > 0 && curr.revenue > 0) {
          const growth = ((curr.revenue - prev.revenue) / prev.revenue) * 100;
          growthRates.push(growth >= 0 ? `+${growth.toFixed(0)}%` : `${growth.toFixed(0)}%`);
        }
      }
      return growthRates;
    };
    
    const quarterlyGrowthRates = getQuarterlyGrowthString();
    const hasUsableQuarterlyData = quarterlyTrend.length >= 2 && quarterlyGrowthRates && quarterlyGrowthRates.length > 0;

    const growthPotential = {
      id: "growth",
      title: "성장 가능성",
      emoji: "🚀",
      status: getGrowthStatus(),
      statusText: getGrowthStatusText(),
      summary: getGrowthSummary(),
      // 분기별 우선: 분기별 데이터 있으면 최근 분기 성장률, 없으면 연간
      mainValue: isPreRevenueCompany 
        ? "매출 없음" 
        : hasUsableQuarterlyData
          ? (latestQoQGrowth !== null ? formatPercent(latestQoQGrowth, "-") : formatCurrency(actualRevenue))
          : hasRevenueGrowthData
            ? formatPercent(revenueGrowthValue, "데이터 없음")
            : formatCurrency(actualRevenue),
      mainLabel: isPreRevenueCompany
        ? "매출"
        : hasUsableQuarterlyData
          ? "최근 분기 성장률"
          : hasRevenueGrowthData
            ? "연간 성장률"
            : `연간 매출`,
      average: hasUsableQuarterlyData 
        ? `${quarterlyTrend[quarterlyTrend.length - 1]?.quarter} 기준`
        : hasRevenueGrowthData ? growthYearLabel : dataYearLabel,
      metrics: [
        // 🆕 분기별 추이 우선 표시
        hasUsableQuarterlyData ? {
          name: "📈 분기별 매출 추이",
          description: "💡 최근 4분기 매출 흐름. 성장세를 직접 확인!",
          value: quarterlyTrend.map(q => q.quarter.replace(/^\d{4}/, "'" + q.quarter.slice(2, 4))).join(' → '),
          status: latestQoQGrowth !== null ? (latestQoQGrowth > 0.1 ? "green" : latestQoQGrowth > 0 ? "yellow" : "red") : "yellow",
          benchmark: quarterlyTrend.map(q => formatCurrency(q.revenue, "-")).join(' → '),
          interpretation: quarterlyGrowthRates ? `성장률: ${quarterlyGrowthRates.join(' → ')}` : "추이 확인",
        } : {
          name: "매출 성장률 (전년 대비)",
          description: "💡 작년보다 매출이 얼마나 늘었나?",
          value: isPreRevenueCompany 
            ? "아직 매출 없음" 
            : hasRevenueGrowthData
              ? formatPercent(revenueGrowthValue, "데이터 없음")
              : `${formatCurrency(actualRevenue)} (${dataYearLabel})`,
          status: isPreRevenueCompany ? "red" : hasRevenueGrowthData ? getStatus(revenueGrowthValue, { good: 0.15, bad: 0 }, true) : "yellow",
          benchmark: hasRevenueGrowthData ? growthYearLabel : "전년 데이터 없음",
          interpretation: isPreRevenueCompany
            ? "매출이 없어 성장률을 계산할 수 없어요"
            : hasRevenueGrowthData
              ? `${growthYearLabel}, ${revenueGrowthValue > 0.5 ? "폭발적 성장! 🚀" : revenueGrowthValue > 0.15 ? "고성장" : revenueGrowthValue > 0 ? "안정적 성장" : "역성장"}`
              : "전년 데이터가 없어요",
        },
        {
          name: "순이익 추이",
          description: "💡 최종 이익이 늘고 있나? 흑자/적자 전환 여부",
          value: getEarningsGrowthDisplay(),
          status: getEarningsGrowthStatus(),
          benchmark: hasEarningsGrowthData ? growthYearLabel : "전년 데이터 없음",
          interpretation: getEarningsInterpretation(),
        },
        // 연간 성장률은 분기별이 있어도 보조로 표시
        hasRevenueGrowthData ? {
          name: `연간 성장률 (${growthYearLabel})`,
          description: "💡 1년 단위 성장률. 장기 추세 파악용",
          value: formatPercent(revenueGrowthValue, "데이터 없음"),
          status: getStatus(revenueGrowthValue, { good: 0.15, bad: 0 }, true),
          benchmark: `${formatCurrency(revenuePreviousYear)} → ${formatCurrency(revenueCurrentYear)}`,
          interpretation: `${revenueGrowthValue > 0.5 ? "폭발적 성장!" : revenueGrowthValue > 0.15 ? "고성장" : revenueGrowthValue > 0 ? "안정적 성장" : "역성장"}`,
        } : {
          name: `연간 매출 (${dataYearLabel})`,
          description: "💡 1년간 총 판매 금액. 기업 규모 파악용",
          value: actualRevenue > 0 ? formatCurrency(actualRevenue) : "아직 매출 없음",
          status: actualRevenue > 0 ? "green" : "red",
          // v9.22: 분기 데이터로 계산 가능하면 표시
          benchmark: revenuePreviousYear > 0 
            ? `전년: ${formatCurrency(revenuePreviousYear)}` 
            : (hasUsableQuarterlyData 
                ? `📊 분기 추이로 확인하세요` 
                : "신규 상장/분사 기업"),
          interpretation: actualRevenue > 0 
            ? `${dataYearLabel} 총 매출`
            : "연구개발 단계 기업",
        },
      ],
      // 분기별 매출 추이 (차트용)
      quarterlyTrend: quarterlyTrend.length > 0 ? {
        label: "최근 4분기 매출 추이",
        data: quarterlyTrend.map(q => ({
          quarter: q.quarter,
          value: formatCurrency(q.revenue, "-"),
          raw: q.revenue,
        })),
      } : null,
      whyImportant: isPreRevenueCompany 
        ? [
            "연구개발 단계 기업은 매출 대신 기술력과 현금 보유량이 중요해요",
            "상용화 시점과 시장 잠재력을 확인하세요",
          ]
        : hasRevenueButNoGrowthData
          ? [
              "⚠️ 전년 데이터가 없어 성장률을 정확히 알 수 없어요",
              "최신 실적 발표(10-K, 10-Q)를 직접 확인하세요",
              "IPO 직후 기업은 데이터가 제한적일 수 있어요",
            ]
          : [
              "성장이 멈추면 주가도 멈출 수 있어요",
              "매출보다 이익 성장이 빠르면 효율성이 좋아지는 거예요",
            ],
      caution: isPreRevenueCompany
        ? [
            "아직 매출이 없어 재무 분석이 제한적이에요",
            "현금 소진 속도와 자금 조달 계획을 확인하세요",
          ]
        : hasRevenueButNoGrowthData
          ? [
              "⚠️ 성장률 데이터가 부족해요",
              "Yahoo Finance API 한계로 일부 데이터가 누락될 수 있어요",
              "정확한 정보는 기업 IR 자료를 확인하세요",
            ]
          : turnedProfitable
            ? [
                "🎉 최근 흑자 전환에 성공했어요!",
                "흑자가 지속될지 다음 분기 실적을 확인하세요",
              ]
            : lossExpanded
              ? [
                  "⚠️ 적자가 확대되고 있어요",
                  "현금 보유량과 흑자 전환 시점을 확인하세요",
                ]
              : revenueGrowthValue > 0.5
                ? [
                    "급격한 성장은 지속되기 어려울 수 있어요",
                    "성장 둔화 시 주가 조정 가능성이 있어요",
                  ]
                : revenueGrowthValue < 0 && earningsGrowthValue > 0.5
                  ? [
                      "💡 매출은 줄었지만 이익은 크게 늘었어요",
                      "비용 절감이나 고마진 사업 집중의 결과일 수 있어요",
                    ]
                  : undefined,
    };

    // 💎 현재 몸값
    // PEG 계산 개선 - earningsGrowth 사용
    const calculatedPEG = (per > 0 && earningsGrowthValue > 0) 
      ? per / (earningsGrowthValue * 100) 
      : null;
    const displayPEG = peg > 0 ? peg : calculatedPEG;

    // 업종별 PER 참고 문구
    const getPERContextNote = () => {
      const sector = basicInfo.sector || "";
      const industry = basicInfo.industry || "";
      if (industry.includes("Semiconductor") || industry.includes("Software") || sector === "Technology") {
        return "💡 성장주(기술/반도체)는 PER 40~60도 일반적이에요.";
      }
      if (sector === "Financial Services" || sector === "Energy") {
        return "💡 금융/에너지 업종은 PER 10~20이 보통이에요.";
      }
      return "💡 업종마다 적정 PER이 달라요. 동종 업계와 비교해보세요.";
    };

    const getPERStatus = () => {
      if (isNegativePER) return "yellow";
      // 기준 완화: 60↑ = red, 40~60 = yellow, 15~40 = green
      return getStatus(per, { good: 40, bad: 60 }, false);
    };

    const getPERSummary = () => {
      if (isNegativePER) return "적자 기업이라 PER을 산정하기 어려워요. PSR(매출 대비)이나 PBR(자산 대비)로 평가해야 해요.";
      if (per < 10) return "PER이 매우 낮아요. 저평가일 수도 있고, 성장성이 없다고 평가받는 것일 수도 있어요.";
      if (per < 15) return "PER이 낮은 편이에요. 가치주이거나 성장 기대가 낮은 기업일 수 있어요.";
      if (per < 25) return "PER이 적정 수준이에요. 이익 대비 주가가 합리적인 범위에요.";
      if (per < 40) return "PER이 다소 높지만, 성장주라면 받아들일 수 있는 수준이에요.";
      if (per < 60) return "PER이 높은 편이에요. 미래 성장에 대한 기대가 주가에 반영되어 있어요.";
      return "PER이 매우 높아요. 고성장 기대가 충족되지 않으면 주가 하락 위험이 있어요.";
    };

    const getPERStatusText = () => {
      if (isNegativePER) return "적자 기업";
      if (per < 15) return "낮은 편";
      if (per < 40) return "보통";
      if (per < 60) return "높은 편";
      return "매우 높음";
    };

    const valuation = {
      id: "valuation",
      title: "현재 몸값",
      emoji: "💎",
      status: getPERStatus(),
      statusText: getPERStatusText(),
      summary: getPERSummary(),
      mainValue: isNegativePER ? "적자라 산정 불가" : formatRatio(per, "데이터 없음"),
      mainLabel: perType ? `PER (${perType})` : "PER",
      average: "현재 주가 기준",
      metrics: [
        {
          name: perType ? `PER (${perType})` : "PER (주가수익비율)",
          description: perType === "TTM" 
            ? "💡 최근 12개월 실제 이익 기준" 
            : "💡 예상 이익 기준",
          value: isNegativePER ? "적자 기업" : formatRatio(per, "데이터 없음"),
          status: isNegativePER ? "yellow" : getStatus(per, { good: 40, bad: 60 }, false),
          benchmark: "📅 현재 주가 기준",
          interpretation: isNegativePER 
            ? "적자라 PER 산정 불가" 
            : `${per < 15 ? "낮은 편 (15↓)" : per < 40 ? "보통 (15~40)" : per < 60 ? "높은 편 (40~60)" : "매우 높음 (60↑)"}`,
          contextNote: getPERContextNote(),
        },
        {
          name: "PEG (성장 대비 가격)",
          description: "💡 PER ÷ 이익성장률. 성장주 평가에 유용",
          value: displayPEG && displayPEG > 0 ? formatRatio(displayPEG, "데이터 없음") : "데이터 부족",
          status: displayPEG && displayPEG > 0 
            ? getStatus(displayPEG, { good: 1, bad: 2 }, false) 
            : "yellow",
          benchmark: "📅 예상 성장률 기준",
          interpretation: displayPEG && displayPEG > 0
            ? `${displayPEG < 0.5 ? "매우 낮음 (0.5↓)" : displayPEG < 1 ? "낮은 편 (1↓)" : displayPEG < 2 ? "보통 (1~2)" : "높은 편 (2↑)"}`
            : "데이터 부족",
        },
        {
          name: "PBR (주가순자산비율)",
          description: "💡 주가 ÷ 1주당 순자산. 청산가치 대비 평가",
          value: pbr > 0 ? formatRatio(pbr, "데이터 없음") : "데이터 없음",
          status: pbr > 0 ? getStatus(pbr, { good: 3, bad: 10 }, false) : "yellow",
          benchmark: `📅 ${latestFiscalYear}년 기준`,
          interpretation: pbr > 0
            ? `${pbr < 1 ? "낮은 편 (1↓)" : pbr < 3 ? "보통 (1~3)" : pbr < 5 ? "다소 높음 (3~5)" : "높은 편 (5↑)"}`
            : "데이터 부족",
        },
      ],
      whyImportant: isNegativePER || isLossCompany
        ? [
            "적자 기업은 PER 대신 PSR(매출 대비)이나 PBR(자산 대비)로 평가해요",
            "흑자 전환 시점과 성장 가능성이 더 중요해요",
          ]
        : [
            "업종마다 적정 PER이 달라요 (기술주 vs 금융주)",
            "PEG가 1 이하면 성장률 대비 매력적일 수 있어요",
          ],
      decisionPoint: isNegativePER || isLossCompany
        ? [
            "흑자 전환 가능성이 있다면 → 장기 투자 고려",
            "적자가 지속된다면 → 리스크가 커요",
          ]
        : [
            "성장이 계속되면 → 지금 가격도 정당화됨",
            "성장이 꺾이면 → 비싸게 산 게 됨",
          ],
    };

    // AI 요약 생성
    const generateAISummary = () => {
      const sentences = [];
      
      // 1문장: 성장성
      if (isPreRevenueCompany) {
        sentences.push("아직 매출이 없는 연구개발 단계예요.");
      } else if (revenueGrowthValue > 0.5) {
        sentences.push(`매출이 폭발적으로 성장 중이에요 (${formatPercent(revenueGrowthValue)}).`);
      } else if (revenueGrowthValue > 0.15) {
        sentences.push(`매출이 빠르게 성장 중이에요 (${formatPercent(revenueGrowthValue)}).`);
      } else if (revenueGrowthValue > 0) {
        sentences.push(`매출이 꾸준히 성장 중이에요 (${formatPercent(revenueGrowthValue)}).`);
      } else if (revenueGrowthValue < -0.1) {
        sentences.push(`매출이 감소하고 있어요 (${formatPercent(revenueGrowthValue)}).`);
      } else {
        // 🆕 연간 성장률이 없거나 정체인데, 분기 성장률이 있으면 그걸 사용
        if (latestQoQGrowth !== null && latestQoQGrowth > 0.1) {
          sentences.push(`최근 분기 매출이 빠르게 성장 중이에요 (전분기 대비 ${formatPercent(latestQoQGrowth)}).`);
        } else if (quarterlyYoYGrowth !== null && quarterlyYoYGrowth > 0.1) {
          sentences.push(`최근 분기 매출이 성장 중이에요 (전년 동기 대비 ${formatPercent(quarterlyYoYGrowth)}).`);
        } else {
          sentences.push("매출 성장이 정체 상태예요.");
        }
      }
      
      // 2문장: 수익성 + 재무 건전성
      // 🆕 턴어라운드 케이스 우선 처리
      if (isTurnaroundInProgress) {
        sentences.push("연간으로는 적자지만, 최신 분기에 흑자로 돌아섰어요! 턴어라운드 기대됩니다.");
      } else if (isLossCompany) {
        if (debtToEquity < 0.5) {
          sentences.push("아직 적자지만, 빚이 적어서 버틸 여력은 있어요.");
        } else {
          sentences.push("적자 상태에 빚도 있어서 재무 상황이 좋지 않아요.");
        }
      } else if (isNegativeOCF) {
        sentences.push("장부상 이익은 있지만 실제 현금이 빠져나가고 있어서 주의가 필요해요.");
      } else if (roe > 0.15 && debtToEquity < 0.5) {
        sentences.push("돈도 잘 벌고 빚도 적어서 재무 상태가 튼튼해요.");
      } else if (roe > 0.15) {
        sentences.push("돈은 잘 버는 편이에요.");
      } else if (debtToEquity < 0.3) {
        sentences.push("자본 대비 빚 부담이 적어서 재무가 안정적이에요.");
      } else if (debtToEquity > 1) {
        sentences.push("빚이 많은 편이라 재무 건전성에 주의가 필요해요.");
      } else {
        sentences.push("재무 상태는 평균적인 수준이에요.");
      }
      
      // 3문장: 밸류에이션 (가격)
      // 🆕 턴어라운드 기업은 PER 언급 다르게
      if (isTurnaroundInProgress) {
        sentences.push("흑자 전환 초기라 가격 판단은 조금 더 지켜봐야 해요.");
      } else if (isNegativePER) {
        sentences.push("적자라서 PER로 가격을 판단하기 어려워요.");
      } else if (per > 60) {
        sentences.push("PER이 매우 높아서 가격 부담이 있어요.");
      } else if (per > 40) {
        sentences.push("PER이 높은 편이지만, 성장주에선 일반적인 수준이에요.");
      } else if (per < 15) {
        sentences.push("PER이 낮아서 가격 매력이 있을 수 있어요.");
      } else {
        sentences.push("PER은 보통 수준이에요.");
      }
      
      return sentences.join(" ");
    };

    // 좋은점 / 주의점 생성
    // 🆕 턴어라운드 반영
    const generatePros = () => {
      const pros = [];
      if (isTurnaroundInProgress) pros.push("🎉 최신 분기 흑자 전환 성공!");
      if (roe > 0.15) pros.push(`ROE ${formatPercentNoSign(roe)}로 수익성 우수`);
      if (ocfFromHistory > 0) pros.push(`영업현금흐름 ${formatCurrency(ocfFromHistory)}으로 현금 창출력 양호`);
      if (debtToEquity < 0.5) pros.push(`부채비율 ${formatPercentNoSign(debtToEquity)}로 재무 건전`);
      if (!isPreRevenueCompany && revenueGrowthValue > 0.15) pros.push(`매출 성장률 ${formatPercent(revenueGrowthValue)}로 고성장`);
      // 🆕 분기 성장률도 체크
      if (latestQoQGrowth !== null && latestQoQGrowth > 0.2) pros.push(`최근 분기 매출 ${formatPercent(latestQoQGrowth)} 급성장`);
      if (earningsGrowthValue > 1) pros.push(`순이익 ${formatPercent(earningsGrowthValue)} 급증`);
      if (profitMargin > 0.1) pros.push(`순이익률 ${formatPercentNoSign(profitMargin)}로 마진 우수`);
      if (currentRatio > 5) pros.push(`유동비율 ${formatRatio(currentRatio)}로 현금 풍부`);
      if (pros.length === 0) pros.push("안정적인 사업 구조");
      return pros.slice(0, 3);
    };

    const generateCons = () => {
      const cons = [];
      if (isNegativeOCF) cons.push(`⚠️ 영업현금흐름 적자 (${formatCurrency(ocfFromHistory)})`);
      // 🆕 턴어라운드 중이면 "적자"라고 단정하지 않음
      if (isLossCompany && !isTurnaroundInProgress) cons.push("현재 적자 상태");
      if (isPreRevenueCompany) cons.push("아직 매출 없는 연구개발 단계");
      if (!isNegativePER && per > 60) cons.push(`PER ${formatRatio(per)}로 가격 부담 있음`);
      if (debtToEquity > 1) cons.push(`부채비율 ${formatPercentNoSign(debtToEquity)}로 빚 많음`);
      if (!isPreRevenueCompany && revenueGrowthValue < 0) cons.push("매출 역성장 중");
      if (cons.length === 0) cons.push("시장 변동성 리스크");
      if (cons.length < 2) cons.push("경쟁 심화 가능성");
      return cons.slice(0, 3);
    };

    // v9.26: 관련 종목 추천 (섹터/업종 기반) + 신호등
    const getRelatedStocks = async () => {
      const currentSector = basicInfo.sector;
      const currentIndustry = basicInfo.industry;
      const currentTicker = symbol;
      
      // 섹터/업종별 인기 종목 매핑 (한국명 추가)
      const sectorStocks: Record<string, { ticker: string; name: string; nameKo: string; reason: string }[]> = {
        "Technology": [
          { ticker: "AAPL", name: "Apple", nameKo: "애플", reason: "빅테크 대장주" },
          { ticker: "MSFT", name: "Microsoft", nameKo: "마이크로소프트", reason: "클라우드 & AI 강자" },
          { ticker: "NVDA", name: "NVIDIA", nameKo: "엔비디아", reason: "AI 반도체 1위" },
          { ticker: "GOOGL", name: "Alphabet", nameKo: "구글", reason: "검색 & 광고 독점" },
          { ticker: "META", name: "Meta", nameKo: "메타", reason: "SNS & 메타버스" },
          { ticker: "AMZN", name: "Amazon", nameKo: "아마존", reason: "이커머스 & AWS" },
          { ticker: "TSM", name: "TSMC", nameKo: "TSMC", reason: "반도체 파운드리 1위" },
          { ticker: "AVGO", name: "Broadcom", nameKo: "브로드컴", reason: "AI 네트워크 칩" },
          { ticker: "AMD", name: "AMD", nameKo: "AMD", reason: "CPU & GPU 경쟁자" },
          { ticker: "ORCL", name: "Oracle", nameKo: "오라클", reason: "클라우드 인프라" },
        ],
        "Communication Services": [
          { ticker: "GOOGL", name: "Alphabet", nameKo: "구글", reason: "유튜브 & 검색" },
          { ticker: "META", name: "Meta", nameKo: "메타", reason: "인스타 & 왓츠앱" },
          { ticker: "NFLX", name: "Netflix", nameKo: "넷플릭스", reason: "스트리밍 1위" },
          { ticker: "DIS", name: "Disney", nameKo: "디즈니", reason: "콘텐츠 제국" },
          { ticker: "TMUS", name: "T-Mobile", nameKo: "티모바일", reason: "통신 3위" },
        ],
        "Consumer Cyclical": [
          { ticker: "AMZN", name: "Amazon", nameKo: "아마존", reason: "이커머스 왕" },
          { ticker: "TSLA", name: "Tesla", nameKo: "테슬라", reason: "전기차 선두" },
          { ticker: "HD", name: "Home Depot", nameKo: "홈디포", reason: "홈인테리어 1위" },
          { ticker: "NKE", name: "Nike", nameKo: "나이키", reason: "스포츠웨어 1위" },
          { ticker: "SBUX", name: "Starbucks", nameKo: "스타벅스", reason: "커피 체인 1위" },
          { ticker: "MCD", name: "McDonald's", nameKo: "맥도날드", reason: "패스트푸드 1위" },
        ],
        "Financial Services": [
          { ticker: "JPM", name: "JPMorgan", nameKo: "JP모건", reason: "미국 최대 은행" },
          { ticker: "V", name: "Visa", nameKo: "비자", reason: "결제 네트워크 1위" },
          { ticker: "MA", name: "Mastercard", nameKo: "마스터카드", reason: "결제 네트워크 2위" },
          { ticker: "BAC", name: "Bank of America", nameKo: "뱅크오브아메리카", reason: "미국 2위 은행" },
          { ticker: "GS", name: "Goldman Sachs", nameKo: "골드만삭스", reason: "투자은행 명가" },
        ],
        "Healthcare": [
          { ticker: "UNH", name: "UnitedHealth", nameKo: "유나이티드헬스", reason: "헬스케어 1위" },
          { ticker: "JNJ", name: "Johnson & Johnson", nameKo: "존슨앤존슨", reason: "제약 & 의료기기" },
          { ticker: "LLY", name: "Eli Lilly", nameKo: "일라이릴리", reason: "비만치료제 강자" },
          { ticker: "PFE", name: "Pfizer", nameKo: "화이자", reason: "글로벌 제약사" },
          { ticker: "ABBV", name: "AbbVie", nameKo: "애브비", reason: "바이오 제약" },
        ],
        "Consumer Defensive": [
          { ticker: "WMT", name: "Walmart", nameKo: "월마트", reason: "유통 1위" },
          { ticker: "PG", name: "Procter & Gamble", nameKo: "P&G", reason: "생활용품 1위" },
          { ticker: "COST", name: "Costco", nameKo: "코스트코", reason: "창고형 마트" },
          { ticker: "KO", name: "Coca-Cola", nameKo: "코카콜라", reason: "음료 1위" },
          { ticker: "PEP", name: "PepsiCo", nameKo: "펩시코", reason: "음료 & 스낵" },
        ],
        "Energy": [
          { ticker: "XOM", name: "Exxon Mobil", nameKo: "엑슨모빌", reason: "석유 메이저" },
          { ticker: "CVX", name: "Chevron", nameKo: "쉐브론", reason: "에너지 대장주" },
          { ticker: "COP", name: "ConocoPhillips", nameKo: "코노코필립스", reason: "석유 생산" },
          { ticker: "SLB", name: "Schlumberger", nameKo: "슐룸버거", reason: "유전 서비스" },
        ],
        "Industrials": [
          { ticker: "CAT", name: "Caterpillar", nameKo: "캐터필러", reason: "건설장비 1위" },
          { ticker: "BA", name: "Boeing", nameKo: "보잉", reason: "항공기 제조" },
          { ticker: "UPS", name: "UPS", nameKo: "UPS", reason: "물류 대장주" },
          { ticker: "HON", name: "Honeywell", nameKo: "하니웰", reason: "산업 자동화" },
          { ticker: "GE", name: "GE Aerospace", nameKo: "GE에어로", reason: "항공 엔진" },
        ],
        "Utilities": [
          { ticker: "NEE", name: "NextEra Energy", nameKo: "넥스트에라", reason: "신재생에너지 1위" },
          { ticker: "DUK", name: "Duke Energy", nameKo: "듀크에너지", reason: "전력 유틸리티" },
          { ticker: "SO", name: "Southern Company", nameKo: "서던컴퍼니", reason: "남부 전력" },
        ],
        "Real Estate": [
          { ticker: "AMT", name: "American Tower", nameKo: "아메리칸타워", reason: "통신 타워 리츠" },
          { ticker: "PLD", name: "Prologis", nameKo: "프로로지스", reason: "물류 창고 리츠" },
          { ticker: "EQIX", name: "Equinix", nameKo: "에퀴닉스", reason: "데이터센터 리츠" },
        ],
        "Basic Materials": [
          { ticker: "LIN", name: "Linde", nameKo: "린데", reason: "산업가스 1위" },
          { ticker: "APD", name: "Air Products", nameKo: "에어프로덕츠", reason: "수소 & 가스" },
          { ticker: "FCX", name: "Freeport-McMoRan", nameKo: "프리포트맥모란", reason: "구리 채굴" },
        ],
      };
      
      // 특정 종목 연관 매핑 (업종/경쟁사 기반) - 한국명 추가
      const specificRelations: Record<string, { ticker: string; name: string; nameKo: string; reason: string }[]> = {
        // ═══════════════════════════════════════════════════════════════
        // v9.27: 모든 종목 8개로 확장 (테마 4개 + 관련 4개)
        // ═══════════════════════════════════════════════════════════════
        "NVDA": [
          { ticker: "AMD", name: "AMD", nameKo: "AMD", reason: "GPU 경쟁사" },
          { ticker: "TSM", name: "TSMC", nameKo: "TSMC", reason: "NVDA 칩 생산" },
          { ticker: "AVGO", name: "Broadcom", nameKo: "브로드컴", reason: "AI 네트워크 칩" },
          { ticker: "MRVL", name: "Marvell", nameKo: "마벨", reason: "데이터센터 반도체" },
          { ticker: "SMCI", name: "Super Micro", nameKo: "슈퍼마이크로", reason: "AI 서버" },
          { ticker: "ARM", name: "ARM Holdings", nameKo: "ARM", reason: "칩 설계 IP" },
          { ticker: "CRDO", name: "Credo", nameKo: "크리도", reason: "AI 연결 솔루션" },
          { ticker: "INTC", name: "Intel", nameKo: "인텔", reason: "CPU/GPU 경쟁" },
        ],
        "AAPL": [
          { ticker: "MSFT", name: "Microsoft", nameKo: "마이크로소프트", reason: "빅테크 라이벌" },
          { ticker: "GOOGL", name: "Alphabet", nameKo: "구글", reason: "스마트폰 OS 경쟁" },
          { ticker: "QCOM", name: "Qualcomm", nameKo: "퀄컴", reason: "모바일 칩" },
          { ticker: "TSM", name: "TSMC", nameKo: "TSMC", reason: "애플 칩 생산" },
          { ticker: "META", name: "Meta", nameKo: "메타", reason: "XR 경쟁" },
          { ticker: "AVGO", name: "Broadcom", nameKo: "브로드컴", reason: "무선칩 공급" },
          { ticker: "NVDA", name: "NVIDIA", nameKo: "엔비디아", reason: "AI 반도체" },
          { ticker: "AMZN", name: "Amazon", nameKo: "아마존", reason: "빅테크 경쟁" },
        ],
        "TSLA": [
          { ticker: "RIVN", name: "Rivian", nameKo: "리비안", reason: "전기 픽업트럭" },
          { ticker: "LCID", name: "Lucid", nameKo: "루시드", reason: "프리미엄 EV" },
          { ticker: "F", name: "Ford", nameKo: "포드", reason: "F-150 라이트닝" },
          { ticker: "GM", name: "General Motors", nameKo: "GM", reason: "EV 전환 중" },
          { ticker: "NIO", name: "NIO", nameKo: "니오", reason: "중국 프리미엄 EV" },
          { ticker: "XPEV", name: "XPeng", nameKo: "샤오펑", reason: "중국 EV" },
          { ticker: "LI", name: "Li Auto", nameKo: "리오토", reason: "중국 EV" },
          { ticker: "NVDA", name: "NVIDIA", nameKo: "엔비디아", reason: "자율주행 칩" },
        ],
        "AMZN": [
          { ticker: "SHOP", name: "Shopify", nameKo: "쇼피파이", reason: "이커머스 플랫폼" },
          { ticker: "WMT", name: "Walmart", nameKo: "월마트", reason: "오프라인 유통" },
          { ticker: "MSFT", name: "Microsoft", nameKo: "마이크로소프트", reason: "클라우드 경쟁" },
          { ticker: "GOOGL", name: "Alphabet", nameKo: "구글", reason: "클라우드 3위" },
          { ticker: "BABA", name: "Alibaba", nameKo: "알리바바", reason: "글로벌 이커머스" },
          { ticker: "MELI", name: "MercadoLibre", nameKo: "메르카도리브레", reason: "남미 이커머스" },
          { ticker: "CRM", name: "Salesforce", nameKo: "세일즈포스", reason: "클라우드 SaaS" },
          { ticker: "AAPL", name: "Apple", nameKo: "애플", reason: "빅테크 경쟁" },
        ],
        "GOOGL": [
          { ticker: "META", name: "Meta", nameKo: "메타", reason: "디지털 광고 경쟁" },
          { ticker: "MSFT", name: "Microsoft", nameKo: "마이크로소프트", reason: "AI 검색 경쟁" },
          { ticker: "SNAP", name: "Snap", nameKo: "스냅", reason: "소셜 광고" },
          { ticker: "AMZN", name: "Amazon", nameKo: "아마존", reason: "광고 성장 중" },
          { ticker: "TTD", name: "The Trade Desk", nameKo: "트레이드데스크", reason: "광고 테크" },
          { ticker: "NFLX", name: "Netflix", nameKo: "넷플릭스", reason: "스트리밍 경쟁" },
          { ticker: "PINS", name: "Pinterest", nameKo: "핀터레스트", reason: "이미지 검색" },
          { ticker: "AAPL", name: "Apple", nameKo: "애플", reason: "빅테크 경쟁" },
        ],
        "MSFT": [
          { ticker: "GOOGL", name: "Alphabet", nameKo: "구글", reason: "클라우드 & AI 경쟁" },
          { ticker: "CRM", name: "Salesforce", nameKo: "세일즈포스", reason: "기업 SaaS 경쟁" },
          { ticker: "ORCL", name: "Oracle", nameKo: "오라클", reason: "클라우드 DB" },
          { ticker: "AMZN", name: "Amazon", nameKo: "아마존", reason: "클라우드 1위 AWS" },
          { ticker: "AAPL", name: "Apple", nameKo: "애플", reason: "빅테크 경쟁" },
          { ticker: "NOW", name: "ServiceNow", nameKo: "서비스나우", reason: "기업 자동화" },
          { ticker: "SNOW", name: "Snowflake", nameKo: "스노우플레이크", reason: "데이터 클라우드" },
          { ticker: "PLTR", name: "Palantir", nameKo: "팔란티어", reason: "AI 데이터 분석" },
        ],
        "META": [
          { ticker: "GOOGL", name: "Alphabet", nameKo: "구글", reason: "디지털 광고 1위" },
          { ticker: "SNAP", name: "Snap", nameKo: "스냅", reason: "젊은 층 소셜" },
          { ticker: "PINS", name: "Pinterest", nameKo: "핀터레스트", reason: "이미지 소셜" },
          { ticker: "NFLX", name: "Netflix", nameKo: "넷플릭스", reason: "콘텐츠 경쟁" },
          { ticker: "TTD", name: "The Trade Desk", nameKo: "트레이드데스크", reason: "광고 테크" },
          { ticker: "SPOT", name: "Spotify", nameKo: "스포티파이", reason: "오디오 플랫폼" },
          { ticker: "RBLX", name: "Roblox", nameKo: "로블록스", reason: "메타버스 경쟁" },
          { ticker: "AAPL", name: "Apple", nameKo: "애플", reason: "XR 경쟁" },
        ],
        "AMD": [
          { ticker: "NVDA", name: "NVIDIA", nameKo: "엔비디아", reason: "GPU 시장 1위" },
          { ticker: "INTC", name: "Intel", nameKo: "인텔", reason: "CPU 경쟁사" },
          { ticker: "QCOM", name: "Qualcomm", nameKo: "퀄컴", reason: "모바일 칩" },
          { ticker: "TSM", name: "TSMC", nameKo: "TSMC", reason: "AMD 칩 생산" },
          { ticker: "AVGO", name: "Broadcom", nameKo: "브로드컴", reason: "반도체 경쟁" },
          { ticker: "MRVL", name: "Marvell", nameKo: "마벨", reason: "데이터센터 칩" },
          { ticker: "ARM", name: "ARM Holdings", nameKo: "ARM", reason: "칩 설계 IP" },
          { ticker: "MU", name: "Micron", nameKo: "마이크론", reason: "메모리 반도체" },
        ],
        "TSM": [
          { ticker: "NVDA", name: "NVIDIA", nameKo: "엔비디아", reason: "최대 고객사" },
          { ticker: "AAPL", name: "Apple", nameKo: "애플", reason: "주요 고객사" },
          { ticker: "AMD", name: "AMD", nameKo: "AMD", reason: "주요 고객사" },
          { ticker: "INTC", name: "Intel", nameKo: "인텔", reason: "파운드리 경쟁" },
          { ticker: "AVGO", name: "Broadcom", nameKo: "브로드컴", reason: "고객사" },
          { ticker: "QCOM", name: "Qualcomm", nameKo: "퀄컴", reason: "고객사" },
          { ticker: "ASML", name: "ASML", nameKo: "ASML", reason: "장비 공급사" },
          { ticker: "AMAT", name: "Applied Materials", nameKo: "어플라이드", reason: "장비 공급" },
        ],
        "AVGO": [
          { ticker: "NVDA", name: "NVIDIA", nameKo: "엔비디아", reason: "AI 반도체 1위" },
          { ticker: "MRVL", name: "Marvell", nameKo: "마벨", reason: "데이터센터 경쟁" },
          { ticker: "QCOM", name: "Qualcomm", nameKo: "퀄컴", reason: "통신 칩 경쟁" },
          { ticker: "CRDO", name: "Credo", nameKo: "크리도", reason: "AI 연결 솔루션" },
          { ticker: "AMD", name: "AMD", nameKo: "AMD", reason: "반도체 경쟁" },
          { ticker: "TSM", name: "TSMC", nameKo: "TSMC", reason: "칩 생산" },
          { ticker: "INTC", name: "Intel", nameKo: "인텔", reason: "반도체 경쟁" },
          { ticker: "TXN", name: "Texas Instruments", nameKo: "텍사스인스트루먼트", reason: "아날로그 칩" },
        ],
        "PLTR": [
          { ticker: "AI", name: "C3.ai", nameKo: "씨쓰리에이아이", reason: "기업용 AI" },
          { ticker: "SNOW", name: "Snowflake", nameKo: "스노우플레이크", reason: "데이터 분석" },
          { ticker: "INOD", name: "Innodata", nameKo: "이노데이터", reason: "AI 데이터" },
          { ticker: "BBAI", name: "BigBear.ai", nameKo: "빅베어에이아이", reason: "AI 분석" },
          { ticker: "SOUN", name: "SoundHound", nameKo: "사운드하운드", reason: "음성 AI" },
          { ticker: "MSFT", name: "Microsoft", nameKo: "마이크로소프트", reason: "기업 AI 경쟁" },
          { ticker: "CRM", name: "Salesforce", nameKo: "세일즈포스", reason: "기업 SW" },
          { ticker: "NVDA", name: "NVIDIA", nameKo: "엔비디아", reason: "AI 인프라" },
        ],
        "INOD": [
          { ticker: "PLTR", name: "Palantir", nameKo: "팔란티어", reason: "AI 분석 대장" },
          { ticker: "AI", name: "C3.ai", nameKo: "씨쓰리에이아이", reason: "기업용 AI" },
          { ticker: "BBAI", name: "BigBear.ai", nameKo: "빅베어에이아이", reason: "AI 분석" },
          { ticker: "SOUN", name: "SoundHound", nameKo: "사운드하운드", reason: "음성 AI" },
          { ticker: "SNOW", name: "Snowflake", nameKo: "스노우플레이크", reason: "데이터 분석" },
          { ticker: "TEM", name: "Tempus AI", nameKo: "템퍼스", reason: "헬스케어 AI" },
          { ticker: "PATH", name: "UiPath", nameKo: "유아이패스", reason: "AI 자동화" },
          { ticker: "NVDA", name: "NVIDIA", nameKo: "엔비디아", reason: "AI 인프라" },
        ],
        "GLW": [
          { ticker: "COHR", name: "Coherent", nameKo: "코히런트", reason: "광통신 장비" },
          { ticker: "AVGO", name: "Broadcom", nameKo: "브로드컴", reason: "광통신 칩" },
          { ticker: "AAPL", name: "Apple", nameKo: "애플", reason: "고릴라글라스" },
          { ticker: "LITE", name: "Lumentum", nameKo: "루멘텀", reason: "광학 부품" },
          { ticker: "CRDO", name: "Credo", nameKo: "크리도", reason: "연결 솔루션" },
          { ticker: "ANET", name: "Arista", nameKo: "아리스타", reason: "네트워크 장비" },
          { ticker: "NVDA", name: "NVIDIA", nameKo: "엔비디아", reason: "AI 인프라" },
          { ticker: "CSCO", name: "Cisco", nameKo: "시스코", reason: "네트워크 장비" },
        ],
        "COHR": [
          { ticker: "GLW", name: "Corning", nameKo: "코닝", reason: "광섬유 & 유리" },
          { ticker: "LITE", name: "Lumentum", nameKo: "루멘텀", reason: "광학 장비 경쟁" },
          { ticker: "AVGO", name: "Broadcom", nameKo: "브로드컴", reason: "광통신 칩" },
          { ticker: "CRDO", name: "Credo", nameKo: "크리도", reason: "고속 연결" },
          { ticker: "ANET", name: "Arista", nameKo: "아리스타", reason: "네트워크" },
          { ticker: "NVDA", name: "NVIDIA", nameKo: "엔비디아", reason: "AI 인프라" },
          { ticker: "MRVL", name: "Marvell", nameKo: "마벨", reason: "데이터센터" },
          { ticker: "CSCO", name: "Cisco", nameKo: "시스코", reason: "네트워크" },
        ],
        "CRDO": [
          { ticker: "AVGO", name: "Broadcom", nameKo: "브로드컴", reason: "AI 네트워크 1위" },
          { ticker: "MRVL", name: "Marvell", nameKo: "마벨", reason: "데이터센터" },
          { ticker: "COHR", name: "Coherent", nameKo: "코히런트", reason: "광통신" },
          { ticker: "NVDA", name: "NVIDIA", nameKo: "엔비디아", reason: "AI 반도체" },
          { ticker: "ANET", name: "Arista", nameKo: "아리스타", reason: "네트워크" },
          { ticker: "GLW", name: "Corning", nameKo: "코닝", reason: "광섬유" },
          { ticker: "LITE", name: "Lumentum", nameKo: "루멘텀", reason: "광학" },
          { ticker: "CSCO", name: "Cisco", nameKo: "시스코", reason: "네트워크" },
        ],
        "MRVL": [
          { ticker: "AVGO", name: "Broadcom", nameKo: "브로드컴", reason: "데이터센터 경쟁" },
          { ticker: "NVDA", name: "NVIDIA", nameKo: "엔비디아", reason: "AI 반도체 1위" },
          { ticker: "CRDO", name: "Credo", nameKo: "크리도", reason: "연결 솔루션" },
          { ticker: "AMD", name: "AMD", nameKo: "AMD", reason: "데이터센터 경쟁" },
          { ticker: "ANET", name: "Arista", nameKo: "아리스타", reason: "네트워크" },
          { ticker: "TSM", name: "TSMC", nameKo: "TSMC", reason: "칩 생산" },
          { ticker: "QCOM", name: "Qualcomm", nameKo: "퀄컴", reason: "통신 칩" },
          { ticker: "INTC", name: "Intel", nameKo: "인텔", reason: "반도체 경쟁" },
        ],
        "SMCI": [
          { ticker: "NVDA", name: "NVIDIA", nameKo: "엔비디아", reason: "GPU 서버 공급" },
          { ticker: "DELL", name: "Dell", nameKo: "델", reason: "서버 경쟁" },
          { ticker: "HPE", name: "HP Enterprise", nameKo: "HPE", reason: "서버 경쟁" },
          { ticker: "VRT", name: "Vertiv", nameKo: "버티브", reason: "데이터센터 인프라" },
          { ticker: "AMD", name: "AMD", nameKo: "AMD", reason: "서버 CPU" },
          { ticker: "ANET", name: "Arista", nameKo: "아리스타", reason: "네트워크" },
          { ticker: "EQIX", name: "Equinix", nameKo: "에퀴닉스", reason: "데이터센터" },
          { ticker: "AVGO", name: "Broadcom", nameKo: "브로드컴", reason: "네트워크 칩" },
        ],
        "VRT": [
          { ticker: "ETN", name: "Eaton", nameKo: "이튼", reason: "전력 인프라" },
          { ticker: "SMCI", name: "Super Micro", nameKo: "슈퍼마이크로", reason: "AI 서버" },
          { ticker: "NVDA", name: "NVIDIA", nameKo: "엔비디아", reason: "AI 데이터센터" },
          { ticker: "EQIX", name: "Equinix", nameKo: "에퀴닉스", reason: "데이터센터" },
          { ticker: "VST", name: "Vistra", nameKo: "비스트라", reason: "전력" },
          { ticker: "CEG", name: "Constellation", nameKo: "컨스털레이션", reason: "전력" },
          { ticker: "PWR", name: "Quanta Services", nameKo: "퀀타서비스", reason: "전력 인프라" },
          { ticker: "EMR", name: "Emerson", nameKo: "에머슨", reason: "산업 자동화" },
        ],
        "IONQ": [
          { ticker: "RGTI", name: "Rigetti", nameKo: "리게티", reason: "양자컴퓨터 경쟁" },
          { ticker: "QBTS", name: "D-Wave", nameKo: "디웨이브", reason: "양자컴퓨터" },
          { ticker: "IBM", name: "IBM", nameKo: "IBM", reason: "양자 선두" },
          { ticker: "GOOGL", name: "Alphabet", nameKo: "구글", reason: "양자 우위" },
          { ticker: "MSFT", name: "Microsoft", nameKo: "마이크로소프트", reason: "양자 연구" },
          { ticker: "NVDA", name: "NVIDIA", nameKo: "엔비디아", reason: "양자-AI 협력" },
          { ticker: "AMZN", name: "Amazon", nameKo: "아마존", reason: "양자 클라우드" },
          { ticker: "PLTR", name: "Palantir", nameKo: "팔란티어", reason: "양자 응용" },
        ],
        "RGTI": [
          { ticker: "IONQ", name: "IonQ", nameKo: "아이온큐", reason: "양자컴퓨터 경쟁" },
          { ticker: "QBTS", name: "D-Wave", nameKo: "디웨이브", reason: "양자컴퓨터" },
          { ticker: "IBM", name: "IBM", nameKo: "IBM", reason: "양자 연구" },
          { ticker: "NVDA", name: "NVIDIA", nameKo: "엔비디아", reason: "양자-AI 협력" },
          { ticker: "GOOGL", name: "Alphabet", nameKo: "구글", reason: "양자 연구" },
          { ticker: "MSFT", name: "Microsoft", nameKo: "마이크로소프트", reason: "양자 연구" },
          { ticker: "AMZN", name: "Amazon", nameKo: "아마존", reason: "양자 클라우드" },
          { ticker: "PLTR", name: "Palantir", nameKo: "팔란티어", reason: "양자 응용" },
        ],
        "QBTS": [
          { ticker: "IONQ", name: "IonQ", nameKo: "아이온큐", reason: "양자컴퓨터" },
          { ticker: "RGTI", name: "Rigetti", nameKo: "리게티", reason: "양자컴퓨터" },
          { ticker: "IBM", name: "IBM", nameKo: "IBM", reason: "양자 연구" },
          { ticker: "GOOGL", name: "Alphabet", nameKo: "구글", reason: "양자 연구" },
          { ticker: "MSFT", name: "Microsoft", nameKo: "마이크로소프트", reason: "양자 연구" },
          { ticker: "NVDA", name: "NVIDIA", nameKo: "엔비디아", reason: "양자-AI" },
          { ticker: "AMZN", name: "Amazon", nameKo: "아마존", reason: "양자 클라우드" },
          { ticker: "PLTR", name: "Palantir", nameKo: "팔란티어", reason: "양자 응용" },
        ],
        "SMR": [
          { ticker: "OKLO", name: "Oklo", nameKo: "오클로", reason: "소형원자로 경쟁" },
          { ticker: "CEG", name: "Constellation", nameKo: "컨스털레이션", reason: "원전 운영" },
          { ticker: "CCJ", name: "Cameco", nameKo: "카메코", reason: "우라늄 공급" },
          { ticker: "VST", name: "Vistra", nameKo: "비스트라", reason: "전력 회사" },
          { ticker: "LEU", name: "Centrus", nameKo: "센트러스", reason: "우라늄 농축" },
          { ticker: "NNE", name: "Nano Nuclear", nameKo: "나노뉴클리어", reason: "마이크로원자로" },
          { ticker: "DNN", name: "Denison Mines", nameKo: "데니슨", reason: "우라늄 채굴" },
          { ticker: "UEC", name: "Uranium Energy", nameKo: "우라늄에너지", reason: "우라늄" },
        ],
        "OKLO": [
          { ticker: "SMR", name: "NuScale", nameKo: "뉴스케일", reason: "소형원자로" },
          { ticker: "CEG", name: "Constellation", nameKo: "컨스털레이션", reason: "원전 운영" },
          { ticker: "CCJ", name: "Cameco", nameKo: "카메코", reason: "우라늄" },
          { ticker: "LEU", name: "Centrus", nameKo: "센트러스", reason: "우라늄 농축" },
          { ticker: "NNE", name: "Nano Nuclear", nameKo: "나노뉴클리어", reason: "마이크로원자로" },
          { ticker: "VST", name: "Vistra", nameKo: "비스트라", reason: "전력" },
          { ticker: "DNN", name: "Denison Mines", nameKo: "데니슨", reason: "우라늄" },
          { ticker: "UEC", name: "Uranium Energy", nameKo: "우라늄에너지", reason: "우라늄" },
        ],
        "CEG": [
          { ticker: "VST", name: "Vistra", nameKo: "비스트라", reason: "전력 회사" },
          { ticker: "SMR", name: "NuScale", nameKo: "뉴스케일", reason: "소형원자로" },
          { ticker: "NEE", name: "NextEra", nameKo: "넥스트에라", reason: "신재생 전력" },
          { ticker: "CCJ", name: "Cameco", nameKo: "카메코", reason: "우라늄 공급" },
          { ticker: "OKLO", name: "Oklo", nameKo: "오클로", reason: "소형원자로" },
          { ticker: "ETN", name: "Eaton", nameKo: "이튼", reason: "전력 인프라" },
          { ticker: "SO", name: "Southern Company", nameKo: "서던컴퍼니", reason: "전력" },
          { ticker: "DUK", name: "Duke Energy", nameKo: "듀크에너지", reason: "전력" },
        ],
        "COIN": [
          { ticker: "MSTR", name: "MicroStrategy", nameKo: "마이크로스트래티지", reason: "비트코인 대량 보유" },
          { ticker: "HOOD", name: "Robinhood", nameKo: "로빈후드", reason: "크립토 거래" },
          { ticker: "MARA", name: "Marathon", nameKo: "마라톤", reason: "비트코인 채굴" },
          { ticker: "RIOT", name: "Riot", nameKo: "라이엇", reason: "비트코인 채굴" },
          { ticker: "IREN", name: "Iris Energy", nameKo: "아이렌", reason: "비트코인 채굴" },
          { ticker: "CLSK", name: "CleanSpark", nameKo: "클린스파크", reason: "비트코인 채굴" },
          { ticker: "SQ", name: "Block", nameKo: "블록", reason: "크립토 결제" },
          { ticker: "PYPL", name: "PayPal", nameKo: "페이팔", reason: "크립토 결제" },
        ],
        "MSTR": [
          { ticker: "COIN", name: "Coinbase", nameKo: "코인베이스", reason: "크립토 거래소" },
          { ticker: "MARA", name: "Marathon", nameKo: "마라톤", reason: "비트코인 채굴" },
          { ticker: "RIOT", name: "Riot", nameKo: "라이엇", reason: "비트코인 채굴" },
          { ticker: "CIFR", name: "Cipher", nameKo: "사이퍼", reason: "비트코인 채굴" },
          { ticker: "IREN", name: "Iris Energy", nameKo: "아이렌", reason: "비트코인 채굴" },
          { ticker: "CLSK", name: "CleanSpark", nameKo: "클린스파크", reason: "비트코인 채굴" },
          { ticker: "HOOD", name: "Robinhood", nameKo: "로빈후드", reason: "크립토 거래" },
          { ticker: "SQ", name: "Block", nameKo: "블록", reason: "크립토 결제" },
        ],
        "CIFR": [
          { ticker: "MARA", name: "Marathon", nameKo: "마라톤", reason: "비트코인 채굴 1위" },
          { ticker: "RIOT", name: "Riot", nameKo: "라이엇", reason: "비트코인 채굴" },
          { ticker: "BITF", name: "Bitfarms", nameKo: "비트팜스", reason: "비트코인 채굴" },
          { ticker: "COIN", name: "Coinbase", nameKo: "코인베이스", reason: "크립토 거래소" },
          { ticker: "IREN", name: "Iris Energy", nameKo: "아이렌", reason: "비트코인 채굴" },
          { ticker: "CLSK", name: "CleanSpark", nameKo: "클린스파크", reason: "비트코인 채굴" },
          { ticker: "MSTR", name: "MicroStrategy", nameKo: "마이크로스트래티지", reason: "비트코인 홀더" },
          { ticker: "HUT", name: "Hut 8", nameKo: "허트에이트", reason: "비트코인 채굴" },
        ],
        "BITF": [
          { ticker: "MARA", name: "Marathon", nameKo: "마라톤", reason: "비트코인 채굴 1위" },
          { ticker: "RIOT", name: "Riot", nameKo: "라이엇", reason: "비트코인 채굴" },
          { ticker: "CIFR", name: "Cipher", nameKo: "사이퍼", reason: "비트코인 채굴" },
          { ticker: "COIN", name: "Coinbase", nameKo: "코인베이스", reason: "크립토 거래소" },
          { ticker: "IREN", name: "Iris Energy", nameKo: "아이렌", reason: "비트코인 채굴" },
          { ticker: "CLSK", name: "CleanSpark", nameKo: "클린스파크", reason: "비트코인 채굴" },
          { ticker: "MSTR", name: "MicroStrategy", nameKo: "마이크로스트래티지", reason: "비트코인 홀더" },
          { ticker: "HUT", name: "Hut 8", nameKo: "허트에이트", reason: "비트코인 채굴" },
        ],
        "ONDS": [
          { ticker: "IREN", name: "Iris Energy", nameKo: "아이렌", reason: "비트코인 채굴" },
          { ticker: "SOUN", name: "SoundHound", nameKo: "사운드하운드", reason: "AI 스몰캡" },
          { ticker: "RKLB", name: "Rocket Lab", nameKo: "로켓랩", reason: "우주 스몰캡" },
          { ticker: "PLTR", name: "Palantir", nameKo: "팔란티어", reason: "정부 AI" },
          { ticker: "IONQ", name: "IonQ", nameKo: "아이온큐", reason: "양자컴퓨터" },
          { ticker: "NBIS", name: "Nebius", nameKo: "네비우스", reason: "AI 인프라" },
          { ticker: "RDW", name: "Redwire", nameKo: "레드와이어", reason: "우주" },
          { ticker: "LUNR", name: "Intuitive Machines", nameKo: "인튜이티브", reason: "우주" },
        ],
        "TEM": [
          { ticker: "VEEV", name: "Veeva", nameKo: "비바", reason: "헬스케어 데이터" },
          { ticker: "INOD", name: "Innodata", nameKo: "이노데이터", reason: "AI 데이터" },
          { ticker: "EXAS", name: "Exact Sciences", nameKo: "이그젝트", reason: "진단" },
          { ticker: "ILMN", name: "Illumina", nameKo: "일루미나", reason: "유전체" },
          { ticker: "PLTR", name: "Palantir", nameKo: "팔란티어", reason: "헬스케어 AI" },
          { ticker: "ISRG", name: "Intuitive Surgical", nameKo: "인튜이티브서지컬", reason: "의료 로봇" },
          { ticker: "DXCM", name: "DexCom", nameKo: "덱스컴", reason: "의료기기" },
          { ticker: "TDOC", name: "Teladoc", nameKo: "텔라닥", reason: "원격의료" },
        ],
        "RDW": [
          { ticker: "RKLB", name: "Rocket Lab", nameKo: "로켓랩", reason: "우주 발사체" },
          { ticker: "ASTS", name: "AST SpaceMobile", nameKo: "AST스페이스모바일", reason: "위성 통신" },
          { ticker: "LUNR", name: "Intuitive Machines", nameKo: "인튜이티브", reason: "달 착륙선" },
          { ticker: "SPCE", name: "Virgin Galactic", nameKo: "버진갤럭틱", reason: "우주 관광" },
          { ticker: "PL", name: "Planet Labs", nameKo: "플래닛랩스", reason: "위성 이미지" },
          { ticker: "BKSY", name: "BlackSky", nameKo: "블랙스카이", reason: "위성 이미지" },
          { ticker: "IRDM", name: "Iridium", nameKo: "이리듐", reason: "위성 통신" },
          { ticker: "BA", name: "Boeing", nameKo: "보잉", reason: "우주 대기업" },
        ],
        "SOUN": [
          { ticker: "PLTR", name: "Palantir", nameKo: "팔란티어", reason: "AI 대장" },
          { ticker: "AI", name: "C3.ai", nameKo: "씨쓰리에이아이", reason: "기업용 AI" },
          { ticker: "BBAI", name: "BigBear.ai", nameKo: "빅베어에이아이", reason: "AI 분석" },
          { ticker: "INOD", name: "Innodata", nameKo: "이노데이터", reason: "AI 데이터" },
          { ticker: "NVDA", name: "NVIDIA", nameKo: "엔비디아", reason: "AI 인프라" },
          { ticker: "GOOGL", name: "Alphabet", nameKo: "구글", reason: "음성 AI" },
          { ticker: "AMZN", name: "Amazon", nameKo: "아마존", reason: "알렉사" },
          { ticker: "AAPL", name: "Apple", nameKo: "애플", reason: "시리" },
        ],
        "INTC": [
          { ticker: "AMD", name: "AMD", nameKo: "AMD", reason: "CPU 경쟁사" },
          { ticker: "NVDA", name: "NVIDIA", nameKo: "엔비디아", reason: "AI 칩 경쟁" },
          { ticker: "TSM", name: "TSMC", nameKo: "TSMC", reason: "파운드리 경쟁" },
          { ticker: "QCOM", name: "Qualcomm", nameKo: "퀄컴", reason: "모바일 칩" },
          { ticker: "AVGO", name: "Broadcom", nameKo: "브로드컴", reason: "반도체" },
          { ticker: "ARM", name: "ARM Holdings", nameKo: "ARM", reason: "칩 설계" },
          { ticker: "MU", name: "Micron", nameKo: "마이크론", reason: "메모리" },
          { ticker: "TXN", name: "Texas Instruments", nameKo: "TI", reason: "아날로그" },
        ],
        "QCOM": [
          { ticker: "AVGO", name: "Broadcom", nameKo: "브로드컴", reason: "통신 칩 경쟁" },
          { ticker: "NVDA", name: "NVIDIA", nameKo: "엔비디아", reason: "AI 칩" },
          { ticker: "AMD", name: "AMD", nameKo: "AMD", reason: "모바일 칩 경쟁" },
          { ticker: "AAPL", name: "Apple", nameKo: "애플", reason: "주요 고객" },
          { ticker: "INTC", name: "Intel", nameKo: "인텔", reason: "칩 경쟁" },
          { ticker: "TSM", name: "TSMC", nameKo: "TSMC", reason: "칩 생산" },
          { ticker: "ARM", name: "ARM Holdings", nameKo: "ARM", reason: "칩 설계" },
          { ticker: "MRVL", name: "Marvell", nameKo: "마벨", reason: "통신 칩" },
        ],
        "ORCL": [
          { ticker: "MSFT", name: "Microsoft", nameKo: "마이크로소프트", reason: "클라우드 경쟁" },
          { ticker: "CRM", name: "Salesforce", nameKo: "세일즈포스", reason: "기업 SW 경쟁" },
          { ticker: "GOOGL", name: "Alphabet", nameKo: "구글", reason: "클라우드 경쟁" },
          { ticker: "AMZN", name: "Amazon", nameKo: "아마존", reason: "AWS 경쟁" },
          { ticker: "SAP", name: "SAP", nameKo: "SAP", reason: "기업 SW 경쟁" },
          { ticker: "NOW", name: "ServiceNow", nameKo: "서비스나우", reason: "기업 SW" },
          { ticker: "SNOW", name: "Snowflake", nameKo: "스노우플레이크", reason: "데이터 클라우드" },
          { ticker: "IBM", name: "IBM", nameKo: "IBM", reason: "기업 IT" },
        ],
        "SNOW": [
          { ticker: "DDOG", name: "Datadog", nameKo: "데이터독", reason: "클라우드 모니터링" },
          { ticker: "MDB", name: "MongoDB", nameKo: "몽고DB", reason: "클라우드 DB" },
          { ticker: "PLTR", name: "Palantir", nameKo: "팔란티어", reason: "데이터 분석" },
          { ticker: "NET", name: "Cloudflare", nameKo: "클라우드플레어", reason: "클라우드 인프라" },
          { ticker: "CRM", name: "Salesforce", nameKo: "세일즈포스", reason: "기업 SaaS" },
          { ticker: "MSFT", name: "Microsoft", nameKo: "마이크로소프트", reason: "데이터 경쟁" },
          { ticker: "GOOGL", name: "Alphabet", nameKo: "구글", reason: "빅쿼리 경쟁" },
          { ticker: "ORCL", name: "Oracle", nameKo: "오라클", reason: "DB 경쟁" },
        ],
        "ALAB": [
          { ticker: "NVDA", name: "NVIDIA", nameKo: "엔비디아", reason: "AI 반도체 대장" },
          { ticker: "AVGO", name: "Broadcom", nameKo: "브로드컴", reason: "AI 네트워크 칩" },
          { ticker: "MRVL", name: "Marvell", nameKo: "마벨", reason: "데이터센터 칩" },
          { ticker: "CRDO", name: "Credo", nameKo: "크리도", reason: "연결 솔루션" },
          { ticker: "AMD", name: "AMD", nameKo: "AMD", reason: "AI 칩 경쟁" },
          { ticker: "TSM", name: "TSMC", nameKo: "TSMC", reason: "칩 생산" },
          { ticker: "SMCI", name: "Super Micro", nameKo: "슈퍼마이크로", reason: "AI 서버" },
          { ticker: "ANET", name: "Arista", nameKo: "아리스타", reason: "네트워크" },
        ],
        // ═══════════════════════════════════════════════════════════════
        // v9.25: 데이터 기반 + 테마 기반 하이브리드 매핑 추가
        // 앞 4개: 테마/섹터 기반, 뒤 4개: SQL 분석 "함께 조회" 기반
        // ═══════════════════════════════════════════════════════════════
        
        // 비트코인 채굴
        "IREN": [
          { ticker: "CIFR", name: "Cipher Mining", nameKo: "사이퍼", reason: "비트코인 채굴" },
          { ticker: "BITF", name: "Bitfarms", nameKo: "비트팜스", reason: "비트코인 채굴" },
          { ticker: "CLSK", name: "CleanSpark", nameKo: "클린스파크", reason: "친환경 채굴" },
          { ticker: "MARA", name: "Marathon Digital", nameKo: "마라톤", reason: "비트코인 채굴 1위" },
          { ticker: "AVGO", name: "Broadcom", nameKo: "브로드컴", reason: "함께 조회 많음" },
          { ticker: "CRDO", name: "Credo", nameKo: "크리도", reason: "함께 조회 많음" },
          { ticker: "RDW", name: "Redwire", nameKo: "레드와이어", reason: "함께 조회 많음" },
          { ticker: "IONQ", name: "IonQ", nameKo: "아이온큐", reason: "함께 조회 많음" },
        ],
        "CLSK": [
          { ticker: "IREN", name: "Iris Energy", nameKo: "아이렌", reason: "비트코인 채굴" },
          { ticker: "MARA", name: "Marathon Digital", nameKo: "마라톤", reason: "비트코인 채굴 1위" },
          { ticker: "RIOT", name: "Riot Platforms", nameKo: "라이엇", reason: "비트코인 채굴" },
          { ticker: "CIFR", name: "Cipher Mining", nameKo: "사이퍼", reason: "비트코인 채굴" },
          { ticker: "BITF", name: "Bitfarms", nameKo: "비트팜스", reason: "비트코인 채굴" },
          { ticker: "COIN", name: "Coinbase", nameKo: "코인베이스", reason: "크립토 거래소" },
          { ticker: "MSTR", name: "MicroStrategy", nameKo: "마이크로스트래티지", reason: "비트코인 홀더" },
          { ticker: "HUT", name: "Hut 8", nameKo: "허트에이트", reason: "비트코인 채굴" },
        ],
        "NBIS": [
          { ticker: "IREN", name: "Iris Energy", nameKo: "아이렌", reason: "비트코인 채굴" },
          { ticker: "BITF", name: "Bitfarms", nameKo: "비트팜스", reason: "비트코인 채굴" },
          { ticker: "CIFR", name: "Cipher Mining", nameKo: "사이퍼", reason: "비트코인 채굴" },
          { ticker: "CLSK", name: "CleanSpark", nameKo: "클린스파크", reason: "비트코인 채굴" },
          { ticker: "CRDO", name: "Credo", nameKo: "크리도", reason: "함께 조회 많음" },
          { ticker: "BE", name: "Bloom Energy", nameKo: "블룸에너지", reason: "함께 조회 많음" },
          { ticker: "IONQ", name: "IonQ", nameKo: "아이온큐", reason: "함께 조회 많음" },
          { ticker: "ONDS", name: "Ondas Holdings", nameKo: "온다스", reason: "함께 조회 많음" },
        ],
        // 우주항공
        "RKLB": [
          { ticker: "ASTS", name: "AST SpaceMobile", nameKo: "AST스페이스모바일", reason: "우주 통신 위성" },
          { ticker: "LUNR", name: "Intuitive Machines", nameKo: "인튜이티브머신스", reason: "달 착륙선" },
          { ticker: "RDW", name: "Redwire", nameKo: "레드와이어", reason: "우주 인프라" },
          { ticker: "PL", name: "Planet Labs", nameKo: "플래닛랩스", reason: "위성 이미지" },
          { ticker: "SMR", name: "NuScale", nameKo: "뉴스케일", reason: "함께 조회 많음" },
          { ticker: "CRDO", name: "Credo", nameKo: "크리도", reason: "함께 조회 많음" },
          { ticker: "AVGO", name: "Broadcom", nameKo: "브로드컴", reason: "함께 조회 많음" },
          { ticker: "PLTR", name: "Palantir", nameKo: "팔란티어", reason: "함께 조회 많음" },
        ],
        "ASTS": [
          { ticker: "RKLB", name: "Rocket Lab", nameKo: "로켓랩", reason: "우주 발사체" },
          { ticker: "LUNR", name: "Intuitive Machines", nameKo: "인튜이티브머신스", reason: "우주 탐사" },
          { ticker: "RDW", name: "Redwire", nameKo: "레드와이어", reason: "우주 인프라" },
          { ticker: "PL", name: "Planet Labs", nameKo: "플래닛랩스", reason: "위성 서비스" },
          { ticker: "SMR", name: "NuScale", nameKo: "뉴스케일", reason: "함께 조회 많음" },
          { ticker: "TEM", name: "Tempus AI", nameKo: "템퍼스", reason: "함께 조회 많음" },
          { ticker: "AVGO", name: "Broadcom", nameKo: "브로드컴", reason: "함께 조회 많음" },
          { ticker: "BKSY", name: "BlackSky", nameKo: "블랙스카이", reason: "위성 이미지 경쟁" },
        ],
        "PL": [
          { ticker: "RKLB", name: "Rocket Lab", nameKo: "로켓랩", reason: "우주 발사체" },
          { ticker: "ASTS", name: "AST SpaceMobile", nameKo: "AST스페이스모바일", reason: "위성 통신" },
          { ticker: "RDW", name: "Redwire", nameKo: "레드와이어", reason: "우주 인프라" },
          { ticker: "LUNR", name: "Intuitive Machines", nameKo: "인튜이티브머신스", reason: "달 탐사" },
          { ticker: "BKSY", name: "BlackSky", nameKo: "블랙스카이", reason: "위성 이미지 경쟁" },
          { ticker: "SPIR", name: "Spire Global", nameKo: "스파이어", reason: "위성 데이터" },
          { ticker: "IRDM", name: "Iridium", nameKo: "이리듐", reason: "위성 통신" },
          { ticker: "PLTR", name: "Palantir", nameKo: "팔란티어", reason: "함께 조회 많음" },
        ],
        // 스토리지/메모리
        "SNDK": [
          { ticker: "MU", name: "Micron", nameKo: "마이크론", reason: "메모리 반도체" },
          { ticker: "WDC", name: "Western Digital", nameKo: "웨스턴디지털", reason: "스토리지 경쟁사" },
          { ticker: "STX", name: "Seagate", nameKo: "씨게이트", reason: "HDD 경쟁사" },
          { ticker: "PSTG", name: "Pure Storage", nameKo: "퓨어스토리지", reason: "플래시 스토리지" },
          { ticker: "RKLB", name: "Rocket Lab", nameKo: "로켓랩", reason: "함께 조회 많음" },
          { ticker: "SMR", name: "NuScale", nameKo: "뉴스케일", reason: "함께 조회 많음" },
          { ticker: "CRDO", name: "Credo", nameKo: "크리도", reason: "함께 조회 많음" },
          { ticker: "BE", name: "Bloom Energy", nameKo: "블룸에너지", reason: "함께 조회 많음" },
        ],
        "WDC": [
          { ticker: "MU", name: "Micron", nameKo: "마이크론", reason: "메모리 반도체" },
          { ticker: "STX", name: "Seagate", nameKo: "씨게이트", reason: "HDD 경쟁사" },
          { ticker: "SNDK", name: "SanDisk", nameKo: "샌디스크", reason: "낸드플래시" },
          { ticker: "PSTG", name: "Pure Storage", nameKo: "퓨어스토리지", reason: "플래시 스토리지" },
          { ticker: "INTC", name: "Intel", nameKo: "인텔", reason: "함께 조회 많음" },
          { ticker: "CRDO", name: "Credo", nameKo: "크리도", reason: "함께 조회 많음" },
          { ticker: "AMAT", name: "Applied Materials", nameKo: "어플라이드", reason: "반도체 장비" },
          { ticker: "LRCX", name: "Lam Research", nameKo: "램리서치", reason: "반도체 장비" },
        ],
        // 전력 인프라
        "ETN": [
          { ticker: "VRT", name: "Vertiv", nameKo: "버티브", reason: "데이터센터 전력" },
          { ticker: "VST", name: "Vistra", nameKo: "비스트라", reason: "전력 유틸리티" },
          { ticker: "CEG", name: "Constellation", nameKo: "컨스털레이션", reason: "전력 회사" },
          { ticker: "GEV", name: "GE Vernova", nameKo: "GE버노바", reason: "전력 장비" },
          { ticker: "PWR", name: "Quanta Services", nameKo: "퀀타서비스", reason: "전력 인프라" },
          { ticker: "EMR", name: "Emerson", nameKo: "에머슨", reason: "산업 자동화" },
          { ticker: "ROK", name: "Rockwell", nameKo: "록웰", reason: "산업 자동화" },
          { ticker: "SMCI", name: "Super Micro", nameKo: "슈퍼마이크로", reason: "AI 서버" },
        ],
        // 핀테크
        "HOOD": [
          { ticker: "COIN", name: "Coinbase", nameKo: "코인베이스", reason: "크립토 거래 경쟁" },
          { ticker: "SOFI", name: "SoFi", nameKo: "소파이", reason: "핀테크 경쟁사" },
          { ticker: "SQ", name: "Block", nameKo: "블록(스퀘어)", reason: "핀테크 대장" },
          { ticker: "PYPL", name: "PayPal", nameKo: "페이팔", reason: "결제 플랫폼" },
          { ticker: "AFRM", name: "Affirm", nameKo: "어펌", reason: "BNPL 서비스" },
          { ticker: "NU", name: "Nu Holdings", nameKo: "누뱅크", reason: "디지털 뱅킹" },
          { ticker: "MSTR", name: "MicroStrategy", nameKo: "마이크로스트래티지", reason: "비트코인 관련" },
          { ticker: "AVGO", name: "Broadcom", nameKo: "브로드컴", reason: "함께 조회 많음" },
        ],
        // 수소/클린에너지
        "BE": [
          { ticker: "PLUG", name: "Plug Power", nameKo: "플러그파워", reason: "수소연료전지 대장" },
          { ticker: "FCEL", name: "FuelCell Energy", nameKo: "퓨얼셀", reason: "연료전지" },
          { ticker: "BLDP", name: "Ballard Power", nameKo: "발라드파워", reason: "연료전지" },
          { ticker: "ENPH", name: "Enphase", nameKo: "엔페이즈", reason: "클린에너지" },
          { ticker: "NBIS", name: "Nebius", nameKo: "네비우스", reason: "함께 조회 많음" },
          { ticker: "IONQ", name: "IonQ", nameKo: "아이온큐", reason: "함께 조회 많음" },
          { ticker: "CRDO", name: "Credo", nameKo: "크리도", reason: "함께 조회 많음" },
          { ticker: "SMR", name: "NuScale", nameKo: "뉴스케일", reason: "클린에너지" },
        ],
      };
      
      // v9.26: 신호등 조회 (경량 버전)
      const getSignals = async (ticker: string): Promise<{
        earning: "good" | "normal" | "bad";
        debt: "good" | "normal" | "bad";
        growth: "good" | "normal" | "bad";
        valuation: "good" | "normal" | "bad";
      } | null> => {
        try {
          const signalData = await yahooFinance.quoteSummary(ticker, {
            modules: ["financialData", "defaultKeyStatistics"]
          });
          
          const fd = signalData.financialData;
          const ks = signalData.defaultKeyStatistics;
          
          const roe = fd?.returnOnEquity || 0;
          // debtToEquity는 비율(0.5 = 50%)로 반환됨
          const debtRatio = (fd?.debtToEquity || 0) * 100; // % 단위로 변환
          const revenueGrowth = fd?.revenueGrowth || 0;
          const per = ks?.forwardPE || ks?.trailingPE || 0;
          
          return {
            // ROE: 15%↑ 우수, 5%↑ 보통, 5%↓ 주의
            earning: roe > 0.15 ? "good" : roe > 0.05 ? "normal" : "bad",
            // 부채비율: 30%↓ 우수, 100%↓ 보통, 100%↑ 주의 (상세 페이지와 동일)
            debt: debtRatio < 30 ? "good" : debtRatio < 100 ? "normal" : "bad",
            // 성장률: 15%↑ 우수, 0%↑ 보통, 0%↓ 주의
            growth: revenueGrowth > 0.15 ? "good" : revenueGrowth > 0 ? "normal" : "bad",
            // PER: 25↓ 저평가, 50↓ 보통, 50↑ 고평가
            valuation: per > 0 && per < 25 ? "good" : per > 0 && per < 50 ? "normal" : "bad",
          };
        } catch (error) {
          console.error(`Signal fetch error for ${ticker}:`, error);
          return null;
        }
      };
      
      // 1. 특정 종목 연관이 있으면 우선 사용
      let baseStocks: { ticker: string; name: string; nameKo: string; reason: string }[];
      
      if (specificRelations[currentTicker]) {
        baseStocks = specificRelations[currentTicker]
          .filter(s => s.ticker !== currentTicker)
          .slice(0, 8);
      } else {
        // 2. 같은 섹터 종목 추천
        const sectorList = sectorStocks[currentSector] || sectorStocks["Technology"];
        baseStocks = sectorList
          .filter(s => s.ticker !== currentTicker)
          .slice(0, 8);
      }
      
      // v9.26: 병렬로 신호등 조회
      const stocksWithSignals = await Promise.all(
        baseStocks.map(async (stock) => {
          const signals = await getSignals(stock.ticker);
          return { ...stock, signals };
        })
      );
      
      return stocksWithSignals;
    };

    // v9.26: getRelatedStocks가 async가 되어서 await 필요
    const relatedStocksData = await getRelatedStocks();

    const result = {
      ...basicInfo,
      aiSummary: generateAISummary(),
      pros: generatePros(),
      cons: generateCons(),
      metrics: [earningPower, debtManagement, growthPotential, valuation],
      // v9.26: 관련 종목 추천 (신호등 포함)
      relatedStocks: relatedStocksData,
      // 🆕 턴어라운드 정보 추가
      turnaroundInfo: isTurnaroundInProgress ? {
        isInProgress: true,
        latestQuarterNetIncome: latestQuarterNetIncome,
        annualNetIncome: netIncomeCurrentYear,
        message: "연간 적자지만 최신 분기 흑자 전환!"
      } : null,
      // 데이터 출처 면책 (v9.21: 분기 데이터 우선 표시)
      dataSource: {
        provider: "Yahoo Finance API",
        note: quarterlyTrend.length > 0 
          ? "📊 성장성은 분기 기준, 수익성/부채는 연간 기준이에요"
          : "⚠️ 연간 데이터 기준이며, 최신 분기와 다를 수 있어요",
        lastUpdated: quarterlyTrend.length > 0 
          ? `${quarterlyTrend[quarterlyTrend.length - 1]?.quarter} 분기 기준`
          : (latestFiscalYear ? `${latestFiscalYear}년 연간 기준` : "최근 12개월"),
        disclaimer: "투자 전 기업 IR 자료와 최신 분기 실적을 꼭 확인하세요",
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Stock API Error:", error);
    return NextResponse.json(
      { error: "데이터를 불러오는 중 오류가 발생했어요" },
      { status: 500 }
    );
  }
}
