import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

function getStatus(value: number, thresholds: { good: number; bad: number }, higherIsBetter: boolean = true): "green" | "yellow" | "red" {
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

function calculateGrowth(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current === 0 && previous === 0) return null;
  if (!previous || previous === 0) return null;
  if (current === null || current === undefined) return 0;
  return (current - previous) / Math.abs(previous);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string; metricId: string }> }
) {
  try {
    const { ticker, metricId } = await params;
    const symbol = ticker.toUpperCase();

    // v9.22: incomeStatementHistoryQuarterly 추가
    const [quote, quoteSummary] = await Promise.all([
      yahooFinance.quote(symbol),
      yahooFinance.quoteSummary(symbol, {
        modules: [
          "summaryProfile", 
          "financialData", 
          "defaultKeyStatistics", 
          "incomeStatementHistory",
          "incomeStatementHistoryQuarterly",  // v9.22: 분기 데이터
          "cashflowStatementHistory"
        ],
      }),
    ]);

    if (!quote) {
      return NextResponse.json({ error: "종목을 찾을 수 없어요" }, { status: 404 });
    }

    const financialData = quoteSummary.financialData;
    const keyStats = quoteSummary.defaultKeyStatistics;
    const incomeHistory = quoteSummary.incomeStatementHistory?.incomeStatementHistory || [];
    const incomeQuarterly = quoteSummary.incomeStatementHistoryQuarterly?.incomeStatementHistory || [];
    const cashflowHistory = quoteSummary.cashflowStatementHistory?.cashflowStatements || [];
    const stockName = quote.shortName || quote.longName || symbol;

    let latestFiscalYear = new Date().getFullYear().toString();
    let revenueCurrentYear = 0, revenuePreviousYear = 0, netIncomeCurrentYear = 0, netIncomePreviousYear = 0;
    let revenueGrowth: number | null = null, earningsGrowth: number | null = null;
    let isPreRevenueCompany = false;
    let currentFiscalYear = "", previousFiscalYear = "";

    if (incomeHistory.length >= 2) {
      const current = incomeHistory[0], previous = incomeHistory[1];
      revenueCurrentYear = current?.totalRevenue || 0;
      revenuePreviousYear = previous?.totalRevenue || 0;
      netIncomeCurrentYear = current?.netIncome || 0;
      netIncomePreviousYear = previous?.netIncome || 0;
      if (current?.endDate) { currentFiscalYear = new Date(current.endDate).getFullYear().toString(); latestFiscalYear = currentFiscalYear; }
      if (previous?.endDate) { previousFiscalYear = new Date(previous.endDate).getFullYear().toString(); }
      revenueGrowth = calculateGrowth(revenueCurrentYear, revenuePreviousYear);
      earningsGrowth = calculateGrowth(netIncomeCurrentYear, netIncomePreviousYear);
      
      if (revenueCurrentYear === 0 && financialData?.totalRevenue) {
        revenueCurrentYear = financialData.totalRevenue;
      }
    } else {
      revenueCurrentYear = financialData?.totalRevenue || 0;
      revenueGrowth = financialData?.revenueGrowth || null;
      earningsGrowth = financialData?.earningsGrowth || null;
      netIncomeCurrentYear = financialData?.netIncomeToCommon || 0;
    }
    
    const actualRevenue = revenueCurrentYear || financialData?.totalRevenue || 0;
    isPreRevenueCompany = actualRevenue === 0;

    // v9.22: 분기별 추이 데이터 계산
    const quarterlyTrend = incomeQuarterly.slice(0, 4).map((q: any) => {
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

    // 분기 성장률 계산
    let latestQoQGrowth: number | null = null;
    let quarterlyGrowthRates: string[] = [];
    
    if (quarterlyTrend.length >= 2) {
      const latest = quarterlyTrend[quarterlyTrend.length - 1];
      const previous = quarterlyTrend[quarterlyTrend.length - 2];
      if (latest.revenue > 0 && previous.revenue > 0) {
        latestQoQGrowth = (latest.revenue - previous.revenue) / previous.revenue;
      }
      
      for (let i = 1; i < quarterlyTrend.length; i++) {
        const prev = quarterlyTrend[i - 1];
        const curr = quarterlyTrend[i];
        if (prev.revenue > 0 && curr.revenue > 0) {
          const growth = ((curr.revenue - prev.revenue) / prev.revenue) * 100;
          quarterlyGrowthRates.push(growth >= 0 ? `+${growth.toFixed(0)}%` : `${growth.toFixed(0)}%`);
        }
      }
    }
    
    const hasUsableQuarterlyData = quarterlyTrend.length >= 2 && quarterlyGrowthRates.length > 0;
    const latestQuarterLabel = quarterlyTrend.length > 0 ? quarterlyTrend[quarterlyTrend.length - 1].quarter : null;

    const growthYearLabel = previousFiscalYear && currentFiscalYear ? `${previousFiscalYear} → ${currentFiscalYear}` : `${latestFiscalYear}년 기준`;
    const revenueGrowthValue = revenueGrowth ?? 0;
    const earningsGrowthValue = earningsGrowth ?? 0;

    const roe = financialData?.returnOnEquity || 0;
    const operatingMargin = financialData?.operatingMargins || 0;
    const profitMargin = financialData?.profitMargins || 0;
    
    // v9.22: debtToEquity, currentRatio는 mrq(최근 분기) 기준
    const debtToEquity = financialData?.debtToEquity ? financialData.debtToEquity / 100 : 0;
    const currentRatio = financialData?.currentRatio || 0;
    const currentQuarterLabel = latestQuarterLabel || `${new Date().getFullYear()}Q${Math.ceil((new Date().getMonth() + 1) / 3)}`;
    
    const trailingPER = keyStats?.trailingPE || quote.trailingPE || 0;
    const forwardPER = keyStats?.forwardPE || 0;
    const per = trailingPER > 0 ? trailingPER : forwardPER;
    const perType = trailingPER > 0 ? "TTM" : (forwardPER > 0 ? "Forward" : "");
    const peg = keyStats?.pegRatio || 0;
    const pbr = keyStats?.priceToBook || 0;

    let ocfFromHistory = financialData?.operatingCashflow || 0;
    let fcfFromHistory: number | null = financialData?.freeCashflow || 0;
    if (cashflowHistory.length >= 1) {
      const latest = cashflowHistory[0];
      ocfFromHistory = latest?.totalCashFromOperatingActivities || ocfFromHistory;
      // v9.24: FCF = OCF - CapEx (capex가 0이면 financialData 사용)
      const capex = latest?.capitalExpenditures || 0;
      if (capex !== 0) {
        fcfFromHistory = ocfFromHistory + capex; // capex는 보통 음수
      } else if (financialData?.freeCashflow) {
        fcfFromHistory = financialData.freeCashflow;
      } else {
        fcfFromHistory = null; // 계산 불가
      }
    }

    const isNegativeOCF = ocfFromHistory < 0;
    const isNegativePER = per < 0;
    const isLossCompany = netIncomeCurrentYear < 0;
    
    // v9.24: 턴어라운드 감지 (분기 데이터 기반)
    const latestQuarterNetIncome = quarterlyTrend.length > 0 ? quarterlyTrend[quarterlyTrend.length - 1].netIncome : null;
    const prevQuarterNetIncome = quarterlyTrend.length > 1 ? quarterlyTrend[quarterlyTrend.length - 2].netIncome : null;
    const isLatestQuarterProfit = latestQuarterNetIncome !== null && latestQuarterNetIncome > 0;
    const isTurnaroundInProgress = isLossCompany && isLatestQuarterProfit; // 연간 적자 + 최신 분기 흑자

    let metricData: any;

    switch (metricId) {
      case "earning":
        // v9.24: 턴어라운드 반영
        const getEarningStatus = () => {
          if (isTurnaroundInProgress) return "흑자 전환 중 🎉";
          if (isNegativeOCF) return "현금흐름 주의";
          if (roe > 0.15) return "우수";
          if (roe > 0.05) return "보통";
          return "주의";
        };
        
        const getEarningStatusColor = () => {
          if (isTurnaroundInProgress) return "yellow"; // 지켜봐야 함
          if (isNegativeOCF) return "red";
          return getStatus(roe, { good: 0.15, bad: 0.05 }, true);
        };
        
        const getEarningSummary = () => {
          if (isTurnaroundInProgress) {
            return "연간은 적자지만, 최신 분기 흑자 전환! 🎉";
          }
          if (isNegativeOCF) return "현금이 빠져나가고 있어요";
          if (roe > 0.15) return "돈을 잘 벌고 있어요";
          if (roe > 0.05) return "보통 수준으로 벌고 있어요";
          return "수익성이 낮아요";
        };
        
        metricData = {
          title: "돈 버는 능력", emoji: "💰",
          status: getEarningStatus(),
          statusColor: getEarningStatusColor(),
          summary: getEarningSummary(),
          dataYear: quarterlyTrend.length > 0 
            ? `${quarterlyTrend[quarterlyTrend.length - 1]?.quarter} 기준`
            : `${latestFiscalYear}년 연간 기준`,
          metrics: [
            { name: "ROE (자기자본이익률)", description: "💡 내 돈(자본)으로 얼마나 벌었나?", value: formatPercentNoSign(roe), status: getStatus(roe, { good: 0.15, bad: 0.05 }, true), benchmark: `📅 ${latestFiscalYear}년 연간`, interpretation: `${roe > 0.15 ? "우수 (15%↑)" : roe > 0.05 ? "보통 (5~15%)" : roe > 0 ? "낮음 (5%↓)" : "적자"}` },
            { name: "영업이익률", description: "💡 본업에서 매출 100원당 얼마가 남나?", value: formatPercentNoSign(operatingMargin), status: getStatus(operatingMargin, { good: 0.1, bad: 0.05 }, true), benchmark: `📅 ${latestFiscalYear}년 연간`, interpretation: `${operatingMargin > 0.15 ? "우수 (15%↑)" : operatingMargin > 0.1 ? "양호 (10%↑)" : operatingMargin > 0.05 ? "보통" : "낮음"}` },
            { name: "순이익률", description: "💡 모든 비용 제하고 최종적으로 얼마가 남나?", value: formatPercentNoSign(profitMargin), status: getStatus(profitMargin, { good: 0.1, bad: 0.03 }, true), benchmark: `📅 ${latestFiscalYear}년 연간`, interpretation: `${profitMargin > 0.1 ? "우수 (10%↑)" : profitMargin > 0.05 ? "양호 (5%↑)" : profitMargin > 0 ? "보통" : "적자"}` },
            { name: "영업현금흐름 (OCF)", description: "💡 영업활동으로 실제 들어온 현금", value: formatCurrency(ocfFromHistory), status: ocfFromHistory > 0 ? "green" : "red", benchmark: `📅 ${latestFiscalYear}년 연간`, interpretation: ocfFromHistory > 0 ? "✅ 현금 유입 중" : "⚠️ 현금 유출 중" },
            { 
              name: "잉여현금흐름 (FCF)", 
              description: "💡 투자 후 남는 현금", 
              value: fcfFromHistory !== null ? formatCurrency(fcfFromHistory) : "데이터 없음", 
              status: fcfFromHistory === null ? "yellow" : (fcfFromHistory > 0 ? "green" : "yellow"), 
              benchmark: `📅 ${latestFiscalYear}년 연간`, 
              interpretation: fcfFromHistory === null ? "CapEx 데이터 부족" : (fcfFromHistory > 0 ? "✅ 투자 후 현금 남음" : "투자에 현금 사용 중")
            },
          ],
          whyImportant: isTurnaroundInProgress 
            ? ["최신 분기 흑자 전환에 성공했어요! 지속 여부를 지켜봐야 해요", "장부상 이익보다 현금흐름(OCF)이 플러스인 게 중요해요"]
            : ["ROE가 높으면 주주 돈으로 효율적으로 돈을 번다는 의미예요", "💡 순이익이 좋아도 현금흐름(OCF)이 마이너스면 위험 신호예요"],
          caution: isTurnaroundInProgress 
            ? ["🎉 최신 분기 흑자 전환!", "이 추세가 지속될지 다음 분기 실적을 확인하세요"]
            : (isNegativeOCF ? ["⚠️ 장부상 이익은 있지만, 실제 현금이 빠져나가고 있어요"] : undefined),
        };
        break;

      case "debt":
        // v9.22: financialData의 debtToEquity, currentRatio는 mrq(최근 분기) 기준
        metricData = {
          title: "빚 관리", emoji: "🏦",
          status: debtToEquity < 0.5 ? "우수" : debtToEquity < 1.5 ? "보통" : "주의",
          statusColor: getStatus(debtToEquity, { good: 0.5, bad: 1.5 }, false),
          summary: debtToEquity < 0.3 ? "자본 대비 빚 부담이 적어요" : debtToEquity < 1 ? "빚이 적당해요" : "빚이 많은 편이에요",
          // v9.22: 최근 분기 기준으로 표시
          dataYear: `${currentQuarterLabel} 기준 (최근 분기)`,
          metrics: [
            { 
              name: "부채비율 (빚 ÷ 자본)", 
              description: "💡 내 돈 대비 빚이 얼마나 있나? 낮을수록 안전",
              value: formatPercentNoSign(debtToEquity), 
              status: getStatus(debtToEquity, { good: 0.5, bad: 1.5 }, false), 
              benchmark: `📅 ${currentQuarterLabel} (최근 분기)`, 
              interpretation: `${debtToEquity < 0.3 ? "우수 (30%↓)" : debtToEquity < 0.5 ? "양호 (50%↓)" : debtToEquity < 1 ? "보통 (100%↓)" : "높음 (100%↑)"}` 
            },
            { 
              name: "유동비율 (단기 지급 능력)", 
              description: "💡 1년 내 갚을 빚 대비 현금 여유. 1배 이상 필요",
              value: formatRatio(currentRatio), 
              status: getStatus(currentRatio, { good: 1.5, bad: 1 }, true), 
              benchmark: `📅 ${currentQuarterLabel} (최근 분기)`, 
              interpretation: `${currentRatio > 2 ? "우수 (2배↑)" : currentRatio > 1.5 ? "양호 (1.5배↑)" : currentRatio > 1 ? "보통 (1배↑)" : "주의 (1배↓)"}` 
            },
          ],
          whyImportant: ["빚이 많으면 금리 인상 시 이자 부담이 커져요", "유동비율이 낮으면 단기 자금난 위험이 있어요"],
        };
        break;

      case "growth":
        const hasRevenueGrowthData = revenueGrowth !== null;
        const hasEarningsGrowthData = earningsGrowth !== null;
        const hasRevenueButNoGrowthData = actualRevenue > 0 && !hasRevenueGrowthData;
        
        // === 연간 기준 (기존) ===
        const isCurrentlyLossAnnual = netIncomeCurrentYear < 0;
        const wasPreviouslyLossAnnual = netIncomePreviousYear < 0;
        const turnedProfitableAnnual = wasPreviouslyLossAnnual && !isCurrentlyLossAnnual;
        const lossExpandedAnnual = wasPreviouslyLossAnnual && isCurrentlyLossAnnual && netIncomeCurrentYear < netIncomePreviousYear;
        
        // v9.22: 분기별 순이익 추이 계산
        const quarterlyNetIncomeTrend = quarterlyTrend.map((q: any, i: number) => {
          const prev = i > 0 ? quarterlyTrend[i - 1] : null;
          let growth: string | null = null;
          if (prev && prev.netIncome !== 0 && q.netIncome !== 0) {
            // 적자→흑자 또는 흑자→적자는 특별 처리
            if (prev.netIncome < 0 && q.netIncome > 0) {
              growth = "흑자전환";
            } else if (prev.netIncome > 0 && q.netIncome < 0) {
              growth = "적자전환";
            } else if (prev.netIncome > 0) {
              const rate = ((q.netIncome - prev.netIncome) / prev.netIncome) * 100;
              growth = rate >= 0 ? `+${rate.toFixed(0)}%` : `${rate.toFixed(0)}%`;
            }
          }
          return {
            quarter: q.quarter,
            value: q.netIncome,
            growth,
          };
        });
        
        // === v9.23: 분기 기준 손익 상태 (caution용) ===
        const latestQuarterNetIncome = quarterlyTrend.length > 0 ? quarterlyTrend[quarterlyTrend.length - 1].netIncome : null;
        const prevQuarterNetIncome = quarterlyTrend.length > 1 ? quarterlyTrend[quarterlyTrend.length - 2].netIncome : null;
        const prev2QuarterNetIncome = quarterlyTrend.length > 2 ? quarterlyTrend[quarterlyTrend.length - 3].netIncome : null;
        
        // 분기 기준 판단
        const isCurrentlyLossQuarterly = latestQuarterNetIncome !== null && latestQuarterNetIncome < 0;
        const wasPreviouslyLossQuarterly = prevQuarterNetIncome !== null && prevQuarterNetIncome < 0;
        
        // 분기 기준: 흑자 전환 (이전 분기 적자 → 최신 분기 흑자)
        const turnedProfitableQuarterly = wasPreviouslyLossQuarterly && !isCurrentlyLossQuarterly;
        
        // 분기 기준: 적자 확대 (이전 분기도 적자, 최신 분기도 적자, 적자폭 커짐)
        const lossExpandedQuarterly = wasPreviouslyLossQuarterly && isCurrentlyLossQuarterly && 
          latestQuarterNetIncome !== null && prevQuarterNetIncome !== null &&
          latestQuarterNetIncome < prevQuarterNetIncome;
        
        // 분기 기준: 적자 축소 (이전 분기도 적자, 최신 분기도 적자, 적자폭 줄어듦)
        const lossReducedQuarterly = wasPreviouslyLossQuarterly && isCurrentlyLossQuarterly &&
          latestQuarterNetIncome !== null && prevQuarterNetIncome !== null &&
          latestQuarterNetIncome > prevQuarterNetIncome;
        
        // 분기 기준: 흑자 → 적자 전환
        const turnedLossQuarterly = !wasPreviouslyLossQuarterly && prevQuarterNetIncome !== null && isCurrentlyLossQuarterly;
        
        // === v9.23: 분기 데이터 우선, 없으면 연간 데이터 사용 ===
        const hasQuarterlyNetIncomeData = quarterlyTrend.length >= 2;
        
        // 최종 판단 변수 (분기 우선)
        const turnedProfitable = hasQuarterlyNetIncomeData ? turnedProfitableQuarterly : turnedProfitableAnnual;
        const lossExpanded = hasQuarterlyNetIncomeData ? lossExpandedQuarterly : lossExpandedAnnual;
        const lossReduced = hasQuarterlyNetIncomeData ? lossReducedQuarterly : false;
        const turnedLoss = hasQuarterlyNetIncomeData ? turnedLossQuarterly : false;
        const isCurrentlyLoss = hasQuarterlyNetIncomeData ? isCurrentlyLossQuarterly : isCurrentlyLossAnnual;
        
        // 최신 분기 순이익 성장률
        const latestNetIncomeGrowth = quarterlyNetIncomeTrend.length > 0 
          ? quarterlyNetIncomeTrend[quarterlyNetIncomeTrend.length - 1].growth 
          : null;
        
        // v9.22: 분기 데이터 우선 사용
        const getGrowthStatusText = () => {
          if (isPreRevenueCompany) return "연구개발 단계";
          // 분기 데이터 있으면 분기 기준으로 판단
          if (hasUsableQuarterlyData && latestQoQGrowth !== null) {
            if (latestQoQGrowth > 0.3) return "초고속 성장";
            if (latestQoQGrowth > 0.15) return "고성장";
            if (latestQoQGrowth > 0) return "성장중";
            if (latestQoQGrowth > -0.1) return "정체";
            return "역성장";
          }
          if (hasRevenueButNoGrowthData) return "데이터 부족";
          if (revenueGrowthValue > 0.5) return "초고속 성장";
          if (revenueGrowthValue > 0.15) return "고성장";
          if (revenueGrowthValue > 0) return "성장중";
          if (revenueGrowthValue > -0.1) return "정체";
          return "역성장";
        };
        
        const getGrowthSummary = () => {
          if (isPreRevenueCompany) return "아직 매출이 없는 연구개발 단계예요";
          // v9.22: 분기 데이터 우선
          if (hasUsableQuarterlyData && latestQoQGrowth !== null) {
            if (latestQoQGrowth > 0.2) return "최근 분기 빠르게 성장하고 있어요!";
            if (latestQoQGrowth > 0.1) return "최근 분기 꾸준히 성장하고 있어요";
            if (latestQoQGrowth > 0) return "최근 분기 성장하고 있어요";
            return "최근 분기 성장이 둔화됐어요";
          }
          if (hasRevenueButNoGrowthData) return `연간 매출 ${formatCurrency(actualRevenue)}이지만, 전년 데이터가 없어 성장률을 알 수 없어요`;
          if (revenueGrowthValue > 0.5) return "폭발적으로 성장하고 있어요!";
          if (revenueGrowthValue > 0.3) return "빠르게 성장하고 있어요";
          if (revenueGrowthValue > 0.1) return "꾸준히 성장하고 있어요";
          if (revenueGrowthValue > 0) return "느리게 성장하고 있어요";
          return "성장이 멈췄거나 역성장 중이에요";
        };
        
        // 매출 성장률 해석 문구
        const getRevenueInterpretation = () => {
          if (latestQoQGrowth === null) return "데이터 부족";
          if (latestQoQGrowth > 0.3) return "🔥 폭발적 성장!";
          if (latestQoQGrowth > 0.2) return "🚀 빠르게 성장 중!";
          if (latestQoQGrowth > 0.1) return "📈 꾸준히 성장 중";
          if (latestQoQGrowth > 0) return "소폭 성장";
          if (latestQoQGrowth > -0.1) return "성장 정체";
          return "📉 역성장";
        };
        
        // v9.22: 분기 데이터 우선 표시
        const growthMetrics = [];
        
        // 분기별 매출 추이 (분기 데이터 있으면 우선)
        if (hasUsableQuarterlyData) {
          growthMetrics.push({
            name: "📈 분기별 매출 추이",
            description: "💡 최근 4분기 매출 흐름. 성장세를 직접 확인!",
            value: quarterlyTrend.map((q: any) => q.quarter.replace(/^\d{4}/, "'" + q.quarter.slice(2, 4))).join(' → '),
            status: latestQoQGrowth !== null ? (latestQoQGrowth > 0.1 ? "green" : latestQoQGrowth > 0 ? "yellow" : "red") : "yellow",
            benchmark: quarterlyTrend.map((q: any) => formatCurrency(q.revenue, "-")).join(' → '),
            interpretation: `성장률: ${quarterlyGrowthRates.join(' → ')}`,
            summaryText: getRevenueInterpretation(), // v9.22: 해석 문구 추가
          });
        } else {
          growthMetrics.push({ 
            name: "매출 성장률 (전년 대비)", 
            description: "💡 작년보다 매출이 얼마나 늘었나?",
            value: isPreRevenueCompany ? "아직 매출 없음" : hasRevenueButNoGrowthData ? `${formatCurrency(actualRevenue)} (${latestFiscalYear}년)` : formatPercent(revenueGrowthValue), 
            status: isPreRevenueCompany ? "red" : hasRevenueButNoGrowthData ? "yellow" : getStatus(revenueGrowthValue, { good: 0.15, bad: 0 }, true), 
            benchmark: hasRevenueGrowthData ? `📅 ${growthYearLabel}` : (hasUsableQuarterlyData ? "📊 분기 추이로 확인하세요" : "신규 상장/분사 기업"), 
            interpretation: isPreRevenueCompany ? "매출 없음" : hasRevenueButNoGrowthData ? "전년 데이터가 없어요" : `${revenueGrowthValue > 0.5 ? "초고속 (50%↑)" : revenueGrowthValue > 0.15 ? "고성장 (15%↑)" : revenueGrowthValue > 0 ? "성장 중" : "역성장"}` 
          });
        }
        
        // v9.22: 순이익 추이도 분기별로!
        if (quarterlyNetIncomeTrend.length >= 2) {
          // 분기별 순이익 성장률 계산
          const netIncomeGrowthRates = quarterlyNetIncomeTrend
            .slice(1)
            .map((q: any) => q.growth || "-")
            .filter((g: string) => g !== "-");
          
          // 최신 순이익 상태 판단
          const latestNetIncome = quarterlyNetIncomeTrend[quarterlyNetIncomeTrend.length - 1].value;
          const prevNetIncome = quarterlyNetIncomeTrend[quarterlyNetIncomeTrend.length - 2]?.value || 0;
          
          const getNetIncomeInterpretation = () => {
            if (prevNetIncome < 0 && latestNetIncome > 0) return "🎉 흑자 전환 성공!";
            if (prevNetIncome > 0 && latestNetIncome < 0) return "⚠️ 적자 전환";
            if (latestNetIncome < 0 && prevNetIncome < 0 && latestNetIncome > prevNetIncome) return "📈 적자폭 축소 중";
            if (latestNetIncome < 0) return "적자 지속 중";
            if (latestNetIncome > prevNetIncome * 2) return "🔥 이익 급증!";
            if (latestNetIncome > prevNetIncome) return "📈 이익 증가 중";
            return "이익 감소 중";
          };
          
          growthMetrics.push({
            name: "📊 분기별 순이익 추이",
            description: "💡 최근 4분기 순이익 흐름. 흑자/적자 추이 확인!",
            value: quarterlyNetIncomeTrend.map((q: any) => q.quarter.replace(/^\d{4}/, "'" + q.quarter.slice(2, 4))).join(' → '),
            status: latestNetIncome > 0 ? "green" : latestNetIncome < 0 ? "red" : "yellow",
            benchmark: quarterlyNetIncomeTrend.map((q: any) => formatCurrency(q.value, "-")).join(' → '),
            interpretation: netIncomeGrowthRates.length > 0 ? `성장률: ${netIncomeGrowthRates.join(' → ')}` : "성장률 계산 불가",
            summaryText: getNetIncomeInterpretation(), // v9.22: 해석 문구 추가
          });
        } else {
          // 분기 데이터 없으면 연간으로 폴백
          const getEarningsDisplay = () => {
            if (!hasEarningsGrowthData) return "데이터 없음";
            if (turnedProfitableAnnual) return `흑자 전환! (${formatCurrency(netIncomeCurrentYear)})`;
            if (lossExpandedAnnual) return `적자 확대 (${formatCurrency(netIncomePreviousYear)} → ${formatCurrency(netIncomeCurrentYear)})`;
            if (isCurrentlyLossAnnual) return formatCurrency(netIncomeCurrentYear);
            return formatPercent(earningsGrowthValue);
          };
          
          const getEarningsInterpretation = () => {
            if (!hasEarningsGrowthData) return "데이터가 부족해요";
            if (turnedProfitableAnnual) return "🎉 흑자 전환 성공!";
            if (lossExpandedAnnual) return `⚠️ 적자 확대`;
            if (isCurrentlyLossAnnual) return "아직 적자 상태예요";
            if (earningsGrowthValue > 1) return "이익 2배 이상 급증!";
            if (earningsGrowthValue > 0) return "이익 증가 중";
            return "이익 감소 중";
          };
          
          const getEarningsStatus = () => {
            if (!hasEarningsGrowthData) return "yellow";
            if (turnedProfitableAnnual) return "green";
            if (lossExpandedAnnual) return "red";
            if (isCurrentlyLossAnnual) return "yellow";
            return getStatus(earningsGrowthValue, { good: 0.15, bad: 0 }, true);
          };
          
          growthMetrics.push({ 
            name: "순이익 추이", 
            description: "💡 최종 이익이 늘고 있나?",
            value: getEarningsDisplay(), 
            status: getEarningsStatus(), 
            benchmark: hasEarningsGrowthData ? `📅 ${growthYearLabel}` : "전년 데이터 없음", 
            interpretation: getEarningsInterpretation() 
          });
        }
        
        // 연간 매출 또는 연간 성장률
        if (hasRevenueGrowthData) {
          growthMetrics.push({
            name: `연간 성장률 (${growthYearLabel})`,
            description: "💡 1년 단위 성장률. 장기 추세 파악용",
            value: formatPercent(revenueGrowthValue),
            status: getStatus(revenueGrowthValue, { good: 0.15, bad: 0 }, true),
            benchmark: `${formatCurrency(revenuePreviousYear)} → ${formatCurrency(revenueCurrentYear)}`,
            interpretation: `${revenueGrowthValue > 0.5 ? "폭발적 성장!" : revenueGrowthValue > 0.15 ? "고성장" : revenueGrowthValue > 0 ? "안정적 성장" : "역성장"}`,
          });
        } else {
          growthMetrics.push({ 
            name: `연간 매출 (${latestFiscalYear}년)`, 
            description: "💡 1년간 총 판매 금액",
            value: actualRevenue > 0 ? formatCurrency(actualRevenue) : "아직 매출 없음", 
            status: actualRevenue > 0 ? "green" : "red", 
            benchmark: hasUsableQuarterlyData ? "📊 분기 추이로 확인하세요" : "신규 상장/분사 기업", 
            interpretation: actualRevenue > 0 ? `${latestFiscalYear}년 총 매출` : "연구개발 단계" 
          });
        }
        
        // === v9.23: caution 로직 개선 (분기 데이터 우선) ===
        const generateCaution = (): string[] | undefined => {
          // 1. 데이터 부족
          if (hasRevenueButNoGrowthData && !hasUsableQuarterlyData) {
            return ["⚠️ 성장률 데이터가 부족해요", "정확한 정보는 기업 IR 자료를 확인하세요"];
          }
          
          // 2. 흑자 전환 (가장 좋은 케이스)
          if (turnedProfitable) {
            return ["🎉 최근 흑자 전환에 성공했어요!", "흑자가 지속될지 다음 분기 실적을 확인하세요"];
          }
          
          // 3. 적자 축소 중 (개선 중)
          if (lossReduced) {
            return ["📈 아직 적자지만, 적자폭이 줄고 있어요", "흑자 전환 시점을 지켜봐야 해요"];
          }
          
          // 4. 흑자 → 적자 전환 (나쁜 케이스)
          if (turnedLoss) {
            return ["⚠️ 흑자에서 적자로 전환됐어요", "일시적인 비용인지 확인이 필요해요"];
          }
          
          // 5. 적자 확대 (가장 나쁜 케이스)
          if (lossExpanded) {
            return ["⚠️ 적자가 확대되고 있어요", "현금 보유량과 흑자 전환 시점을 확인하세요"];
          }
          
          // 6. 적자 지속 (확대도 축소도 아님)
          if (isCurrentlyLoss && !lossReduced && !lossExpanded) {
            return ["⚠️ 적자가 지속되고 있어요", "흑자 전환 가능성을 지켜봐야 해요"];
          }
          
          return undefined;
        };
        
        metricData = {
          title: "성장 가능성", emoji: "🚀",
          status: getGrowthStatusText(),
          statusColor: isPreRevenueCompany ? "yellow" : (hasUsableQuarterlyData && latestQoQGrowth !== null) ? getStatus(latestQoQGrowth, { good: 0.15, bad: 0 }, true) : hasRevenueButNoGrowthData ? "yellow" : getStatus(revenueGrowthValue, { good: 0.15, bad: 0 }, true),
          summary: getGrowthSummary(),
          // v9.22: 분기 데이터 있으면 분기 기준
          dataYear: hasUsableQuarterlyData ? `${latestQuarterLabel} 기준` : growthYearLabel,
          metrics: growthMetrics,
          whyImportant: isPreRevenueCompany 
            ? ["연구개발 단계 기업은 매출 대신 기술력과 현금 보유량이 중요해요"] 
            : hasRevenueButNoGrowthData && !hasUsableQuarterlyData
              ? ["⚠️ 전년 데이터가 없어 성장률을 정확히 알 수 없어요", "최신 실적 발표(10-K, 10-Q)를 직접 확인하세요"]
              : ["성장이 멈추면 주가도 멈출 수 있어요", "매출보다 이익 성장이 빠르면 효율성이 좋아지는 거예요"],
          // v9.23: 분기 기준 caution
          caution: generateCaution(),
        };
        break;

      case "valuation":
        const calculatedPEG = (per > 0 && earningsGrowthValue > 0) ? per / (earningsGrowthValue * 100) : null;
        const displayPEG = peg > 0 ? peg : calculatedPEG;
        
        const getPERStatusText = () => {
          if (isNegativePER) return "적자 기업";
          if (per < 15) return "낮은 편";
          if (per < 40) return "보통";
          if (per < 60) return "높은 편";
          return "매우 높음";
        };
        const getPERSummary = () => {
          // v9.24: 턴어라운드 반영
          if (isTurnaroundInProgress) return "흑자 전환 성공! PER 산정이 가능해졌어요";
          if (isNegativePER) return "적자 기업이라 PER을 산정하기 어려워요";
          if (per < 15) return "PER이 낮은 편이에요";
          if (per < 40) return "PER이 보통 수준이에요";
          if (per < 60) return "PER이 높은 편이에요";
          return "PER이 매우 높아요";
        };
        
        // v9.24: 턴어라운드 시 decisionPoint 개선
        const getDecisionPoint = () => {
          if (isTurnaroundInProgress) {
            return ["🎉 최신 분기 흑자 전환 성공! 실적 개선세가 지속될지 지켜보세요", "자산 가치(PBR)와 현금흐름도 함께 확인하세요"];
          }
          if (isNegativePER || isLossCompany) {
            return ["흑자 전환 가능성이 있다면 → 장기 투자 고려", "적자가 지속된다면 → 리스크가 커요"];
          }
          return ["성장이 계속되면 → 지금 가격도 정당화됨", "성장이 꺾이면 → 비싸게 산 게 됨"];
        };
        
        metricData = {
          title: "현재 몸값", emoji: "💎",
          status: isTurnaroundInProgress ? "흑자 전환 🎉" : getPERStatusText(),
          statusColor: isTurnaroundInProgress ? "green" : (isNegativePER ? "yellow" : getStatus(per, { good: 40, bad: 60 }, false)),
          summary: getPERSummary(),
          dataYear: "현재 주가 기준",
          metrics: [
            { name: perType ? `PER (${perType})` : "PER", description: perType === "TTM" ? "💡 최근 12개월 실제 이익 기준" : "💡 예상 이익 기준", value: isNegativePER ? "적자 기업" : formatRatio(per), status: isNegativePER ? "yellow" : getStatus(per, { good: 40, bad: 60 }, false), benchmark: "📅 현재 주가 기준", interpretation: isNegativePER ? "적자라 PER 산정 불가" : `${per < 15 ? "낮은 편 (15↓)" : per < 40 ? "보통 (15~40)" : per < 60 ? "높은 편 (40~60)" : "매우 높음 (60↑)"}`, contextNote: "💡 업종마다 적정 PER이 달라요. 성장주는 40~60도 일반적이에요." },
            { name: "PEG (성장 대비 가격)", description: "💡 PER ÷ 이익성장률", value: displayPEG && displayPEG > 0 ? formatRatio(displayPEG) : "데이터 부족", status: displayPEG && displayPEG > 0 ? getStatus(displayPEG, { good: 1, bad: 2 }, false) : "yellow", benchmark: "📅 예상 성장률 기준", interpretation: displayPEG && displayPEG > 0 ? `${displayPEG < 0.5 ? "매우 낮음 (0.5↓)" : displayPEG < 1 ? "낮은 편 (1↓)" : displayPEG < 2 ? "보통 (1~2)" : "높은 편 (2↑)"}` : "데이터 부족" },
            { name: "PBR (주가순자산비율)", description: "💡 주가 ÷ 1주당 순자산", value: pbr > 0 ? formatRatio(pbr) : "데이터 없음", status: pbr > 0 ? getStatus(pbr, { good: 3, bad: 10 }, false) : "yellow", benchmark: `📅 ${latestFiscalYear}년 기준`, interpretation: pbr > 0 ? `${pbr < 1 ? "낮은 편 (1↓)" : pbr < 3 ? "보통 (1~3)" : pbr < 5 ? "다소 높음 (3~5)" : "높은 편 (5↑)"}` : "데이터 부족" },
          ],
          whyImportant: isTurnaroundInProgress 
            ? ["흑자 전환에 성공해 PER 지표를 다시 볼 수 있게 됐어요", "실적 개선 속도와 지속 가능성이 핵심이에요"]
            : (isNegativePER || isLossCompany ? ["적자 기업은 PER 대신 PSR이나 PBR로 평가해요", "흑자 전환 시점과 성장 가능성이 더 중요해요"] : ["업종마다 적정 PER이 달라요 (기술주 vs 금융주)", "PEG가 1 이하면 성장률 대비 매력적일 수 있어요"]),
          decisionPoint: getDecisionPoint(),
        };
        break;

      default:
        return NextResponse.json({ error: "잘못된 지표입니다" }, { status: 400 });
    }

    // v9.22: 관련 종목 추천 (섹터 기반) - 한국명 추가
    const profile = quoteSummary.summaryProfile;
    const currentSector = profile?.sector || "Technology";
    
    const sectorStocks: Record<string, { ticker: string; name: string; nameKo: string; reason: string }[]> = {
      "Technology": [
        { ticker: "AAPL", name: "Apple", nameKo: "애플", reason: "빅테크 대장주" },
        { ticker: "MSFT", name: "Microsoft", nameKo: "마이크로소프트", reason: "클라우드 & AI" },
        { ticker: "NVDA", name: "NVIDIA", nameKo: "엔비디아", reason: "AI 반도체 1위" },
        { ticker: "GOOGL", name: "Alphabet", nameKo: "구글", reason: "검색 & 광고" },
      ],
      "Communication Services": [
        { ticker: "GOOGL", name: "Alphabet", nameKo: "구글", reason: "유튜브 & 검색" },
        { ticker: "META", name: "Meta", nameKo: "메타", reason: "SNS 플랫폼" },
        { ticker: "NFLX", name: "Netflix", nameKo: "넷플릭스", reason: "스트리밍 1위" },
        { ticker: "DIS", name: "Disney", nameKo: "디즈니", reason: "콘텐츠 제국" },
      ],
      "Consumer Cyclical": [
        { ticker: "AMZN", name: "Amazon", nameKo: "아마존", reason: "이커머스 왕" },
        { ticker: "TSLA", name: "Tesla", nameKo: "테슬라", reason: "전기차 선두" },
        { ticker: "HD", name: "Home Depot", nameKo: "홈디포", reason: "홈인테리어 1위" },
        { ticker: "NKE", name: "Nike", nameKo: "나이키", reason: "스포츠웨어" },
      ],
      "Financial Services": [
        { ticker: "JPM", name: "JPMorgan", nameKo: "JP모건", reason: "미국 최대 은행" },
        { ticker: "V", name: "Visa", nameKo: "비자", reason: "결제 네트워크" },
        { ticker: "MA", name: "Mastercard", nameKo: "마스터카드", reason: "결제 2위" },
        { ticker: "GS", name: "Goldman Sachs", nameKo: "골드만삭스", reason: "투자은행" },
      ],
      "Healthcare": [
        { ticker: "UNH", name: "UnitedHealth", nameKo: "유나이티드헬스", reason: "헬스케어 1위" },
        { ticker: "JNJ", name: "J&J", nameKo: "존슨앤존슨", reason: "제약 & 의료기기" },
        { ticker: "LLY", name: "Eli Lilly", nameKo: "일라이릴리", reason: "비만치료제" },
        { ticker: "PFE", name: "Pfizer", nameKo: "화이자", reason: "글로벌 제약" },
      ],
    };
    
    const relatedStocks = (sectorStocks[currentSector] || sectorStocks["Technology"])
      .filter(s => s.ticker !== symbol)
      .slice(0, 4);

    return NextResponse.json({ ticker: symbol, stockName, ...metricData, relatedStocks });
  } catch (error) {
    console.error("Metric API Error:", error);
    return NextResponse.json({ error: "데이터를 불러오는 중 오류가 발생했어요" }, { status: 500 });
  }
}
