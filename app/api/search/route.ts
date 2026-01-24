import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

// 한글 종목명 → 티커 매핑 (자주 검색되는 종목)
const koreanNameMap: { [key: string]: string } = {
  // 빅테크
  "애플": "AAPL", "마이크로소프트": "MSFT", "마소": "MSFT", "구글": "GOOGL", 
  "알파벳": "GOOGL", "아마존": "AMZN", "메타": "META", "페이스북": "META", 
  "넷플릭스": "NFLX", "테슬라": "TSLA", "엔비디아": "NVDA", "앤비디아": "NVDA",
  
  // AI/반도체
  "아스테라랩스": "ALAB", "아스테라 랩스": "ALAB", "마벨": "MRVL", "마블": "MRVL",
  "브로드컴": "AVGO", "퀄컴": "QCOM", "인텔": "INTC", "AMD": "AMD",
  "암드": "AMD", "에이엠디": "AMD", "마이크론": "MU", "팔란티어": "PLTR",
  "팔란": "PLTR", "슈퍼마이크로": "SMCI", "아리스타": "ANET", "몽고DB": "MDB",
  "TSMC": "TSM", "대만반도체": "TSM", "티에스엠씨": "TSM",
  
  // 클라우드/소프트웨어
  "스노우플레이크": "SNOW", "세일즈포스": "CRM", "서비스나우": "NOW",
  "크라우드스트라이크": "CRWD", "데이터독": "DDOG", "줌": "ZM",
  "도큐사인": "DOCU", "오클로": "OKLO", "오라클": "ORCL",
  
  // AI 인프라
  "코어위브": "CRWV", "버티브": "VRT", "이튼": "ETN",
  
  // 에너지/원자력 (SMR)
  "컨스털레이션": "CEG", "비스트라": "VST", "탈렌": "TLN",
  "카메코": "CCJ", "뉴스케일": "SMR",
  
  // v9.22: 온다스 추가
  "온다스": "ONDS", "온다스홀딩스": "ONDS",
  
  // v9.22: 추가 요청 종목
  "사이퍼마이닝": "CIFR", "사이퍼": "CIFR", "싸이퍼마이닝": "CIFR", "싸이퍼": "CIFR",
  
  // 금융
  "버크셔": "BRK-B", "JP모건": "JPM", "제이피모건": "JPM",
  "골드만삭스": "GS", "비자": "V", "마스터카드": "MA",
  "뱅크오브아메리카": "BAC", "웰스파고": "WFC",
  
  // 헬스케어
  "유나이티드헬스": "UNH", "일라이릴리": "LLY", "노보노디스크": "NVO",
  "화이자": "PFE", "머크": "MRK", "존슨앤존슨": "JNJ", "애브비": "ABBV",
  
  // 소비재
  "코스트코": "COST", "월마트": "WMT", "나이키": "NKE",
  "스타벅스": "SBUX", "맥도날드": "MCD", "코카콜라": "KO", "펩시": "PEP",
  "홈디포": "HD",
  
  // 양자컴퓨팅
  "아이온큐": "IONQ", "아이온Q": "IONQ", "리게티": "RGTI", "리게이티": "RGTI",
  "디웨이브": "QBTS", "퀀텀스케이프": "QS",
  
  // 전기차
  "루시드": "LCID", "리비안": "RIVN", "니오": "NIO", "포드": "F",
  
  // 기타
  "아이렌": "IREN", "사운드하운드": "SOUN", "로블록스": "RBLX",
  "디즈니": "DIS", "보잉": "BA", "쓰리엠": "MMM", "3M": "MMM",
  "코인베이스": "COIN", "마이크로스트래티지": "MSTR",
  "캐터필러": "CAT", "캐터필라": "CAT",
  "엑슨모빌": "XOM", "쉐브론": "CVX",
  
  // ETF
  "스파이": "SPY", "큐큐큐": "QQQ", "아크": "ARKK",
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    let query = searchParams.get("q");

    if (!query || query.length < 1) {
      return NextResponse.json({ results: [] });
    }

    // 한글 검색어인 경우 영문 티커로 변환
    const normalizedQuery = query.replace(/\s/g, "").toLowerCase();
    let mappedTicker: string | null = null;
    
    // 정확한 매칭 먼저 시도
    for (const [korean, ticker] of Object.entries(koreanNameMap)) {
      if (korean.replace(/\s/g, "").toLowerCase() === normalizedQuery) {
        mappedTicker = ticker;
        break;
      }
    }
    
    // 부분 매칭 시도
    if (!mappedTicker) {
      for (const [korean, ticker] of Object.entries(koreanNameMap)) {
        if (korean.replace(/\s/g, "").toLowerCase().includes(normalizedQuery) ||
            normalizedQuery.includes(korean.replace(/\s/g, "").toLowerCase())) {
          mappedTicker = ticker;
          break;
        }
      }
    }

    // 한글 매핑이 있으면 해당 티커로 검색
    const searchQuery = mappedTicker || query;

    // Yahoo Finance 검색 API 호출
    const searchResults = await yahooFinance.search(searchQuery, {
      quotesCount: 8,
      newsCount: 0,
    });

    // 주식만 필터링 (ETF, 뮤추얼펀드 등 제외 가능)
    const stocks = searchResults.quotes
      .filter((item: any) => 
        item.quoteType === "EQUITY" || 
        item.quoteType === "ETF"
      )
      .map((item: any) => ({
        ticker: item.symbol,
        name: item.shortname || item.longname || item.symbol,
        exchange: item.exchange || "",
        type: item.quoteType,
      }));

    return NextResponse.json({ 
      results: stocks,
      // 검색 결과가 없고 한글 검색이었다면 안내 메시지 포함
      noResultHint: stocks.length === 0 && /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(query) 
        ? "한글로 검색이 안 되면 영문명이나 티커(예: NVDA)로 검색해보세요"
        : null,
    });
  } catch (error) {
    console.error("Search API Error:", error);
    return NextResponse.json({ results: [] });
  }
}
