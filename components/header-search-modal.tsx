"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface SearchResult {
  ticker: string
  name: string
  exchange: string
  type: string
  isKorean?: boolean
  stockCode?: string
}

// 미국 주식 한글 매핑
const koreanStockMap: Record<string, string> = {
  // 빅테크
  "엔비디아": "NVDA", "애플": "AAPL", "테슬라": "TSLA", "마이크로소프트": "MSFT",
  "구글": "GOOGL", "알파벳": "GOOGL", "아마존": "AMZN", "메타": "META",
  "넷플릭스": "NFLX", "인텔": "INTC", "에이엠디": "AMD", "AMD": "AMD",
  // 반도체
  "퀄컴": "QCOM", "브로드컴": "AVGO", "마이크론": "MU", "팔란티어": "PLTR",
  "슈퍼마이크로": "SMCI", "마벨": "MRVL", "암홀딩스": "ARM", "대만반도체": "TSM",
  // AI/클라우드
  "스노우플레이크": "SNOW", "데이터독": "DDOG", "세일즈포스": "CRM", "오라클": "ORCL",
  "사운드하운드": "SOUN", "빅베어에이아이": "BBAI", "씨쓰리에이아이": "AI",
  // 크립토/비트코인
  "코인베이스": "COIN", "마이크로스트래티지": "MSTR", "마라톤": "MARA", "라이엇": "RIOT",
  "비트팜스": "BITF", "사이퍼마이닝": "CIFR", "클린스파크": "CLSK", "허트에이트": "HUT",
  "테라울프": "WULF", "코어사이언티픽": "CORZ", "아이리스에너지": "IREN",
  // 양자컴퓨터
  "아이온큐": "IONQ", "리게티": "RGTI", "디웨이브": "QBTS",
  "퀀텀컴퓨팅": "QUBT", "퀀텀 컴퓨팅": "QUBT", "퀀텀": "QUBT",
  "양자컴퓨터": "IONQ", "양자컴퓨팅": "IONQ",
  // 원자력/SMR
  "뉴스케일": "SMR", "오클로": "OKLO", "컨스털레이션": "CEG", "비스트라": "VST",
  "센트러스에너지": "LEU", "카메코": "CCJ",
  // 데이터센터/인프라
  "버티브": "VRT", "이튼": "ETN", "아스테라랩스": "ALAB", "에퀴닉스": "EQIX",
  "디지털리얼티": "DLR", "GE버노바": "GEV",
  // 광통신
  "크리도": "CRDO", "코히런트": "COHR", "코닝": "GLW", "루멘텀": "LITE",
  // AI 데이터/헬스케어
  "이노데이터": "INOD", "템퍼스": "TEM",
  // 우주
  "레드와이어": "RDW", "로켓랩": "RKLB", "AST스페이스모바일": "ASTS", "인튜이티브머신스": "LUNR",
  // 기타
  "온다스": "ONDS", "클라우드플레어": "NET", "델": "DELL",
  // 신규 요청
  "블루골드": "BGL", "브랜드인게이지먼트네트워크": "BNAI", "브랜드인게이지먼트": "BNAI",
  // 전기차
  "리비안": "RIVN", "루시드": "LCID", "니오": "NIO", "니콜라": "NKLA",
  // 핀테크
  "로빈후드": "HOOD", "페이팔": "PYPL", "블록": "SQ", "업스타트": "UPST", "소파이": "SOFI",
}

