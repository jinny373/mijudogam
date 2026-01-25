"use client"

import React, { useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Search, Loader2, X, Clock } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { trackSearch } from '@/lib/analytics'

const popularStocks = [
  { ticker: "NVDA", name: "엔비디아" },
  { ticker: "AAPL", name: "애플" },
  { ticker: "TSLA", name: "테슬라" },
  { ticker: "MSFT", name: "마이크로소프트" },
  { ticker: "GOOGL", name: "구글" },
]

// 최근 본 종목 저장/불러오기 (localStorage)
const RECENT_STOCKS_KEY = "mijudogam_recent_stocks"
const MAX_RECENT_STOCKS = 5

interface RecentStock {
  ticker: string
  name: string
  viewedAt: number
}

const getRecentStocks = (): RecentStock[] => {
  if (typeof window === "undefined") return []
  try {
    const stored = localStorage.getItem(RECENT_STOCKS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

const saveRecentStock = (ticker: string, name: string) => {
  if (typeof window === "undefined") return
  try {
    const recent = getRecentStocks()
    const filtered = recent.filter((s) => s.ticker !== ticker)
    const updated = [{ ticker, name, viewedAt: Date.now() }, ...filtered].slice(0, MAX_RECENT_STOCKS)
    localStorage.setItem(RECENT_STOCKS_KEY, JSON.stringify(updated))
  } catch {
    // localStorage 에러 무시
  }
}

// ===== 한국 주식 키워드 (미지원 안내용) =====
const koreanStockKeywords = [
  '삼성', '하이닉스', '현대', 'LG', '네이버', '카카오',
  '셀트리온', '삼바', 'SK', '포스코', '한화', '두산',
  '고려아연', '동성케미컬', '한올', '에스피지', '기아',
  '엔씨소프트', '크래프톤', '넥슨', '펄어비스', '카카오게임즈',
  '쿠팡', '배달의민족', '토스', '야놀자', '직방',
  '신한', '국민은행', 'KB', '우리은행', '하나은행'
]

const isKoreanStock = (query: string): boolean => {
  return koreanStockKeywords.some(keyword =>
    query.toLowerCase().includes(keyword.toLowerCase())
  )
}

// ===== v9.20: 한글 매핑 (완전형 이름 기준, 중복 제거) =====
// 규칙: 하나의 티커에 하나의 완전형 이름만 매핑
// 줄임말/별칭은 searchAliases에서 처리
const koreanStockMap: Record<string, string> = {
  // ===== 빅테크 (Mag 7) =====
  "엔비디아": "NVDA",
  "애플": "AAPL",
  "테슬라": "TSLA",
  "마이크로소프트": "MSFT",
  "구글": "GOOGL",
  "알파벳": "GOOGL",
  "아마존": "AMZN",
  "메타": "META",
  "페이스북": "META",
  "넷플릭스": "NFLX",
  
  // ===== 반도체 =====
  "인텔": "INTC",
  "에이엠디": "AMD",
  "퀄컴": "QCOM",
  "브로드컴": "AVGO",
  "마이크론": "MU",
  "슈퍼마이크로": "SMCI",
  "암홀딩스": "ARM",
  "아스엠엘": "ASML",
  "티에스엠씨": "TSM",
  "대만반도체": "TSM",
  "텍사스인스트루먼트": "TXN",
  "어플라이드머티리얼즈": "AMAT",
  "램리서치": "LRCX",
  "케이엘에이": "KLAC",
  "마벨테크놀로지": "MRVL",
  "온세미컨덕터": "ON",
  "엔엑스피": "NXPI",
  "스카이웍스": "SWKS",
  "울프스피드": "WOLF",
  
  // ===== AI/클라우드/소프트웨어 =====
  "팔란티어": "PLTR",
  // "팔란이오" 삭제 - 틀린 이름
  "스노우플레이크": "SNOW",
  "데이터독": "DDOG",
  "크라우드스트라이크": "CRWD",
  "세일즈포스": "CRM",
  "어도비": "ADBE",
  "오라클": "ORCL",
  "시스코": "CSCO",
  "아이비엠": "IBM",
  "줌": "ZM",
  "서비스나우": "NOW",
  "워크데이": "WDAY",
  "몽고디비": "MDB",
  "엘라스틱": "ESTC",
  "지스케일러": "ZS",
  "포티넷": "FTNT",
  "옥타": "OKTA",
  "트윌리오": "TWLO",
  "도큐사인": "DOCU",
  "아틀라시안": "TEAM",
  "허브스팟": "HUBS",
  "앤시스": "ANSS",
  "시놉시스": "SNPS",
  "케이던스": "CDNS",
  "오토데스크": "ADSK",
  "인튜이트": "INTU",
  "사운드하운드": "SOUN",
  "빅베어에이아이": "BBAI",
  "씨쓰리에이아이": "AI",
  
  // ===== 전기차/클린에너지 =====
  "리비안": "RIVN",
  "루시드": "LCID",
  "니오": "NIO",
  "샤오펑": "XPEV",
  "비야디": "BYDDY",
  "리오토": "LI",
  "블룸에너지": "BE",
  "플러그파워": "PLUG",
  "퍼스트솔라": "FSLR",
  "엔페이즈": "ENPH",
  "솔라엣지": "SEDG",
  "차지포인트": "CHPT",
  "발라드파워": "BLDP",
  "퀀텀스케이프": "QS",
  
  // ===== 원자력/SMR/유틸리티 =====
  "뉴스케일파워": "SMR",
  "오클로": "OKLO",
  "센트러스에너지": "LEU",
  "카메코": "CCJ",
  "우라늄에너지": "UEC",
  "컨스털레이션에너지": "CEG",
  "비스트라에너지": "VST",
  "넥스트에라에너지": "NEE",
  "서던컴퍼니": "SO",
  "듀크에너지": "DUK",
  "탈렌에너지": "TLN",
  "도미니언에너지": "D",
  "엑셀론": "EXC",
  "피지앤이": "PCG",
  "엔터지": "ETR",
  "퍼블릭서비스": "PEG",
  
  // ===== 데이터센터/인프라 =====
  "아이렌": "IREN",
  "코어위브": "CRWV",
  "버티브": "VRT",
  "이튼": "ETN",
  "에퀴닉스": "EQIX",
  "디지털리얼티": "DLR",
  "아메리칸타워": "AMT",
  "크라운캐슬": "CCI",
  "아스테라랩스": "ALAB",
  
  // ===== 양자컴퓨터 =====
  "아이온큐": "IONQ",
  "리게티컴퓨팅": "RGTI",
  "디웨이브": "QBTS",
  
  // ===== 핀테크/암호화폐 =====
  "코인베이스": "COIN",
  "로빈후드": "HOOD",
  "페이팔": "PYPL",
  "블록": "SQ",
  "스퀘어": "SQ",
  "쇼피파이": "SHOP",
  "어펌": "AFRM",
  "소파이": "SOFI",
  "마라톤디지털": "MARA",
  "라이엇플랫폼스": "RIOT",
  "마이크로스트래티지": "MSTR",
  "누홀딩스": "NU",
  
  // ===== 소비재/리테일 =====
  "코스트코": "COST",
  "스타벅스": "SBUX",
  "나이키": "NKE",
  "디즈니": "DIS",
  "맥도날드": "MCD",
  "월마트": "WMT",
  "타겟": "TGT",
  "홈디포": "HD",
  "로우스": "LOW",
  "치폴레": "CMG",
  "룰루레몬": "LULU",
  "크록스": "CROX",
  "덱커스": "DECK",
  "온홀딩": "ONON",
  "달러제너럴": "DG",
  "달러트리": "DLTR",
  "로스스토어": "ROST",
  "티제이맥스": "TJX",
  
  // ===== 플랫폼/소셜/게임 =====
  "우버": "UBER",
  "에어비앤비": "ABNB",
  "도어대시": "DASH",
  "유니티": "U",
  "로블록스": "RBLX",
  "스포티파이": "SPOT",
  "핀터레스트": "PINS",
  "스냅": "SNAP",
  "매치그룹": "MTCH",
  "듀오링고": "DUOL",
  "일렉트로닉아츠": "EA",
  "테이크투": "TTWO",
  "액티비전": "ATVI",
  
  // ===== 헬스케어/바이오 =====
  "일라이릴리": "LLY",
  "노보노디스크": "NVO",
  "화이자": "PFE",
  "모더나": "MRNA",
  "존슨앤존슨": "JNJ",
  "유나이티드헬스": "UNH",
  "애브비": "ABBV",
  "머크": "MRK",
  "암젠": "AMGN",
  "길리어드": "GILD",
  "버텍스": "VRTX",
  "리제네론": "REGN",
  "바이오젠": "BIIB",
  "일루미나": "ILMN",
  "인튜이티브서지컬": "ISRG",
  "덱스컴": "DXCM",
  "아이큐비아": "IQV",
  "써모피셔": "TMO",
  "다나허": "DHR",
  "에드워즈라이프사이언스": "EW",
  "스트라이커": "SYK",
  "메드트로닉": "MDT",
  "애보트": "ABT",
  "브리스톨마이어스": "BMY",
  "CVS헬스": "CVS",
  "시그나": "CI",
  "휴마나": "HUM",
  "센틴": "CNC",
  
  // ===== 금융 =====
  "버크셔해서웨이": "BRK-B",
  "제이피모건": "JPM",
  "골드만삭스": "GS",
  "모건스탠리": "MS",
  "뱅크오브아메리카": "BAC",
  "웰스파고": "WFC",
  "씨티그룹": "C",
  "비자": "V",
  "마스터카드": "MA",
  "아메리칸익스프레스": "AXP",
  "찰스슈왑": "SCHW",
  "블랙록": "BLK",
  "스테이트스트리트": "STT",
  "피델리티": "FIS",
  "CME그룹": "CME",
  "인터컨티넨탈익스체인지": "ICE",
  "마켓액세스": "MKTX",
  "트레이드데스크": "TTD",
  
  // ===== 통신 =====
  "버라이즌": "VZ",
  "에이티앤티": "T",
  "티모바일": "TMUS",
  "컴캐스트": "CMCSA",
  "차터커뮤니케이션즈": "CHTR",

  // ===== 방산/항공우주 =====
  "록히드마틴": "LMT",
  "레이시온": "RTX",
  "노스롭그루먼": "NOC",
  "제너럴다이내믹스": "GD",
  "보잉": "BA",
  "에어버스": "EADSY",
  "L3해리스": "LHX",
  "헌팅턴잉걸스": "HII",
  "로켓랩": "RKLB",
  // "로켓", "로켓램" 삭제 - 줄임말/오타는 별칭에서 처리
  "버진갤럭틱": "SPCE",
  "플래닛랩스": "PL",

  // ===== 산업재/장비 =====
  "캐터필러": "CAT",
  // "캐터필" 삭제 - 줄임말은 별칭에서 처리
  "디어": "DE",
  "존디어": "DE",
  "허니웰": "HON",
  "쓰리엠": "MMM",
  "3M": "MMM",
  "유니온퍼시픽": "UNP",
  "유피에스": "UPS",
  "페덱스": "FDX",

  // 소재
  "뉴코어": "NUE",
  "프리포트맥모란": "FCX",
  "에어프로덕츠": "APD",
  "린데": "LIN",

  // 리츠
  "프로로지스": "PLD",
  "리얼티인컴": "O",

  // 기타 인기 종목
  "팔로알토네트웍스": "PANW",

  // ===== v9.20: 검색 실패 종목 매핑 (완전형만) =====
  "앱러빈": "APP",
  "알리바바": "BABA",
  "샌디스크": "SNDK",
  "비트마인이머션테크놀로지스": "BMNR",  // 완전형만
  "나비타스세미컨덕터": "NVTS",  // 완전형만
  "네비우스그룹": "NBIS",  // 완전형만
  "레드캣홀딩스": "RCAT",  // 완전형만
  "업스타트홀딩스": "UPST",  // 완전형만
  "셰니어에너지": "LNG",  // 완전형만
  "코크리스털파마": "COCP",  // 완전형만
  "보이저테크놀로지스": "VOYG",  // 완전형만
  "써클인터넷그룹": "CRCL",
  "이오스에너지": "EOSE",
  "노던오일앤가스": "NOG",
  "노던트러스트": "NTRS",
  "노던다이너스티미네랄스": "NAK",
  
  // ===== v9.22: 추가 종목 =====
  "온다스홀딩스": "ONDS",
  "온다스": "ONDS",
  "사이퍼마이닝": "CIFR",
  "레드와이어": "RDW",
  "템퍼스": "TEM",
  "템퍼스AI": "TEM",
  "템퍼스에이아이": "TEM",
  "비트팜스": "BITF",
  "비트팜": "BITF",
}

// ===== v9.20: 검색용 별칭 (줄임말, 오타 등) =====
// findSimilarStocks에서 사용 - 자동완성에는 안 뜨고 추천에만 사용
const searchAliases: Record<string, string> = {
  // 줄임말
  "뉴스케일": "SMR",
  "컨스털레이션": "CEG",
  "비스트라": "VST",
  "넥스트에라": "NEE",
  "리겟티": "RGTI",
  "리게티": "RGTI",
  "아스테라": "ALAB",
  "로켓": "RKLB",
  "캐터필": "CAT",
  "팔로알토": "PANW",
  
  // 검색 실패 종목 줄임말
  "비트마인": "BMNR",
  "나비타스": "NVTS",
  "네비우스": "NBIS",
  "레드캣": "RCAT",
  "업스타트": "UPST",
  "셰니어": "LNG",
  "쉐니어": "LNG",
  "코크리스털": "COCP",
  "보이저": "VOYG",
  "써클": "CRCL",
  "이오스": "EOSE",
  "노던": "NOG",
  
  // 흔한 오타/변형
  "JP모건": "JPM",
  "몽고DB": "MDB",
  "UPS": "UPS",
  
  // v9.22: 추가 오타/줄임말
  "비트팜주": "BITF",
  "빗팜스": "BITF",
  "빗팜": "BITF",
  "템퍼스아이": "TEM",
  "레드와이어": "RDW",
  "사이퍼": "CIFR",
  "싸이퍼": "CIFR",
}

// 티커 → 완전형 이름 역매핑 (유사 종목 추천용)
const getFullNameByTicker = (ticker: string): string | null => {
  for (const [name, t] of Object.entries(koreanStockMap)) {
    if (t === ticker) return name
  }
  return null
}

// ===== v9.20: 유사 종목 찾기 (개선) =====
const findSimilarStocks = (query: string): { ticker: string; name: string }[] => {
  const normalizedQuery = query.toLowerCase().replace(/\s/g, '')
  const suggestions: { ticker: string; name: string; score: number }[] = []
  const seenTickers = new Set<string>()

  // 1. koreanStockMap에서 검색 (완전형 이름)
  for (const [korean, ticker] of Object.entries(koreanStockMap)) {
    const normalizedKorean = korean.toLowerCase().replace(/\s/g, '')
    
    if (normalizedKorean.includes(normalizedQuery) ||
        normalizedQuery.includes(normalizedKorean)) {
      if (!seenTickers.has(ticker)) {
        suggestions.push({
          ticker,
          name: korean,
          score: normalizedKorean === normalizedQuery ? 100 : 
                 normalizedKorean.startsWith(normalizedQuery) ? 80 : 50
        })
        seenTickers.add(ticker)
      }
    }
  }

  // 2. searchAliases에서 검색 (줄임말/오타)
  for (const [alias, ticker] of Object.entries(searchAliases)) {
    const normalizedAlias = alias.toLowerCase().replace(/\s/g, '')
    
    if (normalizedAlias.includes(normalizedQuery) ||
        normalizedQuery.includes(normalizedAlias)) {
      if (!seenTickers.has(ticker)) {
        const fullName = getFullNameByTicker(ticker) || alias
        suggestions.push({
          ticker,
          name: fullName,
          score: normalizedAlias === normalizedQuery ? 90 : 40
        })
        seenTickers.add(ticker)
      }
    }
  }

  // 점수순 정렬 후 상위 3개
  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ ticker, name }) => ({ ticker, name }))
}

