import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const DART_API_KEY = process.env.DART_API_KEY || "";
const DART_BASE_URL = "https://opendart.fss.or.kr/api";

// ═══════════════════════════════════════════════════════════════
// 한국 주식 종목코드 → DART 고유번호(corp_code) 매핑
// DART API는 고유번호가 필요한데, 종목코드→고유번호 변환이 필요
// ═══════════════════════════════════════════════════════════════

// 주요 종목 매핑 (종목코드 → 회사명)
const KR_STOCK_MAP: Record<string, { name: string; market: "KS" | "KQ" }> = {
  // 대형주 (KOSPI)
  "005930": { name: "삼성전자", market: "KS" },
  "000660": { name: "SK하이닉스", market: "KS" },
  "373220": { name: "LG에너지솔루션", market: "KS" },
  "005380": { name: "현대자동차", market: "KS" },
  "000270": { name: "기아", market: "KS" },
  "006400": { name: "삼성SDI", market: "KS" },
  "051910": { name: "LG화학", market: "KS" },
  "035420": { name: "NAVER", market: "KS" },
  "035720": { name: "카카오", market: "KS" },
  "005490": { name: "POSCO홀딩스", market: "KS" },
  "055550": { name: "신한지주", market: "KS" },
  "105560": { name: "KB금융", market: "KS" },
  "003670": { name: "포스코퓨처엠", market: "KS" },
  "028260": { name: "삼성물산", market: "KS" },
  "012330": { name: "현대모비스", market: "KS" },
  "066570": { name: "LG전자", market: "KS" },
  "003550": { name: "LG", market: "KS" },
  "034730": { name: "SK", market: "KS" },
  "032830": { name: "삼성생명", market: "KS" },
  "096770": { name: "SK이노베이션", market: "KS" },
  "030200": { name: "KT", market: "KS" },
  "017670": { name: "SK텔레콤", market: "KS" },
  "009150": { name: "삼성전기", market: "KS" },
  "086790": { name: "하나금융지주", market: "KS" },
  "316140": { name: "우리금융지주", market: "KS" },
  "003490": { name: "대한항공", market: "KS" },
  "010950": { name: "S-Oil", market: "KS" },
  "034020": { name: "두산에너빌리티", market: "KS" },
  "000810": { name: "삼성화재", market: "KS" },
  "018260": { name: "삼성에스디에스", market: "KS" },
  "011200": { name: "HMM", market: "KS" },
  "011170": { name: "롯데케미칼", market: "KS" },
  "036570": { name: "엔씨소프트", market: "KS" },
  "251270": { name: "넷마블", market: "KS" },
  "259960": { name: "크래프톤", market: "KS" },
  "352820": { name: "하이브", market: "KS" },
  "010130": { name: "고려아연", market: "KS" },
  "004020": { name: "현대제철", market: "KS" },
  "009540": { name: "HD한국조선해양", market: "KS" },
  "329180": { name: "HD현대중공업", market: "KS" },
  "042700": { name: "한미반도체", market: "KS" },
  "267260": { name: "HD현대일렉트릭", market: "KS" },
  "006800": { name: "미래에셋증권", market: "KS" },
  "033780": { name: "KT&G", market: "KS" },
  "000720": { name: "현대건설", market: "KS" },
  "047050": { name: "포스코인터내셔널", market: "KS" },
  "010140": { name: "삼성중공업", market: "KS" },
  "021240": { name: "코웨이", market: "KS" },
  "090430": { name: "아모레퍼시픽", market: "KS" },
  "180640": { name: "한진칼", market: "KS" },
  "003410": { name: "쌍용C&E", market: "KS" },
  "004170": { name: "신세계", market: "KS" },
  "069500": { name: "KODEX 200", market: "KS" },
  "005935": { name: "삼성전자우", market: "KS" },
  "051900": { name: "LG생활건강", market: "KS" },
  "068270": { name: "셀트리온", market: "KS" },
  "015760": { name: "한국전력", market: "KS" },
  "088980": { name: "맥쿼리인프라", market: "KS" },
  "302440": { name: "SK바이오사이언스", market: "KS" },
  "323410": { name: "카카오뱅크", market: "KS" },
  "377300": { name: "카카오페이", market: "KS" },

  // 코스닥 대형주
  "247540": { name: "에코프로비엠", market: "KQ" },
  "086520": { name: "에코프로", market: "KQ" },
  "041510": { name: "에스엠", market: "KQ" },
  "263750": { name: "펄어비스", market: "KQ" },
  "196170": { name: "알테오젠", market: "KQ" },
  "145020": { name: "휴젤", market: "KQ" },
  "091990": { name: "셀트리온헬스케어", market: "KQ" },
  "293490": { name: "카카오게임즈", market: "KQ" },
  "035900": { name: "JYP Ent.", market: "KQ" },
  "403870": { name: "HPSP", market: "KQ" },
  "058470": { name: "리노공업", market: "KQ" },
  "039030": { name: "이오테크닉스", market: "KQ" },
  "328130": { name: "루닛", market: "KQ" },
  "060310": { name: "3S", market: "KQ" },
  "357780": { name: "솔브레인", market: "KQ" },
  "067160": { name: "아프리카TV", market: "KQ" },
  "112040": { name: "위메이드", market: "KQ" },
  "036930": { name: "주성엔지니어링", market: "KQ" },
  "078600": { name: "대주전자재료", market: "KQ" },
  "383220": { name: "F&F", market: "KQ" },
};

