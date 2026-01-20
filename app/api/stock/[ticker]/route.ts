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

    // Yahoo Finance API 호출 - 현금흐름 데이터 추가
    const [quote, quoteSummary] = await Promise.all([
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
        ],
      }),
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
      // FCF = OCF - CapEx
      const capex = latest?.capitalExpenditures || 0;
      fcfFromHistory = ocfFromHistory + capex; // capex는 보통 음수
    }
    if (cashflowHistory.length >= 2) {
      const prev = cashflowHistory[1];
      ocfPrevYear = prev?.totalCashFromOperatingActivities || 0;
    }

    // 📊 연간 데이터 성장률 계산
    // ⚠️ Yahoo Finance API가 2024.11월부터 incomeStatementHistory 데이터를 잘 안 줌
    // → financialData를 fallback으로 사용
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
    } else {
      // ⚠️ incomeHistory가 없으면 financialData에서 가져오기 (API 변경 대응)
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
    const quarterlyTrend = incomeQuarterly.slice(0, 4).map((q: any) => {
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
    }).reverse(); // 오래된 순으로 정렬

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
    
    // 분기별 YoY 성장률 (같은 분기 전년 대비) - incomeQuarterly에서 5분기 전 데이터가 있으면
    let quarterlyYoYGrowth: number | null = null;
    if (incomeQuarterly.length >= 5) {
      const latestQ = incomeQuarterly[0];
      const sameQLastYear = incomeQuarterly[4]; // 4분기 전 = 작년 같은 분기
      
      if (latestQ?.totalRevenue > 0 && sameQLastYear?.totalRevenue > 0) {
        quarterlyYoYGrowth = (latestQ.totalRevenue - sameQLastYear.totalRevenue) / sameQLastYear.totalRevenue;
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
      if (isPreRevenueCompany) return "아직 매출이 없는 연구개발 단계 기업이에요";
      
      // 🆕 턴어라운드 케이스: 연간 적자지만 최신 분기 흑자
      if (isTurnaroundInProgress) {
        return "연간으로는 적자지만, 최신 분기에 흑자 전환했어요! 🎉";
      }
      
      if (isNegativeOCF) return "장부상 이익은 있지만, 실제 현금이 빠져나가고 있어요";
      if (roe > 0.15) return "돈을 잘 벌고 있어요";
      if (roe > 0.05) return "돈을 적당히 벌고 있어요";
      if (roe < 0) return "현재 적자 상태예요";
      return "수익성이 낮은 편이에요";
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
      average: `${latestFiscalYear}년 연간 기준`,
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

    // 🏦 빚 관리
    const debtManagement = {
      id: "debt",
      title: "빚 관리",
      emoji: "🏦",
      status: getStatus(debtToEquity, { good: 0.5, bad: 1.5 }, false),
      statusText: debtToEquity < 0.5 ? "우수" : debtToEquity < 1.5 ? "보통" : "주의",
      summary: debtToEquity < 0.3
        ? "빚이 거의 없어요"
        : debtToEquity < 1
          ? "빚이 적당해요"
          : "빚이 많은 편이에요",
      mainValue: formatPercentNoSign(debtToEquity, "데이터 없음"),
      mainLabel: "부채비율",
      average: `${latestFiscalYear}년 연간 기준`,
      metrics: [
        {
          name: "부채비율 (빚 ÷ 자본)",
          description: "💡 내 돈 대비 빚이 얼마나 있나? 낮을수록 안전",
          value: formatPercentNoSign(debtToEquity, "데이터 없음"),
          status: getStatus(debtToEquity, { good: 0.5, bad: 1.5 }, false),
          benchmark: `📅 ${latestFiscalYear}년 연간`,
          interpretation: `${debtToEquity < 0.3 ? "우수 (30%↓)" : debtToEquity < 0.5 ? "양호 (50%↓)" : debtToEquity < 1 ? "보통 (100%↓)" : "높음 (100%↑)"}`,
        },
        {
          name: "유동비율 (단기 지급 능력)",
          description: "💡 1년 내 갚을 빚 대비 현금 여유. 1배 이상 필요",
          value: formatRatio(currentRatio, "데이터 없음"),
          status: getStatus(currentRatio, { good: 1.5, bad: 1 }, true),
          benchmark: `📅 ${latestFiscalYear}년 연간`,
          interpretation: `${currentRatio > 2 ? "우수 (2배↑)" : currentRatio > 1.5 ? "양호 (1.5배↑)" : currentRatio > 1 ? "보통 (1배↑)" : "주의 (1배↓)"}`,
        },
      ],
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
      if (isPreRevenueCompany) return "아직 매출이 없는 연구개발 단계예요";
      
      // 연간 성장률 있으면 사용
      if (hasRevenueGrowthData) {
        if (revenueGrowthValue > 0.5) return "폭발적으로 성장하고 있어요!";
        if (revenueGrowthValue > 0.3) return "빠르게 성장하고 있어요";
        if (revenueGrowthValue > 0.1) return "꾸준히 성장하고 있어요";
        if (revenueGrowthValue > 0) return "느리게 성장하고 있어요";
        if (revenueGrowthValue > -0.1) return "성장이 멈춘 상태예요";
        return "매출이 줄어들고 있어요";
      }
      
      // 분기별 대체 가능하면 사용
      if (canUseQuarterlyGrowth && fallbackGrowthRate !== null) {
        const prefix = fallbackGrowthType === "전년 동기 대비" ? "최근 분기" : "전분기 대비";
        if (fallbackGrowthRate > 0.3) return `${prefix} 빠르게 성장하고 있어요`;
        if (fallbackGrowthRate > 0.1) return `${prefix} 꾸준히 성장하고 있어요`;
        if (fallbackGrowthRate > 0) return `${prefix} 성장하고 있어요`;
        if (fallbackGrowthRate > -0.1) return `${prefix} 보합세예요`;
        return `${prefix} 매출이 감소했어요`;
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
          benchmark: revenuePreviousYear > 0 ? `전년: ${formatCurrency(revenuePreviousYear)}` : "전년 데이터 없음",
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
      if (isNegativePER) return "적자 기업이라 PER을 산정하기 어려워요";
      if (per < 15) return "PER이 낮은 편이에요";
      if (per < 40) return "PER이 보통 수준이에요";
      if (per < 60) return "PER이 높은 편이에요";
      return "PER이 매우 높아요";
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
        sentences.push("빚이 거의 없어서 재무가 안정적이에요.");
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

    const result = {
      ...basicInfo,
      aiSummary: generateAISummary(),
      pros: generatePros(),
      cons: generateCons(),
      metrics: [earningPower, debtManagement, growthPotential, valuation],
      // 🆕 턴어라운드 정보 추가
      turnaroundInfo: isTurnaroundInProgress ? {
        isInProgress: true,
        latestQuarterNetIncome: latestQuarterNetIncome,
        annualNetIncome: netIncomeCurrentYear,
        message: "연간 적자지만 최신 분기 흑자 전환!"
      } : null,
      // 데이터 출처 면책 (강화)
      dataSource: {
        provider: "Yahoo Finance API",
        note: "⚠️ 연간 데이터 기준이며, 최신 분기와 다를 수 있어요",
        lastUpdated: latestFiscalYear ? `${latestFiscalYear}년 연간 기준` : "최근 12개월",
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
