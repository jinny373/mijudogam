import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// ═══════════════════════════════════════════════════════════════
// 인기 종목 리스트 (300개)
// ═══════════════════════════════════════════════════════════════

const POPULAR_STOCKS = [
  // ═══════════════════════════════════════════════════════════════
  // 빅테크 & 메가캡 (15)
  // ═══════════════════════════════════════════════════════════════
  { ticker: "AAPL", name: "애플", sector: "기술" },
  { ticker: "MSFT", name: "마이크로소프트", sector: "기술" },
  { ticker: "GOOGL", name: "구글", sector: "기술" },
  { ticker: "AMZN", name: "아마존", sector: "기술" },
  { ticker: "META", name: "메타", sector: "기술" },
  { ticker: "NVDA", name: "엔비디아", sector: "반도체" },
  { ticker: "TSLA", name: "테슬라", sector: "자동차" },
  { ticker: "BRK-B", name: "버크셔해서웨이", sector: "금융" },
  { ticker: "TSM", name: "TSMC", sector: "반도체" },
  { ticker: "V", name: "비자", sector: "금융" },
  { ticker: "JPM", name: "JP모건", sector: "금융" },
  { ticker: "UNH", name: "유나이티드헬스", sector: "헬스케어" },
  { ticker: "XOM", name: "엑슨모빌", sector: "에너지" },
  { ticker: "MA", name: "마스터카드", sector: "금융" },
  { ticker: "JNJ", name: "존슨앤존슨", sector: "헬스케어" },

  // ═══════════════════════════════════════════════════════════════
  // 반도체 (30)
  // ═══════════════════════════════════════════════════════════════
  { ticker: "AMD", name: "AMD", sector: "반도체" },
  { ticker: "AVGO", name: "브로드컴", sector: "반도체" },
  { ticker: "QCOM", name: "퀄컴", sector: "반도체" },
  { ticker: "MU", name: "마이크론", sector: "반도체" },
  { ticker: "INTC", name: "인텔", sector: "반도체" },
  { ticker: "ASML", name: "ASML", sector: "반도체" },
  { ticker: "MRVL", name: "마벨테크", sector: "반도체" },
  { ticker: "LRCX", name: "램리서치", sector: "반도체" },
  { ticker: "KLAC", name: "KLA", sector: "반도체" },
  { ticker: "AMAT", name: "어플라이드머티리얼즈", sector: "반도체" },
  { ticker: "TXN", name: "텍사스인스트루먼트", sector: "반도체" },
  { ticker: "ADI", name: "아날로그디바이스", sector: "반도체" },
  { ticker: "NXPI", name: "NXP", sector: "반도체" },
  { ticker: "ON", name: "온세미컨덕터", sector: "반도체" },
  { ticker: "MCHP", name: "마이크로칩", sector: "반도체" },
  { ticker: "SWKS", name: "스카이웍스", sector: "반도체" },
  { ticker: "QRVO", name: "코르보", sector: "반도체" },
  { ticker: "ARM", name: "ARM", sector: "반도체" },
  { ticker: "MPWR", name: "모놀리식파워", sector: "반도체" },
  { ticker: "SMCI", name: "슈퍼마이크로", sector: "반도체" },
  { ticker: "SNPS", name: "시놉시스", sector: "반도체" },
  { ticker: "CDNS", name: "케이던스", sector: "반도체" },
  { ticker: "GFS", name: "글로벌파운드리", sector: "반도체" },
  { ticker: "WOLF", name: "울프스피드", sector: "반도체" },
  { ticker: "CRUS", name: "시러스로직", sector: "반도체" },
  { ticker: "MKSI", name: "MKS인스트루먼츠", sector: "반도체" },
  { ticker: "ENTG", name: "엔테그리스", sector: "반도체" },
  { ticker: "ACLS", name: "액셀리스", sector: "반도체" },
  { ticker: "AOSL", name: "알파오메가반도체", sector: "반도체" },
  { ticker: "SYNA", name: "시냅틱스", sector: "반도체" },

  // ═══════════════════════════════════════════════════════════════
  // AI/소프트웨어/클라우드 (40)
  // ═══════════════════════════════════════════════════════════════
  { ticker: "PLTR", name: "팔란티어", sector: "AI" },
  { ticker: "CRM", name: "세일즈포스", sector: "소프트웨어" },
  { ticker: "ADBE", name: "어도비", sector: "소프트웨어" },
  { ticker: "ORCL", name: "오라클", sector: "소프트웨어" },
  { ticker: "NOW", name: "서비스나우", sector: "소프트웨어" },
  { ticker: "SNOW", name: "스노우플레이크", sector: "소프트웨어" },
  { ticker: "PANW", name: "팔로알토", sector: "보안" },
  { ticker: "CRWD", name: "크라우드스트라이크", sector: "보안" },
  { ticker: "ZS", name: "지스케일러", sector: "보안" },
  { ticker: "FTNT", name: "포티넷", sector: "보안" },
  { ticker: "NET", name: "클라우드플레어", sector: "보안" },
  { ticker: "DDOG", name: "데이터독", sector: "소프트웨어" },
  { ticker: "MDB", name: "몽고DB", sector: "소프트웨어" },
  { ticker: "TEAM", name: "아틀라시안", sector: "소프트웨어" },
  { ticker: "WDAY", name: "워크데이", sector: "소프트웨어" },
  { ticker: "INTU", name: "인튜이트", sector: "소프트웨어" },
  { ticker: "SHOP", name: "쇼피파이", sector: "이커머스" },
  { ticker: "SQ", name: "블록", sector: "핀테크" },
  { ticker: "PYPL", name: "페이팔", sector: "핀테크" },
  { ticker: "TTD", name: "트레이드데스크", sector: "광고테크" },
  { ticker: "VEEV", name: "비바시스템즈", sector: "소프트웨어" },
  { ticker: "HUBS", name: "허브스팟", sector: "소프트웨어" },
  { ticker: "OKTA", name: "옥타", sector: "보안" },
  { ticker: "ZM", name: "줌", sector: "소프트웨어" },
  { ticker: "DOCU", name: "도큐사인", sector: "소프트웨어" },
  { ticker: "TWLO", name: "트윌리오", sector: "소프트웨어" },
  { ticker: "U", name: "유니티", sector: "소프트웨어" },
  { ticker: "PATH", name: "유아이패스", sector: "AI" },
  { ticker: "AI", name: "C3.ai", sector: "AI" },
  { ticker: "BIGC", name: "빅커머스", sector: "이커머스" },
  { ticker: "SPLK", name: "스플렁크", sector: "소프트웨어" },
  { ticker: "ESTC", name: "엘라스틱", sector: "소프트웨어" },
  { ticker: "CFLT", name: "컨플루언트", sector: "소프트웨어" },
  { ticker: "GTLB", name: "깃랩", sector: "소프트웨어" },
  { ticker: "S", name: "센티넬원", sector: "보안" },
  { ticker: "CYBR", name: "사이버아크", sector: "보안" },
  { ticker: "RPD", name: "래피드7", sector: "보안" },
  { ticker: "TENB", name: "테너블", sector: "보안" },
  { ticker: "BILL", name: "빌닷컴", sector: "핀테크" },
  { ticker: "AFRM", name: "어펌", sector: "핀테크" },

  // ═══════════════════════════════════════════════════════════════
  // AI 인프라/데이터센터/전력 (25)
  // ═══════════════════════════════════════════════════════════════
  { ticker: "IREN", name: "아이렌", sector: "AI인프라" },
  { ticker: "VRT", name: "버티브", sector: "AI인프라" },
  { ticker: "ETN", name: "이튼", sector: "AI인프라" },
  { ticker: "CEG", name: "컨스털레이션", sector: "에너지" },
  { ticker: "VST", name: "비스트라", sector: "에너지" },
  { ticker: "CORZ", name: "코어사이언티픽", sector: "AI인프라" },
  { ticker: "EQIX", name: "에퀴닉스", sector: "데이터센터" },
  { ticker: "DLR", name: "디지털리얼티", sector: "데이터센터" },
  { ticker: "AMT", name: "아메리칸타워", sector: "인프라" },
  { ticker: "CCI", name: "크라운캐슬", sector: "인프라" },
  { ticker: "SBAC", name: "SBA커뮤니케이션즈", sector: "인프라" },
  { ticker: "PWR", name: "퀀타서비스", sector: "인프라" },
  { ticker: "EME", name: "EMCOR", sector: "인프라" },
  { ticker: "FIX", name: "컴포트시스템즈", sector: "인프라" },
  { ticker: "MTZ", name: "마스텍", sector: "인프라" },
  { ticker: "NRG", name: "NRG에너지", sector: "에너지" },
  { ticker: "AES", name: "AES", sector: "에너지" },
  { ticker: "NEE", name: "넥스트에라", sector: "유틸리티" },
  { ticker: "DUK", name: "듀크에너지", sector: "유틸리티" },
  { ticker: "SO", name: "서던컴퍼니", sector: "유틸리티" },
  { ticker: "D", name: "도미니언", sector: "유틸리티" },
  { ticker: "AEP", name: "AEP", sector: "유틸리티" },
  { ticker: "XEL", name: "엑셀에너지", sector: "유틸리티" },
  { ticker: "WEC", name: "WEC에너지", sector: "유틸리티" },
  { ticker: "ED", name: "콘에디슨", sector: "유틸리티" },

  // ═══════════════════════════════════════════════════════════════
  // 금융 (35)
  // ═══════════════════════════════════════════════════════════════
  { ticker: "GS", name: "골드만삭스", sector: "금융" },
  { ticker: "MS", name: "모건스탠리", sector: "금융" },
  { ticker: "BAC", name: "뱅크오브아메리카", sector: "금융" },
  { ticker: "WFC", name: "웰스파고", sector: "금융" },
  { ticker: "C", name: "씨티그룹", sector: "금융" },
  { ticker: "AXP", name: "아멕스", sector: "금융" },
  { ticker: "SCHW", name: "찰스슈왑", sector: "금융" },
  { ticker: "BLK", name: "블랙록", sector: "금융" },
  { ticker: "SPGI", name: "S&P글로벌", sector: "금융" },
  { ticker: "MCO", name: "무디스", sector: "금융" },
  { ticker: "CME", name: "CME그룹", sector: "금융" },
  { ticker: "ICE", name: "인터컨티넨탈익스체인지", sector: "금융" },
  { ticker: "COF", name: "캐피탈원", sector: "금융" },
  { ticker: "USB", name: "US뱅코프", sector: "금융" },
  { ticker: "PNC", name: "PNC", sector: "금융" },
  { ticker: "TFC", name: "트루이스트", sector: "금융" },
  { ticker: "COIN", name: "코인베이스", sector: "핀테크" },
  { ticker: "HOOD", name: "로빈후드", sector: "핀테크" },
  { ticker: "SOFI", name: "소파이", sector: "핀테크" },
  { ticker: "NU", name: "누뱅크", sector: "핀테크" },
  { ticker: "MET", name: "메트라이프", sector: "보험" },
  { ticker: "PRU", name: "프루덴셜", sector: "보험" },
  { ticker: "AIG", name: "AIG", sector: "보험" },
  { ticker: "ALL", name: "올스테이트", sector: "보험" },
  { ticker: "TRV", name: "트래블러스", sector: "보험" },
  { ticker: "CB", name: "처브", sector: "보험" },
  { ticker: "PGR", name: "프로그레시브", sector: "보험" },
  { ticker: "AFL", name: "애플락", sector: "보험" },
  { ticker: "MMC", name: "마쉬앤맥레넌", sector: "보험" },
  { ticker: "AON", name: "에이온", sector: "보험" },
  { ticker: "WTW", name: "윌리스타워스왓슨", sector: "보험" },
  { ticker: "MSCI", name: "MSCI", sector: "금융" },
  { ticker: "FIS", name: "피델리티내셔널", sector: "핀테크" },
  { ticker: "FISV", name: "파이서브", sector: "핀테크" },
  { ticker: "GPN", name: "글로벌페이먼츠", sector: "핀테크" },

  // ═══════════════════════════════════════════════════════════════
  // 헬스케어/바이오 (40)
  // ═══════════════════════════════════════════════════════════════
  { ticker: "LLY", name: "일라이릴리", sector: "헬스케어" },
  { ticker: "ABBV", name: "애브비", sector: "헬스케어" },
  { ticker: "PFE", name: "화이자", sector: "헬스케어" },
  { ticker: "MRK", name: "머크", sector: "헬스케어" },
  { ticker: "TMO", name: "써모피셔", sector: "헬스케어" },
  { ticker: "ABT", name: "애보트", sector: "헬스케어" },
  { ticker: "DHR", name: "다나허", sector: "헬스케어" },
  { ticker: "BMY", name: "브리스톨마이어스", sector: "헬스케어" },
  { ticker: "AMGN", name: "암젠", sector: "바이오" },
  { ticker: "GILD", name: "길리어드", sector: "바이오" },
  { ticker: "VRTX", name: "버텍스", sector: "바이오" },
  { ticker: "REGN", name: "리제네론", sector: "바이오" },
  { ticker: "MRNA", name: "모더나", sector: "바이오" },
  { ticker: "BIIB", name: "바이오젠", sector: "바이오" },
  { ticker: "ILMN", name: "일루미나", sector: "바이오" },
  { ticker: "ISRG", name: "인튜이티브서지컬", sector: "의료기기" },
  { ticker: "SYK", name: "스트라이커", sector: "의료기기" },
  { ticker: "MDT", name: "메드트로닉", sector: "의료기기" },
  { ticker: "BSX", name: "보스턴사이언티픽", sector: "의료기기" },
  { ticker: "EW", name: "에드워즈라이프사이언스", sector: "의료기기" },
  { ticker: "ZBH", name: "짐머바이오멧", sector: "의료기기" },
  { ticker: "DXCM", name: "덱스콤", sector: "의료기기" },
  { ticker: "IDXX", name: "아이덱스", sector: "헬스케어" },
  { ticker: "IQV", name: "아이큐비아", sector: "헬스케어" },
  { ticker: "A", name: "애질런트", sector: "헬스케어" },
  { ticker: "MTD", name: "메틀러톨레도", sector: "헬스케어" },
  { ticker: "WAT", name: "워터스", sector: "헬스케어" },
  { ticker: "CVS", name: "CVS헬스", sector: "헬스케어" },
  { ticker: "CI", name: "시그나", sector: "헬스케어" },
  { ticker: "ELV", name: "엘리번스헬스", sector: "헬스케어" },
  { ticker: "HUM", name: "휴매나", sector: "헬스케어" },
  { ticker: "CNC", name: "센틴", sector: "헬스케어" },
  { ticker: "HCA", name: "HCA헬스케어", sector: "헬스케어" },
  { ticker: "MCK", name: "맥케슨", sector: "헬스케어" },
  { ticker: "CAH", name: "카디날헬스", sector: "헬스케어" },
  { ticker: "ABC", name: "아메리소스버겐", sector: "헬스케어" },
  { ticker: "ZTS", name: "조에티스", sector: "헬스케어" },
  { ticker: "ALNY", name: "알닐람", sector: "바이오" },
  { ticker: "SGEN", name: "시젠", sector: "바이오" },
  { ticker: "EXAS", name: "이그젝트사이언스", sector: "바이오" },

  // ═══════════════════════════════════════════════════════════════
  // 소비재/리테일 (35)
  // ═══════════════════════════════════════════════════════════════
  { ticker: "COST", name: "코스트코", sector: "소비재" },
  { ticker: "WMT", name: "월마트", sector: "소비재" },
  { ticker: "MCD", name: "맥도날드", sector: "소비재" },
  { ticker: "HD", name: "홈디포", sector: "소비재" },
  { ticker: "NKE", name: "나이키", sector: "소비재" },
  { ticker: "SBUX", name: "스타벅스", sector: "소비재" },
  { ticker: "TGT", name: "타겟", sector: "소비재" },
  { ticker: "LOW", name: "로우스", sector: "소비재" },
  { ticker: "TJX", name: "TJX", sector: "소비재" },
  { ticker: "ROST", name: "로스스토어스", sector: "소비재" },
  { ticker: "DG", name: "달러제너럴", sector: "소비재" },
  { ticker: "DLTR", name: "달러트리", sector: "소비재" },
  { ticker: "ORLY", name: "오라일리오토", sector: "소비재" },
  { ticker: "AZO", name: "오토존", sector: "소비재" },
  { ticker: "BBY", name: "베스트바이", sector: "소비재" },
  { ticker: "ULTA", name: "울타뷰티", sector: "소비재" },
  { ticker: "LULU", name: "룰루레몬", sector: "소비재" },
  { ticker: "CMG", name: "치폴레", sector: "소비재" },
  { ticker: "YUM", name: "얌브랜즈", sector: "소비재" },
  { ticker: "DPZ", name: "도미노피자", sector: "소비재" },
  { ticker: "DECK", name: "데커스", sector: "소비재" },
  { ticker: "PG", name: "P&G", sector: "필수소비재" },
  { ticker: "KO", name: "코카콜라", sector: "필수소비재" },
  { ticker: "PEP", name: "펩시", sector: "필수소비재" },
  { ticker: "PM", name: "필립모리스", sector: "필수소비재" },
  { ticker: "MO", name: "알트리아", sector: "필수소비재" },
  { ticker: "MDLZ", name: "몬델리즈", sector: "필수소비재" },
  { ticker: "CL", name: "콜게이트", sector: "필수소비재" },
  { ticker: "EL", name: "에스티로더", sector: "필수소비재" },
  { ticker: "KMB", name: "킴벌리클라크", sector: "필수소비재" },
  { ticker: "GIS", name: "제너럴밀스", sector: "필수소비재" },
  { ticker: "K", name: "켈라노바", sector: "필수소비재" },
  { ticker: "HSY", name: "허쉬", sector: "필수소비재" },
  { ticker: "SJM", name: "스머커", sector: "필수소비재" },
  { ticker: "STZ", name: "컨스털레이션브랜즈", sector: "필수소비재" },

  // ═══════════════════════════════════════════════════════════════
  // 산업재/방산/항공 (30)
  // ═══════════════════════════════════════════════════════════════
  { ticker: "CAT", name: "캐터필러", sector: "산업재" },
  { ticker: "DE", name: "디어", sector: "산업재" },
  { ticker: "HON", name: "허니웰", sector: "산업재" },
  { ticker: "UNP", name: "유니온퍼시픽", sector: "산업재" },
  { ticker: "UPS", name: "UPS", sector: "산업재" },
  { ticker: "FDX", name: "페덱스", sector: "산업재" },
  { ticker: "GE", name: "GE에어로스페이스", sector: "산업재" },
  { ticker: "RTX", name: "RTX", sector: "방산" },
  { ticker: "LMT", name: "록히드마틴", sector: "방산" },
  { ticker: "NOC", name: "노스롭그루먼", sector: "방산" },
  { ticker: "GD", name: "제너럴다이내믹스", sector: "방산" },
  { ticker: "BA", name: "보잉", sector: "항공" },
  { ticker: "LHX", name: "L3해리스", sector: "방산" },
  { ticker: "HII", name: "헌팅턴잉걸스", sector: "방산" },
  { ticker: "TDG", name: "트랜스다임", sector: "항공" },
  { ticker: "HWM", name: "하우멧에어로스페이스", sector: "항공" },
  { ticker: "TXT", name: "텍스트론", sector: "항공" },
  { ticker: "EMR", name: "에머슨", sector: "산업재" },
  { ticker: "ROK", name: "록웰오토메이션", sector: "산업재" },
  { ticker: "PH", name: "파커해니핀", sector: "산업재" },
  { ticker: "ITW", name: "일리노이툴웍스", sector: "산업재" },
  { ticker: "MMM", name: "3M", sector: "산업재" },
  { ticker: "SHW", name: "셔윈윌리엄스", sector: "소재" },
  { ticker: "APD", name: "에어프로덕츠", sector: "소재" },
  { ticker: "LIN", name: "린데", sector: "소재" },
  { ticker: "ECL", name: "에코랩", sector: "소재" },
  { ticker: "FCX", name: "프리포트맥모란", sector: "소재" },
  { ticker: "NEM", name: "뉴몬트", sector: "소재" },
  { ticker: "NUE", name: "뉴코어", sector: "소재" },
  { ticker: "STLD", name: "스틸다이내믹스", sector: "소재" },

  // ═══════════════════════════════════════════════════════════════
  // 에너지 (20)
  // ═══════════════════════════════════════════════════════════════
  { ticker: "CVX", name: "쉐브론", sector: "에너지" },
  { ticker: "COP", name: "코노코필립스", sector: "에너지" },
  { ticker: "SLB", name: "슐럼버거", sector: "에너지" },
  { ticker: "EOG", name: "EOG리소시스", sector: "에너지" },
  { ticker: "PXD", name: "파이어니어내추럴", sector: "에너지" },
  { ticker: "OXY", name: "옥시덴탈", sector: "에너지" },
  { ticker: "MPC", name: "마라톤페트롤리엄", sector: "에너지" },
  { ticker: "VLO", name: "발레로", sector: "에너지" },
  { ticker: "PSX", name: "필립스66", sector: "에너지" },
  { ticker: "HES", name: "헤스", sector: "에너지" },
  { ticker: "DVN", name: "데본에너지", sector: "에너지" },
  { ticker: "FANG", name: "다이아몬드백", sector: "에너지" },
  { ticker: "HAL", name: "할리버튼", sector: "에너지" },
  { ticker: "BKR", name: "베이커휴즈", sector: "에너지" },
  { ticker: "OKE", name: "원옥", sector: "에너지" },
  { ticker: "WMB", name: "윌리엄스", sector: "에너지" },
  { ticker: "KMI", name: "킨더모건", sector: "에너지" },
  { ticker: "ET", name: "에너지트랜스퍼", sector: "에너지" },
  { ticker: "EPD", name: "엔터프라이즈프로덕츠", sector: "에너지" },
  { ticker: "MPLX", name: "MPLX", sector: "에너지" },

  // ═══════════════════════════════════════════════════════════════
  // 미디어/통신/엔터테인먼트 (20)
  // ═══════════════════════════════════════════════════════════════
  { ticker: "NFLX", name: "넷플릭스", sector: "미디어" },
  { ticker: "DIS", name: "디즈니", sector: "미디어" },
  { ticker: "T", name: "AT&T", sector: "통신" },
  { ticker: "VZ", name: "버라이즌", sector: "통신" },
  { ticker: "TMUS", name: "T모바일", sector: "통신" },
  { ticker: "CMCSA", name: "컴캐스트", sector: "미디어" },
  { ticker: "CHTR", name: "차터커뮤니케이션즈", sector: "통신" },
  { ticker: "WBD", name: "워너브라더스디스커버리", sector: "미디어" },
  { ticker: "PARA", name: "파라마운트", sector: "미디어" },
  { ticker: "FOX", name: "폭스", sector: "미디어" },
  { ticker: "NWSA", name: "뉴스코프", sector: "미디어" },
  { ticker: "RBLX", name: "로블록스", sector: "게임" },
  { ticker: "EA", name: "EA", sector: "게임" },
  { ticker: "TTWO", name: "테이크투", sector: "게임" },
  { ticker: "ATVI", name: "액티비전블리자드", sector: "게임" },
  { ticker: "SPOT", name: "스포티파이", sector: "미디어" },
  { ticker: "LYV", name: "라이브네이션", sector: "엔터테인먼트" },
  { ticker: "MTCH", name: "매치그룹", sector: "인터넷" },
  { ticker: "PINS", name: "핀터레스트", sector: "인터넷" },
  { ticker: "SNAP", name: "스냅", sector: "인터넷" },

  // ═══════════════════════════════════════════════════════════════
  // 플랫폼/이커머스/기타 (20)
  // ═══════════════════════════════════════════════════════════════
  { ticker: "UBER", name: "우버", sector: "플랫폼" },
  { ticker: "ABNB", name: "에어비앤비", sector: "플랫폼" },
  { ticker: "LYFT", name: "리프트", sector: "플랫폼" },
  { ticker: "DASH", name: "도어대시", sector: "플랫폼" },
  { ticker: "BKNG", name: "부킹홀딩스", sector: "여행" },
  { ticker: "EXPE", name: "익스피디아", sector: "여행" },
  { ticker: "MAR", name: "메리어트", sector: "여행" },
  { ticker: "HLT", name: "힐튼", sector: "여행" },
  { ticker: "H", name: "하얏트", sector: "여행" },
  { ticker: "RCL", name: "로얄캐리비안", sector: "여행" },
  { ticker: "CCL", name: "카니발", sector: "여행" },
  { ticker: "NCLH", name: "노르웨이크루즈", sector: "여행" },
  { ticker: "DAL", name: "델타항공", sector: "항공" },
  { ticker: "UAL", name: "유나이티드항공", sector: "항공" },
  { ticker: "AAL", name: "아메리칸항공", sector: "항공" },
  { ticker: "LUV", name: "사우스웨스트항공", sector: "항공" },
  { ticker: "ETSY", name: "엣시", sector: "이커머스" },
  { ticker: "W", name: "웨이페어", sector: "이커머스" },
  { ticker: "CHWY", name: "츄이", sector: "이커머스" },
  { ticker: "EBAY", name: "이베이", sector: "이커머스" },

  // ═══════════════════════════════════════════════════════════════
  // 자동차/EV (10)
  // ═══════════════════════════════════════════════════════════════
  { ticker: "GM", name: "제너럴모터스", sector: "자동차" },
  { ticker: "F", name: "포드", sector: "자동차" },
  { ticker: "RIVN", name: "리비안", sector: "자동차" },
  { ticker: "LCID", name: "루시드", sector: "자동차" },
  { ticker: "NIO", name: "니오", sector: "자동차" },
  { ticker: "XPEV", name: "샤오펑", sector: "자동차" },
  { ticker: "LI", name: "리오토", sector: "자동차" },
  { ticker: "APTV", name: "앱티브", sector: "자동차" },
  { ticker: "BWA", name: "보그워너", sector: "자동차" },
  { ticker: "LEA", name: "리어", sector: "자동차" },
];