// 한글 이름 → 종목코드 검색 매핑
const KR_NAME_TO_CODE: Record<string, string> = {};
for (const [code, info] of Object.entries(KR_STOCK_MAP)) {
  KR_NAME_TO_CODE[info.name.toLowerCase()] = code;
  // 축약어도 추가
  KR_NAME_TO_CODE[info.name.replace(/홀딩스|지주|그룹/g, "").toLowerCase()] = code;
}
// 추가 별칭
const KR_ALIASES: Record<string, string> = {
  "삼전": "005930", "삼성": "005930", "삼성전자": "005930",
  "하이닉스": "000660", "sk하이닉스": "000660", "에스케이하이닉스": "000660",
  "현차": "005380", "현대차": "005380", "현대자동차": "005380",
  "기아": "000270", "기아차": "000270",
  "네이버": "035420", "naver": "035420",
  "카카오": "035720", "카톡": "035720",
  "lg에너지솔루션": "373220", "엘지에너지솔루션": "373220", "lg엔솔": "373220",
  "삼성sdi": "006400", "삼성에스디아이": "006400",
  "lg화학": "051910", "엘지화학": "051910",
  "셀트리온": "068270",
  "포스코": "005490", "posco": "005490",
  "한전": "015760", "한국전력": "015760",
  "에코프로비엠": "247540", "에코프로": "086520",
  "크래프톤": "259960",
  "하이브": "352820",
  "알테오젠": "196170",
  "카카오뱅크": "323410", "카뱅": "323410",
  "카카오페이": "377300", "카페이": "377300",
  "엔씨소프트": "036570", "엔씨": "036570",
  "넷마블": "251270",
  "펄어비스": "263750",
  "kb금융": "105560", "국민은행": "105560",
  "신한지주": "055550", "신한은행": "055550",
  "하나금융": "086790", "하나은행": "086790",
  "우리금융": "316140", "우리은행": "316140",
  "한미반도체": "042700",
  "hd현대일렉트릭": "267260", "현대일렉트릭": "267260",
  "hd현대중공업": "329180", "현대중공업": "329180",
  "고려아연": "010130",
  "대한항공": "003490",
  "kt": "030200", "케이티": "030200",
  "sk텔레콤": "017670", "skt": "017670",
  "kt&g": "033780",
  "삼성물산": "028260",
  "삼성전기": "009150",
  "삼성생명": "032830",
  "삼성화재": "000810",
  "삼성중공업": "010140",
  "현대모비스": "012330",
  "현대건설": "000720",
  "현대제철": "004020",
  "lg전자": "066570", "엘지전자": "066570",
  "lg": "003550",
  "sk": "034730",
  "hmm": "011200",
  "아모레퍼시픽": "090430", "아모레": "090430",
  "코웨이": "021240",
  "jyp": "035900",
  "루닛": "328130",
  "리노공업": "058470",
  "주성엔지니어링": "036930", "주성": "036930",
  "sm": "041510", "에스엠": "041510",
  "카카오게임즈": "293490",
  "위메이드": "112040",
  "f&f": "383220", "에프앤에프": "383220",
  "두산에너빌리티": "034020", "두산에너": "034020",
  "포스코퓨처엠": "003670",
  "포스코인터내셔널": "047050",
  "sk이노베이션": "096770",
  "sk바이오사이언스": "302440",
  "hpsp": "403870",
  "솔브레인": "357780",
  "아프리카tv": "067160", "숲": "067160", "soop": "067160",
};

