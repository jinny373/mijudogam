import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// ═══════════════════════════════════════════════════════════════
// 상수 정의
// ═══════════════════════════════════════════════════════════════

// 11개 S&P 섹터 ETF
const SECTOR_ETFS = [
  { ticker: "XLK", name: "Technology", nameKo: "기술" },
  { ticker: "XLF", name: "Financials", nameKo: "금융" },
  { ticker: "XLV", name: "Health Care", nameKo: "헬스케어" },
  { ticker: "XLE", name: "Energy", nameKo: "에너지" },
  { ticker: "XLU", name: "Utilities", nameKo: "유틸리티" },
  { ticker: "XLI", name: "Industrials", nameKo: "산업재" },
  { ticker: "XLY", name: "Consumer Discretionary", nameKo: "임의소비재" },
  { ticker: "XLP", name: "Consumer Staples", nameKo: "필수소비재" },
  { ticker: "XLB", name: "Materials", nameKo: "소재" },
  { ticker: "XLRE", name: "Real Estate", nameKo: "부동산" },
  { ticker: "XLC", name: "Communication Services", nameKo: "통신" },
];

// AI 밸류체인 6단계
const AI_VALUE_CHAIN = [
  {
    stage: 1,
    name: "반도체 장비",
    nameEn: "Semiconductor Equipment",
    etf: null,
    stocks: ["ASML", "LRCX", "KLAC", "AMAT"],
    description: "반도체 만드는 기계",
  },
  {
    stage: 2,
    name: "AI 칩/GPU",
    nameEn: "AI Chips",
    etf: "SMH",
    stocks: ["NVDA", "AMD", "AVGO", "QCOM"],
    description: "AI 연산의 핵심",
  },
  {
    stage: 3,
    name: "AI 메모리",
    nameEn: "AI Memory",
    etf: null,
    stocks: ["MU"], // SK하이닉스는 미국 상장 아님
    description: "HBM 등 고대역폭 메모리",
  },
  {
    stage: 4,
    name: "서버/스토리지",
    nameEn: "Server & Storage",
    etf: null,
    stocks: ["STX", "WDC", "DELL"],
    description: "데이터 저장/처리",
  },
  {
    stage: 5,
    name: "인프라/전력",
    nameEn: "Infrastructure & Power",
    etf: null,
    stocks: ["VRT", "ETN", "CEG", "VST"],
    description: "데이터센터 전력/냉각",
  },
  {
    stage: 6,
    name: "원자재/소재",
    nameEn: "Materials",
    etf: "SLV",
    stocks: ["SLV", "COPX"],
    description: "하드웨어 소재 (은, 구리)",
  },
];

// 매크로 지표 티커
const MACRO_TICKERS = {
  market: "^GSPC",       // S&P 500
  treasury10Y: "^TNX",   // 10년물 금리
  dollarIndex: "DX-Y.NYB", // 달러 인덱스
  vix: "^VIX",           // 변동성 지수
};

// 경기 사이클별 유리한 섹터
const CYCLE_SECTORS = {
  recovery: { favorable: ["XLF", "XLRE", "XLY"], unfavorable: ["XLU", "XLP"] },
  expansion: { favorable: ["XLK", "XLI", "XLB"], unfavorable: ["XLU", "XLP"] },
  late: { favorable: ["XLE", "XLB"], unfavorable: ["XLK", "XLY"] },
  recession: { favorable: ["XLU", "XLV", "XLP"], unfavorable: ["XLY", "XLF"] },
};

// ═══════════════════════════════════════════════════════════════
// 유틸리티 함수
// ═══════════════════════════════════════════════════════════════

// 기간별 수익률 계산
function calculateReturn(currentPrice: number, historicalPrice: number): number {
  if (!historicalPrice || historicalPrice === 0) return 0;
  return ((currentPrice - historicalPrice) / historicalPrice) * 100;
}

// 상대강도 계산 (섹터 수익률 - 시장 수익률)
function calculateRelativeStrength(sectorReturn: number, marketReturn: number): number {
  return sectorReturn - marketReturn;
}

// 섹터 상태 판단
function getSectorStatus(relativeStrength: number): "hot" | "neutral" | "cold" {
  if (relativeStrength > 5) return "hot";
  if (relativeStrength < -5) return "cold";
  return "neutral";
}

