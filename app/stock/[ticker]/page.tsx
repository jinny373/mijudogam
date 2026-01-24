"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Share2, ThumbsUp, ThumbsDown, TrendingUp, Landmark, Rocket, Gem, ChevronRight, Heart, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { isInWatchlist, toggleWatchlist, logWatchlistEvent } from "@/lib/watchlist"

// 최근 본 종목 저장 (localStorage)
const RECENT_STOCKS_KEY = "mijudogam_recent_stocks"
const MAX_RECENT_STOCKS = 5

const saveRecentStock = (ticker: string, name: string) => {
  if (typeof window === "undefined") return
  try {
    const stored = localStorage.getItem(RECENT_STOCKS_KEY)
    const recent = stored ? JSON.parse(stored) : []
    const filtered = recent.filter((s: any) => s.ticker !== ticker)
    const updated = [{ ticker, name, viewedAt: Date.now() }, ...filtered].slice(0, MAX_RECENT_STOCKS)
    localStorage.setItem(RECENT_STOCKS_KEY, JSON.stringify(updated))
  } catch {
    // localStorage 에러 무시
  }
}

const iconMap: Record<string, any> = {
  earning: TrendingUp,
  debt: Landmark,
  growth: Rocket,
  valuation: Gem,
}

const statusColors = {
  green: { bg: "bg-[#22C55E]", text: "text-[#22C55E]", light: "bg-[#22C55E]/10" },
  yellow: { bg: "bg-[#EAB308]", text: "text-[#EAB308]", light: "bg-[#EAB308]/10" },
  red: { bg: "bg-[#EF4444]", text: "text-[#EF4444]", light: "bg-[#EF4444]/10" },
}

// ===== v9.20: 한국 주식 키워드 =====
const koreanStockKeywords = [
  '삼성', '하이닉스', '현대', 'LG', '네이버', '카카오',
  '셀트리온', '삼바', 'SK', '포스코', '한화', '두산',
  '고려아연', '동성케미컬', '한올', '에스피지', '기아',
  '엔씨소프트', '크래프톤', '넥슨', '펄어비스', '카카오게임즈',
  '쿠팡', '배달의민족', '토스', '야놀자', '직방',
  '신한', '국민은행', 'KB', '우리은행', '하나은행'
]

const isKoreanStock = (query: string): boolean => {
  const decoded = decodeURIComponent(query)
  return koreanStockKeywords.some(keyword =>
    decoded.toLowerCase().includes(keyword.toLowerCase())
  )
}

// ===== v9.20: 유사 종목 추천용 매핑 =====
const suggestionsMap: Record<string, { ticker: string; name: string }[]> = {
  // 검색 실패가 많았던 종목들
  "앱러빈": [{ ticker: "APP", name: "앱러빈" }],
  "알리바바": [{ ticker: "BABA", name: "알리바바" }],
  "샌디스크": [{ ticker: "SNDK", name: "샌디스크" }],
  "비트마인": [{ ticker: "BMNR", name: "비트마인이머션테크놀로지스" }],
  "비트": [{ ticker: "BMNR", name: "비트마인이머션테크놀로지스" }],
  "나비타스": [{ ticker: "NVTS", name: "나비타스세미컨덕터" }],
  "나비": [{ ticker: "NVTS", name: "나비타스세미컨덕터" }],
  "네비우스": [{ ticker: "NBIS", name: "네비우스그룹" }],
  "레드캣": [{ ticker: "RCAT", name: "레드캣홀딩스" }],
  "업스타트": [{ ticker: "UPST", name: "업스타트홀딩스" }],
  "셰니어": [{ ticker: "LNG", name: "셰니어에너지" }],
  "쉐니어": [{ ticker: "LNG", name: "셰니어에너지" }],
  "코크리스털": [{ ticker: "COCP", name: "코크리스털파마" }],
  "코크": [{ ticker: "COCP", name: "코크리스털파마" }],
  "보이저": [{ ticker: "VOYG", name: "보이저테크놀로지스" }],
  "써클": [{ ticker: "CRCL", name: "써클인터넷그룹" }],
  "뉴스케일": [{ ticker: "SMR", name: "뉴스케일파워" }],
  "팔란티어": [{ ticker: "PLTR", name: "팔란티어" }],
  "팔란이오": [{ ticker: "PLTR", name: "팔란티어" }],  // 오타 대응
  "로켓": [{ ticker: "RKLB", name: "로켓랩" }],
  "로켓램": [{ ticker: "RKLB", name: "로켓랩" }],  // 오타 대응
  "리게티": [{ ticker: "RGTI", name: "리게티컴퓨팅" }],
  "리겟티": [{ ticker: "RGTI", name: "리게티컴퓨팅" }],
  "캐터필": [{ ticker: "CAT", name: "캐터필러" }],
  "노던": [{ ticker: "NOG", name: "노던오일앤가스" }, { ticker: "NTRS", name: "노던트러스트" }],
}

