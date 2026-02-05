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
  "웨스턴디지털": "WDC", "웨스턴 디지털": "WDC", "웨디": "WDC",
  
  // 클라우드/소프트웨어
  "스노우플레이크": "SNOW", "세일즈포스": "CRM", "서비스나우": "NOW",
  "크라우드스트라이크": "CRWD", "데이터독": "DDOG", "줌": "ZM",
  "도큐사인": "DOCU", "오클로": "OKLO", "오라클": "ORCL",
  
  // AI 인프라
  "코어위브": "CRWV", "버티브": "VRT", "이튼": "ETN",
  "아이렌": "IREN", "아이 렌": "IREN", "IREN": "IREN",
  "심보틱": "SYM", "심보틱스": "SYM",
  
  // 에너지/원자력 (SMR)
  "컨스털레이션": "CEG", "비스트라": "VST", "탈렌": "TLN",
  "카메코": "CCJ", "뉴스케일": "SMR",
  "플러그파워": "PLUG", "플러그 파워": "PLUG", "플러그": "PLUG",
  
  // v9.22: 온다스 추가
  "온다스": "ONDS", "온다스홀딩스": "ONDS",
  
  // v9.22: 추가 요청 종목
  "사이퍼마이닝": "CIFR", "사이퍼": "CIFR", "싸이퍼마이닝": "CIFR", "싸이퍼": "CIFR",
  "레드와이어": "RDW",
  "템퍼스": "TEM", "템퍼스AI": "TEM", "템퍼스에이아이": "TEM", "템퍼스아이": "TEM",
  "비트팜스": "BITF", "비트팜": "BITF", "비트팜주": "BITF", "빗팜스": "BITF",
  "이노데이터": "INOD",
  "코닝": "GLW",
  "코히런트": "COHR",
  "크리도테크놀로지그룹홀딩": "CRDO", "크리도테크놀로지": "CRDO", "크리도": "CRDO",
  // 추가 인기 종목
  "마라톤디지털": "MARA", "마라톤": "MARA",
  "라이엇": "RIOT", "라이엇플랫폼스": "RIOT",
  "루멘텀": "LITE", "에퀴닉스": "EQIX",
  "델": "DELL", "클라우드플레어": "NET",
  "빅베어에이아이": "BBAI", "씨쓰리에이아이": "AI",
  "센트러스에너지": "LEU", "센트러스": "LEU",
  "럼블": "RUM", "럼블Inc": "RUM",
  
  // 금융
  "버크셔": "BRK-B", "JP모건": "JPM", "제이피모건": "JPM",
  "골드만삭스": "GS", "비자": "V", "마스터카드": "MA",
  "뱅크오브아메리카": "BAC", "웰스파고": "WFC",
  
  // 헬스케어
  "유나이티드헬스": "UNH", "유나이티드헬스그룹": "UNH", "유나이티드": "UNH", "UNH": "UNH",
  "일라이릴리": "LLY", "노보노디스크": "NVO",
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
  "사운드하운드": "SOUN", "로블록스": "RBLX",
  "디즈니": "DIS", "보잉": "BA", "쓰리엠": "MMM", "3M": "MMM",
  "코인베이스": "COIN", "마이크로스트래티지": "MSTR",
  "캐터필러": "CAT", "캐터필라": "CAT",
  "엑슨모빌": "XOM", "쉐브론": "CVX",
  
  // v9.22: 신규 요청 종목
  "블루골드": "BGL",
  "브랜드인게이지먼트네트워크": "BNAI", "브랜드인게이지먼트": "BNAI",
  
  // v9.22: 확장 - 크립토/비트코인
  "클린스파크": "CLSK", "허트에이트": "HUT", "허트에이트마이닝": "HUT",
  "테라울프": "WULF", "코어사이언티픽": "CORZ", "아이리스에너지": "IREN",
  "비트디어": "BTDR",
  
  // v9.22: 확장 - 전기차/배터리
  "니콜라": "NKLA", "카누": "GOEV", "피스커": "FSR", "빈패스트": "VFS",
  "앨버말": "ALB", "리튬아메리카스": "LAC",
  
  // v9.22: 확장 - 우주
  "AST스페이스모바일": "ASTS", "인튜이티브머신스": "LUNR", "로켓랩": "RKLB",
  "블랙스카이": "BKSY", "스파이어글로벌": "SPIR",
  
  // v9.22: 확장 - 유틸리티
  "GE버노바": "GEV", "지이버노바": "GEV",
  
  // ETF
  "스파이": "SPY", "큐큐큐": "QQQ", "아크": "ARKK",
};