// RSI 계산 (간단 버전 - 14일 기준)
function calculateRSI(prices: number[]): number {
  if (prices.length < 15) return 50; // 데이터 부족시 중립

  let gains = 0;
  let losses = 0;

  for (let i = 1; i < Math.min(15, prices.length); i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  const avgGain = gains / 14;
  const avgLoss = losses / 14;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// 증명 상태 판단
function getProofStatus(data: {
  change3M: number;
  rsi14: number;
  fromHigh52W: number;
}): { emoji: string; label: string; status: string } {
  const { change3M, rsi14, fromHigh52W } = data;

  // 1. 증명 완료 + 고평가 (RSI 70+ 기준)
  if (change3M > 30 && rsi14 > 70 && fromHigh52W > -10) {
    return { emoji: "✅", label: "증명 완료, 고평가", status: "proven_expensive" };
  }

  // 2. 증명 완료 + 적정가
  if (change3M > 25 && rsi14 > 55) {
    return { emoji: "✅", label: "증명 완료", status: "proven" };
  }

  // 3. 현재 주목 (실적 증명 중)
  if (change3M > 15 && rsi14 > 50) {
    return { emoji: "🔥", label: "실적 증명 중", status: "proving" };
  }

  // 4. 성장 초기 (다음 타자)
  if (change3M > 5) {
    return { emoji: "⭐", label: "성장 초기", status: "early" };
  }

  // 5. 대기 중
  if (change3M > -10) {
    return { emoji: "🌱", label: "대기 중", status: "waiting" };
  }

  // 6. 약세
  return { emoji: "❄️", label: "약세", status: "weak" };
}

// VIX 레벨 판단
function getVixLevel(vix: number): { level: string; label: string; color: string } {
  if (vix < 15) return { level: "low", label: "매우 안정", color: "green" };
  if (vix < 20) return { level: "normal", label: "안정", color: "green" };
  if (vix < 25) return { level: "elevated", label: "경계", color: "yellow" };
  if (vix < 30) return { level: "high", label: "불안", color: "orange" };
  return { level: "extreme", label: "공포", color: "red" };
}

// 금리 트렌드 판단
function getRateTrend(change: number): { trend: string; label: string } {
  if (change < -0.1) return { trend: "down", label: "하락 추세" };
  if (change > 0.1) return { trend: "up", label: "상승 추세" };
  return { trend: "flat", label: "보합" };
}

// 달러 트렌드 판단
function getDollarTrend(change: number): { trend: string; label: string } {
  if (change < -2) return { trend: "weak", label: "약세" };
  if (change > 2) return { trend: "strong", label: "강세" };
  return { trend: "flat", label: "보합" };
}

// 경기 사이클 추정 (간단 버전)
function estimateCyclePosition(data: {
  vix: number;
  rateChange: number;
  marketReturn3M: number;
}): "recovery" | "expansion" | "late" | "recession" {
  const { vix, rateChange, marketReturn3M } = data;

  // 간단한 휴리스틱
  if (vix > 25 && marketReturn3M < -5) return "recession";
  if (marketReturn3M > 10 && vix < 20) return "expansion";
  if (rateChange > 0.3 && marketReturn3M > 0) return "late";
  return "recovery";
}

// ═══════════════════════════════════════════════════════════════
// 히스토리컬 데이터 가져오기
// ═══════════════════════════════════════════════════════════════

async function getHistoricalPrices(ticker: string, days: number): Promise<number[]> {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days - 10); // 여유분 추가

    const result = await yahooFinance.historical(ticker, {
      period1: startDate.toISOString().split('T')[0],
      period2: endDate.toISOString().split('T')[0],
      interval: '1d',
    });

    return result.map(d => d.close).filter(p => p != null) as number[];
  } catch (error) {
    console.error(`Historical data error for ${ticker}:`, error);
    return [];
  }
}

// 특정 기간 전 가격 가져오기
async function getPriceAtDate(ticker: string, daysAgo: number): Promise<number | null> {
  const prices = await getHistoricalPrices(ticker, daysAgo + 5);
  if (prices.length === 0) return null;
  return prices[0]; // 가장 오래된 가격
}

// ═══════════════════════════════════════════════════════════════
// 메인 API 핸들러
// ═══════════════════════════════════════════════════════════════

