import Image from "next/image"
import Link from "next/link"
import { Heart } from "lucide-react"
import { StockSearchForm } from "@/components/stock-search-form"

export default function Home() {
  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="w-full px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">미주도감</h1>
          <Link 
            href="/watchlist"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition-colors text-sm font-medium"
          >
            <Heart className="h-4 w-4 fill-current" />
            <span>관심 종목</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8 -mt-8">
        {/* Cat Researcher Illustration */}
        <div className="mb-6">
          <div className="relative w-48 h-48 sm:w-56 sm:h-56">
            <Image
              src="/cat-researcher.jpg"
              alt="귀여운 고양이 연구원"
              fill
              className="object-contain rounded-2xl"
              priority
            />
          </div>
        </div>

        {/* Text Content */}
        <div className="text-center mb-8 space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-balance">
            어떤 미국주식이 궁금한가요?
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg">
            재무제표를 쉽게 해석해드릴게요
          </p>
        </div>

        {/* Search Form */}
        <StockSearchForm />
      </div>
    </main>
  )
}