// 유사 종목 찾기
const findSuggestions = (query: string): { ticker: string; name: string }[] => {
  const decoded = decodeURIComponent(query).toLowerCase()
  
  for (const [keyword, suggestions] of Object.entries(suggestionsMap)) {
    if (decoded.includes(keyword.toLowerCase()) || keyword.toLowerCase().includes(decoded)) {
      return suggestions
    }
  }
  
  return []
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </header>
      <main className="px-4 py-6 max-w-2xl mx-auto space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-28" />
        </div>
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      </main>
    </div>
  )
}

// ===== v9.20: ErrorState 개선 =====
function ErrorState({ message, ticker }: { message: string; ticker?: string }) {
  const router = useRouter()
  
  // URL 인코딩된 한글 디코딩
  const decodedTicker = ticker ? decodeURIComponent(ticker) : null
  
  // v9.20: 한국 주식 여부 체크
  const isKorean = decodedTicker ? isKoreanStock(decodedTicker) : false
  
  // v9.20: 유사 종목 추천
  const suggestions = decodedTicker ? findSuggestions(decodedTicker) : []
  
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">뒤로가기</span>
            </Button>
          </Link>
          <span className="text-lg font-bold text-primary">미주도감</span>
          <div className="w-10" />
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="text-center space-y-4 max-w-sm w-full">
          <div className="text-4xl">😅</div>
          <p className="text-foreground text-lg font-medium">
            {decodedTicker ? `"${decodedTicker}" 종목을 찾을 수 없어요` : "종목을 찾을 수 없어요"}
          </p>
          
          {/* v9.20: 한국 주식 검색 시 안내 */}
          {isKorean && (
            <div className="bg-orange-50 dark:bg-orange-950 rounded-xl p-4 text-left">
              <p className="text-sm font-medium text-orange-600 dark:text-orange-400 flex items-center gap-2">
                ⚠️ 미주도감은 <strong>미국 주식</strong>만 지원해요
              </p>
              <p className="text-xs text-orange-500 mt-2">
                한국 주식은 네이버 증권, 키움증권 등을 이용해주세요
              </p>
            </div>
          )}
          
          {/* v9.20: 유사 종목 추천 */}
          {!isKorean && suggestions.length > 0 && (
            <div className="bg-primary/5 rounded-xl p-4 text-left">
              <p className="text-sm font-medium text-foreground flex items-center gap-2 mb-3">
                <Search className="h-4 w-4" />
                이 종목을 찾으셨나요?
              </p>
              <div className="space-y-2">
                {suggestions.map((stock) => (
                  <button
                    key={stock.ticker}
                    onClick={() => router.push(`/stock/${stock.ticker}`)}
                    className="w-full px-4 py-3 bg-background rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors text-left flex items-center justify-between"
                  >
                    <div>
                      <span className="font-semibold text-primary">{stock.ticker}</span>
                      <span className="ml-2 text-muted-foreground">{stock.name}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* 기본 안내 (한국 주식도 아니고 유사 종목도 없을 때) */}
          {!isKorean && suggestions.length === 0 && (
            <div className="bg-muted/50 rounded-xl p-4 text-left space-y-2">
              <p className="text-sm font-medium text-foreground">💡 이렇게 검색해보세요</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 티커: <span className="text-foreground font-medium">NVDA, TSLA, MSFT</span></li>
                <li>• 영문명: <span className="text-foreground font-medium">Nvidia, Tesla, Microsoft</span></li>
              </ul>
            </div>
          )}
          
          <Link href="/">
            <Button className="w-full">다시 검색하기</Button>
          </Link>
        </div>
      </main>
    </div>
  )
}

export default function StockDetailPage() {
  const params = useParams()
  const ticker = params.ticker as string
  
  const [stockData, setStockData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null)
  const [isWatchlisted, setIsWatchlisted] = useState(false)

  // 관심종목 여부 확인
  useEffect(() => {
    setIsWatchlisted(isInWatchlist(ticker))
  }, [ticker])

  // 관심종목 토글
  const handleToggleWatchlist = () => {
    if (!stockData) return
    const result = toggleWatchlist(stockData.ticker, stockData.name)
    setIsWatchlisted(result)
  }

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true)
        setError(null)
        
        // API Route 호출
        const response = await fetch(`/api/stock/${ticker}`)
        const data = await response.json()
        
        if (!response.ok) {
          setError(data.error || "데이터를 찾을 수 없어요")
          return
        }
        
        setStockData(data)
        
        // 최근 본 종목에 저장
        if (data.name && data.ticker) {
          saveRecentStock(data.ticker, data.name)
        }
      } catch (err) {
        console.error("Error:", err)
        setError("데이터를 불러오는 중 오류가 발생했어요")
      } finally {
        setIsLoading(false)
      }
    }

    if (ticker) {
      fetchData()
    }
  }, [ticker])

  const handleShare = async () => {
    if (stockData && navigator.share) {
      await navigator.share({
        title: `${stockData.name} (${stockData.ticker}) - 미주도감`,
        url: window.location.href,
      })
    } else {
      await navigator.clipboard.writeText(window.location.href)
      alert("링크가 복사되었습니다!")
    }
  }

  if (isLoading) return <LoadingSkeleton />
  if (error) return <ErrorState message={error} ticker={ticker} />
  if (!stockData) return <ErrorState message="데이터를 찾을 수 없어요" ticker={ticker} />

  const isPositive = stockData.change >= 0

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">뒤로가기</span>
            </Button>
          </Link>
          <span className="text-lg font-bold text-primary">미주도감</span>
          <div className="flex items-center gap-2">
            <Link 
              href="/watchlist"
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition-colors text-xs font-medium"
            >
              <Heart className="h-3.5 w-3.5 fill-current" />
              <span>관심 종목</span>
            </Link>
            <Button variant="ghost" size="icon" className="rounded-full" onClick={handleShare}>
              <Share2 className="h-5 w-5" />
              <span className="sr-only">공유하기</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 max-w-2xl mx-auto space-y-6">
        {/* Stock Basic Info */}
        <section>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{stockData.name}</h1>
              <p className="text-muted-foreground">
                {stockData.ticker} · {stockData.exchange}
              </p>
            </div>
            <button
              onClick={handleToggleWatchlist}
              className={`p-2 rounded-full transition-colors ${
                isWatchlisted 
                  ? "text-red-500 bg-red-50 hover:bg-red-100" 
                  : "text-muted-foreground bg-muted hover:bg-muted/80"
              }`}
              title={isWatchlisted ? "관심목록에서 제거" : "관심목록에 추가"}
            >
              <Heart className={`h-6 w-6 ${isWatchlisted ? "fill-current" : ""}`} />
            </button>
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-3xl font-bold">${stockData.price?.toFixed(2)}</span>
            <span className={`text-lg font-semibold ${isPositive ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
              {isPositive ? "+" : ""}${stockData.change?.toFixed(2)} ({isPositive ? "+" : ""}{stockData.changePercent?.toFixed(2)}%)
            </span>
          </div>
        </section>

        {/* AI Summary Card */}
        <Card className="bg-primary p-5 rounded-2xl border-0 shadow-lg">
          <p className="text-primary-foreground/80 text-sm font-medium mb-1">📌 이 종목을 한마디로?</p>
          <p className="text-primary-foreground text-lg font-semibold leading-relaxed">
            {stockData.aiSummary}
          </p>
        </Card>

        {/* Pros and Cons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Pros */}
          <Card className="p-4 rounded-xl border shadow-sm">
            <h3 className="text-[#22C55E] font-semibold mb-3 flex items-center gap-2">
              <span className="text-base">✅ 좋은 점</span>
            </h3>
            <ul className="space-y-2">
              {stockData.pros?.map((pro: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="text-[#22C55E] mt-0.5">•</span>
                  <span>{pro}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Cons */}
          <Card className="p-4 rounded-xl border shadow-sm">
            <h3 className="text-[#EAB308] font-semibold mb-3 flex items-center gap-2">
              <span className="text-base">⚠️ 알고 갈 점</span>
            </h3>
            <ul className="space-y-2">
              {stockData.cons?.map((con: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="text-[#EAB308] mt-0.5">•</span>
                  <span>{con}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Key Metrics */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">📊 핵심 체크</h2>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#22C55E]"></span>
                좋음
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#EAB308]"></span>
                보통
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#EF4444]"></span>
                주의
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {stockData.metrics?.map((metric: any, i: number) => {
              const colors = statusColors[metric.status as keyof typeof statusColors] || statusColors.yellow
              const Icon = iconMap[metric.id] || TrendingUp
              
              return (
                <Link 
                  key={i} 
                  href={`/stock/${stockData.ticker}/metric/${metric.id}`}
                  onClick={() => logWatchlistEvent("metric_card_click", { 
                    ticker: stockData.ticker, 
                    metric_id: metric.id,
                    metric_title: metric.title 
                  })}
                >
                  <Card className="p-4 rounded-xl border shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
                    <div className="flex items-center justify-between mb-2">
                      <div className={`p-2 rounded-lg ${colors.light}`}>
                        <Icon className={`h-5 w-5 ${colors.text}`} />
                      </div>
                      <div className="flex items-center gap-1">
                        <div className={`w-3 h-3 rounded-full ${colors.bg}`} />
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                    <h4 className="font-semibold text-foreground text-sm">{metric.title}</h4>
                    <p className="text-muted-foreground text-xs mt-0.5 mb-3">{metric.summary}</p>
                    <div>
                      <span className="text-2xl font-bold text-foreground">{metric.mainValue}</span>
                      <span className="text-xs text-muted-foreground ml-1">{metric.mainLabel}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{metric.average}</p>
                  </Card>
                </Link>
              )
            })}
          </div>
        </section>

        {/* Feedback CTA */}
        <section className="pt-4 pb-8">
          <Card className="p-5 rounded-xl border shadow-sm text-center">
            <p className="text-foreground font-medium mb-4">이 분석이 도움이 됐나요?</p>
            <div className="flex justify-center gap-4">
              <Button
                variant={feedback === "up" ? "default" : "outline"}
                size="lg"
                className={`rounded-full px-6 ${feedback === "up" ? "bg-primary" : ""}`}
                onClick={() => {
                  setFeedback("up")
                  logWatchlistEvent("feedback_up", { ticker: stockData.ticker })
                }}
              >
                <ThumbsUp className="h-5 w-5 mr-2" />
                좋아요
              </Button>
              <Button
                variant={feedback === "down" ? "default" : "outline"}
                size="lg"
                className={`rounded-full px-6 ${feedback === "down" ? "bg-muted-foreground" : ""}`}
                onClick={() => {
                  setFeedback("down")
                  logWatchlistEvent("feedback_down", { ticker: stockData.ticker })
                }}
              >
                <ThumbsDown className="h-5 w-5 mr-2" />
                아쉬워요
              </Button>
            </div>
            {feedback && (
              <p className="text-sm text-muted-foreground mt-4">
                피드백 감사합니다!
              </p>
            )}
          </Card>
          
          {/* Data Source Notice - 강화된 면책 */}
          {stockData.dataSource && (
            <div className="text-center mt-4 space-y-1">
              <p className="text-xs text-muted-foreground">
                📊 {stockData.dataSource.provider} · {stockData.dataSource.lastUpdated}
              </p>
              <p className="text-xs text-muted-foreground">
                ⚠️ {stockData.dataSource.note}
              </p>
              {stockData.dataSource.disclaimer && (
                <p className="text-xs text-muted-foreground">
                  💡 {stockData.dataSource.disclaimer}
                </p>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