// ═══════════════════════════════════════════════════════════════
// 한국 주식 검색 매핑
// ═══════════════════════════════════════════════════════════════
const krStockSearchMap: Record<string, { code: string; name: string; market: string }> = {
  "삼성전자": { code: "005930", name: "삼성전자", market: "KOSPI" },
  "삼전": { code: "005930", name: "삼성전자", market: "KOSPI" },
  "삼성": { code: "005930", name: "삼성전자", market: "KOSPI" },
  "sk하이닉스": { code: "000660", name: "SK하이닉스", market: "KOSPI" },
  "하이닉스": { code: "000660", name: "SK하이닉스", market: "KOSPI" },
  "에스케이하이닉스": { code: "000660", name: "SK하이닉스", market: "KOSPI" },
  "현대자동차": { code: "005380", name: "현대자동차", market: "KOSPI" },
  "현대차": { code: "005380", name: "현대자동차", market: "KOSPI" },
  "현차": { code: "005380", name: "현대자동차", market: "KOSPI" },
  "기아": { code: "000270", name: "기아", market: "KOSPI" },
  "기아차": { code: "000270", name: "기아", market: "KOSPI" },
  "lg에너지솔루션": { code: "373220", name: "LG에너지솔루션", market: "KOSPI" },
  "엘지에너지솔루션": { code: "373220", name: "LG에너지솔루션", market: "KOSPI" },
  "lg엔솔": { code: "373220", name: "LG에너지솔루션", market: "KOSPI" },
  "삼성sdi": { code: "006400", name: "삼성SDI", market: "KOSPI" },
  "삼성에스디아이": { code: "006400", name: "삼성SDI", market: "KOSPI" },
  "lg화학": { code: "051910", name: "LG화학", market: "KOSPI" },
  "엘지화학": { code: "051910", name: "LG화학", market: "KOSPI" },
  "네이버": { code: "035420", name: "NAVER", market: "KOSPI" },
  "naver": { code: "035420", name: "NAVER", market: "KOSPI" },
  "카카오": { code: "035720", name: "카카오", market: "KOSPI" },
  "카톡": { code: "035720", name: "카카오", market: "KOSPI" },
  "posco홀딩스": { code: "005490", name: "POSCO홀딩스", market: "KOSPI" },
  "포스코": { code: "005490", name: "POSCO홀딩스", market: "KOSPI" },
  "posco": { code: "005490", name: "POSCO홀딩스", market: "KOSPI" },
  "셀트리온": { code: "068270", name: "셀트리온", market: "KOSPI" },
  "한국전력": { code: "015760", name: "한국전력", market: "KOSPI" },
  "한전": { code: "015760", name: "한국전력", market: "KOSPI" },
  "kb금융": { code: "105560", name: "KB금융", market: "KOSPI" },
  "국민은행": { code: "105560", name: "KB금융", market: "KOSPI" },
  "신한지주": { code: "055550", name: "신한지주", market: "KOSPI" },
  "신한은행": { code: "055550", name: "신한지주", market: "KOSPI" },
  "하나금융": { code: "086790", name: "하나금융지주", market: "KOSPI" },
  "하나은행": { code: "086790", name: "하나금융지주", market: "KOSPI" },
  "우리금융": { code: "316140", name: "우리금융지주", market: "KOSPI" },
  "우리은행": { code: "316140", name: "우리금융지주", market: "KOSPI" },
  "크래프톤": { code: "259960", name: "크래프톤", market: "KOSPI" },
  "하이브": { code: "352820", name: "하이브", market: "KOSPI" },
  "엔씨소프트": { code: "036570", name: "엔씨소프트", market: "KOSPI" },
  "엔씨": { code: "036570", name: "엔씨소프트", market: "KOSPI" },
  "넷마블": { code: "251270", name: "넷마블", market: "KOSPI" },
  "대한항공": { code: "003490", name: "대한항공", market: "KOSPI" },
  "삼성물산": { code: "028260", name: "삼성물산", market: "KOSPI" },
  "현대모비스": { code: "012330", name: "현대모비스", market: "KOSPI" },
  "lg전자": { code: "066570", name: "LG전자", market: "KOSPI" },
  "엘지전자": { code: "066570", name: "LG전자", market: "KOSPI" },
  "삼성전기": { code: "009150", name: "삼성전기", market: "KOSPI" },
  "삼성생명": { code: "032830", name: "삼성생명", market: "KOSPI" },
  "삼성화재": { code: "000810", name: "삼성화재", market: "KOSPI" },
  "삼성중공업": { code: "010140", name: "삼성중공업", market: "KOSPI" },
  "현대건설": { code: "000720", name: "현대건설", market: "KOSPI" },
  "현대제철": { code: "004020", name: "현대제철", market: "KOSPI" },
  "고려아연": { code: "010130", name: "고려아연", market: "KOSPI" },
  "kt": { code: "030200", name: "KT", market: "KOSPI" },
  "케이티": { code: "030200", name: "KT", market: "KOSPI" },
  "sk텔레콤": { code: "017670", name: "SK텔레콤", market: "KOSPI" },
  "skt": { code: "017670", name: "SK텔레콤", market: "KOSPI" },
  "kt&g": { code: "033780", name: "KT&G", market: "KOSPI" },
  "한미반도체": { code: "042700", name: "한미반도체", market: "KOSPI" },
  "hd현대일렉트릭": { code: "267260", name: "HD현대일렉트릭", market: "KOSPI" },
  "현대일렉트릭": { code: "267260", name: "HD현대일렉트릭", market: "KOSPI" },
  "hd현대중공업": { code: "329180", name: "HD현대중공업", market: "KOSPI" },
  "현대중공업": { code: "329180", name: "HD현대중공업", market: "KOSPI" },
  "두산에너빌리티": { code: "034020", name: "두산에너빌리티", market: "KOSPI" },
  "두산에너": { code: "034020", name: "두산에너빌리티", market: "KOSPI" },
  "hmm": { code: "011200", name: "HMM", market: "KOSPI" },
  "아모레퍼시픽": { code: "090430", name: "아모레퍼시픽", market: "KOSPI" },
  "아모레": { code: "090430", name: "아모레퍼시픽", market: "KOSPI" },
  "코웨이": { code: "021240", name: "코웨이", market: "KOSPI" },
  "카카오뱅크": { code: "323410", name: "카카오뱅크", market: "KOSPI" },
  "카뱅": { code: "323410", name: "카카오뱅크", market: "KOSPI" },
  "카카오페이": { code: "377300", name: "카카오페이", market: "KOSPI" },
  "포스코퓨처엠": { code: "003670", name: "포스코퓨처엠", market: "KOSPI" },
  "포스코인터내셔널": { code: "047050", name: "포스코인터내셔널", market: "KOSPI" },
  "sk이노베이션": { code: "096770", name: "SK이노베이션", market: "KOSPI" },
  "sk바이오사이언스": { code: "302440", name: "SK바이오사이언스", market: "KOSPI" },
  "sk": { code: "034730", name: "SK", market: "KOSPI" },
  "lg": { code: "003550", name: "LG", market: "KOSPI" },
  "lg생활건강": { code: "051900", name: "LG생활건강", market: "KOSPI" },
  "삼성에스디에스": { code: "018260", name: "삼성에스디에스", market: "KOSPI" },
  "삼성sds": { code: "018260", name: "삼성에스디에스", market: "KOSPI" },
  "s-oil": { code: "010950", name: "S-Oil", market: "KOSPI" },
  "에쓰오일": { code: "010950", name: "S-Oil", market: "KOSPI" },
  "미래에셋증권": { code: "006800", name: "미래에셋증권", market: "KOSPI" },
  "신세계": { code: "004170", name: "신세계", market: "KOSPI" },
  "에코프로비엠": { code: "247540", name: "에코프로비엠", market: "KOSDAQ" },
  "에코프로": { code: "086520", name: "에코프로", market: "KOSDAQ" },
  "알테오젠": { code: "196170", name: "알테오젠", market: "KOSDAQ" },
  "펄어비스": { code: "263750", name: "펄어비스", market: "KOSDAQ" },
  "카카오게임즈": { code: "293490", name: "카카오게임즈", market: "KOSDAQ" },
  "jyp": { code: "035900", name: "JYP Ent.", market: "KOSDAQ" },
  "에스엠": { code: "041510", name: "에스엠", market: "KOSDAQ" },
  "sm": { code: "041510", name: "에스엠", market: "KOSDAQ" },
  "위메이드": { code: "112040", name: "위메이드", market: "KOSDAQ" },
  "hpsp": { code: "403870", name: "HPSP", market: "KOSDAQ" },
  "리노공업": { code: "058470", name: "리노공업", market: "KOSDAQ" },
  "루닛": { code: "328130", name: "루닛", market: "KOSDAQ" },
  "주성엔지니어링": { code: "036930", name: "주성엔지니어링", market: "KOSDAQ" },
  "주성": { code: "036930", name: "주성엔지니어링", market: "KOSDAQ" },
  "f&f": { code: "383220", name: "F&F", market: "KOSDAQ" },
  "에프앤에프": { code: "383220", name: "F&F", market: "KOSDAQ" },
  "솔브레인": { code: "357780", name: "솔브레인", market: "KOSDAQ" },
  "아프리카tv": { code: "067160", name: "아프리카TV", market: "KOSDAQ" },
  "숲": { code: "067160", name: "아프리카TV(SOOP)", market: "KOSDAQ" },
  "soop": { code: "067160", name: "아프리카TV(SOOP)", market: "KOSDAQ" },
  "휴젤": { code: "145020", name: "휴젤", market: "KOSDAQ" },
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    let query = searchParams.get("q");

    if (!query || query.length < 1) {
      return NextResponse.json({ results: [] });
    }

    // URL 인코딩된 한글 디코딩
    try {
      query = decodeURIComponent(query);
    } catch (e) {
      // 이미 디코딩된 경우 무시
    }

    console.log("[search] raw query:", searchParams.get("q"), "→ decoded:", query);

    const normalizedQuery = query.replace(/\s/g, "").toLowerCase();
    
    console.log("[search] normalized:", normalizedQuery, "krMap has key:", normalizedQuery in krStockSearchMap);
    
    // ═══════════════════════════════════════════════════════════════
    // 1. 한국 주식 매칭 (정확 + 부분)
    // ═══════════════════════════════════════════════════════════════
    const krResults: { ticker: string; name: string; exchange: string; type: string; isKorean: boolean; stockCode: string }[] = [];
    
    // 정확 매칭
    if (krStockSearchMap[normalizedQuery]) {
      const kr = krStockSearchMap[normalizedQuery];
      krResults.push({
        ticker: `${kr.code}.${kr.market === "KOSPI" ? "KS" : "KQ"}`,
        name: kr.name,
        exchange: kr.market,
        type: "EQUITY",
        isKorean: true,
        stockCode: kr.code,
      });
    }
    
    // 부분 매칭 (정확 매칭 결과 없을 때)
    if (krResults.length === 0) {
      for (const [key, kr] of Object.entries(krStockSearchMap)) {
        if (key.includes(normalizedQuery) || normalizedQuery.includes(key)) {
          // 중복 방지
          if (!krResults.find(r => r.stockCode === kr.code)) {
            krResults.push({
              ticker: `${kr.code}.${kr.market === "KOSPI" ? "KS" : "KQ"}`,
              name: kr.name,
              exchange: kr.market,
              type: "EQUITY",
              isKorean: true,
              stockCode: kr.code,
            });
          }
          if (krResults.length >= 3) break; // 최대 3개
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 2. 미국 주식 매칭 (기존 로직)
    // ═══════════════════════════════════════════════════════════════
    let mappedTicker: string | null = null;
    
    for (const [korean, ticker] of Object.entries(koreanNameMap)) {
      if (korean.replace(/\s/g, "").toLowerCase() === normalizedQuery) {
        mappedTicker = ticker;
        break;
      }
    }
    
    if (!mappedTicker) {
      for (const [korean, ticker] of Object.entries(koreanNameMap)) {
        if (korean.replace(/\s/g, "").toLowerCase().includes(normalizedQuery) ||
            normalizedQuery.includes(korean.replace(/\s/g, "").toLowerCase())) {
          mappedTicker = ticker;
          break;
        }
      }
    }

    const searchQuery = mappedTicker || query;

    // Yahoo Finance 검색 (미국 주식) - 에러 시에도 한국 결과는 보존
    let usStocks: { ticker: string; name: string; exchange: string; type: string; isKorean: boolean }[] = [];
    try {
      const searchResults = await yahooFinance.search(searchQuery, {
        quotesCount: 8,
        newsCount: 0,
      });

      usStocks = searchResults.quotes
        .filter((item: any) => 
          item.quoteType === "EQUITY" || 
          item.quoteType === "ETF"
        )
        .map((item: any) => ({
          ticker: item.symbol,
          name: item.shortname || item.longname || item.symbol,
          exchange: item.exchange || "",
          type: item.quoteType,
          isKorean: false,
        }));
    } catch (yahooError) {
      console.error("Yahoo Finance search error (한국 결과는 유지):", yahooError);
      // Yahoo 에러 시에도 한국 결과는 유지
    }

    // ═══════════════════════════════════════════════════════════════
    // 3. 한국 + 미국 합쳐서 반환 (한국 먼저)
    // ═══════════════════════════════════════════════════════════════
    const allResults = [...krResults, ...usStocks];
    
    console.log("[search] krResults:", krResults.length, "usStocks:", usStocks.length, "total:", allResults.length);

    return NextResponse.json({ 
      results: allResults,
      noResultHint: allResults.length === 0 && /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(query) 
        ? "한글로 검색이 안 되면 영문명이나 티커(예: NVDA)로 검색해보세요"
        : null,
    });
  } catch (error) {
    console.error("Search API Error:", error);
    return NextResponse.json({ results: [] });
  }
}
