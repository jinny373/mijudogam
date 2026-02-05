import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// ═══════════════════════════════════════════════════════════════
// 시장 지수 + 환율 + 코인
// ═══════════════════════════════════════════════════════════════

const MARKET_TICKERS = {
  sp500: "^GSPC",
  nasdaq: "^IXIC",
  dow: "^DJI",
  vix: "^VIX",
  treasury10Y: "^TNX",
  treasury2Y: "^IRX",
  dollarIndex: "DX-Y.NYB",
  gold: "GC=F",
  oil: "CL=F",
  kospi: "^KS11",
  kosdaq: "^KQ11",
  usdkrw: "KRW=X",
  // 코인
  btc: "BTC-USD",
  eth: "ETH-USD",
  sol: "SOL-USD",
};

// 핵심 개별 종목 (빅테크 + 반도체 + 방산/에너지)
const KEY_STOCKS = {
  nvda: "NVDA",
  googl: "GOOGL",
  amd: "AMD",
  aapl: "AAPL",
  msft: "MSFT",
  meta: "META",
  amzn: "AMZN",
  tsla: "TSLA",
  avgo: "AVGO",
  smh: "SMH",     // 반도체 ETF
  xle: "XLE",     // 에너지 섹터
  xlu: "XLU",     // 유틸리티 (방어주)
  xlp: "XLP",     // 필수소비재 (방어주)
  lmt: "LMT",     // 방산
};

// ═══════════════════════════════════════════════════════════════
// 시장 데이터 가져오기
// ═══════════════════════════════════════════════════════════════

interface MarketQuote {
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

const nameMap: Record<string, string> = {
  sp500: "S&P 500",
  nasdaq: "나스닥",
  dow: "다우존스",
  vix: "VIX (공포지수)",
  treasury10Y: "미국 10년물 금리",
  treasury2Y: "미국 2년물 금리",
  dollarIndex: "달러 인덱스",
  gold: "금",
  oil: "원유 (WTI)",
  kospi: "코스피",
  kosdaq: "코스닥",
  usdkrw: "원/달러 환율",
  btc: "비트코인",
  eth: "이더리움",
  sol: "솔라나",
  nvda: "엔비디아",
  googl: "알파벳(구글)",
  amd: "AMD",
  aapl: "애플",
  msft: "마이크로소프트",
  meta: "메타",
  amzn: "아마존",
  tsla: "테슬라",
  avgo: "브로드컴",
  smh: "반도체 ETF",
  xle: "에너지 섹터",
  xlu: "유틸리티 섹터",
  xlp: "필수소비재 섹터",
  lmt: "록히드마틴",
};

async function fetchAllQuotes(tickers: Record<string, string>): Promise<Record<string, MarketQuote>> {
  const results: Record<string, MarketQuote> = {};

  await Promise.all(
    Object.entries(tickers).map(async ([key, ticker]) => {
      try {
        const quote = await yahooFinance.quote(ticker);
        results[key] = {
          name: nameMap[key] || ticker,
          price: quote.regularMarketPrice ?? 0,
          change: quote.regularMarketChange ?? 0,
          changePercent: quote.regularMarketChangePercent ?? 0,
        };
      } catch (e) {
        console.error(`Failed to fetch ${ticker}:`, e);
      }
    })
  );

  return results;
}

// ═══════════════════════════════════════════════════════════════
// API Route
// ═══════════════════════════════════════════════════════════════

export async function GET() {
  try {
    const [marketData, stockData] = await Promise.all([
      fetchAllQuotes(MARKET_TICKERS),
      fetchAllQuotes(KEY_STOCKS),
    ]);

    // 오늘 날짜 (한국 시간)
    const today = new Date().toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
      timeZone: "Asia/Seoul",
    });

    return NextResponse.json({
      date: today,
      marketData,
      stockData,
      lastUpdated: new Date().toISOString(),
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    console.error("Debate API error:", error);
    return NextResponse.json(
      { error: "시장 데이터를 가져오는 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
