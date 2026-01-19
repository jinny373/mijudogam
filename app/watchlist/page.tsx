"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Heart, Pencil, X, Loader2, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { getWatchlist, removeFromWatchlist, logWatchlistEvent, WatchlistItem } from "@/lib/watchlist"

const statusDots: Record<string, string> = {
  green: "🟢",
  yellow: "🟡",
  red: "🔴",
}

interface StockData {
  ticker: string
  name: string
  price: number
  change: number
  changePercent: number
  aiSummary: string
  metrics: {
    id: string
    title: string
    status: string
    statusText: string
    mainValue: string
    mainLabel: string
    summary: string
  }[]
}

export default function WatchlistPage() {
  const router = useRouter()
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [stockData, setStockData] = useState<Record<string, StockData>>({})
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
      const data: Record<string, StockData> = {}

      await Promise.all(
        watchlist.map(async (item) => {
          try {
            const res = await fetch(`/api/stock/${item.ticker}`)
            if (res.ok) {
              const json = await res.json()
              data[item.ticker] = json
            }
          } catch {
            // 에러 무시
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
    if (!data) return null
    return data.metrics?.find((m) => m.id === metricId)
  }

  // 지표 정보
  const metricInfo = [
    { id: "earning", emoji: "💰", name: "수익성", desc: "돈 버는 능력" },
    { id: "debt", emoji: "🏦", name: "안정성", desc: "빚 관리" },
    { id: "growth", emoji: "🚀", name: "성장성", desc: "성장 가능성" },
    { id: "valuation", emoji: "💎", name: "가치", desc: "현재 몸값" },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500 fill-red-500" />
            관심 종목 ({watchlist.length})
          </h1>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setIsEditMode(!isEditMode)}
            className={isEditMode ? "text-primary" : ""}
          >
            {isEditMode ? <X className="h-5 w-5" /> : <Pencil className="h-5 w-5" />}
          </Button>
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

              return (
                <div key={item.ticker} className="relative">
                  {/* 편집 모드: 삭제 버튼 (카드 바깥) */}
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
                        <span className="text-sm text-foreground">{item.name}</span>
                      </div>
                      {!isEditMode && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>

                    {/* 한 줄 요약 */}
                    {data?.aiSummary && (
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-1">
                        {data.aiSummary}
                      </p>
                    )}

                    {/* 지표 그리드 */}
                    <div className="grid grid-cols-2 gap-2">
                      {metricInfo.map((info) => {
                        const metric = getMetric(item.ticker, info.id)
                        const status = metric?.status || "yellow"
                        // summary 사용 (핵심체크 문장)
                        const summaryText = metric?.summary || "-"

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
                                {summaryText}
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
