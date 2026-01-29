import { NextResponse } from "next/server";

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
// 신호등 타입
// ═══════════════════════════════════════════════════════════════

interface SignalResult {
  earning: "good" | "normal" | "bad";
  debt: "good" | "normal" | "bad";
  growth: "good" | "normal" | "bad";
  valuation: "good" | "normal" | "bad";
}

// ═══════════════════════════════════════════════════════════════
// 기존 stock API 호출해서 신호등 가져오기
// ═══════════════════════════════════════════════════════════════

async function getSignalsFromStockAPI(ticker: string): Promise<SignalResult | null> {
  try {
    // 상대 경로로 기존 stock API 호출
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    
    const response = await fetch(`${baseUrl}/api/stock/${ticker}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      // 캐시 사용
      next: { revalidate: 3600 } // 1시간 캐시
    });

    if (!response.ok) {
      console.error(`Stock API error for ${ticker}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    // indicators에서 신호등 추출
    if (data.indicators) {
      return {
        earning: statusToSignal(data.indicators.earning?.status),
        debt: statusToSignal(data.indicators.debt?.status),
        growth: statusToSignal(data.indicators.growth?.status),
        valuation: statusToSignal(data.indicators.valuation?.status),
      };
    }

    return null;
  } catch (error) {
    console.error(`Error fetching signals for ${ticker}:`, error);
    return null;
  }
}

// green/yellow/red → good/normal/bad 변환
function statusToSignal(status: string | undefined): "good" | "normal" | "bad" {
  if (status === "green") return "good";
  if (status === "red") return "bad";
  return "normal";
}

// ═══════════════════════════════════════════════════════════════
// API 핸들러
// ═══════════════════════════════════════════════════════════════

export async function GET() {
  try {
    // 모든 종목의 신호등 가져오기 (병렬, 동시 요청 제한)
    const batchSize = 5; // 동시 요청 5개씩
    const results: { ticker: string; name: string; sector: string; signals: SignalResult | null }[] = [];

    for (let i = 0; i < POPULAR_STOCKS.length; i += batchSize) {
      const batch = POPULAR_STOCKS.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (stock) => {
          const signals = await getSignalsFromStockAPI(stock.ticker);
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