// ═══════════════════════════════════════════════════════════════
// DART API 호출 함수들
// ═══════════════════════════════════════════════════════════════

// DART: corp_code 조회 (종목코드 → 고유번호)
async function getCorpCode(stockCode: string): Promise<string | null> {
  try {
    if (!DART_API_KEY) {
      console.warn("DART_API_KEY가 설정되지 않았습니다");
      return null;
    }
    const url = `${DART_BASE_URL}/company.json?crtfc_key=${DART_API_KEY}&stock_code=${stockCode}`;
    const res = await fetch(url, { 
      signal: AbortSignal.timeout(5000) // 5초 타임아웃
    });
    const data = await res.json();
    
    if (data.status === "000" && data.corp_code) {
      return data.corp_code;
    }
    console.warn(`DART corp_code 조회: status=${data.status}, message=${data.message || "N/A"}`);
    return null;
  } catch (error) {
    console.error("DART corp_code 조회 실패:", error);
    return null;
  }
}

// DART: 단일 재무제표 조회
async function getDartFinancials(corpCode: string, year: string, reportCode: string = "11011") {
  try {
    const url = `${DART_BASE_URL}/fnlttSinglAcntAll.json?crtfc_key=${DART_API_KEY}&corp_code=${corpCode}&bsns_year=${year}&reprt_code=${reportCode}&fs_div=CFS`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000) // 8초 타임아웃
    });
    const data = await res.json();
    
    if (data.status === "000" && data.list) {
      return data.list;
    }
    console.warn(`DART 재무제표 (${year}): status=${data.status}, message=${data.message || "N/A"}`);
    return [];
  } catch (error) {
    console.error(`DART 재무제표 조회 실패 (${year}):`, error);
    return [];
  }
}

// DART 재무제표에서 특정 항목 값 추출
function extractDartValue(financials: any[], accountNm: string | string[]): number {
  const names = Array.isArray(accountNm) ? accountNm : [accountNm];
  
  for (const name of names) {
    const item = financials.find((f: any) => {
      const fName = (f.account_nm || "").replace(/\s/g, "");
      const searchName = name.replace(/\s/g, "");
      return fName.includes(searchName) || searchName.includes(fName);
    });
    
    if (item) {
      // thstrm_amount (당기금액) 우선
      const value = item.thstrm_amount || item.frmtrm_amount || "0";
      return parseFloat(value.replace(/,/g, "")) || 0;
    }
  }
  return 0;
}

// ═══════════════════════════════════════════════════════════════
// 신호등 계산 (한국 주식 기준)
// ═══════════════════════════════════════════════════════════════

interface KRSignals {
  earning: { status: "green" | "yellow" | "red"; label: string };
  debt: { status: "green" | "yellow" | "red"; label: string };
  growth: { status: "green" | "yellow" | "red"; label: string };
  valuation: { status: "green" | "yellow" | "red"; label: string };
}

