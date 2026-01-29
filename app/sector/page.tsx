"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Search, Share2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { HeaderSearchModal } from "@/components/header-search-modal"

// ═══════════════════════════════════════════════════════════════
// 타입 정의
// ═══════════════════════════════════════════════════════════════

interface MacroData {
  treasury10Y: {
    value: number;
    change1M: number;
    trend: string;
    trendLabel: string;
  };
  dollarIndex: {
    value: number;
    change1M: number;
    trend: string;
    trendLabel: string;
  };
  vix: {
    value: number;
    level: string;
    levelLabel: string;
    color: string;
  };
  cycle: {
    position: string;
    positionKo: string;
    favorableSectors: string[];
    unfavorableSectors: string[];
  };
  summary: string;
}

interface SectorData {
  ticker: string;
  name: string;
  nameKo: string;
  price: number;
  change1W: number;
  change1M: number;
  change3M: number;
  change6M: number;
  change1Y: number;
  rs1W: number;
  rs1M: number;
  rs3M: number;
  rs6M: number;
  rs1Y: number;
  status: "hot" | "neutral" | "cold";
}

interface ValueChainData {
  stage: number;
  name: string;
  nameEn: string;
  etfOrAvg: string;
  description: string;
  change3M: number;
  rsi14: number;
  fromHigh52W: number;
  proof: {
    emoji: string;
    label: string;
    status: string;
  };
  stocks: { ticker: string; name: string }[];
}

interface APIResponse {
  macro: MacroData;
  market: {
    ticker: string;
    name: string;
    price: number;
    change1W: number;
    change1M: number;
    change3M: number;
    change6M: number;
    change1Y: number;
  };
  sectors: SectorData[];
  sectorSummary: string;
  valueChain: ValueChainData[];
  valueChainSummary: string;
  lastUpdated: string;
}

// ═══════════════════════════════════════════════════════════════
// 메인 컴포넌트
// ═══════════════════════════════════════════════════════════════

