// 관심종목 유틸리티
const WATCHLIST_KEY = "mijudogam_watchlist"
const MAX_WATCHLIST = 20

export interface WatchlistItem {
  ticker: string
  name: string
  addedAt: number
}

// 이벤트 로깅 (콘솔 + 나중에 분석용으로 확장 가능)
export const logWatchlistEvent = (event: string, data?: Record<string, any>) => {
  const logData = {
    event,
    timestamp: new Date().toISOString(),
    ...data,
  }
  console.log("[Watchlist Event]", logData)
  
  // 나중에 분석 서비스 연동 시 여기에 추가
  // analytics.track(event, data)
}

// 관심종목 불러오기
export const getWatchlist = (): WatchlistItem[] => {
  if (typeof window === "undefined") return []
  try {
    const stored = localStorage.getItem(WATCHLIST_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

// 관심종목 추가
export const addToWatchlist = (ticker: string, name: string): boolean => {
  if (typeof window === "undefined") return false
  try {
    const watchlist = getWatchlist()
    if (watchlist.some((s) => s.ticker === ticker)) return false
    if (watchlist.length >= MAX_WATCHLIST) return false
    
    const updated = [{ ticker, name, addedAt: Date.now() }, ...watchlist]
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(updated))
    
    logWatchlistEvent("watchlist_add", { ticker })
    return true
  } catch {
    return false
  }
}

// 관심종목 제거
export const removeFromWatchlist = (ticker: string): boolean => {
  if (typeof window === "undefined") return false
  try {
    const watchlist = getWatchlist()
    const updated = watchlist.filter((s) => s.ticker !== ticker)
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(updated))
    
    logWatchlistEvent("watchlist_remove", { ticker })
    return true
  } catch {
    return false
  }
}

// 관심종목 여부 확인
export const isInWatchlist = (ticker: string): boolean => {
  if (typeof window === "undefined") return false
  try {
    const watchlist = getWatchlist()
    return watchlist.some((s) => s.ticker === ticker)
  } catch {
    return false
  }
}

// 관심종목 토글
export const toggleWatchlist = (ticker: string, name: string): boolean => {
  if (isInWatchlist(ticker)) {
    removeFromWatchlist(ticker)
    return false // 제거됨
  } else {
    addToWatchlist(ticker, name)
    return true // 추가됨
  }
}