function calculateKRSignals(data: {
  roe: number;
  debtRatio: number;
  revenueGrowth: number;
  per: number;
  netIncome: number;
  ocf: number;
}): KRSignals {
  // 돈버는능력 (ROE) - 한국 기준
  let earning: KRSignals["earning"];
  if (data.ocf < 0) {
    earning = { status: "red", label: "영업현금흐름 적자" };
  } else if (data.netIncome < 0) {
    earning = { status: "red", label: "순손실" };
  } else if (data.roe >= 0.10) {
    earning = { status: "green", label: "ROE 10%↑ 우수" };
  } else if (data.roe >= 0.05) {
    earning = { status: "yellow", label: "ROE 보통" };
  } else {
    earning = { status: "red", label: "ROE 5%↓ 부진" };
  }

  // 빚관리 (부채비율) - 한국 기준 (한국은 부채비율이 미국보다 높은 편)
  let debt: KRSignals["debt"];
  if (data.debtRatio <= 0.8) {
    debt = { status: "green", label: "부채비율 양호" };
  } else if (data.debtRatio <= 1.5) {
    debt = { status: "yellow", label: "부채비율 보통" };
  } else {
    debt = { status: "red", label: "부채비율 높음" };
  }

  // 성장가능성 (매출성장률) - 한국 기준
  let growth: KRSignals["growth"];
  if (data.revenueGrowth > 0.10) {
    growth = { status: "green", label: "성장률 10%↑" };
  } else if (data.revenueGrowth > 0) {
    growth = { status: "yellow", label: "저성장" };
  } else {
    growth = { status: "red", label: "매출 역성장" };
  }

  // 현재몸값 (PER) - 한국 기준 (미국보다 낮은 PER 적용)
  let valuation: KRSignals["valuation"];
  if (data.per <= 0) {
    valuation = { status: "yellow", label: "적자/측정불가" };
  } else if (data.per <= 15) {
    valuation = { status: "green", label: "PER 15↓ 저평가" };
  } else if (data.per <= 30) {
    valuation = { status: "yellow", label: "PER 적정" };
  } else {
    valuation = { status: "red", label: "PER 30↑ 고평가" };
  }

  return { earning, debt, growth, valuation };
}

