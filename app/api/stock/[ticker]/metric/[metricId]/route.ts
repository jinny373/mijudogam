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

    const [quote, quoteSummary] = await Promise.all([
      yahooFinance.quote(symbol),
      yahooFinance.quoteSummary(symbol, {
        modules: ["summaryProfile", "financialData", "defaultKeyStatistics", "incomeStatementHistory", "cashflowStatementHistory"],
      }),
    ]);

    if (!quote) {
      return NextResponse.json({ error: "종목을 찾을 수 없어요" }, { status: 404 });
    }

    const financialData = quoteSummary.financialData;
    const keyStats = quoteSummary.defaultKeyStatistics;
    const incomeHistory = quoteSummary.incomeStatementHistory?.incomeStatementHistory || [];
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
      
      // 매출이 0인데 financialData에는 있으면 그걸 사용
      if (revenueCurrentYear === 0 && financialData?.totalRevenue) {
        revenueCurrentYear = financialData.totalRevenue;
      }
    } else {
      // ⚠️ incomeHistory가 없으면 financialData에서 가져오기 (Yahoo API 변경 대응)
      revenueCurrentYear = financialData?.totalRevenue || 0;
      revenueGrowth = financialData?.revenueGrowth || null;
      earningsGrowth = financialData?.earningsGrowth || null;
      netIncomeCurrentYear = financialData?.netIncomeToCommon || 0;
    }
    
    // 실제 매출 (fallback 포함)
    const actualRevenue = revenueCurrentYear || financialData?.totalRevenue || 0;
    isPreRevenueCompany = actualRevenue === 0;

    const growthYearLabel = previousFiscalYear && currentFiscalYear ? `${previousFiscalYear} → ${currentFiscalYear}` : `${latestFiscalYear}년 기준`;
    const revenueGrowthValue = revenueGrowth ?? 0;
    const earningsGrowthValue = earningsGrowth ?? 0;

    const roe = financialData?.returnOnEquity || 0;
    const operatingMargin = financialData?.operatingMargins || 0;
    const profitMargin = financialData?.profitMargins || 0;
    const debtToEquity = financialData?.debtToEquity ? financialData.debtToEquity / 100 : 0;
    const currentRatio = financialData?.currentRatio || 0;
    
    // PER: Trailing(TTM) 우선
    const trailingPER = keyStats?.trailingPE || quote.trailingPE || 0;
    const forwardPER = keyStats?.forwardPE || 0;
    const per = trailingPER > 0 ? trailingPER : forwardPER;
    const perType = trailingPER > 0 ? "TTM" : (forwardPER > 0 ? "Forward" : "");
    
    const peg = keyStats?.pegRatio || 0;
    const pbr = keyStats?.priceToBook || 0;

    let ocfFromHistory = financialData?.operatingCashflow || 0;
    let fcfFromHistory = financialData?.freeCashflow || 0;
    if (cashflowHistory.length >= 1) {
      const latest = cashflowHistory[0];
      ocfFromHistory = latest?.totalCashFromOperatingActivities || ocfFromHistory;
      fcfFromHistory = ocfFromHistory + (latest?.capitalExpenditures || 0);
    }

    const isLossCompany = netIncomeCurrentYear < 0;
    const isNegativePER = per < 0;
    const isNegativeOCF = ocfFromHistory < 0;

    let metricData;

    switch (metricId) {
      case "earning":
        const getEarningSummary = () => {
          if (isPreRevenueCompany) return "아직 매출이 없는 연구개발 단계 기업이에요";
          if (isNegativeOCF) return "장부상 이익은 있지만, 실제 현금이 빠져나가고 있어요";
          if (roe > 0.15) return "돈을 잘 벌고 있어요";
          if (roe > 0.05) return "돈을 적당히 벌고 있어요";
          if (roe < 0) return "현재 적자 상태예요";
          return "수익성이 낮은 편이에요";
        };
        
        metricData = {
          title: "돈 버는 능력", emoji: "💰",
          status: isPreRevenueCompany ? "연구개발 단계" : isNegativeOCF ? "현금흐름 주의" : (roe > 0.15 ? "우수" : roe > 0.05 ? "보통" : "주의"),
          statusColor: isPreRevenueCompany ? "yellow" : isNegativeOCF ? "red" : getStatus(roe, { good: 0.15, bad: 0.05 }, true),
          summary: getEarningSummary(),
          dataYear: `${latestFiscalYear}년 연간 기준`,
          metrics: [
            { 
              name: "ROE (자기자본이익률)", 
              description: "💡 내 돈(자본)으로 얼마나 벌었나? 높을수록 효율적",
              value: formatPercentNoSign(roe), 
              status: roe > 0.15 ? "green" : roe > 0.05 ? "yellow" : "red", 
              benchmark: `📅 ${latestFiscalYear}년 연간`, 
              interpretation: `${roe > 0.15 ? "우수 (15%↑)" : roe > 0.05 ? "보통 (5~15%)" : roe > 0 ? "낮음 (5%↓)" : "적자"}` 
            },
            { 
              name: "영업이익률", 
              description: "💡 본업에서 매출 100원당 얼마가 남나?",
              value: isPreRevenueCompany ? "아직 매출 없음" : formatPercentNoSign(operatingMargin), 
              status: isPreRevenueCompany ? "yellow" : getStatus(operatingMargin, { good: 0.1, bad: 0.05 }, true), 
              benchmark: `📅 ${latestFiscalYear}년 연간`, 
              interpretation: isPreRevenueCompany ? "매출 없음" : `${operatingMargin > 0.15 ? "우수 (15%↑)" : operatingMargin > 0.1 ? "양호 (10%↑)" : operatingMargin > 0.05 ? "보통" : "낮음"}` 
            },
            { 
              name: "순이익률", 
              description: "💡 모든 비용 제하고 최종적으로 얼마가 남나?",
              value: isPreRevenueCompany ? "아직 매출 없음" : formatPercentNoSign(profitMargin), 
              status: isPreRevenueCompany ? "yellow" : getStatus(profitMargin, { good: 0.1, bad: 0.03 }, true), 
              benchmark: `📅 ${latestFiscalYear}년 연간`, 
              interpretation: isPreRevenueCompany ? "매출 없음" : `${profitMargin > 0.1 ? "우수 (10%↑)" : profitMargin > 0.05 ? "양호 (5%↑)" : profitMargin > 0 ? "보통" : "적자"}` 
            },
            { 
              name: "영업현금흐름 (OCF)", 
              description: "💡 영업활동으로 실제 들어온 현금",
              value: formatCurrency(ocfFromHistory), 
              status: ocfFromHistory > 0 ? "green" : "red", 
              benchmark: `📅 ${latestFiscalYear}년 연간`, 
              interpretation: ocfFromHistory > 0 ? "✅ 현금 유입 중" : "⚠️ 현금 유출 중" 
            },
            { 
              name: "잉여현금흐름 (FCF)", 
              description: "💡 투자 후 남는 현금",
              value: formatCurrency(fcfFromHistory), 
              status: fcfFromHistory > 0 ? "green" : "yellow", 
              benchmark: `📅 ${latestFiscalYear}년 연간`, 
              interpretation: fcfFromHistory > 0 ? "✅ 투자 후 현금 남음" : "투자에 현금 사용 중" 
            },
          ],
          whyImportant: ["ROE가 높으면 주주 돈으로 효율적으로 돈을 번다는 의미예요", "💡 순이익이 좋아도 현금흐름(OCF)이 마이너스면 위험 신호예요"],
          caution: isNegativeOCF ? ["⚠️ 장부상 이익은 있지만, 실제 현금이 빠져나가고 있어요"] : undefined,
        };
        break;

      case "debt":
        metricData = {
          title: "빚 관리", emoji: "🏦",
          status: debtToEquity < 0.5 ? "우수" : debtToEquity < 1.5 ? "보통" : "주의",
          statusColor: getStatus(debtToEquity, { good: 0.5, bad: 1.5 }, false),
          summary: debtToEquity < 0.3 ? "빚이 거의 없어요" : debtToEquity < 1 ? "빚이 적당해요" : "빚이 많은 편이에요",
          dataYear: `${latestFiscalYear}년 연간 기준`,
          metrics: [
            { 
              name: "부채비율 (빚 ÷ 자본)", 
              description: "💡 내 돈 대비 빚이 얼마나 있나? 낮을수록 안전",
              value: formatPercentNoSign(debtToEquity), 
              status: getStatus(debtToEquity, { good: 0.5, bad: 1.5 }, false), 
              benchmark: `📅 ${latestFiscalYear}년 연간`, 
              interpretation: `${debtToEquity < 0.3 ? "우수 (30%↓)" : debtToEquity < 0.5 ? "양호 (50%↓)" : debtToEquity < 1 ? "보통 (100%↓)" : "높음 (100%↑)"}` 
            },
            { 
              name: "유동비율 (단기 지급 능력)", 
              description: "💡 1년 내 갚을 빚 대비 현금 여유. 1배 이상 필요",
              value: formatRatio(currentRatio), 
              status: getStatus(currentRatio, { good: 1.5, bad: 1 }, true), 
              benchmark: `📅 ${latestFiscalYear}년 연간`, 
              interpretation: `${currentRatio > 2 ? "우수 (2배↑)" : currentRatio > 1.5 ? "양호 (1.5배↑)" : currentRatio > 1 ? "보통 (1배↑)" : "주의 (1배↓)"}` 
            },
          ],
          whyImportant: ["빚이 많으면 금리 인상 시 이자 부담이 커져요", "유동비율이 낮으면 단기 자금난 위험이 있어요"],
        };
        break;

      case "growth":
        // 성장률 데이터 유무 확인
        const hasRevenueGrowthData = revenueGrowth !== null;
        const hasEarningsGrowthData = earningsGrowth !== null;
        // revenueGrowthValue, earningsGrowthValue는 이미 상위에서 선언됨
        const hasRevenueButNoGrowthData = actualRevenue > 0 && !hasRevenueGrowthData;
        
        // 적자 관련 상태
        const isCurrentlyLoss = netIncomeCurrentYear < 0;
        const wasPreviouslyLoss = netIncomePreviousYear < 0;
        const turnedProfitable = wasPreviouslyLoss && !isCurrentlyLoss;
        const lossExpanded = wasPreviouslyLoss && isCurrentlyLoss && netIncomeCurrentYear < netIncomePreviousYear;
        
        // 성장 상태 결정
        const getGrowthStatusText = () => {
          if (isPreRevenueCompany) return "연구개발 단계";
          if (hasRevenueButNoGrowthData) return "데이터 부족";
          if (revenueGrowthValue > 0.5) return "초고속 성장";
          if (revenueGrowthValue > 0.15) return "고성장";
          if (revenueGrowthValue > 0) return "성장중";
          if (revenueGrowthValue > -0.1) return "정체";
          return "역성장";
        };
        
        const getGrowthSummary = () => {
          if (isPreRevenueCompany) return "아직 매출이 없는 연구개발 단계예요";
          if (hasRevenueButNoGrowthData) return `연간 매출 ${formatCurrency(actualRevenue)}이지만, 전년 데이터가 없어 성장률을 알 수 없어요`;
          if (revenueGrowthValue > 0.5) return "폭발적으로 성장하고 있어요!";
          if (revenueGrowthValue > 0.3) return "빠르게 성장하고 있어요";
          if (revenueGrowthValue > 0.1) return "꾸준히 성장하고 있어요";
          if (revenueGrowthValue > 0) return "느리게 성장하고 있어요";
          return "성장이 멈췄거나 역성장 중이에요";
        };
        
        // 순이익 관련 해석
        const getEarningsDisplay = () => {
          if (!hasEarningsGrowthData) return "데이터 없음";
          if (turnedProfitable) return `흑자 전환! (${formatCurrency(netIncomeCurrentYear)})`;
          if (lossExpanded) return `적자 확대 (${formatCurrency(netIncomePreviousYear)} → ${formatCurrency(netIncomeCurrentYear)})`;
          return formatPercent(earningsGrowthValue);
        };
        
        const getEarningsInterpretation = () => {
          if (!hasEarningsGrowthData) return "데이터가 부족해요";
          if (turnedProfitable) return "🎉 흑자 전환 성공!";
          if (lossExpanded) return `⚠️ 적자가 ${formatCurrency(netIncomePreviousYear)}에서 ${formatCurrency(netIncomeCurrentYear)}로 확대됐어요`;
          if (isCurrentlyLoss) return "아직 적자 상태예요";
          if (earningsGrowthValue > 1) return "이익 2배 이상 급증!";
          if (earningsGrowthValue > 0) return "이익 증가 중";
          return "이익 감소 중";
        };
        
        const getEarningsStatus = () => {
          if (!hasEarningsGrowthData) return "yellow";
          if (turnedProfitable) return "green";
          if (lossExpanded) return "red";
          if (isCurrentlyLoss) return "yellow";
          return getStatus(earningsGrowthValue, { good: 0.15, bad: 0 }, true);
        };
        
        metricData = {
          title: "성장 가능성", emoji: "🚀",
          status: getGrowthStatusText(),
          statusColor: isPreRevenueCompany ? "yellow" : hasRevenueButNoGrowthData ? "yellow" : getStatus(revenueGrowthValue, { good: 0.15, bad: 0 }, true),
          summary: getGrowthSummary(),
          dataYear: growthYearLabel,
          metrics: [
            { 
              name: "매출 성장률 (전년 대비)", 
              description: "💡 작년보다 매출이 얼마나 늘었나?",
              value: isPreRevenueCompany ? "아직 매출 없음" : hasRevenueButNoGrowthData ? `${formatCurrency(actualRevenue)} (${latestFiscalYear}년)` : formatPercent(revenueGrowthValue), 
              status: isPreRevenueCompany ? "red" : hasRevenueButNoGrowthData ? "yellow" : getStatus(revenueGrowthValue, { good: 0.15, bad: 0 }, true), 
              benchmark: hasRevenueGrowthData ? `📅 ${growthYearLabel}` : "전년 데이터 없음", 
              interpretation: isPreRevenueCompany ? "매출 없음" : hasRevenueButNoGrowthData ? "전년 데이터 없음" : `${revenueGrowthValue > 0.5 ? "초고속 (50%↑)" : revenueGrowthValue > 0.15 ? "고성장 (15%↑)" : revenueGrowthValue > 0 ? "성장 중" : "역성장"}` 
            },
            { 
              name: "순이익 추이", 
              description: "💡 최종 이익이 늘고 있나?",
              value: getEarningsDisplay(), 
              status: getEarningsStatus(), 
              benchmark: hasEarningsGrowthData ? `📅 ${growthYearLabel}` : "전년 데이터 없음", 
              interpretation: getEarningsInterpretation() 
            },
            { 
              name: "연간 매출", 
              description: "💡 1년간 총 판매 금액",
              value: actualRevenue > 0 ? formatCurrency(actualRevenue) : "아직 매출 없음", 
              status: actualRevenue > 0 ? "green" : "red", 
              benchmark: revenuePreviousYear > 0 ? `📅 ${previousFiscalYear || (parseInt(latestFiscalYear) - 1)} → ${latestFiscalYear}` : `📅 ${latestFiscalYear}년`, 
              interpretation: actualRevenue > 0 ? (revenuePreviousYear > 0 ? `${formatCurrency(revenuePreviousYear)} → ${formatCurrency(actualRevenue)}` : `${latestFiscalYear}년 매출`) : "연구개발 단계" 
            },
          ],
          whyImportant: isPreRevenueCompany 
            ? ["연구개발 단계 기업은 매출 대신 기술력과 현금 보유량이 중요해요"] 
            : hasRevenueButNoGrowthData
              ? ["⚠️ 전년 데이터가 없어 성장률을 정확히 알 수 없어요", "최신 실적 발표(10-K, 10-Q)를 직접 확인하세요"]
              : ["성장이 멈추면 주가도 멈출 수 있어요", "매출보다 이익 성장이 빠르면 효율성이 좋아지는 거예요"],
          caution: hasRevenueButNoGrowthData 
            ? ["⚠️ 성장률 데이터가 부족해요", "정확한 정보는 기업 IR 자료를 확인하세요"]
            : turnedProfitable 
              ? ["🎉 최근 흑자 전환에 성공했어요!", "흑자가 지속될지 다음 분기 실적을 확인하세요"]
              : lossExpanded
                ? ["⚠️ 적자가 확대되고 있어요", "현금 보유량과 흑자 전환 시점을 확인하세요"]
                : undefined,
        };
        break;

      case "valuation":
        const calculatedPEG = (per > 0 && earningsGrowthValue > 0) ? per / (earningsGrowthValue * 100) : null;
        const displayPEG = peg > 0 ? peg : calculatedPEG;
        
        // PER 상태/요약 함수
        const getPERStatusText = () => {
          if (isNegativePER) return "적자 기업";
          if (per < 15) return "낮은 편";
          if (per < 40) return "보통";
          if (per < 60) return "높은 편";
          return "매우 높음";
        };
        const getPERSummary = () => {
          if (isNegativePER) return "적자 기업이라 PER을 산정하기 어려워요";
          if (per < 15) return "PER이 낮은 편이에요";
          if (per < 40) return "PER이 보통 수준이에요";
          if (per < 60) return "PER이 높은 편이에요";
          return "PER이 매우 높아요";
        };
        
        metricData = {
          title: "현재 몸값", emoji: "💎",
          status: getPERStatusText(),
          statusColor: isNegativePER ? "yellow" : getStatus(per, { good: 40, bad: 60 }, false),
          summary: getPERSummary(),
          dataYear: "현재 주가 기준",
          metrics: [
            { 
              name: perType ? `PER (${perType})` : "PER", 
              description: perType === "TTM" ? "💡 최근 12개월 실제 이익 기준" : "💡 예상 이익 기준",
              value: isNegativePER ? "적자 기업" : formatRatio(per), 
              status: isNegativePER ? "yellow" : getStatus(per, { good: 40, bad: 60 }, false), 
              benchmark: "📅 현재 주가 기준", 
              interpretation: isNegativePER ? "적자라 PER 산정 불가" : `${per < 15 ? "낮은 편 (15↓)" : per < 40 ? "보통 (15~40)" : per < 60 ? "높은 편 (40~60)" : "매우 높음 (60↑)"}`,
              contextNote: "💡 업종마다 적정 PER이 달라요. 성장주는 40~60도 일반적이에요."
            },
            { 
              name: "PEG (성장 대비 가격)", 
              description: "💡 PER ÷ 이익성장률",
              value: displayPEG && displayPEG > 0 ? formatRatio(displayPEG) : "데이터 부족", 
              status: displayPEG && displayPEG > 0 ? getStatus(displayPEG, { good: 1, bad: 2 }, false) : "yellow", 
              benchmark: "📅 예상 성장률 기준", 
              interpretation: displayPEG && displayPEG > 0 ? `${displayPEG < 0.5 ? "매우 낮음 (0.5↓)" : displayPEG < 1 ? "낮은 편 (1↓)" : displayPEG < 2 ? "보통 (1~2)" : "높은 편 (2↑)"}` : "데이터 부족" 
            },
            { 
              name: "PBR (주가순자산비율)", 
              description: "💡 주가 ÷ 1주당 순자산",
              value: pbr > 0 ? formatRatio(pbr) : "데이터 없음", 
              status: pbr > 0 ? getStatus(pbr, { good: 3, bad: 10 }, false) : "yellow", 
              benchmark: `📅 ${latestFiscalYear}년 기준`, 
              interpretation: pbr > 0 ? `${pbr < 1 ? "낮은 편 (1↓)" : pbr < 3 ? "보통 (1~3)" : pbr < 5 ? "다소 높음 (3~5)" : "높은 편 (5↑)"}` : "데이터 부족" 
            },
          ],
          whyImportant: isNegativePER || isLossCompany ? ["적자 기업은 PER 대신 PSR이나 PBR로 평가해요", "흑자 전환 시점과 성장 가능성이 더 중요해요"] : ["업종마다 적정 PER이 달라요 (기술주 vs 금융주)", "PEG가 1 이하면 성장률 대비 매력적일 수 있어요"],
          decisionPoint: isNegativePER || isLossCompany ? ["흑자 전환 가능성이 있다면 → 장기 투자 고려", "적자가 지속된다면 → 리스크가 커요"] : ["성장이 계속되면 → 지금 가격도 정당화됨", "성장이 꺾이면 → 비싸게 산 게 됨"],
        };
        break;

      default:
        return NextResponse.json({ error: "잘못된 지표입니다" }, { status: 400 });
    }

    return NextResponse.json({ ticker: symbol, stockName, ...metricData });
  } catch (error) {
    console.error("Metric API Error:", error);
    return NextResponse.json({ error: "데이터를 불러오는 중 오류가 발생했어요" }, { status: 500 });
  }
}
