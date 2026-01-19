"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

const statusStyles = {
  green: { badge: "bg-[#22C55E]/10 text-[#22C55E]", bar: "bg-[#22C55E]", dot: "🟢" },
  yellow: { badge: "bg-[#EAB308]/10 text-[#EAB308]", bar: "bg-[#EAB308]", dot: "🟡" },
  red: { badge: "bg-[#EF4444]/10 text-[#EF4444]", bar: "bg-[#EF4444]", dot: "🔴" },
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <Skeleton className="h-8 w-24" />
        </div>
      </header>
      <main className="px-4 py-6 max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </main>
    </div>
  )
}

function ErrorState({ message, ticker }: { message: string; ticker: string }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <Link href={`/stock/${ticker}`}>
            <Button variant="ghost" size="sm" className="rounded-full gap-1 pl-2">
              <ArrowLeft className="h-4 w-4" />
              <span>뒤로가기</span>
            </Button>
          </Link>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground text-lg">{message}</p>
          <Link href={`/stock/${ticker}`}>
            <Button variant="outline">종목 페이지로 돌아가기</Button>
          </Link>
        </div>
      </main>
    </div>
  )
}

export default function MetricDetailPage() {
  const params = useParams()
  const ticker = params.ticker as string
  const metricId = params.metricId as string

  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch(`/api/stock/${ticker}/metric/${metricId}`)
        const result = await response.json()

        if (!response.ok) {
          setError(result.error || "데이터를 찾을 수 없어요")
          return
        }

        setData(result)
      } catch (err) {
        console.error("Error:", err)
        setError("데이터를 불러오는 중 오류가 발생했어요")
      } finally {
        setIsLoading(false)
      }
    }

    if (ticker && metricId) {
      fetchData()
    }
  }, [ticker, metricId])

  if (isLoading) return <LoadingSkeleton />
  if (error) return <ErrorState message={error} ticker={ticker} />
  if (!data) return <ErrorState message="데이터를 찾을 수 없어요" ticker={ticker} />

  const styles = statusStyles[data.statusColor as keyof typeof statusStyles] || statusStyles.yellow

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <Link href={`/stock/${ticker}`}>
            <Button variant="ghost" size="sm" className="rounded-full gap-1 pl-2">
              <ArrowLeft className="h-4 w-4" />
              <span>{data.stockName}</span>
            </Button>
          </Link>
        </div>
      </header>

      <main className="px-4 py-6 max-w-2xl mx-auto space-y-6">
        {/* Title with Status */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <span>{data.emoji}</span>
            <span>{data.title}</span>
          </h1>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles.badge}`}>
            {styles.dot} {data.status}
          </span>
        </div>

        {/* Summary */}
        <Card className="p-4 rounded-xl border shadow-sm">
          <h2 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1">
            📌 한줄 요약
          </h2>
          <p className="text-foreground font-medium">{data.summary}</p>
        </Card>

        {/* Key Metrics */}
        <section>
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-1">
            📊 핵심 숫자
          </h2>
          <div className="space-y-3">
            {data.metrics?.map((metric: any, i: number) => {
              const metricStyles = statusStyles[metric.status as keyof typeof statusStyles] || statusStyles.yellow
              
              return (
                <Card key={i} className="p-4 rounded-xl border shadow-sm">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="text-sm font-medium text-foreground">{metric.name}</h3>
                    <span className={`text-lg font-bold ${metricStyles.bar.replace("bg-", "text-")}`}>
                      {metric.value} {metricStyles.dot}
                    </span>
                  </div>
                  {metric.description && (
                    <p className="text-xs text-muted-foreground mb-2">{metric.description}</p>
                  )}
                  <div className="flex flex-col gap-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{metric.benchmark || metric.average}</span>
                      <span className="text-foreground font-medium">{metric.interpretation}</span>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </section>

        {/* Why Important */}
        <section>
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-1">
            💡 이게 왜 중요해?
          </h2>
          <Card className="p-4 rounded-xl border shadow-sm">
            <ul className="space-y-3">
              {data.whyImportant?.map((item: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        {/* Caution Section */}
        {data.caution && (
          <section>
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-1">
              ⚠️ 주의할 점
            </h2>
            <Card className="p-4 rounded-xl border border-[#EAB308]/30 bg-[#EAB308]/5 shadow-sm">
              <ul className="space-y-3">
                {data.caution.map((item: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="text-[#EAB308] mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        )}

        {/* Decision Point Section */}
        {data.decisionPoint && (
          <section>
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-1">
              🤔 판단 포인트
            </h2>
            <Card className="p-4 rounded-xl border shadow-sm">
              <ul className="space-y-3">
                {data.decisionPoint.map((item: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        )}
      </main>
    </div>
  )
}
