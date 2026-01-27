// 관심종목 관리 유틸리티

import { trackEvent } from './analytics'

const WATCHLIST_KEY = "mijudogam_watchlist"

export interface WatchlistItem {
  ticker: string
  name: string
  addedAt: number
}

// 관심종목 목록 가져오기 (잘못된 데이터 자동 정리)
export function getWatchlist(): WatchlistItem[] {
  if (typeof window === "undefined") return []
  try {
    const stored = localStorage.getItem(WATCHLIST_KEY)
    if (!stored) return []
    
    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) {
      localStorage.removeItem(WATCHLIST_KEY)
      return []
    }
    
    // 잘못된 데이터 필터링 (ticker가 객체인 경우 등)
    const cleaned = parsed.filter((item: any) => {
      // ticker가 문자열이어야 함
      if (!item || typeof item.ticker !== "string") return false
      return true
    }).map((item: any) => ({
      ticker: String(item.ticker),
      name: typeof item.name === "string" ? item.name : item.ticker,
      addedAt: item.addedAt || Date.now(),
    }))
    
    // 정리된 데이터가 원본과 다르면 저장
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(cleaned))
      console.log("[Watchlist] 잘못된 데이터 정리됨:", parsed.length - cleaned.length, "개 제거")
    }
    
    return cleaned
  } catch {
    // 파싱 에러 시 초기화
    localStorage.removeItem(WATCHLIST_KEY)
    return []
  }
}

// 관심종목에 있는지 확인
export function isInWatchlist(ticker: string): boolean {
  const watchlist = getWatchlist()
  return watchlist.some(item => item.ticker.toUpperCase() === ticker.toUpperCase())
}

// 관심종목 추가/제거 토글
export function toggleWatchlist(ticker: string, name: string): boolean {
  const watchlist = getWatchlist()
  const upperTicker = ticker.toUpperCase()
  const index = watchlist.findIndex(item => item.ticker.toUpperCase() === upperTicker)
  
  if (index >= 0) {
    // 제거
    watchlist.splice(index, 1)
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist))
    return false // 제거됨
  } else {
    // 추가
    watchlist.unshift({
      ticker: upperTicker,
      name,
      addedAt: Date.now()
    })
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist))
    return true // 추가됨
  }
}

// 관심종목에서 제거
export function removeFromWatchlist(ticker: string): void {
  const watchlist = getWatchlist()
  const filtered = watchlist.filter(item => item.ticker.toUpperCase() !== ticker.toUpperCase())
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(filtered))
}

// 관심종목 이벤트 로깅 (분석용)
export function logWatchlistEvent(event: string, data: Record<string, any>): void {
  console.log(`[Watchlist] ${event}`, data)
  
  // Supabase로 전송
  trackEvent(event, data)
  
  // Google Analytics 이벤트 (gtag가 있으면)
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", event, data)
  }
}