// ═══════════════════════════════════════════════════════════════
// 한국 주식 한글 → 종목코드 (엔터 직접 입력 대응)
// ═══════════════════════════════════════════════════════════════
const krDirectMap: Record<string, { code: string; market: "KS" | "KQ" }> = {
  "삼성전자": { code: "005930", market: "KS" },
  "삼전": { code: "005930", market: "KS" },
  "삼성": { code: "005930", market: "KS" },
  "sk하이닉스": { code: "000660", market: "KS" },
  "하이닉스": { code: "000660", market: "KS" },
  "현대자동차": { code: "005380", market: "KS" },
  "현대차": { code: "005380", market: "KS" },
  "현차": { code: "005380", market: "KS" },
  "기아": { code: "000270", market: "KS" },
  "네이버": { code: "035420", market: "KS" },
  "naver": { code: "035420", market: "KS" },
  "카카오": { code: "035720", market: "KS" },
  "카톡": { code: "035720", market: "KS" },
  "lg에너지솔루션": { code: "373220", market: "KS" },
  "lg엔솔": { code: "373220", market: "KS" },
  "삼성sdi": { code: "006400", market: "KS" },
  "lg화학": { code: "051910", market: "KS" },
  "셀트리온": { code: "068270", market: "KS" },
  "포스코": { code: "005490", market: "KS" },
  "한국전력": { code: "015760", market: "KS" },
  "한전": { code: "015760", market: "KS" },
  "kb금융": { code: "105560", market: "KS" },
  "국민은행": { code: "105560", market: "KS" },
  "신한지주": { code: "055550", market: "KS" },
  "신한은행": { code: "055550", market: "KS" },
  "하나금융": { code: "086790", market: "KS" },
  "하나은행": { code: "086790", market: "KS" },
  "우리금융": { code: "316140", market: "KS" },
  "우리은행": { code: "316140", market: "KS" },
  "크래프톤": { code: "259960", market: "KS" },
  "하이브": { code: "352820", market: "KS" },
  "엔씨소프트": { code: "036570", market: "KS" },
  "엔씨": { code: "036570", market: "KS" },
  "넷마블": { code: "251270", market: "KS" },
  "대한항공": { code: "003490", market: "KS" },
  "삼성물산": { code: "028260", market: "KS" },
  "현대모비스": { code: "012330", market: "KS" },
  "lg전자": { code: "066570", market: "KS" },
  "삼성전기": { code: "009150", market: "KS" },
  "삼성생명": { code: "032830", market: "KS" },
  "삼성화재": { code: "000810", market: "KS" },
  "삼성중공업": { code: "010140", market: "KS" },
  "현대건설": { code: "000720", market: "KS" },
  "현대제철": { code: "004020", market: "KS" },
  "고려아연": { code: "010130", market: "KS" },
  "kt": { code: "030200", market: "KS" },
  "sk텔레콤": { code: "017670", market: "KS" },
  "skt": { code: "017670", market: "KS" },
  "kt&g": { code: "033780", market: "KS" },
  "한미반도체": { code: "042700", market: "KS" },
  "hd현대일렉트릭": { code: "267260", market: "KS" },
  "현대일렉트릭": { code: "267260", market: "KS" },
  "hd현대중공업": { code: "329180", market: "KS" },
  "현대중공업": { code: "329180", market: "KS" },
  "두산에너빌리티": { code: "034020", market: "KS" },
  "hmm": { code: "011200", market: "KS" },
  "아모레퍼시픽": { code: "090430", market: "KS" },
  "코웨이": { code: "021240", market: "KS" },
  "카카오뱅크": { code: "323410", market: "KS" },
  "카카오페이": { code: "377300", market: "KS" },
  "포스코퓨처엠": { code: "003670", market: "KS" },
  "sk이노베이션": { code: "096770", market: "KS" },
  "sk": { code: "034730", market: "KS" },
  "lg": { code: "003550", market: "KS" },
  "에코프로비엠": { code: "247540", market: "KQ" },
  "에코프로": { code: "086520", market: "KQ" },
  "알테오젠": { code: "196170", market: "KQ" },
  "펄어비스": { code: "263750", market: "KQ" },
  "카카오게임즈": { code: "293490", market: "KQ" },
  "jyp": { code: "035900", market: "KQ" },
  "에스엠": { code: "041510", market: "KQ" },
  "sm": { code: "041510", market: "KQ" },
  "위메이드": { code: "112040", market: "KQ" },
  "hpsp": { code: "403870", market: "KQ" },
  "리노공업": { code: "058470", market: "KQ" },
  "루닛": { code: "328130", market: "KQ" },
  "주성엔지니어링": { code: "036930", market: "KQ" },
  "주성": { code: "036930", market: "KQ" },
  "f&f": { code: "383220", market: "KQ" },
  "솔브레인": { code: "357780", market: "KQ" },
  "아프리카tv": { code: "067160", market: "KQ" },
  "숲": { code: "067160", market: "KQ" },
  "soop": { code: "067160", market: "KQ" },
  "휴젤": { code: "145020", market: "KQ" },
  "파두": { code: "440110", market: "KQ" },
  "fadu": { code: "440110", market: "KQ" },
  // v9.23: 추가 한국 주식
  "동원시스템즈": { code: "014820", market: "KS" },
  "동원": { code: "014820", market: "KS" },
  "동원f&b": { code: "049770", market: "KS" },
  "동원산업": { code: "006040", market: "KS" },
  "cj제일제당": { code: "097950", market: "KS" },
  "cj": { code: "001040", market: "KS" },
  "오리온": { code: "271560", market: "KS" },
  "농심": { code: "004370", market: "KS" },
  "롯데": { code: "004990", market: "KS" },
  "gs": { code: "078930", market: "KS" },
  "한온시스템": { code: "018880", market: "KS" },
  "만도": { code: "204320", market: "KS" },
  "s-oil": { code: "010950", market: "KS" },
  "에쓰오일": { code: "010950", market: "KS" },
  "hd현대": { code: "267250", market: "KS" },
  "sk바이오팜": { code: "326030", market: "KS" },
  "유한양행": { code: "000100", market: "KS" },
  "녹십자": { code: "006280", market: "KS" },
  "한미약품": { code: "128940", market: "KS" },
  "db하이텍": { code: "000990", market: "KS" },
  "이수페타시스": { code: "007660", market: "KS" },
  "파크시스템스": { code: "140860", market: "KQ" },
  "레인보우로보틱스": { code: "277810", market: "KQ" },
  "씨에스윈드": { code: "112610", market: "KS" },
  "삼성sds": { code: "018260", market: "KS" },
}