interface SearchResult {
  ticker: string
  name: string
  exchange: string
  type: string
}

interface StockSearchFormProps {
  autoFocus?: boolean
}

export function StockSearchForm({ autoFocus = false }: StockSearchFormProps) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [recentStocks, setRecentStocks] = useState<RecentStock[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // autoFocus prop이 true면 검색창에 포커스
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  // 최근 본 종목 불러오기 (클라이언트에서만)
  useEffect(() => {
    setRecentStocks(getRecentStocks())
  }, [])

  // 검색 API 호출 (디바운스)
  const searchStocks = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 1) {
      setResults([])
      setShowDropdown(false)
      return
    }

    // v9.20: 한글 매핑 체크 (중복 티커 제거)
    const seenTickers = new Set<string>()
    const koreanMatches = Object.entries(koreanStockMap)
      .filter(([korean]) => korean.includes(searchQuery))
      .filter(([_, ticker]) => {
        if (seenTickers.has(ticker)) return false
        seenTickers.add(ticker)
        return true
      })
      .map(([korean, ticker]) => ({
        ticker,
        name: korean,
        exchange: "NASDAQ",
        type: "EQUITY",
      }))

    if (koreanMatches.length > 0) {
      setResults(koreanMatches.slice(0, 5))
      setShowDropdown(true)
    }

    // Yahoo API 검색
    setIsSearching(true)
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
      const data = await response.json()
      
      if (data.results && data.results.length > 0) {
        // 한글 매핑 결과와 API 결과 합치기 (중복 제거)
        const apiResults = data.results.filter(
          (r: SearchResult) => !koreanMatches.some(k => k.ticker === r.ticker)
        )
        setResults([...koreanMatches, ...apiResults].slice(0, 8))
        setShowDropdown(true)
      } else if (koreanMatches.length === 0) {
        setResults([])
        setShowDropdown(true) // v9.20: 결과 없어도 드롭다운 표시 (안내 메시지용)
      }
    } catch (error) {
      console.error("Search error:", error)
    } finally {
      setIsSearching(false)
    }
  }, [])

  // 입력 변경 시 디바운스 검색
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (query.length >= 1) {
      searchTimeoutRef.current = setTimeout(() => {
        searchStocks(query)
      }, 300) // 300ms 디바운스
    } else {
      setResults([])
      setShowDropdown(false)
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [query, searchStocks])

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // 종목 선택
  const handleSelectStock = (ticker: string, name?: string) => {
    setIsLoading(true)
    setShowDropdown(false)
    setQuery("")
    trackSearch(ticker)
    // 최근 본 종목에 저장
    const stockName = name || koreanStockMap[ticker] || ticker
    saveRecentStock(ticker, stockName)
    setRecentStocks(getRecentStocks())
    router.push(`/stock/${ticker}`)
  }

  // 폼 제출
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (selectedIndex >= 0 && results[selectedIndex]) {
      handleSelectStock(results[selectedIndex].ticker)
      return
    }

    if (!query.trim()) return

    // 한글 매핑 체크
    const mappedTicker = koreanStockMap[query.trim()]
    if (mappedTicker) {
      handleSelectStock(mappedTicker)
      return
    }

    // 별칭 체크
    const aliasTicker = searchAliases[query.trim()]
    if (aliasTicker) {
      handleSelectStock(aliasTicker)
      return
    }

    // 영문 티커로 바로 이동
    setIsLoading(true)
    setShowDropdown(false)
    router.push(`/stock/${query.toUpperCase().trim()}`)
  }

  // 키보드 네비게이션
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || results.length === 0) return

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev))
        break
      case "ArrowUp":
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case "Enter":
        if (selectedIndex >= 0 && results[selectedIndex]) {
          e.preventDefault()
          handleSelectStock(results[selectedIndex].ticker, results[selectedIndex].name)
        }
        break
      case "Escape":
        setShowDropdown(false)
        setSelectedIndex(-1)
        break
    }
  }

  // 입력 초기화
  const handleClear = () => {
    setQuery("")
    setResults([])
    setShowDropdown(false)
    inputRef.current?.focus()
  }

  // v9.20: 유사 종목 추천 가져오기
  const similarStocks = query.length >= 2 ? findSimilarStocks(query) : []

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="종목명 또는 티커 검색 (예: 엔비디아, AAPL)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(-1)
            }}
            onFocus={() => {
              if (results.length > 0 || query.length >= 2) setShowDropdown(true)
            }}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            autoComplete="off"
            className="pl-12 pr-20 h-14 text-base rounded-2xl border-2 border-muted bg-background shadow-sm focus:border-primary focus:ring-primary transition-all"
          />
          
          {/* 로딩/클리어/검색 버튼 */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {isSearching && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {query && !isLoading && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleClear}
                className="h-8 w-8 rounded-lg"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !query.trim()}
              className="h-10 w-10 rounded-xl bg-primary hover:bg-primary/90"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Search className="h-5 w-5" />
              )}
              <span className="sr-only">검색</span>
            </Button>
          </div>
        </div>

        {/* 자동완성 드롭다운 */}
        {showDropdown && results.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-2 bg-background border-2 border-muted rounded-xl shadow-lg overflow-hidden"
          >
            {results.map((result, index) => (
              <button
                key={`${result.ticker}-${index}`}
                type="button"
                onClick={() => handleSelectStock(result.ticker, result.name)}
                className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-muted/50 transition-colors ${
                  index === selectedIndex ? "bg-muted/50" : ""
                }`}
              >
                <div>
                  <span className="font-semibold text-primary">{result.ticker}</span>
                  <span className="ml-2 text-foreground">{result.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">{result.exchange}</span>
              </button>
            ))}
          </div>
        )}

        {/* v9.20: 검색 결과 없을 때 안내 (개선됨) */}
        {showDropdown && results.length === 0 && query.length >= 2 && !isSearching && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-2 bg-background border-2 border-muted rounded-xl shadow-lg overflow-hidden p-4"
          >
            <p className="text-sm text-muted-foreground text-center">
              검색 결과가 없어요
            </p>
            
            {/* v9.20: 한국 주식 검색 시 안내 */}
            {isKoreanStock(query) && (
              <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                <p className="text-sm text-orange-600 dark:text-orange-400 text-center">
                  ⚠️ 미주도감은 <strong>미국 주식</strong>만 지원해요
                </p>
                <p className="text-xs text-orange-500 dark:text-orange-500 text-center mt-1">
                  한국 주식은 네이버 증권, 키움증권 등을 이용해주세요
                </p>
              </div>
            )}

            {/* v9.20: 유사 종목 추천 */}
            {!isKoreanStock(query) && similarStocks.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground text-center mb-2">
                  🔍 이 종목을 찾으셨나요?
                </p>
                <div className="space-y-1">
                  {similarStocks.map((stock) => (
                    <button
                      key={stock.ticker}
                      type="button"
                      onClick={() => handleSelectStock(stock.ticker, stock.name)}
                      className="w-full px-3 py-2 text-left hover:bg-muted/50 rounded-lg transition-colors"
                    >
                      <span className="font-semibold text-primary">{stock.ticker}</span>
                      <span className="ml-2 text-muted-foreground">{stock.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 기본 안내 (한국 주식도 아니고 유사 종목도 없을 때) */}
            {!isKoreanStock(query) && similarStocks.length === 0 && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                💡 영문 티커로 검색해보세요 (예: NVDA, AAPL)
              </p>
            )}
          </div>
        )}
      </form>

      {/* 최근 본 종목 */}
      {recentStocks.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1 justify-center text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>최근 본 종목</span>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {recentStocks.map((stock) => (
              <button
                key={stock.ticker}
                onClick={() => handleSelectStock(stock.ticker, stock.name)}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-full text-sm font-medium bg-muted text-foreground hover:bg-muted/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {stock.ticker}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 인기 종목 */}
      <div className="flex flex-wrap justify-center gap-2">
        {popularStocks.map((stock) => (
          <button
            key={stock.ticker}
            onClick={() => handleSelectStock(stock.ticker, stock.name)}
            disabled={isLoading}
            className="px-4 py-2 rounded-full text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {stock.ticker} {stock.name}
          </button>
        ))}
      </div>
    </div>
  )
}
