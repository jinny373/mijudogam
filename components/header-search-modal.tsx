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
}

// 한글 매핑 (stock-search-form.tsx와 동일)
const koreanStockMap: Record<string, string> = {
  "엔비디아": "NVDA", "애플": "AAPL", "테슬라": "TSLA", "마이크로소프트": "MSFT",
  "구글": "GOOGL", "알파벳": "GOOGL", "아마존": "AMZN", "메타": "META",
  "넷플릭스": "NFLX", "인텔": "INTC", "에이엠디": "AMD", "AMD": "AMD",
  "퀄컴": "QCOM", "브로드컴": "AVGO", "마이크론": "MU", "팔란티어": "PLTR",
  "코인베이스": "COIN", "마이크로스트래티지": "MSTR", "아이온큐": "IONQ",
  "리게티": "RGTI", "디웨이브": "QBTS", "뉴스케일": "SMR", "오클로": "OKLO",
  "컨스털레이션": "CEG", "비스트라": "VST", "오라클": "ORCL", "세일즈포스": "CRM",
  "스노우플레이크": "SNOW", "데이터독": "DDOG", "슈퍼마이크로": "SMCI",
  "버티브": "VRT", "이튼": "ETN", "아스테라랩스": "ALAB", "마벨": "MRVL",
  "크리도": "CRDO", "코히런트": "COHR", "코닝": "GLW", "이노데이터": "INOD",
  "템퍼스": "TEM", "비트팜스": "BITF", "사이퍼마이닝": "CIFR", "레드와이어": "RDW",
  "온다스": "ONDS", "마라톤": "MARA", "라이엇": "RIOT", "로켓랩": "RKLB",
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

  // 모달 열릴 때 즉시 포커스 (모바일 키보드 트리거)
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // 모바일에서 키보드가 확실히 올라오도록 즉시 포커스
      inputRef.current.focus()
      // iOS Safari 대응: 약간의 딜레이 후 다시 포커스
      const timer = setTimeout(() => {
        inputRef.current?.focus()
        // 커서를 끝으로 이동
        inputRef.current?.setSelectionRange(
          inputRef.current.value.length,
          inputRef.current.value.length
        )
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // ESC 키로 닫기
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

  // 검색 API 호출
  const searchStocks = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 1) {
      setResults([])
      return
    }

    // 한글 매핑 체크
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
    }

    setIsSearching(true)
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
      const data = await response.json()
      
      if (data.results && data.results.length > 0) {
        const apiResults = data.results.filter(
          (r: SearchResult) => !koreanMatches.some(k => k.ticker === r.ticker)
        )
        setResults([...koreanMatches, ...apiResults].slice(0, 6))
      } else if (koreanMatches.length === 0) {
        setResults([])
      }
    } catch (error) {
      console.error("Search error:", error)
    } finally {
      setIsSearching(false)
    }
  }, [])

  // 디바운스 검색
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

  // 종목 선택
  const handleSelectStock = (ticker: string) => {
    onClose()
    setQuery("")
    setResults([])
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

    // 영문 티커로 바로 이동
    handleSelectStock(query.toUpperCase().trim())
  }

  // 키보드 네비게이션
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
      {/* 배경 오버레이 */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 검색 모달 */}
      <div className="relative w-full max-w-lg mx-auto mt-16 px-4">
        <div className="bg-background rounded-2xl shadow-2xl overflow-hidden">
          {/* 검색 입력 */}
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

          {/* 검색 결과 */}
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
                    <span className="font-semibold text-primary">{result.ticker}</span>
                    <span className="ml-2 text-foreground">{result.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{result.exchange}</span>
                </button>
              ))}
            </div>
          )}

          {/* 검색 결과 없을 때 */}
          {query.length >= 2 && results.length === 0 && !isSearching && (
            <div className="p-4 text-center text-muted-foreground text-sm">
              검색 결과가 없어요
            </div>
          )}

          {/* 안내 문구 */}
          {query.length === 0 && (
            <div className="p-4 text-center text-muted-foreground text-sm">
              종목명(한글/영문) 또는 티커를 입력하세요
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
