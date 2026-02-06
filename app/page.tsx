"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Image from "next/image"
import { StockSearchForm } from "@/components/stock-search-form"

function HomeContent() {
  const searchParams = useSearchParams()
  const shouldFocusSearch = searchParams.get("focus") === "search"

  return (
    <main className="min-h-screen bg-background flex flex-col pb-16">
      {/* Header - 로고 사이즈 축소 */}
      <header className="w-full px-4 py-3 sm:px-6">
        <div className="flex items-center justify-center">
          <h1 className="text-xl font-bold text-primary">미주도감</h1>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8 -mt-12">
        {/* Cat Researcher Illustration - 사이즈 축소 */}
        <div className="mb-4">
          <div className="relative w-36 h-36 sm:w-44 sm:h-44">
            <Image
              src="/cat-researcher.png"
              alt="귀여운 고양이 연구원"
              fill
              className="object-contain rounded-2xl"
              priority
            />
          </div>
        </div>

        {/* Text Content - 간격 축소 */}
        <div className="text-center mb-6 space-y-1">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground text-balance">
            어떤 주식이 궁금하세요?
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base">
            재무제표를 쉽게 해석해드릴게요
          </p>
        </div>

        {/* Search Form - autoFocus prop 전달 */}
        <StockSearchForm autoFocus={shouldFocusSearch} />
      </div>
    </main>
  )
}

export default function Home() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="text-xl font-bold text-primary">미주도감</div>
      </main>
    }>
      <HomeContent />
    </Suspense>
  )
}