// ═══════════════════════════════════════════════════════════════
// 신호등 계산 (stock API와 동일한 로직)
// ═══════════════════════════════════════════════════════════════

interface SignalResult {
  earning: "good" | "normal" | "bad";
  debt: "good" | "normal" | "bad";
  growth: "good" | "normal" | "bad";
  valuation: "good" | "normal" | "bad";
}

function getStatusForSignal(
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

function statusToSignal(status: "green" | "yellow" | "red"): "good" | "normal" | "bad" {
  if (status === "green") return "good";
  if (status === "yellow") return "normal";
  return "bad";
}

async function calculateSignalsForTicker(ticker: string): Promise<SignalResult | null> {
  try {
    const [quote, quoteSummary, fundamentals] = await Promise.all([
      yahooFinance.quote(ticker),
      yahooFinance.quoteSummary(ticker, {
        modules: [
          "financialData",
          "defaultKeyStatistics",
          "incomeStatementHistory",
          "incomeStatementHistoryQuarterly",
          "cashflowStatementHistory",
          "balanceSheetHistoryQuarterly",
        ],
      }),
      yahooFinance.fundamentalsTimeSeries(ticker, {
        period1: new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        period2: new Date().toISOString().split('T')[0],
        type: 'quarterly',
        module: 'all',
      }).catch(() => []),
    ]);
    
    const financialData = quoteSummary.financialData;
    const keyStats = quoteSummary.defaultKeyStatistics;
    const incomeHistory = quoteSummary.incomeStatementHistory?.incomeStatementHistory || [];
    const incomeQuarterly = quoteSummary.incomeStatementHistoryQuarterly?.incomeStatementHistory || [];
    const cashflowHistory = quoteSummary.cashflowStatementHistory?.cashflowStatements || [];
    const balanceSheetQuarterly = quoteSummary.balanceSheetHistoryQuarterly?.balanceSheetStatements || [];
    
    const fundamentalsData = Array.isArray(fundamentals) ? fundamentals : [];
    const fundamentalsQuarterly = fundamentalsData
      .filter((f: any) => f.date)
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-8);
    
    // ROE
    const roe = financialData?.returnOnEquity || 0;
    
    // OCF
    const ocfFromHistory = cashflowHistory.length > 0 
      ? (cashflowHistory[0]?.totalCashFromOperatingActivities || 0) 
      : 0;
    const isNegativeOCF = ocfFromHistory < 0;
    
    // 매출 (pre-revenue 체크용)
    const actualRevenue = incomeHistory.length > 0 ? (incomeHistory[0]?.totalRevenue || 0) : 0;
    const isPreRevenueCompany = actualRevenue === 0 || actualRevenue < 1000000;
    
    // 연간 순이익 (턴어라운드 체크용)
    const netIncomeCurrentYear = incomeHistory.length > 0 ? (incomeHistory[0]?.netIncome || 0) : 0;
    const isAnnualLoss = netIncomeCurrentYear < 0;
    
    // 분기별 매출/이익 추이
    let quarterlyTrend: { quarter: string; revenue: number; netIncome: number }[] = [];
    if (incomeQuarterly.length > 0) {
      quarterlyTrend = incomeQuarterly.slice(0, 4).map((q: any) => {
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
    }
    
    // 최신 분기 흑자 체크
    const latestQuarterNetIncome = quarterlyTrend.length > 0 
      ? quarterlyTrend[quarterlyTrend.length - 1].netIncome 
      : null;
    const isLatestQuarterProfit = latestQuarterNetIncome !== null && latestQuarterNetIncome > 0;
    const isTurnaroundInProgress = isAnnualLoss && isLatestQuarterProfit;
    
    // 부채비율
    const debtToEquityRaw = financialData?.debtToEquity || 0;
    const debtToEquity = debtToEquityRaw / 100;
    
    let quarterlyDebtTrend: { debtToEquity: number | null }[] = [];
    if (balanceSheetQuarterly.length > 0) {
      quarterlyDebtTrend = balanceSheetQuarterly.slice(0, 4).map((q: any) => {
        const shortTermDebt = q.shortLongTermDebt || q.shortTermDebt || 0;
        const longTermDebt = q.longTermDebt || 0;
        const totalDebt = shortTermDebt + longTermDebt;
        const totalEquity = q.totalStockholderEquity || q.stockholdersEquity || 0;
        const debtToEquityQ = totalEquity > 0 ? totalDebt / totalEquity : null;
        return { debtToEquity: debtToEquityQ };
      }).reverse();
    } else if (fundamentalsQuarterly.length > 0) {
      quarterlyDebtTrend = fundamentalsQuarterly.slice(-4).map((f: any) => {
        const totalDebt = f.quarterlyTotalDebt || f.totalDebt || 
                          (f.quarterlyLongTermDebt || 0) + (f.quarterlyCurrentDebt || 0) || 0;
        const totalEquity = f.quarterlyStockholdersEquity || f.stockholdersEquity || 
                            f.quarterlyTotalEquityGrossMinorityInterest || 0;
        const debtToEquityQ = totalEquity > 0 ? totalDebt / totalEquity : null;
        return { debtToEquity: debtToEquityQ };
      });
    }
    
    const latestQuarterDebt = quarterlyDebtTrend.length > 0 
      ? quarterlyDebtTrend[quarterlyDebtTrend.length - 1] 
      : null;
    const latestQuarterDebtToEquity = latestQuarterDebt?.debtToEquity ?? debtToEquity;
    const hasQuarterlyDebtData = quarterlyDebtTrend.length > 0 && latestQuarterDebt?.debtToEquity !== null;
    const displayDebtToEquity = hasQuarterlyDebtData ? latestQuarterDebtToEquity : debtToEquity;
    
    // 성장률
    let revenueGrowthCalc: number | null = null;
    
    if (incomeHistory.length >= 2) {
      const currentRev = incomeHistory[0]?.totalRevenue || 0;
      const previousRev = incomeHistory[1]?.totalRevenue || 0;
      if (previousRev > 0) {
        revenueGrowthCalc = (currentRev - previousRev) / Math.abs(previousRev);
      }
    } else if (fundamentalsQuarterly.length >= 5) {
      const recentFour = fundamentalsQuarterly.slice(-4);
      const previousFour = fundamentalsQuarterly.slice(-8, -4);
      
      const revenueCurrentYear = recentFour.reduce((sum: number, f: any) => 
        sum + (f.quarterlyTotalRevenue || f.totalRevenue || 0), 0);
      const revenuePreviousYear = previousFour.reduce((sum: number, f: any) => 
        sum + (f.quarterlyTotalRevenue || f.totalRevenue || 0), 0);
      
      if (revenuePreviousYear > 0) {
        revenueGrowthCalc = (revenueCurrentYear - revenuePreviousYear) / Math.abs(revenuePreviousYear);
      }
    } else {
      revenueGrowthCalc = financialData?.revenueGrowth || null;
    }
    
    const hasRevenueGrowthData = revenueGrowthCalc !== null && !isNaN(revenueGrowthCalc);
    const revenueGrowth = revenueGrowthCalc ?? 0;
    
    // 분기별 성장률 fallback
    let fallbackGrowthRate: number | null = null;
    if (quarterlyTrend.length >= 2) {
      const latest = quarterlyTrend[quarterlyTrend.length - 1];
      const prev = quarterlyTrend[quarterlyTrend.length - 2];
      if (prev.revenue > 0) {
        fallbackGrowthRate = (latest.revenue - prev.revenue) / prev.revenue;
      }
    }
    const canUseQuarterlyGrowth = !hasRevenueGrowthData && fallbackGrowthRate !== null;
    
    // PER
    const trailingPER = keyStats?.trailingPE || quote?.trailingPE || 0;
    const forwardPER = keyStats?.forwardPE || financialData?.forwardPE || 0;
    const per = trailingPER > 0 ? trailingPER : forwardPER;
    const isNegativePER = per < 0;
    
    // EARNING
    let earningStatus: "green" | "yellow" | "red";
    if (isPreRevenueCompany) {
      earningStatus = "yellow";
    } else if (isTurnaroundInProgress) {
      earningStatus = "yellow";
    } else if (isNegativeOCF) {
      earningStatus = "red";
    } else {
      earningStatus = getStatusForSignal(roe, { good: 0.15, bad: 0.05 }, true);
    }
    
    // DEBT
    const debtStatus = getStatusForSignal(displayDebtToEquity, { good: 0.5, bad: 1.5 }, false);
    
    // GROWTH
    let growthStatus: "green" | "yellow" | "red";
    if (isPreRevenueCompany) {
      growthStatus = "yellow";
    } else if (hasRevenueGrowthData) {
      if (revenueGrowth > 0.15) growthStatus = "green";
      else if (revenueGrowth > 0) growthStatus = "yellow";
      else growthStatus = "red";
    } else if (canUseQuarterlyGrowth && fallbackGrowthRate !== null) {
      if (fallbackGrowthRate > 0.15) growthStatus = "green";
      else if (fallbackGrowthRate > 0) growthStatus = "yellow";
      else growthStatus = "red";
    } else {
      growthStatus = "yellow";
    }
    
    // VALUATION
    let valuationStatus: "green" | "yellow" | "red";
    if (isNegativePER) {
      valuationStatus = "yellow";
    } else {
      valuationStatus = getStatusForSignal(per, { good: 40, bad: 60 }, false);
    }
    
    return {
      earning: statusToSignal(earningStatus),
      debt: statusToSignal(debtStatus),
      growth: statusToSignal(growthStatus),
      valuation: statusToSignal(valuationStatus),
    };
  } catch (error) {
    console.error(`calculateSignalsForTicker error for ${ticker}:`, error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// API 핸들러
// ═══════════════════════════════════════════════════════════════

export async function GET() {
  try {
    // 15개씩 배치 처리 (300개를 20번 반복)
    const batchSize = 15;
    const results: { ticker: string; name: string; sector: string; signals: SignalResult | null }[] = [];

    for (let i = 0; i < POPULAR_STOCKS.length; i += batchSize) {
      const batch = POPULAR_STOCKS.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (stock) => {
          const signals = await calculateSignalsForTicker(stock.ticker);
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

    // 응답
    const response = {
      allGreen: allGreen.map(r => ({
        ticker: r.ticker,
        name: r.name,
        sector: r.sector,
        signals: r.signals,
      })),
      totalChecked: POPULAR_STOCKS.length,
      validCount: validResults.length,
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
