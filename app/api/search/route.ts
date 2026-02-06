import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

// 한글 종목명 → 티커 매핑 (자주 검색되는 종목)
const koreanNameMap: { [key: string]: string } = {
  // ═══════════════════════════════════════════════════════════════
  // 빅테크 (Magnificent 7 + 주요 기업)
  // ═══════════════════════════════════════════════════════════════
  "애플": "AAPL", "마이크로소프트": "MSFT", "마소": "MSFT", "MS": "MSFT",
  "구글": "GOOGL", "알파벳": "GOOGL", "구글A": "GOOGL", "구글C": "GOOG",
  "아마존": "AMZN", "메타": "META", "페이스북": "META", "페북": "META",
  "넷플릭스": "NFLX", "넷플": "NFLX", "테슬라": "TSLA",
  "엔비디아": "NVDA", "앤비디아": "NVDA", "엔비": "NVDA",

  // ═══════════════════════════════════════════════════════════════
  // AI/반도체 (핵심 확장)
  // ═══════════════════════════════════════════════════════════════
  "아스테라랩스": "ALAB", "아스테라 랩스": "ALAB", "아스테라": "ALAB",
  "마벨": "MRVL", "마블": "MRVL", "마벨테크": "MRVL",
  "브로드컴": "AVGO", "퀄컴": "QCOM", "인텔": "INTC",
  "AMD": "AMD", "암드": "AMD", "에이엠디": "AMD",
  "마이크론": "MU", "팔란티어": "PLTR", "팔란": "PLTR",
  "슈퍼마이크로": "SMCI", "슈마컴": "SMCI",
  "아리스타": "ANET", "아리스타네트웍스": "ANET",
  "몽고DB": "MDB", "몽고디비": "MDB",
  "TSMC": "TSM", "대만반도체": "TSM", "티에스엠씨": "TSM",
  "웨스턴디지털": "WDC", "웨스턴 디지털": "WDC", "웨디": "WDC",
  "램리서치": "LRCX", "램 리서치": "LRCX",
  "어플라이드머티리얼즈": "AMAT", "어플라이드": "AMAT", "AMAT": "AMAT",
  "ASML": "ASML", "아스엠엘": "ASML",
  "KLA": "KLAC", "케이엘에이": "KLAC",
  "시놉시스": "SNPS", "케이던스": "CDNS",
  "암": "ARM", "ARM": "ARM", "아암": "ARM", "암홀딩스": "ARM",
  
  // ═══════════════════════════════════════════════════════════════
  // 클라우드/소프트웨어/사이버보안
  // ═══════════════════════════════════════════════════════════════
  "스노우플레이크": "SNOW", "스노우": "SNOW",
  "세일즈포스": "CRM", "서비스나우": "NOW",
  "크라우드스트라이크": "CRWD", "크라우드": "CRWD",
  "데이터독": "DDOG", "줌": "ZM", "줌비디오": "ZM",
  "도큐사인": "DOCU", "오클로": "OKLO", "오라클": "ORCL",
  "팔로알토": "PANW", "팔로알토네트웍스": "PANW",
  "포티넷": "FTNT", "젠데스크": "ZEN",
  "옥타": "OKTA", "스플렁크": "SPLK",
  "어도비": "ADBE", "오토데스크": "ADSK",
  "인튜이트": "INTU", "워크데이": "WDAY",
  "몽고디비": "MDB", "엘라스틱": "ESTC",
  "트윌리오": "TWLO", "애틀라시안": "TEAM",
  "허브스팟": "HUBS", "쇼피파이": "SHOP",
  
  // ═══════════════════════════════════════════════════════════════
  // AI 인프라/데이터센터/전력
  // ═══════════════════════════════════════════════════════════════
  "코어위브": "CRWV", "버티브": "VRT", "버티브홀딩스": "VRT",
  "이튼": "ETN", "이튼코퍼레이션": "ETN",
  "아이렌": "IREN", "아이 렌": "IREN", "IREN": "IREN",
  "심보틱": "SYM", "심보틱스": "SYM",
  "에퀴닉스": "EQIX", "디지털리얼티": "DLR",
  "슈나이더일렉트릭": "SBGSF",
  
  // ═══════════════════════════════════════════════════════════════
  // 에너지/원자력/SMR (핵심 확장)
  // ═══════════════════════════════════════════════════════════════
  "컨스털레이션": "CEG", "컨스텔레이션": "CEG", "컨스텔": "CEG",
  "비스트라": "VST", "탈렌": "TLN", "탈렌에너지": "TLN",
  "카메코": "CCJ", "뉴스케일": "SMR", "뉴스케일파워": "SMR",
  "플러그파워": "PLUG", "플러그 파워": "PLUG", "플러그": "PLUG",
  "넥스트에라": "NEE", "넥스트에라에너지": "NEE",
  "듀크에너지": "DUK", "서던컴퍼니": "SO",
  "센트러스에너지": "LEU", "센트러스": "LEU",
  "우라늄에너지": "UEC", "에너지퓨얼즈": "UUUU",
  "데니슨마인즈": "DNN",
  
  // v9.22: 온다스 추가
  "온다스": "ONDS", "온다스홀딩스": "ONDS",
  
  // ═══════════════════════════════════════════════════════════════
  // 크립토/비트코인 마이닝 (확장)
  // ═══════════════════════════════════════════════════════════════
  "사이퍼마이닝": "CIFR", "사이퍼": "CIFR", "싸이퍼마이닝": "CIFR", "싸이퍼": "CIFR",
  "마라톤디지털": "MARA", "마라톤": "MARA",
  "라이엇": "RIOT", "라이엇플랫폼스": "RIOT",
  "클린스파크": "CLSK", "허트에이트": "HUT", "허트에이트마이닝": "HUT",
  "테라울프": "WULF", "코어사이언티픽": "CORZ",
  "아이리스에너지": "IREN", "비트디어": "BTDR",
  "비트팜스": "BITF", "비트팜": "BITF", "비트팜주": "BITF", "빗팜스": "BITF",
  "코인베이스": "COIN", "마이크로스트래티지": "MSTR", "마스트": "MSTR",
  
  // ═══════════════════════════════════════════════════════════════
  // 우주/항공/방산 (핵심 확장)
  // ═══════════════════════════════════════════════════════════════
  "켄코아에어로스페이스": "KENK", "켄코아": "KENK",
  "AST스페이스모바일": "ASTS", "AST": "ASTS", "에이에스티": "ASTS",
  "인튜이티브머신스": "LUNR", "인튜이티브": "LUNR",
  "로켓랩": "RKLB", "로켓 랩": "RKLB",
  "블랙스카이": "BKSY", "스파이어글로벌": "SPIR",
  "레드와이어": "RDW", "레드 와이어": "RDW",
  "록히드마틴": "LMT", "록히드": "LMT",
  "레이시온": "RTX", "노스롭그루먼": "NOC",
  "제너럴다이내믹스": "GD", "보잉": "BA",
  "팔란티어": "PLTR",
  
  // ═══════════════════════════════════════════════════════════════
  // 헬스케어/바이오 (핵심 확장)
  // ═══════════════════════════════════════════════════════════════
  "한올바이오파마": "HNOLV", // 또는 한국주식으로 분류
  "리졸브AI": "RZLV", "리졸브": "RZLV", "RZLV": "RZLV",
  "템퍼스": "TEM", "템퍼스AI": "TEM", "템퍼스에이아이": "TEM",
  "유나이티드헬스": "UNH", "유나이티드헬스그룹": "UNH", "유나이티드": "UNH",
  "일라이릴리": "LLY", "릴리": "LLY",
  "노보노디스크": "NVO", "노보": "NVO",
  "화이자": "PFE", "머크": "MRK",
  "존슨앤존슨": "JNJ", "존슨엔존슨": "JNJ", "J&J": "JNJ",
  "애브비": "ABBV", "브리스톨마이어스": "BMY",
  "암젠": "AMGN", "길리어드": "GILD",
  "리제네론": "REGN", "모더나": "MRNA",
  "바이오엔텍": "BNTX", "일루미나": "ILMN",
  "버텍스": "VRTX", "인튜이티브서지컬": "ISRG",
  "덱스컴": "DXCM", "애보트": "ABT",
  "써모피셔": "TMO", "다나허": "DHR",
  "아이덱스": "IDXX", "바이오마린": "BMRN",
  
  // ═══════════════════════════════════════════════════════════════
  // AI/로보틱스/자율주행
  // ═══════════════════════════════════════════════════════════════
  "이노데이터": "INOD", "사운드하운드": "SOUN", "사하": "SOUN",
  "빅베어에이아이": "BBAI", "빅베어": "BBAI",
  "씨쓰리에이아이": "AI", "C3AI": "AI", "씨쓰리": "AI",
  "유아이패스": "PATH", "심볼릭": "SYM",
  "오로라": "AUR", "오로라이노베이션": "AUR",
  "모빌아이": "MBLY", "웨이모": "GOOGL", // 알파벳 자회사
  "앱러빈": "APP", "앱 러빈": "APP",
  
  // ═══════════════════════════════════════════════════════════════
  // 전기차/배터리/클린에너지
  // ═══════════════════════════════════════════════════════════════
  "루시드": "LCID", "리비안": "RIVN", "니오": "NIO",
  "샤오펑": "XPEV", "리오토": "LI", "포드": "F", "GM": "GM",
  "니콜라": "NKLA", "카누": "GOEV", "피스커": "FSR", "빈패스트": "VFS",
  "앨버말": "ALB", "리튬아메리카스": "LAC",
  "퀀텀스케이프": "QS", "솔리드파워": "SLDP",
  "차지포인트": "CHPT", "EVgo": "EVGO", "이브이고": "EVGO",
  "엔페이즈": "ENPH", "솔라엣지": "SEDG",
  "퍼스트솔라": "FSLR", "선런": "RUN",
  
  // ═══════════════════════════════════════════════════════════════
  // 양자컴퓨팅
  // ═══════════════════════════════════════════════════════════════
  "아이온큐": "IONQ", "아이온Q": "IONQ",
  "리게티": "RGTI", "리게이티": "RGTI", "리게티컴퓨팅": "RGTI",
  "디웨이브": "QBTS", "디웨이브퀀텀": "QBTS",
  "퀀텀컴퓨팅": "QUBT",
  
  // ═══════════════════════════════════════════════════════════════
  // 금융/핀테크
  // ═══════════════════════════════════════════════════════════════
  "버크셔": "BRK-B", "버크셔해서웨이": "BRK-B",
  "JP모건": "JPM", "제이피모건": "JPM", "JPM": "JPM",
  "골드만삭스": "GS", "골드만": "GS",
  "모건스탠리": "MS", "뱅크오브아메리카": "BAC", "BOA": "BAC",
  "웰스파고": "WFC", "시티그룹": "C", "시티": "C",
  "비자": "V", "마스터카드": "MA",
  "아멕스": "AXP", "아메리칸익스프레스": "AXP",
  "페이팔": "PYPL", "블록": "SQ", "스퀘어": "SQ",
  "어펌": "AFRM", "소파이": "SOFI",
  "로빈후드": "HOOD", "업스타트": "UPST",
  "블랙록": "BLK", "찰스슈왑": "SCHW",
  
  // ═══════════════════════════════════════════════════════════════
  // 소비재/리테일
  // ═══════════════════════════════════════════════════════════════
  "코스트코": "COST", "월마트": "WMT", "타겟": "TGT",
  "나이키": "NKE", "룰루레몬": "LULU",
  "스타벅스": "SBUX", "맥도날드": "MCD", "치폴레": "CMG",
  "코카콜라": "KO", "펩시": "PEP", "몬스터": "MNST",
  "홈디포": "HD", "로우스": "LOW",
  "에스티로더": "EL", "프록터앤갬블": "PG", "P&G": "PG",
  
  // ═══════════════════════════════════════════════════════════════
  // 미디어/게임/엔터테인먼트
  // ═══════════════════════════════════════════════════════════════
  "디즈니": "DIS", "월트디즈니": "DIS",
  "로블록스": "RBLX", "유니티": "U",
  "테이크투": "TTWO", "EA": "EA", "일렉트로닉아츠": "EA",
  "액티비전": "ATVI", "스포티파이": "SPOT",
  "워너브라더스": "WBD", "파라마운트": "PARA",
  "라이브네이션": "LYV", "트레이드데스크": "TTD",
  "럼블": "RUM", "럼블Inc": "RUM",
  
  // ═══════════════════════════════════════════════════════════════
  // 통신/네트워크
  // ═══════════════════════════════════════════════════════════════
  "버라이즌": "VZ", "AT&T": "T", "에이티앤티": "T",
  "티모바일": "TMUS", "코닝": "GLW",
  "코히런트": "COHR", "루멘텀": "LITE",
  "크리도테크놀로지그룹홀딩": "CRDO", "크리도테크놀로지": "CRDO", "크리도": "CRDO",
  "시에나": "CIEN", "주니퍼": "JNPR",
  
  // ═══════════════════════════════════════════════════════════════
  // 산업재/물류/인프라
  // ═══════════════════════════════════════════════════════════════
  "캐터필러": "CAT", "캐터필라": "CAT",
  "디어": "DE", "존디어": "DE",
  "유나이티드렌탈": "URI", "페덱스": "FDX", "UPS": "UPS",
  "제너럴일렉트릭": "GE", "GE": "GE",
  "GE버노바": "GEV", "지이버노바": "GEV", "GE에어로": "GE",
  "허니웰": "HON", "쓰리엠": "MMM", "3M": "MMM",
  "일리노이툴웍스": "ITW", "에머슨": "EMR",
  "파커해니핀": "PH", "록웰오토메이션": "ROK",
  "델": "DELL", "HP": "HPQ", "HPE": "HPE",
  
  // ═══════════════════════════════════════════════════════════════
  // 에너지/오일가스
  // ═══════════════════════════════════════════════════════════════
  "엑슨모빌": "XOM", "쉐브론": "CVX",
  "코노코필립스": "COP", "EOG": "EOG",
  "슐럼버거": "SLB", "할리버튼": "HAL",
  "옥시덴탈": "OXY", "파이어니어": "PXD",
  "디아몬드백": "FANG", "데본에너지": "DVN",
  
  // ═══════════════════════════════════════════════════════════════
  // 기타 요청 종목
  // ═══════════════════════════════════════════════════════════════
  "블루골드": "BGL",
  "브랜드인게이지먼트네트워크": "BNAI", "브랜드인게이지먼트": "BNAI",
  "클라우드플레어": "NET",
  
  // ═══════════════════════════════════════════════════════════════
  // ETF (주요)
  // ═══════════════════════════════════════════════════════════════
  "스파이": "SPY", "SPY": "SPY", "에스피와이": "SPY",
  "큐큐큐": "QQQ", "QQQ": "QQQ", "나스닥ETF": "QQQ",
  "아크": "ARKK", "ARKK": "ARKK", "아크이노베이션": "ARKK",
  "ARKW": "ARKW", "아크핀테크": "ARKF",
  "SOXX": "SOXX", "반도체ETF": "SOXX", "SMH": "SMH",
  "XLK": "XLK", "기술ETF": "XLK",
  "XLE": "XLE", "에너지ETF": "XLE",
  "XLF": "XLF", "금융ETF": "XLF",
  "TQQQ": "TQQQ", "SQQQ": "SQQQ",
  "VTI": "VTI", "VOO": "VOO",
  "IWM": "IWM", "러셀2000": "IWM",
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
  // 한화그룹
  "한화솔루션": { code: "009830", name: "한화솔루션", market: "KOSPI" },
  "한화": { code: "000880", name: "한화", market: "KOSPI" },
  "한화에어로스페이스": { code: "012450", name: "한화에어로스페이스", market: "KOSPI" },
  "한화에어로": { code: "012450", name: "한화에어로스페이스", market: "KOSPI" },
  "한화오션": { code: "042660", name: "한화오션", market: "KOSPI" },
  "한화시스템": { code: "272210", name: "한화시스템", market: "KOSPI" },
  "한화생명": { code: "088350", name: "한화생명", market: "KOSPI" },
  // HD현대그룹
  "hd현대": { code: "267250", name: "HD현대", market: "KOSPI" },
  "hd현대에너지솔루션": { code: "322000", name: "HD현대에너지솔루션", market: "KOSPI" },
  "현대에너지솔루션": { code: "322000", name: "HD현대에너지솔루션", market: "KOSPI" },
  "hd현대미포": { code: "010620", name: "HD현대미포", market: "KOSPI" },
  "현대미포": { code: "010620", name: "HD현대미포", market: "KOSPI" },
  "hd현대인프라코어": { code: "042670", name: "HD현대인프라코어", market: "KOSPI" },
  "hd한국조선해양": { code: "009540", name: "HD한국조선해양", market: "KOSPI" },
  "한국조선해양": { code: "009540", name: "HD한국조선해양", market: "KOSPI" },
  // 두산그룹
  "두산밥캣": { code: "241560", name: "두산밥캣", market: "KOSPI" },
  "두산로보틱스": { code: "454910", name: "두산로보틱스", market: "KOSPI" },
  "두산퓨얼셀": { code: "336260", name: "두산퓨얼셀", market: "KOSPI" },
  "두산": { code: "000150", name: "두산", market: "KOSPI" },
  // 제약/바이오
  "삼천당제약": { code: "000250", name: "삼천당제약", market: "KOSPI" },
  "삼천당": { code: "000250", name: "삼천당제약", market: "KOSPI" },
  "유한양행": { code: "000100", name: "유한양행", market: "KOSPI" },
  "녹십자": { code: "006280", name: "GC녹십자", market: "KOSPI" },
  "gc녹십자": { code: "006280", name: "GC녹십자", market: "KOSPI" },
  "한미약품": { code: "128940", name: "한미약품", market: "KOSPI" },
  "종근당": { code: "185750", name: "종근당", market: "KOSPI" },
  "일양약품": { code: "007570", name: "일양약품", market: "KOSPI" },
  "대웅제약": { code: "069620", name: "대웅제약", market: "KOSPI" },
  "sk바이오팜": { code: "326030", name: "SK바이오팜", market: "KOSPI" },
  "삼성바이오로직스": { code: "207940", name: "삼성바이오로직스", market: "KOSPI" },
  "삼바": { code: "207940", name: "삼성바이오로직스", market: "KOSPI" },
  "삼성바이오": { code: "207940", name: "삼성바이오로직스", market: "KOSPI" },
  // 조선/방산/에너지
  "한국항공우주": { code: "047810", name: "한국항공우주", market: "KOSPI" },
  "kai": { code: "047810", name: "한국항공우주", market: "KOSPI" },
  "현대로템": { code: "064350", name: "현대로템", market: "KOSPI" },
  "한국가스공사": { code: "036460", name: "한국가스공사", market: "KOSPI" },
  "가스공사": { code: "036460", name: "한국가스공사", market: "KOSPI" },
  "한국석유": { code: "004090", name: "한국석유", market: "KOSPI" },
  // 건설/인프라
  "삼성엔지니어링": { code: "028050", name: "삼성엔지니어링", market: "KOSPI" },
  "현대엔지니어링": { code: "075180", name: "현대엔지니어링", market: "KOSPI" },
  "대우건설": { code: "047040", name: "대우건설", market: "KOSPI" },
  "gs건설": { code: "006360", name: "GS건설", market: "KOSPI" },
  // 유통/식품
  "cj제일제당": { code: "097950", name: "CJ제일제당", market: "KOSPI" },
  "cj": { code: "001040", name: "CJ", market: "KOSPI" },
  "이마트": { code: "139480", name: "이마트", market: "KOSPI" },
  "bgf리테일": { code: "282330", name: "BGF리테일", market: "KOSPI" },
  "오리온": { code: "271560", name: "오리온", market: "KOSPI" },
  "농심": { code: "004370", name: "농심", market: "KOSPI" },
  "롯데칠성": { code: "005300", name: "롯데칠성음료", market: "KOSPI" },
  "하이트진로": { code: "000080", name: "하이트진로", market: "KOSPI" },
  // 철강/소재
  "현대제철": { code: "004020", name: "현대제철", market: "KOSPI" },
  "롯데케미칼": { code: "011170", name: "롯데케미칼", market: "KOSPI" },
  "금호석유": { code: "011780", name: "금호석유", market: "KOSPI" },
  "효성": { code: "004800", name: "효성", market: "KOSPI" },
  "효성첨단소재": { code: "298050", name: "효성첨단소재", market: "KOSPI" },
  // 자동차부품
  "현대위아": { code: "011210", name: "현대위아", market: "KOSPI" },
  "만도": { code: "204320", name: "만도", market: "KOSPI" },
  "한온시스템": { code: "018880", name: "한온시스템", market: "KOSPI" },
  // 보험/증권
  "삼성증권": { code: "016360", name: "삼성증권", market: "KOSPI" },
  "한국투자증권": { code: "071050", name: "한국금융지주", market: "KOSPI" },
  "한국금융지주": { code: "071050", name: "한국금융지주", market: "KOSPI" },
  "db손해보험": { code: "005830", name: "DB손해보험", market: "KOSPI" },
  "현대해상": { code: "001450", name: "현대해상", market: "KOSPI" },
  "메리츠금융": { code: "138040", name: "메리츠금융지주", market: "KOSPI" },
  "메리츠화재": { code: "000060", name: "메리츠화재", market: "KOSPI" },
  // 기타 대형
  "포스코dxbv": { code: "022100", name: "포스코DX", market: "KOSPI" },
  "포스코dx": { code: "022100", name: "포스코DX", market: "KOSPI" },
  "sk스퀘어": { code: "402340", name: "SK스퀘어", market: "KOSPI" },
  "skc": { code: "011790", name: "SKC", market: "KOSPI" },
  "gs": { code: "078930", name: "GS", market: "KOSPI" },
  "ls": { code: "006260", name: "LS", market: "KOSPI" },
  "ls일렉트릭": { code: "010120", name: "LS일렉트릭", market: "KOSPI" },
  "ls에코에너지": { code: "229640", name: "LS에코에너지", market: "KOSPI" },
  "영풍": { code: "000670", name: "영풍", market: "KOSPI" },
  "hl만도": { code: "204320", name: "HL만도", market: "KOSPI" },
  // 코스닥 확대
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
  "파두": { code: "440110", name: "파두", market: "KOSDAQ" },
  "fadu": { code: "440110", name: "파두", market: "KOSDAQ" },
  // 코스닥 확대 - 바이오
  "셀트리온제약": { code: "068760", name: "셀트리온제약", market: "KOSDAQ" },
  "메디톡스": { code: "086900", name: "메디톡스", market: "KOSDAQ" },
  "씨젠": { code: "096530", name: "씨젠", market: "KOSDAQ" },
  "바이오니아": { code: "064550", name: "바이오니아", market: "KOSDAQ" },
  "올릭스": { code: "226950", name: "올릭스", market: "KOSDAQ" },
  "에이비엘바이오": { code: "298380", name: "에이비엘바이오", market: "KOSDAQ" },
  "레고켐바이오": { code: "141080", name: "레고켐바이오", market: "KOSDAQ" },
  "켐온": { code: "217600", name: "켐온", market: "KOSDAQ" },
  // 코스닥 - IT/반도체
  "이오테크닉스": { code: "039030", name: "이오테크닉스", market: "KOSDAQ" },
  "대주전자재료": { code: "078600", name: "대주전자재료", market: "KOSDAQ" },
  "피에스케이": { code: "319660", name: "피에스케이", market: "KOSDAQ" },
  "psk": { code: "319660", name: "피에스케이", market: "KOSDAQ" },
  "하나마이크론": { code: "067310", name: "하나마이크론", market: "KOSDAQ" },
  "테크윙": { code: "089030", name: "테크윙", market: "KOSDAQ" },
  "유니테스트": { code: "086390", name: "유니테스트", market: "KOSDAQ" },
  "원익ips": { code: "240810", name: "원익IPS", market: "KOSDAQ" },
  "원익": { code: "240810", name: "원익IPS", market: "KOSDAQ" },
  "티씨케이": { code: "064760", name: "티씨케이", market: "KOSDAQ" },
  "tck": { code: "064760", name: "티씨케이", market: "KOSDAQ" },
  // 코스닥 - 2차전지/에너지
  "엘앤에프": { code: "066970", name: "엘앤에프", market: "KOSDAQ" },
  "l&f": { code: "066970", name: "엘앤에프", market: "KOSDAQ" },
  "피엔티": { code: "137400", name: "피엔티", market: "KOSDAQ" },
  "에스에너지": { code: "095910", name: "에스에너지", market: "KOSDAQ" },
  // 코스닥 - 엔터/미디어
  "와이지엔터": { code: "122870", name: "YG엔터", market: "KOSDAQ" },
  "yg엔터": { code: "122870", name: "YG엔터", market: "KOSDAQ" },
  "yg": { code: "122870", name: "YG엔터", market: "KOSDAQ" },
  "스튜디오드래곤": { code: "253450", name: "스튜디오드래곤", market: "KOSDAQ" },
  // 코스닥 - 기타
  "카페24": { code: "042000", name: "카페24", market: "KOSDAQ" },
  "더존비즈온": { code: "012510", name: "더존비즈온", market: "KOSDAQ" },
  "nhn": { code: "181710", name: "NHN", market: "KOSDAQ" },
  "컴투스": { code: "078340", name: "컴투스", market: "KOSDAQ" },
  "나스미디어": { code: "089600", name: "나스미디어", market: "KOSDAQ" },
  "포스코엠텍": { code: "009520", name: "포스코엠텍", market: "KOSDAQ" },
  "심텍": { code: "222800", name: "심텍", market: "KOSDAQ" },
  "아이센스": { code: "099190", name: "아이센스", market: "KOSDAQ" },
  
  // ═══════════════════════════════════════════════════════════════
  // v9.23 확장 - 요청 종목
  // ═══════════════════════════════════════════════════════════════
  "켄코아에어로스페이스": { code: "274090", name: "켄코아에어로스페이스", market: "KOSDAQ" },
  "켄코아": { code: "274090", name: "켄코아에어로스페이스", market: "KOSDAQ" },
  "한올바이오파마": { code: "009420", name: "한올바이오파마", market: "KOSPI" },
  "한올바이오": { code: "009420", name: "한올바이오파마", market: "KOSPI" },
  "한올": { code: "009420", name: "한올바이오파마", market: "KOSPI" },
  
  // ═══════════════════════════════════════════════════════════════
  // v9.23 확장 - 우주/항공/방산
  // ═══════════════════════════════════════════════════════════════
  "한화에어로스페이스": { code: "012450", name: "한화에어로스페이스", market: "KOSPI" },
  "한화에어로": { code: "012450", name: "한화에어로스페이스", market: "KOSPI" },
  "한화시스템": { code: "272210", name: "한화시스템", market: "KOSPI" },
  "한화오션": { code: "042660", name: "한화오션", market: "KOSPI" },
  "LIG넥스원": { code: "079550", name: "LIG넥스원", market: "KOSPI" },
  "lig넥스원": { code: "079550", name: "LIG넥스원", market: "KOSPI" },
  "현대로템": { code: "064350", name: "현대로템", market: "KOSPI" },
  
  // ═══════════════════════════════════════════════════════════════
  // v9.23 확장 - 바이오/헬스케어
  // ═══════════════════════════════════════════════════════════════
  "삼성바이오로직스": { code: "207940", name: "삼성바이오로직스", market: "KOSPI" },
  "삼성바이오": { code: "207940", name: "삼성바이오로직스", market: "KOSPI" },
  "삼바": { code: "207940", name: "삼성바이오로직스", market: "KOSPI" },
  "유한양행": { code: "000100", name: "유한양행", market: "KOSPI" },
  "녹십자": { code: "006280", name: "녹십자", market: "KOSPI" },
  "종근당": { code: "185750", name: "종근당", market: "KOSPI" },
  "한미약품": { code: "128940", name: "한미약품", market: "KOSPI" },
  "대웅제약": { code: "069620", name: "대웅제약", market: "KOSPI" },
  "SK바이오팜": { code: "326030", name: "SK바이오팜", market: "KOSPI" },
  "sk바이오팜": { code: "326030", name: "SK바이오팜", market: "KOSPI" },
  "에스케이바이오팜": { code: "326030", name: "SK바이오팜", market: "KOSPI" },
  "오스코텍": { code: "039200", name: "오스코텍", market: "KOSDAQ" },
  "에이치엘비": { code: "028300", name: "에이치엘비", market: "KOSDAQ" },
  "hlb": { code: "028300", name: "에이치엘비", market: "KOSDAQ" },
  
  // ═══════════════════════════════════════════════════════════════
  // v9.23 확장 - AI/소프트웨어
  // ═══════════════════════════════════════════════════════════════
  "네오위즈": { code: "095660", name: "네오위즈", market: "KOSDAQ" },
  "데브시스터즈": { code: "194480", name: "데브시스터즈", market: "KOSDAQ" },
  "카카오엔터테인먼트": { code: "035720", name: "카카오", market: "KOSPI" },
  "두나무": { code: "업비트", name: "두나무(비상장)", market: "비상장" },
  "솔트룩스": { code: "304100", name: "솔트룩스", market: "KOSDAQ" },
  "플리토": { code: "300080", name: "플리토", market: "KOSDAQ" },
  "셀바스ai": { code: "108860", name: "셀바스AI", market: "KOSDAQ" },
  "셀바스": { code: "108860", name: "셀바스AI", market: "KOSDAQ" },
  
  // ═══════════════════════════════════════════════════════════════
  // v9.23 확장 - 2차전지/소재
  // ═══════════════════════════════════════════════════════════════
  "에코프로에이치엔": { code: "383310", name: "에코프로에이치엔", market: "KOSDAQ" },
  "에코프로hn": { code: "383310", name: "에코프로에이치엔", market: "KOSDAQ" },
  "성일하이텍": { code: "365340", name: "성일하이텍", market: "KOSDAQ" },
  "코스모신소재": { code: "005070", name: "코스모신소재", market: "KOSPI" },
  "천보": { code: "278280", name: "천보", market: "KOSDAQ" },
  "나노신소재": { code: "121600", name: "나노신소재", market: "KOSDAQ" },
  
  // ═══════════════════════════════════════════════════════════════
  // v9.23 확장 - 반도체 장비/소재
  // ═══════════════════════════════════════════════════════════════
  "ISC": { code: "095340", name: "ISC", market: "KOSDAQ" },
  "isc": { code: "095340", name: "ISC", market: "KOSDAQ" },
  "와이씨": { code: "232140", name: "와이씨", market: "KOSDAQ" },
  "예스티": { code: "122640", name: "예스티", market: "KOSDAQ" },
  "에이디테크놀로지": { code: "200710", name: "에이디테크놀로지", market: "KOSDAQ" },
  "네패스아크": { code: "330860", name: "네패스아크", market: "KOSDAQ" },
  "네패스": { code: "033640", name: "네패스", market: "KOSDAQ" },
  "파크시스템스": { code: "140860", name: "파크시스템스", market: "KOSDAQ" },
  "제우스": { code: "079370", name: "제우스", market: "KOSDAQ" },
  "디아이": { code: "003160", name: "디아이", market: "KOSDAQ" },
  "에스에프에이": { code: "056190", name: "에스에프에이", market: "KOSDAQ" },
  "sfa": { code: "056190", name: "에스에프에이", market: "KOSDAQ" },
  
  // ═══════════════════════════════════════════════════════════════
  // v9.23 확장 - 조선/해운
  // ═══════════════════════════════════════════════════════════════
  "hd한국조선해양": { code: "009540", name: "HD한국조선해양", market: "KOSPI" },
  "한국조선해양": { code: "009540", name: "HD한국조선해양", market: "KOSPI" },
  "대우조선해양": { code: "042660", name: "한화오션", market: "KOSPI" },
  "팬오션": { code: "028670", name: "팬오션", market: "KOSPI" },
  
  // ═══════════════════════════════════════════════════════════════
  // v9.23 확장 - 금융/보험
  // ═══════════════════════════════════════════════════════════════
  "삼성증권": { code: "016360", name: "삼성증권", market: "KOSPI" },
  "미래에셋증권": { code: "006800", name: "미래에셋증권", market: "KOSPI" },
  "미래에셋": { code: "006800", name: "미래에셋증권", market: "KOSPI" },
  "키움증권": { code: "039490", name: "키움증권", market: "KOSPI" },
  "키움": { code: "039490", name: "키움증권", market: "KOSPI" },
  "삼성카드": { code: "029780", name: "삼성카드", market: "KOSPI" },
  "메리츠금융지주": { code: "138040", name: "메리츠금융지주", market: "KOSPI" },
  "메리츠": { code: "138040", name: "메리츠금융지주", market: "KOSPI" },
  "db손해보험": { code: "005830", name: "DB손해보험", market: "KOSPI" },
  "현대해상": { code: "001450", name: "현대해상", market: "KOSPI" },
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