export async function GET() {
  try {
    // ═══════════════════════════════════════════════════════════════
    // 1. 매크로 데이터 가져오기
    // ═══════════════════════════════════════════════════════════════

    const [marketQuote, treasuryQuote, dollarQuote, vixQuote] = await Promise.all([
      yahooFinance.quote(MACRO_TICKERS.market),
      yahooFinance.quote(MACRO_TICKERS.treasury10Y),
      yahooFinance.quote(MACRO_TICKERS.dollarIndex).catch(() => null),
      yahooFinance.quote(MACRO_TICKERS.vix),
    ]);

    // 시장 히스토리컬 데이터 (수익률 계산용)
    const marketPrices = await getHistoricalPrices(MACRO_TICKERS.market, 365);
    const currentMarketPrice = marketQuote.regularMarketPrice || 0;

    // 기간별 시장 수익률
    const marketReturns = {
      change1W: marketPrices.length > 5 ? calculateReturn(currentMarketPrice, marketPrices[marketPrices.length - 6]) : 0,
      change1M: marketPrices.length > 22 ? calculateReturn(currentMarketPrice, marketPrices[marketPrices.length - 23]) : 0,
      change3M: marketPrices.length > 66 ? calculateReturn(currentMarketPrice, marketPrices[marketPrices.length - 67]) : 0,
      change6M: marketPrices.length > 132 ? calculateReturn(currentMarketPrice, marketPrices[marketPrices.length - 133]) : 0,
      change1Y: marketPrices.length > 252 ? calculateReturn(currentMarketPrice, marketPrices[0]) : 0,
    };

    // 금리 변화 (1개월)
    const treasuryPrices = await getHistoricalPrices(MACRO_TICKERS.treasury10Y, 30);
    const treasuryChange1M = treasuryPrices.length > 22 
      ? (treasuryQuote.regularMarketPrice || 0) - treasuryPrices[0]
      : 0;

    // 달러 변화 (1개월)
    let dollarValue = 103; // 기본값
    let dollarChange1M = 0;
    if (dollarQuote) {
      dollarValue = dollarQuote.regularMarketPrice || 103;
      const dollarPrices = await getHistoricalPrices(MACRO_TICKERS.dollarIndex, 30);
      dollarChange1M = dollarPrices.length > 22 
        ? calculateReturn(dollarValue, dollarPrices[0])
        : 0;
    }

    // VIX
    const vixValue = vixQuote.regularMarketPrice || 20;
    const vixLevel = getVixLevel(vixValue);

    // 경기 사이클 추정
    const cyclePosition = estimateCyclePosition({
      vix: vixValue,
      rateChange: treasuryChange1M,
      marketReturn3M: marketReturns.change3M,
    });

    const cycleData = CYCLE_SECTORS[cyclePosition];

    // 매크로 요약
    const rateTrend = getRateTrend(treasuryChange1M);
    const dollarTrend = getDollarTrend(dollarChange1M);

    const macroSummary = generateMacroSummary({
      treasury: { value: treasuryQuote.regularMarketPrice || 0, trend: rateTrend.trend },
      dollar: { value: dollarValue, trend: dollarTrend.trend },
      vix: { value: vixValue, level: vixLevel.level },
      cycle: cyclePosition,
    });

    // ═══════════════════════════════════════════════════════════════
    // 2. 섹터 ETF 데이터 가져오기
    // ═══════════════════════════════════════════════════════════════

    const sectorDataPromises = SECTOR_ETFS.map(async (sector) => {
      try {
        const [quote, prices] = await Promise.all([
          yahooFinance.quote(sector.ticker),
          getHistoricalPrices(sector.ticker, 365),
        ]);

        const currentPrice = quote.regularMarketPrice || 0;

        // 기간별 수익률
        const change1W = prices.length > 5 ? calculateReturn(currentPrice, prices[prices.length - 6]) : 0;
        const change1M = prices.length > 22 ? calculateReturn(currentPrice, prices[prices.length - 23]) : 0;
        const change3M = prices.length > 66 ? calculateReturn(currentPrice, prices[prices.length - 67]) : 0;
        const change6M = prices.length > 132 ? calculateReturn(currentPrice, prices[prices.length - 133]) : 0;
        const change1Y = prices.length > 252 ? calculateReturn(currentPrice, prices[0]) : 0;

        // 상대강도
        const rs1W = calculateRelativeStrength(change1W, marketReturns.change1W);
        const rs1M = calculateRelativeStrength(change1M, marketReturns.change1M);
        const rs3M = calculateRelativeStrength(change3M, marketReturns.change3M);
        const rs6M = calculateRelativeStrength(change6M, marketReturns.change6M);
        const rs1Y = calculateRelativeStrength(change1Y, marketReturns.change1Y);

        // 상태 (3개월 기준)
        const status = getSectorStatus(rs3M);

        return {
          ticker: sector.ticker,
          name: sector.name,
          nameKo: sector.nameKo,
          price: currentPrice,
          change1W: Math.round(change1W * 100) / 100,
          change1M: Math.round(change1M * 100) / 100,
          change3M: Math.round(change3M * 100) / 100,
          change6M: Math.round(change6M * 100) / 100,
          change1Y: Math.round(change1Y * 100) / 100,
          rs1W: Math.round(rs1W * 100) / 100,
          rs1M: Math.round(rs1M * 100) / 100,
          rs3M: Math.round(rs3M * 100) / 100,
          rs6M: Math.round(rs6M * 100) / 100,
          rs1Y: Math.round(rs1Y * 100) / 100,
          status,
        };
      } catch (error) {
        console.error(`Sector data error for ${sector.ticker}:`, error);
        return null;
      }
    });

    const sectorsRaw = await Promise.all(sectorDataPromises);
    const sectors = sectorsRaw.filter(s => s !== null);

    // 섹터 요약
    const hotSectors = sectors.filter(s => s.status === "hot").map(s => s.nameKo);
    const coldSectors = sectors.filter(s => s.status === "cold").map(s => s.nameKo);
    const sectorSummary = generateSectorSummary(hotSectors, coldSectors);

    // ═══════════════════════════════════════════════════════════════
    // 3. AI 밸류체인 데이터 가져오기
    // ═══════════════════════════════════════════════════════════════

    const valueChainPromises = AI_VALUE_CHAIN.map(async (stage) => {
      try {
        // ETF가 있으면 ETF 사용, 없으면 종목 평균
        let prices: number[] = [];
        let currentPrice = 0;
        let high52W = 0;
        let etfOrAvg = "";

        if (stage.etf) {
          const [quote, historicalPrices] = await Promise.all([
            yahooFinance.quote(stage.etf),
            getHistoricalPrices(stage.etf, 365),
          ]);
          currentPrice = quote.regularMarketPrice || 0;
          high52W = quote.fiftyTwoWeekHigh || currentPrice;
          prices = historicalPrices;
          etfOrAvg = stage.etf;
        } else {
          // 종목 평균
          const stockDataPromises = stage.stocks.map(async (ticker) => {
            try {
              const [quote, historicalPrices] = await Promise.all([
                yahooFinance.quote(ticker),
                getHistoricalPrices(ticker, 365),
              ]);
              return {
                price: quote.regularMarketPrice || 0,
                high52W: quote.fiftyTwoWeekHigh || 0,
                prices: historicalPrices,
              };
            } catch {
              return null;
            }
          });

          const stockData = (await Promise.all(stockDataPromises)).filter(d => d !== null);
          
          if (stockData.length > 0) {
            currentPrice = stockData.reduce((sum, d) => sum + d!.price, 0) / stockData.length;
            high52W = stockData.reduce((sum, d) => sum + d!.high52W, 0) / stockData.length;
            // 첫 번째 종목의 가격 배열 사용 (간단화)
            prices = stockData[0]!.prices;
          }
          etfOrAvg = "평균";
        }

        // 3개월 수익률
        const change3M = prices.length > 66 
          ? calculateReturn(currentPrice, prices[prices.length - 67])
          : 0;

        // 52주 고점 대비
        const fromHigh52W = high52W > 0 
          ? ((currentPrice - high52W) / high52W) * 100
          : 0;

        // RSI
        const recentPrices = prices.slice(-20).reverse();
        const rsi14 = calculateRSI(recentPrices);

        // 증명 상태
        const proof = getProofStatus({
          change3M,
          rsi14,
          fromHigh52W,
        });

        return {
          stage: stage.stage,
          name: stage.name,
          nameEn: stage.nameEn,
          etfOrAvg,
          description: stage.description,
          change3M: Math.round(change3M * 100) / 100,
          rsi14: Math.round(rsi14),
          fromHigh52W: Math.round(fromHigh52W * 100) / 100,
          proof,
          stocks: stage.stocks.map(ticker => ({ ticker, name: ticker })),
        };
      } catch (error) {
        console.error(`Value chain error for stage ${stage.stage}:`, error);
        return null;
      }
    });

    const valueChainRaw = await Promise.all(valueChainPromises);
    const valueChain = valueChainRaw.filter(v => v !== null);

    // 밸류체인 요약
    const valueChainSummary = generateValueChainSummary(valueChain);

    // ═══════════════════════════════════════════════════════════════
    // 4. 응답 구성
    // ═══════════════════════════════════════════════════════════════

    const response = {
      // 매크로
      macro: {
        treasury10Y: {
          value: Math.round((treasuryQuote.regularMarketPrice || 0) * 100) / 100,
          change1M: Math.round(treasuryChange1M * 100) / 100,
          trend: rateTrend.trend,
          trendLabel: rateTrend.label,
        },
        dollarIndex: {
          value: Math.round(dollarValue * 100) / 100,
          change1M: Math.round(dollarChange1M * 100) / 100,
          trend: dollarTrend.trend,
          trendLabel: dollarTrend.label,
        },
        vix: {
          value: Math.round(vixValue * 100) / 100,
          level: vixLevel.level,
          levelLabel: vixLevel.label,
          color: vixLevel.color,
        },
        cycle: {
          position: cyclePosition,
          positionKo: getCyclePositionKo(cyclePosition),
          favorableSectors: cycleData.favorable,
          unfavorableSectors: cycleData.unfavorable,
        },
        summary: macroSummary,
      },

      // 시장 기준
      market: {
        ticker: MACRO_TICKERS.market,
        name: "S&P 500",
        price: Math.round(currentMarketPrice * 100) / 100,
        ...marketReturns,
      },

      // 섹터
      sectors,
      sectorSummary,

      // 밸류체인
      valueChain,
      valueChainSummary,

      // 메타
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error("Sector API Error:", error);
    return NextResponse.json(
      { error: "섹터 데이터를 불러오는 중 오류가 발생했어요" },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// 요약 생성 함수
// ═══════════════════════════════════════════════════════════════

function getCyclePositionKo(position: string): string {
  const map: Record<string, string> = {
    recovery: "회복기",
    expansion: "확장기",
    late: "후기 확장",
    recession: "침체기",
  };
  return map[position] || "확장기";
}

function generateMacroSummary(data: {
  treasury: { value: number; trend: string };
  dollar: { value: number; trend: string };
  vix: { value: number; level: string };
  cycle: string;
}): string {
  const parts: string[] = [];

  // 금리
  if (data.treasury.trend === "down") {
    parts.push("금리 하락 추세로 성장주에 유리한 환경");
  } else if (data.treasury.trend === "up") {
    parts.push("금리 상승 추세로 가치주/금융주 유리");
  }

  // 달러
  if (data.dollar.trend === "weak") {
    parts.push("달러 약세로 원자재/빅테크 유리");
  } else if (data.dollar.trend === "strong") {
    parts.push("달러 강세로 내수주 유리");
  }

  // VIX
  if (data.vix.level === "low" || data.vix.level === "normal") {
    parts.push("VIX 안정으로 위험자산 투자 OK");
  } else if (data.vix.level === "high" || data.vix.level === "extreme") {
    parts.push("VIX 높아 신중한 접근 필요");
  }

  return parts.join(". ") + ".";
}

function generateSectorSummary(hotSectors: string[], coldSectors: string[]): string {
  let summary = "";

  if (hotSectors.length > 0) {
    summary += `${hotSectors.join(", ")} 섹터로 자금 유입 중. `;
  }

  if (coldSectors.length > 0) {
    summary += `${coldSectors.join(", ")} 섹터에서 자금 이탈.`;
  }

  if (!summary) {
    summary = "섹터 간 뚜렷한 차별화 없이 균형 잡힌 흐름.";
  }

  return summary;
}

function generateValueChainSummary(valueChain: any[]): string {
  const proving = valueChain.filter(v => v?.proof?.status === "proving").map(v => v.name);
  const early = valueChain.filter(v => v?.proof?.status === "early").map(v => v.name);
  const expensive = valueChain.filter(v => v?.proof?.status === "proven_expensive").map(v => v.name);

  let summary = "";

  if (expensive.length > 0) {
    summary += `${expensive.join(", ")}은 증명 완료했지만 고평가 구간. `;
  }

  if (proving.length > 0) {
    summary += `${proving.join(", ")}이 현재 실적 증명 중. `;
  }

  if (early.length > 0) {
    summary += `다음 타자로 ${early.join(", ")} 주목!`;
  }

  return summary || "밸류체인 전반적으로 안정적인 흐름.";
}
