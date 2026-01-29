"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Sparkles, ChevronRight, Search, Share2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { HeaderSearchModal } from "@/components/header-search-modal"

// ═══════════════════════════════════════════════════════════════
// 타입 정의
// ═══════════════════════════════════════════════════════════════

interface StockSignals {
  earning: "good" | "normal" | "bad";
  debt: "good" | "normal" | "bad";
  growth: "good" | "normal" | "bad";
  valuation: "good" | "normal" | "bad";
}

interface StockData {
  ticker: string;
  name: string;
  sector: string;
  signals: StockSignals;
  notGood?: string;
}

interface APIResponse {
  allGreen: StockData[];
  totalChecked: number;
  validCount: number;
  lastUpdated: string;
}

// ═══════════════════════════════════════════════════════════════
// 신호등 컴포넌트
// ═══════════════════════════════════════════════════════════════

function SignalDot({ status }: { status: "good" | "normal" | "bad" }) {
  const colors = {
    good: "bg-green-500",
    normal: "bg-yellow-500",
    bad: "bg-red-500",
  };
  return <div className={`w-3 h-3 rounded-full ${colors[status]}`} />;
}

function SignalRow({ signals }: { signals: StockSignals }) {
  return (
    <div className="flex items-center gap-1">
      <SignalDot status={signals.earning} />
      <SignalDot status={signals.debt} />
      <SignalDot status={signals.growth} />
      <SignalDot status={signals.valuation} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 메인 컴포넌트
// ═══════════════════════════════════════════════════════════════

export default function DiscoverPage() {
  const router = useRouter();
  const [data, setData] = useState<APIResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // 공유 기능
  const handleShare = async () => {
    const url = window.location.href;
    const title = "올그린 종목 발견 - 미주도감";
    
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch (e) {
        // 취소됨
      }
    } else {
      await navigator.clipboard.writeText(url);
      alert("링크가 복사되었어요!");
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/discover");
      if (!response.ok) throw new Error("데이터 로딩 실패");
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError("데이터를 불러오는 중 오류가 발생했어요");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState error={error} onRetry={fetchData} />;
  if (!data) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* 검색 모달 */}
      <HeaderSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* Header with Search */}
      <header className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-center gap-2 max-w-2xl mx-auto">
          <Button variant="ghost" size="icon" className="rounded-full flex-shrink-0" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          {/* 검색바 */}
          <div 
            className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded-full bg-muted/50 border cursor-pointer hover:bg-muted transition-colors"
            onClick={() => setIsSearchOpen(true)}
          >
            <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-muted-foreground truncate">종목 검색</span>
          </div>
          {/* 공유 버튼 */}
          <Button variant="ghost" size="icon" className="rounded-full flex-shrink-0" onClick={handleShare}>
            <Share2 className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-6">
        {/* 본문 제목 */}
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-yellow-500" />
          <h1 className="text-xl font-bold">올그린 종목</h1>
        </div>

        {/* 설명 */}
        <Card className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <p className="text-sm text-green-800">
            4가지 핵심 지표(돈버는능력, 빚관리, 성장가능성, 현재몸값)가 
            <span className="font-semibold"> 모두 "좋음"</span>인 종목이에요.
          </p>
        </Card>

        {/* 지표 범례 */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>돈버는능력</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>빚관리</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>성장가능성</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>현재몸값</span>
          </div>
        </div>

        {/* 올그린 종목 */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-bold text-lg">🟢🟢🟢🟢 올그린 종목</h3>
            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
              {data.allGreen.length}개
            </span>
          </div>

          {data.allGreen.length > 0 ? (
            <div className="space-y-2">
              {data.allGreen.map((stock) => (
                <StockCard key={stock.ticker} stock={stock} isAllGreen />
              ))}
            </div>
          ) : (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground">
                현재 올그린 조건을 만족하는 종목이 없어요 😢
              </p>
            </Card>
          )}
        </section>

        {/* 하단 정보 */}
        <div className="text-center space-y-2 pt-4">
          <p className="text-xs text-muted-foreground">
            총 {data.totalChecked}개 인기 종목 중 분석 완료
          </p>
          <p className="text-xs text-muted-foreground">
            마지막 업데이트: {new Date(data.lastUpdated).toLocaleString("ko-KR")}
          </p>
        </div>
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 종목 카드 컴포넌트
// ═══════════════════════════════════════════════════════════════

function StockCard({ stock, isAllGreen = false }: { stock: StockData; isAllGreen?: boolean }) {
  const signalLabels: Record<string, string> = {
    earning: "돈버는능력",
    debt: "빚관리",
    growth: "성장가능성",
    valuation: "현재몸값",
  };

  return (
    <Link href={`/stock/${stock.ticker}`}>
      <Card className={`p-4 hover:shadow-md transition-shadow ${
        isAllGreen ? "border-green-200 bg-green-50/30" : ""
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SignalRow signals={stock.signals} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold">{stock.ticker}</span>
                <span className="text-sm text-muted-foreground">{stock.name}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                  {stock.sector}
                </span>
                {stock.notGood && (
                  <span className="text-xs text-yellow-600">
                    {signalLabels[stock.notGood]} 아쉬움
                  </span>
                )}
              </div>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </Card>
    </Link>
  );
}

// ═══════════════════════════════════════════════════════════════
// 로딩 & 에러 상태
// ═══════════════════════════════════════════════════════════════

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-center gap-2 max-w-2xl mx-auto">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-10 flex-1 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </header>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-5xl mb-6 animate-bounce">🔍</div>
          <h2 className="text-xl font-bold mb-3">지금 올그린 종목을 찾고 있어요!</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            4가지 핵심 지표가 모두 "좋음"인 종목을 분석 중이에요
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            (돈버는능력, 빚관리, 성장가능성, 현재몸값)
          </p>
          <div className="mt-8 flex gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse delay-100" />
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse delay-200" />
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse delay-300" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="p-6 text-center max-w-sm">
        <p className="text-4xl mb-4">😢</p>
        <p className="text-lg font-semibold mb-2">오류가 발생했어요</p>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <Button onClick={onRetry}>다시 시도</Button>
      </Card>
    </div>
  );
}