export default function SectorPage() {
  const router = useRouter();
  const [data, setData] = useState<APIResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"macro" | "sector" | "valuechain">("macro");
  const [selectedPeriod, setSelectedPeriod] = useState<"1W" | "1M" | "3M" | "6M" | "1Y">("3M");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // 공유 기능
  const handleShare = async () => {
    const url = window.location.href;
    const title = "섹터 로테이션 - 미주도감";
    
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
      const response = await fetch("/api/sector");
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

      {/* Tabs */}
      <div className="sticky top-14 z-10 bg-background border-b">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex">
            <TabButton 
              active={activeTab === "macro"} 
              onClick={() => setActiveTab("macro")}
            >
              🌍 매크로
            </TabButton>
            <TabButton 
              active={activeTab === "sector"} 
              onClick={() => setActiveTab("sector")}
            >
              📊 섹터 흐름
            </TabButton>
            <TabButton 
              active={activeTab === "valuechain"} 
              onClick={() => setActiveTab("valuechain")}
            >
              🔗 AI 밸류체인
            </TabButton>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {activeTab === "macro" && <MacroTab data={data.macro} />}
        {activeTab === "sector" && (
          <SectorTab 
            sectors={data.sectors} 
            market={data.market}
            summary={data.sectorSummary}
            selectedPeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
          />
        )}
        {activeTab === "valuechain" && (
          <ValueChainTab 
            valueChain={data.valueChain} 
            summary={data.valueChainSummary}
          />
        )}

        {/* 마지막 업데이트 */}
        <p className="text-center text-xs text-muted-foreground pt-4">
          마지막 업데이트: {new Date(data.lastUpdated).toLocaleString("ko-KR")}
        </p>
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 탭 버튼
// ═══════════════════════════════════════════════════════════════

function TabButton({ 
  active, 
  onClick, 
  children 
}: { 
  active: boolean; 
  onClick: () => void; 
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
        active 
          ? "text-primary border-primary" 
          : "text-muted-foreground border-transparent hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// 탭 1: 매크로
// ═══════════════════════════════════════════════════════════════

// ETF 티커 → 한글 변환
const SECTOR_NAME_MAP: Record<string, string> = {
  "XLK": "기술",
  "XLF": "금융",
  "XLV": "헬스케어",
  "XLE": "에너지",
  "XLU": "유틸리티",
  "XLI": "산업재",
  "XLY": "임의소비재",
  "XLP": "필수소비재",
  "XLB": "소재",
  "XLRE": "부동산",
  "XLC": "통신",
};

function tickersToKorean(tickers: string[]): string {
  return tickers.map(t => SECTOR_NAME_MAP[t] || t).join(", ");
}

function MacroTab({ data }: { data: MacroData }) {
  return (
    <div className="space-y-4">
      {/* AI 종합 판단 - 맨 위로 */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">💡</span>
          <h3 className="font-semibold text-blue-900">AI 종합 판단</h3>
        </div>
        <p className="text-sm text-blue-800 leading-relaxed">
          {data.summary}
        </p>
      </Card>

      {/* 금리 */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">💵</span>
          <h3 className="font-semibold">금리 (10년물)</h3>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold">{data.treasury10Y.value.toFixed(2)}%</p>
            <p className="text-sm text-muted-foreground">
              월간 {data.treasury10Y.change1M > 0 ? "+" : ""}{data.treasury10Y.change1M.toFixed(2)}%
            </p>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            data.treasury10Y.trend === "down" 
              ? "bg-green-100 text-green-700" 
              : data.treasury10Y.trend === "up"
              ? "bg-red-100 text-red-700"
              : "bg-gray-100 text-gray-700"
          }`}>
            {data.treasury10Y.trendLabel}
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          → {data.treasury10Y.trend === "down" ? "성장주/기술주에 유리 🟢" : 
             data.treasury10Y.trend === "up" ? "가치주/금융주에 유리 🟡" : "중립"}
        </p>
      </Card>

      {/* 달러 */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">💲</span>
          <h3 className="font-semibold">달러 인덱스</h3>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold">{data.dollarIndex.value.toFixed(1)}</p>
            <p className="text-sm text-muted-foreground">
              월간 {data.dollarIndex.change1M > 0 ? "+" : ""}{data.dollarIndex.change1M.toFixed(1)}%
            </p>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            data.dollarIndex.trend === "weak" 
              ? "bg-green-100 text-green-700" 
              : data.dollarIndex.trend === "strong"
              ? "bg-yellow-100 text-yellow-700"
              : "bg-gray-100 text-gray-700"
          }`}>
            {data.dollarIndex.trendLabel}
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          → {data.dollarIndex.trend === "weak" ? "원자재/빅테크에 유리 🟢" : 
             data.dollarIndex.trend === "strong" ? "내수주에 유리" : "중립"}
        </p>
      </Card>

      {/* VIX */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">😰</span>
          <h3 className="font-semibold">VIX (공포지수)</h3>
        </div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-2xl font-bold">{data.vix.value.toFixed(1)}</p>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            data.vix.color === "green" 
              ? "bg-green-100 text-green-700" 
              : data.vix.color === "yellow"
              ? "bg-yellow-100 text-yellow-700"
              : data.vix.color === "orange"
              ? "bg-orange-100 text-orange-700"
              : "bg-red-100 text-red-700"
          }`}>
            {data.vix.levelLabel}
          </div>
        </div>
        {/* VIX 게이지 */}
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div 
            className={`h-full transition-all ${
              data.vix.value < 20 ? "bg-green-500" :
              data.vix.value < 25 ? "bg-yellow-500" :
              data.vix.value < 30 ? "bg-orange-500" : "bg-red-500"
            }`}
            style={{ width: `${Math.min(data.vix.value / 40 * 100, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>0</span>
          <span>20</span>
          <span>40</span>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          → {data.vix.level === "low" || data.vix.level === "normal" 
              ? "위험자산 투자 OK 🟢" 
              : "신중한 접근 필요 🔴"}
        </p>
      </Card>

      {/* 경기 사이클 */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">📈</span>
          <h3 className="font-semibold">경기 사이클</h3>
        </div>
        
        {/* 사이클 시각화 */}
        <div className="flex items-center justify-between mb-4 px-2">
          {["회복기", "확장기", "후기", "침체기"].map((stage, idx) => {
            const positions = ["recovery", "expansion", "late", "recession"];
            const isActive = data.cycle.position === positions[idx];
            return (
              <div key={stage} className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                  isActive ? "bg-primary text-white" : "bg-gray-100 text-gray-500"
                }`}>
                  {idx + 1}
                </div>
                <span className={`text-xs mt-1 ${isActive ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                  {stage}
                </span>
                {isActive && <span className="text-xs">↑ 현재</span>}
              </div>
            );
          })}
        </div>

        <div className="space-y-2">
          <p className="text-sm">
            <span className="text-green-600 font-medium">✅ 유리한 섹터: </span>
            {tickersToKorean(data.cycle.favorableSectors)}
          </p>
          <p className="text-sm">
            <span className="text-red-600 font-medium">⚠️ 불리한 섹터: </span>
            {tickersToKorean(data.cycle.unfavorableSectors)}
          </p>
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 탭 2: 섹터 흐름
// ═══════════════════════════════════════════════════════════════

function SectorTab({ 
  sectors, 
  market,
  summary,
  selectedPeriod,
  onPeriodChange,
}: { 
  sectors: SectorData[]; 
  market: APIResponse["market"];
  summary: string;
  selectedPeriod: "1W" | "1M" | "3M" | "6M" | "1Y";
  onPeriodChange: (period: "1W" | "1M" | "3M" | "6M" | "1Y") => void;
}) {
  // 선택된 기간에 따른 데이터 키
  const periodKey = `change${selectedPeriod}` as keyof SectorData;
  const rsKey = `rs${selectedPeriod}` as keyof SectorData;
  const marketChange = market[`change${selectedPeriod}` as keyof typeof market] as number;

  // 상대강도 기준 정렬
  const sortedSectors = [...sectors].sort((a, b) => {
    const aRs = a[rsKey] as number;
    const bRs = b[rsKey] as number;
    return bRs - aRs;
  });

  // 그룹 분류
  const hotSectors = sortedSectors.filter(s => (s[rsKey] as number) > 5);
  const neutralSectors = sortedSectors.filter(s => {
    const rs = s[rsKey] as number;
    return rs >= -5 && rs <= 5;
  });
  const coldSectors = sortedSectors.filter(s => (s[rsKey] as number) < -5);

  return (
    <div className="space-y-4">
      {/* AI 해석 - 맨 위로 */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">💡</span>
          <h3 className="font-semibold text-blue-900">AI 해석</h3>
        </div>
        <p className="text-sm text-blue-800 leading-relaxed">
          {summary}
        </p>
      </Card>

      {/* 기간 선택 */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {(["1W", "1M", "3M", "6M", "1Y"] as const).map((period) => (
          <button
            key={period}
            onClick={() => onPeriodChange(period)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              selectedPeriod === period
                ? "bg-primary text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {period === "1W" ? "1주" : 
             period === "1M" ? "1개월" :
             period === "3M" ? "3개월" :
             period === "6M" ? "6개월" : "1년"}
          </button>
        ))}
      </div>

      {/* 시장 기준 */}
      <Card className="p-3 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">📈 S&P 500 (기준)</span>
          </div>
          <span className={`font-semibold ${marketChange >= 0 ? "text-green-600" : "text-red-600"}`}>
            {marketChange >= 0 ? "+" : ""}{marketChange.toFixed(1)}%
          </span>
        </div>
      </Card>

      {/* 🔥 자금 유입 */}
      {hotSectors.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-1">
            🔥 시장 대비 강세 (자금 유입)
          </h3>
          <div className="space-y-2">
            {hotSectors.map(sector => (
              <SectorRow 
                key={sector.ticker} 
                sector={sector} 
                periodKey={periodKey}
                rsKey={rsKey}
                maxChange={Math.max(...sortedSectors.map(s => Math.abs(s[periodKey] as number)))}
              />
            ))}
          </div>
        </div>
      )}

      {/* 😐 중립 */}
      {neutralSectors.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-1">
            😐 시장과 비슷
          </h3>
          <div className="space-y-2">
            {neutralSectors.map(sector => (
              <SectorRow 
                key={sector.ticker} 
                sector={sector} 
                periodKey={periodKey}
                rsKey={rsKey}
                maxChange={Math.max(...sortedSectors.map(s => Math.abs(s[periodKey] as number)))}
              />
            ))}
          </div>
        </div>
      )}

      {/* ❄️ 자금 이탈 */}
      {coldSectors.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-1">
            ❄️ 시장 대비 약세 (자금 이탈)
          </h3>
          <div className="space-y-2">
            {coldSectors.map(sector => (
              <SectorRow 
                key={sector.ticker} 
                sector={sector} 
                periodKey={periodKey}
                rsKey={rsKey}
                maxChange={Math.max(...sortedSectors.map(s => Math.abs(s[periodKey] as number)))}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SectorRow({ 
  sector, 
  periodKey,
  rsKey,
  maxChange,
}: { 
  sector: SectorData;
  periodKey: keyof SectorData;
  rsKey: keyof SectorData;
  maxChange: number;
}) {
  const change = sector[periodKey] as number;
  const rs = sector[rsKey] as number;
  const barWidth = maxChange > 0 ? Math.abs(change) / maxChange * 100 : 0;

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">{sector.nameKo}</span>
          <span className="text-xs text-muted-foreground">{sector.ticker}</span>
        </div>
        <div className="text-right">
          <span className={`font-semibold ${change >= 0 ? "text-green-600" : "text-red-600"}`}>
            {change >= 0 ? "+" : ""}{change.toFixed(1)}%
          </span>
          <span className={`text-xs ml-1 ${rs >= 0 ? "text-green-500" : "text-red-500"}`}>
            (시장{rs >= 0 ? "+" : ""}{rs.toFixed(1)}%)
          </span>
        </div>
      </div>
      {/* 바 차트 */}
      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
        <div 
          className={`h-full transition-all ${change >= 0 ? "bg-green-500" : "bg-red-500"}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// 탭 3: AI 밸류체인
// ═══════════════════════════════════════════════════════════════

function ValueChainTab({ 
  valueChain,
  summary,
}: { 
  valueChain: ValueChainData[];
  summary: string;
}) {
  return (
    <div className="space-y-4">
      {/* AI 해석 - 맨 위로 */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">💡</span>
          <h3 className="font-semibold text-blue-900">AI 해석</h3>
        </div>
        <p className="text-sm text-blue-800 leading-relaxed">
          {summary}
        </p>
      </Card>

      {/* 밸류체인 흐름도 */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3">빅테크 투자금이 흐르는 순서</h3>
        <div className="flex items-center justify-between overflow-x-auto pb-2">
          {valueChain.map((stage, idx) => (
            <div key={stage.stage} className="flex items-center">
              <div className="flex flex-col items-center min-w-[60px]">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg ${
                  stage.proof.status === "proven_expensive" ? "bg-green-100" :
                  stage.proof.status === "proven" ? "bg-green-100" :
                  stage.proof.status === "proving" ? "bg-orange-100" :
                  stage.proof.status === "early" ? "bg-yellow-100" :
                  "bg-gray-100"
                }`}>
                  {stage.proof.emoji}
                </div>
                <span className="text-xs mt-1 text-center font-medium">{stage.name.split("/")[0]}</span>
                <span className="text-[10px] text-muted-foreground">{stage.etfOrAvg}</span>
              </div>
              {idx < valueChain.length - 1 && (
                <div className="mx-1 text-gray-400">→</div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* 각 단계 상세 */}
      <div className="space-y-3">
        {valueChain.map(stage => (
          <Card key={stage.stage} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{stage.proof.emoji}</span>
                <div>
                  <h4 className="font-semibold">{stage.stage}️⃣ {stage.name}</h4>
                  <p className="text-xs text-muted-foreground">{stage.description}</p>
                </div>
              </div>
              <div className={`px-2 py-1 rounded text-xs font-medium ${
                stage.proof.status === "proven_expensive" ? "bg-green-100 text-green-700" :
                stage.proof.status === "proven" ? "bg-green-100 text-green-700" :
                stage.proof.status === "proving" ? "bg-orange-100 text-orange-700" :
                stage.proof.status === "early" ? "bg-yellow-100 text-yellow-700" :
                "bg-gray-100 text-gray-700"
              }`}>
                {stage.proof.label}
              </div>
            </div>

            {/* 지표 */}
            <div className="grid grid-cols-3 gap-2 text-sm mb-3">
              <div className="bg-gray-50 rounded p-2 text-center">
                <p className="text-xs text-muted-foreground">3개월</p>
                <p className={`font-semibold ${stage.change3M >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {stage.change3M >= 0 ? "+" : ""}{stage.change3M.toFixed(1)}%
                </p>
              </div>
              <div className="bg-gray-50 rounded p-2 text-center">
                <p className="text-xs text-muted-foreground">RSI</p>
                <p className={`font-semibold ${
                  stage.rsi14 > 70 ? "text-red-600" : 
                  stage.rsi14 < 30 ? "text-green-600" : "text-gray-900"
                }`}>
                  {stage.rsi14}
                </p>
              </div>
              <div className="bg-gray-50 rounded p-2 text-center">
                <p className="text-xs text-muted-foreground">고점대비</p>
                <p className={`font-semibold ${stage.fromHigh52W > -10 ? "text-orange-600" : "text-gray-900"}`}>
                  {stage.fromHigh52W.toFixed(0)}%
                </p>
              </div>
            </div>

            {/* 대표 종목 */}
            <div className="flex flex-wrap gap-1">
              {stage.stocks.slice(0, 4).map(stock => (
                <Link
                  key={stock.ticker}
                  href={`/stock/${stock.ticker}`}
                  className="px-2 py-1 bg-gray-100 rounded text-xs font-medium hover:bg-gray-200 transition-colors"
                >
                  {stock.ticker}
                </Link>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 로딩 & 에러 상태
// ═══════════════════════════════════════════════════════════════

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </header>
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
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
