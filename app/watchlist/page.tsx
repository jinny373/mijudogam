"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Heart, Pencil, X, Loader2, ChevronRight, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { getWatchlist, removeFromWatchlist, logWatchlistEvent, WatchlistItem } from "@/lib/watchlist"

const statusDots: Record<string, string> = {
  green: "🟢",
  yellow: "🟡",
  red: "🔴",
}

// 안전하게 문자열로 변환 (객체면 빈 문자열 반환)
const safeRender = (value: any): string => {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  if (typeof value === "number") return String(value)
  if (typeof value === "boolean") return String(value)
  // 객체나 배열이면 빈 문자열
  return ""
}

export default function WatchlistPage() {
  const router = useRouter()
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [stockData, setStockData] = useState<Record<string, any>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isEditMode, setIsEditMode] = useState(false)

  // 관심 종목 불러오기
  useEffect(() => {
    logWatchlistEvent("watchlist_view")
    setWatchlist(getWatchlist())
  }, [])

  // 종목 데이터 불러오기
  useEffect(() => {
    const fetchData = async () => {
      if (watchlist.length === 0) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      const data: Record<string, any> = {}

      await Promise.all(
        watchlist.map(async (item) => {
          try {
            const res = await fetch(`/api/stock/${item.ticker}`)
            if (res.ok) {
              const json = await res.json()
              data[item.ticker] = json
            }
          } catch (e) {
            console.error(`Error fetching ${item.ticker}:`, e)
          }
        })
      )

      setStockData(data)
      setIsLoading(false)
    }

    fetchData()
  }, [watchlist])

  // 관심 종목 제거
  const handleRemove = (ticker: string) => {
    removeFromWatchlist(ticker)
    setWatchlist(getWatchlist())
  }

  // 종목 클릭
  const handleStockClick = (ticker: string) => {
    if (isEditMode) return
    logWatchlistEvent("watchlist_click", { ticker })
    router.push(`/stock/${ticker}`)
  }

  // 지표 가져오기
  const getMetric = (ticker: string, metricId: string) => {
    const data = stockData[ticker]
    if (!data || !data.metrics) return null
    return data.metrics.find((m: any) => m.id === metricId)
  }

  // 지표 정보
  const metricInfo = [
    { id: "earning", emoji: "💰", name: "수익성" },
    { id: "debt", emoji: "🏦", name: "안정성" },
    { id: "growth", emoji: "🚀", name: "성장성" },
    { id: "valuation", emoji: "💎", name: "가치" },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header with Search */}
      <header className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="flex-shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          {/* 검색바 */}
          <div 
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-full bg-muted/50 border cursor-pointer hover:bg-muted transition-colors"
            onClick={() => router.push('/?focus=search')}
          >
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">종목 검색...</span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 text-red-500 text-sm font-medium">
              <Heart className="h-4 w-4 fill-current" />
              <span>{watchlist.length}</span>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setIsEditMode(!isEditMode)}
              className={isEditMode ? "text-primary" : ""}
            >
              {isEditMode ? <X className="h-5 w-5" /> : <Pencil className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 max-w-2xl mx-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : watchlist.length === 0 ? (
          <Card className="p-8 text-center">
            <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">관심 종목이 없어요</h2>
            <p className="text-muted-foreground text-sm mb-4">
              종목 페이지에서 하트를 눌러 추가해보세요
            </p>
            <Button onClick={() => router.push("/")}>종목 검색하기</Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* 범례 */}
            <div className="flex items-center justify-end gap-3 text-xs text-muted-foreground">
              <span>🟢 좋음</span>
              <span>🟡 보통</span>
              <span>🔴 주의</span>
            </div>

            {/* 종목 카드들 */}
            {watchlist.map((item) => {
              const data = stockData[item.ticker]
              
              // 안전하게 문자열 추출
              const stockName = safeRender(data?.name) || safeRender(item.name) || item.ticker
              const aiSummary = safeRender(data?.aiSummary)

              return (
                <div key={item.ticker} className="relative">
                  {/* 편집 모드: 삭제 버튼 */}
                  {isEditMode && (
                    <button
                      onClick={() => handleRemove(item.ticker)}
                      className="absolute -left-2 -top-2 z-10 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}

                  <Card
                    className={`p-4 transition-all ${
                      isEditMode 
                        ? "border-dashed border-2 border-muted-foreground/30" 
                        : "cursor-pointer hover:bg-muted/50"
                    }`}
                    onClick={() => handleStockClick(item.ticker)}
                  >
                    {/* 종목 헤더 */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary">{item.ticker}</span>
                        <span className="text-sm text-foreground">{stockName}</span>
                      </div>
                      {!isEditMode && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>

                    {/* 한 줄 요약 */}
                    {aiSummary && (
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-1">
                        {aiSummary}
                      </p>
                    )}

                    {/* 지표 그리드 */}
                    <div className="grid grid-cols-2 gap-2">
                      {metricInfo.map((info) => {
                        const metric = getMetric(item.ticker, info.id)
                        const status = safeRender(metric?.status) || "yellow"
                        const summary = safeRender(metric?.summary) || "-"

                        return (
                          <div 
                            key={info.id}
                            className="flex items-center gap-2 p-2 rounded-lg bg-muted/30"
                          >
                            <span className="text-lg">{info.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <span className="text-xs font-medium text-foreground">
                                  {info.name}
                                </span>
                                <span>{statusDots[status] || "➖"}</span>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {summary}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </Card>
                </div>
              )
            })}

            {/* 편집 모드 안내 */}
            {isEditMode && (
              <p className="text-center text-xs text-muted-foreground mt-4">
                ❌ 버튼을 눌러 종목을 제거할 수 있어요
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