function resolveKrTicker(input: string): string | null {
  const normalized = input.replace(/\s/g, "").toLowerCase()
  const match = krDirectMap[normalized]
  if (match) return match.code
  for (const [key, val] of Object.entries(krDirectMap)) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return val.code
    }
  }
  return null
}

interface HeaderSearchModalProps {
  isOpen: boolean
  onClose: () => void
}

export function HeaderSearchModal({ isOpen, onClose }: HeaderSearchModalProps) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
      const timer = setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.setSelectionRange(
          inputRef.current.value.length,
          inputRef.current.value.length
        )
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    if (isOpen) {
      document.addEventListener("keydown", handleEsc)
      document.body.style.overflow = "hidden"
    }
    return () => {
      document.removeEventListener("keydown", handleEsc)
      document.body.style.overflow = ""
    }
  }, [isOpen, onClose])

  const searchStocks = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 1) {
      setResults([])
      return
    }

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
        isKorean: false,
      }))

    if (koreanMatches.length > 0) {
      setResults(koreanMatches.slice(0, 5))
    }

    setIsSearching(true)
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
      const data = await response.json()
      
      if (data.results && data.results.length > 0) {
        const apiResults = data.results.filter(
          (r: SearchResult) => !koreanMatches.some(k => k.ticker === r.ticker)
        )
        setResults([...koreanMatches, ...apiResults].slice(0, 8))
      } else if (koreanMatches.length === 0) {
        setResults([])
      }
    } catch (error) {
      console.error("Search error:", error)
    } finally {
      setIsSearching(false)
    }
  }, [])

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    if (query.length >= 1) {
      searchTimeoutRef.current = setTimeout(() => {
        searchStocks(query)
      }, 300)
    } else {
      setResults([])
    }
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [query, searchStocks])

  const handleSelectStock = (ticker: string) => {
    onClose()
    setQuery("")
    setResults([])
    router.push(`/stock/${ticker}`)
  }

  // ═══════════════════════════════════════════════════════════════
  // 폼 제출 (엔터 키) - 한국/미국 모두 올바른 URL로 이동
  // ═══════════════════════════════════════════════════════════════
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // 1. 검색 결과에서 화살표로 선택한 항목
    if (selectedIndex >= 0 && results[selectedIndex]) {
      handleSelectStock(results[selectedIndex].ticker)
      return
    }

    if (!query.trim()) return

    // 2. 검색 결과가 있으면 첫 번째 결과로 (가장 자연스러운 UX)
    if (results.length > 0) {
      handleSelectStock(results[0].ticker)
      return
    }

    // 3. 한국 주식 한글 → 종목코드 변환
    const krTicker = resolveKrTicker(query.trim())
    if (krTicker) {
      handleSelectStock(krTicker)
      return
    }

    // 4. 미국 주식 한글 매핑
    const mappedTicker = koreanStockMap[query.trim()]
    if (mappedTicker) {
      handleSelectStock(mappedTicker)
      return
    }

    // 5. 6자리 숫자 → 한국 주식 종목코드
    const trimmed = query.trim()
    if (/^\d{6}$/.test(trimmed)) {
      handleSelectStock(trimmed)
      return
    }

    // 5.5 v9.23: 부분일치 — koreanStockMap에서 포함 검색
    const normalizedQ = query.trim().toLowerCase().replace(/\s/g, '')
    for (const [korean, ticker] of Object.entries(koreanStockMap)) {
      const normalizedK = korean.toLowerCase().replace(/\s/g, '')
      if (normalizedK.includes(normalizedQ) || normalizedQ.includes(normalizedK)) {
        handleSelectStock(ticker)
        return
      }
    }

    // 6. 영문 티커로 바로 이동
    handleSelectStock(query.toUpperCase().trim())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return
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
          handleSelectStock(results[selectedIndex].ticker)
        }
        break
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-lg mx-auto mt-16 px-4">
        <div className="bg-background rounded-2xl shadow-2xl overflow-hidden">
          <form onSubmit={handleSubmit} className="relative">
            <div className="flex items-center border-b px-4">
              <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <Input
                ref={inputRef}
                type="text"
                inputMode="search"
                enterKeyHint="search"
                placeholder="종목명 또는 티커 검색"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setSelectedIndex(-1)
                }}
                onKeyDown={handleKeyDown}
                autoComplete="off"
                autoFocus
                className="flex-1 border-0 focus-visible:ring-0 text-base h-14"
              />
              {isSearching && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="ml-2"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </form>

          {results.length > 0 && (
            <div className="max-h-80 overflow-y-auto">
              {results.map((result, index) => (
                <button
                  key={`${result.ticker}-${index}`}
                  type="button"
                  onClick={() => handleSelectStock(result.ticker)}
                  className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-muted/50 transition-colors ${
                    index === selectedIndex ? "bg-muted/50" : ""
                  }`}
                >
                  <div>
                    {result.isKorean ? (
                      <>
                        <span className="font-semibold text-primary">{result.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{result.stockCode}</span>
                      </>
                    ) : (
                      <>
                        <span className="font-semibold text-primary">{result.ticker}</span>
                        <span className="ml-2 text-foreground">{result.name}</span>
                      </>
                    )}
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    result.isKorean 
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" 
                      : "text-muted-foreground"
                  }`}>
                    {result.isKorean 
                      ? (result.exchange === "KOSPI" ? "코스피" : "코스닥") 
                      : result.exchange
                    }
                  </span>
                </button>
              ))}
            </div>
          )}

          {query.length >= 2 && results.length === 0 && !isSearching && (
            <div className="p-4 text-center text-muted-foreground text-sm">
              검색 결과가 없어요
            </div>
          )}

          {query.length === 0 && (
            <div className="p-4 text-center text-muted-foreground text-sm">
              미국·한국 종목명 또는 티커를 입력하세요
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