// ═══════════════════════════════════════════════════════════════
// 메인 API 핸들러
// ═══════════════════════════════════════════════════════════════

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code: stockCode } = await params;
    const stockInfo = KR_STOCK_MAP[stockCode];
    
    if (!stockInfo) {
      return NextResponse.json(
        { error: "종목을 찾을 수 없어요" },
        { status: 404 }
      );
    }

    // Yahoo Finance 티커
    const yfinTicker = `${stockCode}.${stockInfo.market}`;
    
    // ═══════════════════════════════════════════════════════════════
    // 1. Yahoo Finance 데이터 (주가, 시총, PER 등)
    // ═══════════════════════════════════════════════════════════════
    
    const [quote, quoteSummary, historical] = await Promise.all([
      yahooFinance.quote(yfinTicker).catch(() => null),
      yahooFinance.quoteSummary(yfinTicker, {
        modules: ["financialData", "defaultKeyStatistics", "summaryProfile"],
      }).catch(() => null),
      yahooFinance.historical(yfinTicker, {
        period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        period2: new Date().toISOString().split('T')[0],
        interval: '1d',
      }).catch(() => []),
    ]);

    const price = quote?.regularMarketPrice || 0;
    const change = quote?.regularMarketChange || 0;
    const changePercent = quote?.regularMarketChangePercent || 0;
    const marketCap = quote?.marketCap || 0;
    const volume = quote?.regularMarketVolume || 0;

    // ═══════════════════════════════════════════════════════════════
    // 2. DART 데이터 (재무제표)
    // ═══════════════════════════════════════════════════════════════
    
    const corpCode = await getCorpCode(stockCode);
    
    let dartFinancials: any[] = [];
    let dartPrevFinancials: any[] = [];
    let dartYear = String(new Date().getFullYear() - 1); // 최신 사업보고서
    let dartPrevYear = String(Number(dartYear) - 1);
    
    if (corpCode) {
      // 최근 2년 연간 재무제표 가져오기
      [dartFinancials, dartPrevFinancials] = await Promise.all([
        getDartFinancials(corpCode, dartYear),
        getDartFinancials(corpCode, dartPrevYear),
      ]);
      
      // 올해 사업보고서가 없으면 전년도 시도
      if (dartFinancials.length === 0) {
        dartYear = String(Number(dartYear) - 1);
        dartPrevYear = String(Number(dartYear) - 1);
        [dartFinancials, dartPrevFinancials] = await Promise.all([
          getDartFinancials(corpCode, dartYear),
          getDartFinancials(corpCode, dartPrevYear),
        ]);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 3. 재무지표 계산
    // ═══════════════════════════════════════════════════════════════

    // DART에서 추출
    const revenue = extractDartValue(dartFinancials, ["매출액", "영업수익", "수익(매출액)", "매출"]);
    const prevRevenue = extractDartValue(dartPrevFinancials, ["매출액", "영업수익", "수익(매출액)", "매출"]);
    const operatingProfit = extractDartValue(dartFinancials, ["영업이익", "영업이익(손실)"]);
    const netIncome = extractDartValue(dartFinancials, ["당기순이익", "당기순이익(손실)"]);
    const totalEquity = extractDartValue(dartFinancials, ["자본총계", "자본 총계"]);
    const totalDebt = extractDartValue(dartFinancials, ["부채총계", "부채 총계"]);
    const totalAssets = extractDartValue(dartFinancials, ["자산총계", "자산 총계"]);
    
    // OCF는 DART 현금흐름표 또는 yfinance에서
    const ocfFromYfin = quoteSummary?.financialData?.operatingCashflow || 0;
    
    // ROE 계산
    let roe = 0;
    if (totalEquity > 0 && netIncome !== 0) {
      roe = netIncome / totalEquity;
    } else if (quoteSummary?.financialData?.returnOnEquity) {
      roe = quoteSummary.financialData.returnOnEquity;
    }
    
    // 부채비율
    let debtRatio = 0;
    if (totalEquity > 0 && totalDebt > 0) {
      debtRatio = totalDebt / totalEquity;
    } else if (quoteSummary?.financialData?.debtToEquity) {
      debtRatio = (quoteSummary.financialData.debtToEquity || 0) / 100;
    }
    
    // 매출성장률
    let revenueGrowth = 0;
    if (prevRevenue > 0 && revenue > 0) {
      revenueGrowth = (revenue - prevRevenue) / prevRevenue;
    } else if (quoteSummary?.financialData?.revenueGrowth) {
      revenueGrowth = quoteSummary.financialData.revenueGrowth;
    }
    
    // PER (yfinance에서)
    const per = quote?.trailingPE || quoteSummary?.defaultKeyStatistics?.trailingPE || 0;
    const forwardPer = quoteSummary?.defaultKeyStatistics?.forwardPE || 0;
    const pbr = quoteSummary?.defaultKeyStatistics?.priceToBook || 0;
    
    // 영업이익률
    const operatingMargin = revenue > 0 ? operatingProfit / revenue : 
      (quoteSummary?.financialData?.operatingMargins || 0);
    
    // 순이익률
    const profitMargin = revenue > 0 ? netIncome / revenue :
      (quoteSummary?.financialData?.profitMargins || 0);

    // ═══════════════════════════════════════════════════════════════
    // 4. 신호등 계산
    // ═══════════════════════════════════════════════════════════════
    
    const signals = calculateKRSignals({
      roe,
      debtRatio,
      revenueGrowth,
      per: per > 0 ? per : forwardPer,
      netIncome,
      ocf: ocfFromYfin,
    });

    // ═══════════════════════════════════════════════════════════════
    // 5. 주가 차트 데이터 (S&P 500 대신 KOSPI 비교)
    // ═══════════════════════════════════════════════════════════════
    
    let kospiHistory: any[] = [];
    try {
      kospiHistory = await yahooFinance.historical("^KS11", {
        period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        period2: new Date().toISOString().split('T')[0],
        interval: '1d',
      });
    } catch { /* 무시 */ }

    // 기간별 수익률 계산
    const historicalPrices = (historical || []).map((d: any) => d.close).filter(Boolean);
    const kospiPrices = kospiHistory.map((d: any) => d.close).filter(Boolean);

    function calcReturn(prices: number[], days: number): number {
      if (prices.length < days) return 0;
      const current = prices[prices.length - 1];
      const past = prices[Math.max(0, prices.length - days)];
      return past > 0 ? ((current - past) / past) * 100 : 0;
    }

    const performance = {
      stock: {
        "1W": calcReturn(historicalPrices, 5),
        "1M": calcReturn(historicalPrices, 22),
        "3M": calcReturn(historicalPrices, 63),
        "6M": calcReturn(historicalPrices, 126),
        "1Y": calcReturn(historicalPrices, 252),
      },
      kospi: {
        "1W": calcReturn(kospiPrices, 5),
        "1M": calcReturn(kospiPrices, 22),
        "3M": calcReturn(kospiPrices, 63),
        "6M": calcReturn(kospiPrices, 126),
        "1Y": calcReturn(kospiPrices, 252),
      },
    };

    // 52주 고점/저점
    const high52W = historicalPrices.length > 0 ? Math.max(...historicalPrices) : price;
    const low52W = historicalPrices.length > 0 ? Math.min(...historicalPrices) : price;
    const fromHigh52W = high52W > 0 ? ((price - high52W) / high52W) * 100 : 0;

    // ═══════════════════════════════════════════════════════════════
    // 6. 응답 구성
    // ═══════════════════════════════════════════════════════════════
    
    const formatKRW = (value: number): string => {
      if (Math.abs(value) >= 1e12) return `${(value / 1e12).toFixed(1)}조`;
      if (Math.abs(value) >= 1e8) return `${(value / 1e8).toFixed(0)}억`;
      if (Math.abs(value) >= 1e4) return `${(value / 1e4).toFixed(0)}만`;
      return String(Math.round(value));
    };

    const result = {
      isKorean: true,
      basicInfo: {
        name: stockInfo.name,
        ticker: yfinTicker,
        stockCode,
        exchange: stockInfo.market === "KS" ? "KOSPI" : "KOSDAQ",
        price,
        change,
        changePercent,
        marketCap,
        marketCapFormatted: formatKRW(marketCap),
        volume,
        sector: quoteSummary?.summaryProfile?.sector || "",
        industry: quoteSummary?.summaryProfile?.industry || "",
      },
      signals: {
        earning: signals.earning.status === "green" ? "good" : signals.earning.status === "yellow" ? "normal" : "bad",
        debt: signals.debt.status === "green" ? "good" : signals.debt.status === "yellow" ? "normal" : "bad",
        growth: signals.growth.status === "green" ? "good" : signals.growth.status === "yellow" ? "normal" : "bad",
        valuation: signals.valuation.status === "green" ? "good" : signals.valuation.status === "yellow" ? "normal" : "bad",
      },
      signalDetails: signals,
      financials: {
        // 수익성
        roe: Math.round(roe * 10000) / 100,
        operatingMargin: Math.round(operatingMargin * 10000) / 100,
        profitMargin: Math.round(profitMargin * 10000) / 100,
        // 부채
        debtRatio: Math.round(debtRatio * 100) / 100,
        // 성장
        revenueGrowth: Math.round(revenueGrowth * 10000) / 100,
        // 밸류에이션
        per: Math.round((per > 0 ? per : forwardPer) * 100) / 100,
        perType: per > 0 ? "TTM" : "Forward",
        pbr: Math.round(pbr * 100) / 100,
        // 원본 데이터
        revenue,
        revenueFormatted: formatKRW(revenue),
        operatingProfit,
        operatingProfitFormatted: formatKRW(operatingProfit),
        netIncome,
        netIncomeFormatted: formatKRW(netIncome),
        totalAssets,
        totalAssetsFormatted: formatKRW(totalAssets),
        totalEquity,
        totalEquityFormatted: formatKRW(totalEquity),
        totalDebt,
        totalDebtFormatted: formatKRW(totalDebt),
        dartYear,
        dataSource: dartFinancials.length > 0 ? "DART" : "Yahoo Finance",
      },
      performance,
      benchmarkName: "KOSPI",
      priceInfo: {
        high52W,
        low52W,
        fromHigh52W: Math.round(fromHigh52W * 10) / 10,
      },
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error) {
    console.error("KR Stock API Error:", error);
    return NextResponse.json(
      { error: "데이터를 불러오는 중 오류가 발생했어요" },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// 한글 검색 지원 (외부에서 import 가능)
// ═══════════════════════════════════════════════════════════════

export { KR_STOCK_MAP, KR_ALIASES };
