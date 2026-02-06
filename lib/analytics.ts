import { supabase } from './supabase'

// GA4 이벤트 전송 헬퍼
function sendGA4Event(eventName: string, params?: Record<string, any>) {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', eventName, params)
  }
}

// 페이지뷰 기록
export async function trackPageView(pagePath: string) {
  await supabase.from('page_views').insert({
    page_path: pagePath,
    referrer: document.referrer || null,
    user_agent: navigator.userAgent
  })
}

// 이벤트 기록 (Supabase + GA4)
export async function trackEvent(eventName: string, eventData?: object) {
  // Supabase 기록
  await supabase.from('events').insert({
    event_name: eventName,
    event_data: eventData || {},
    page_path: window.location.pathname
  })
  
  // GA4 기록
  sendGA4Event(eventName, eventData)
}

// 검색 기록
export async function trackSearch(searchTerm: string) {
  await supabase.from('searches').insert({
    search_term: searchTerm
  })
  sendGA4Event('search', { search_term: searchTerm })
}

// ═══════════════════════════════════════════════════════════════
// 탭 네비게이션 이벤트
// ═══════════════════════════════════════════════════════════════
export function trackTabClick(tabName: string) {
  const eventName = `tab_${tabName}`
  sendGA4Event(eventName)
  trackEvent(eventName)
}

// ═══════════════════════════════════════════════════════════════
// 홈 이벤트
// ═══════════════════════════════════════════════════════════════
export function trackHomeRecentClick(stockTicker: string) {
  sendGA4Event('home_recent_click', { stock_ticker: stockTicker })
  trackEvent('home_recent_click', { stock_ticker: stockTicker })
}

export function trackHomeRecommendClick(stockTicker: string) {
  sendGA4Event('home_recommend_click', { stock_ticker: stockTicker })
  trackEvent('home_recommend_click', { stock_ticker: stockTicker })
}

// ═══════════════════════════════════════════════════════════════
// 섹터 탭 이벤트
// ═══════════════════════════════════════════════════════════════
export function trackSectorMacroClick() {
  sendGA4Event('sector_macro_click')
  trackEvent('sector_macro_click')
}

export function trackSectorFlowClick() {
  sendGA4Event('sector_flow_click')
  trackEvent('sector_flow_click')
}

export function trackSectorValuechainClick() {
  sendGA4Event('sector_valuechain_click')
  trackEvent('sector_valuechain_click')
}

export function trackSectorDetailClick(sectorName: string) {
  sendGA4Event('sector_detail_click', { sector_name: sectorName })
  trackEvent('sector_detail_click', { sector_name: sectorName })
}

// ═══════════════════════════════════════════════════════════════
// 토론 탭 이벤트
// ═══════════════════════════════════════════════════════════════
export function trackDiscussionScrollEnd() {
  sendGA4Event('discussion_scroll_end')
  trackEvent('discussion_scroll_end')
}

export function trackDiscussionCategoryClick(categoryName: string) {
  sendGA4Event('discussion_category_click', { category_name: categoryName })
  trackEvent('discussion_category_click', { category_name: categoryName })
}

// ═══════════════════════════════════════════════════════════════
// 발견 탭 이벤트
// ═══════════════════════════════════════════════════════════════
export function trackDiscoverAllgreenClick(stockTicker: string) {
  sendGA4Event('discover_allgreen_click', { stock_ticker: stockTicker })
  trackEvent('discover_allgreen_click', { stock_ticker: stockTicker })
}

export function trackDiscoverWatchlistClick(stockTicker: string) {
  sendGA4Event('discover_watchlist_click', { stock_ticker: stockTicker })
  trackEvent('discover_watchlist_click', { stock_ticker: stockTicker })
}

export function trackDiscoverEditClick() {
  sendGA4Event('discover_edit_click')
  trackEvent('discover_edit_click')
}

// ═══════════════════════════════════════════════════════════════
// 관심종목 이벤트
// ═══════════════════════════════════════════════════════════════
export function trackWatchlistAdd(stockTicker: string) {
  sendGA4Event('watchlist_add', { stock_ticker: stockTicker })
  trackEvent('watchlist_add', { stock_ticker: stockTicker })
}

export function trackWatchlistRemove(stockTicker: string) {
  sendGA4Event('watchlist_remove', { stock_ticker: stockTicker })
  trackEvent('watchlist_remove', { stock_ticker: stockTicker })
}

export function trackWatchlistClick(stockTicker: string) {
  sendGA4Event('watchlist_click', { stock_ticker: stockTicker })
  trackEvent('watchlist_click', { stock_ticker: stockTicker })
}

export function trackWatchlistEditStart() {
  sendGA4Event('watchlist_edit_start')
  trackEvent('watchlist_edit_start')
}

// ═══════════════════════════════════════════════════════════════
// 상세 종목 이벤트 (기존 확장)
// ═══════════════════════════════════════════════════════════════
export function trackMetricCardClick(cardType: string) {
  sendGA4Event('metric_card_click', { card_type: cardType })
  trackEvent('metric_card_click', { card_type: cardType })
}

export function trackRelatedStockClick(stockTicker: string) {
  sendGA4Event('related_stock_click', { stock_ticker: stockTicker })
  trackEvent('related_stock_click', { stock_ticker: stockTicker })
}

export function trackFeedbackUp(stockTicker: string) {
  sendGA4Event('feedback_up', { stock_ticker: stockTicker })
  trackEvent('feedback_up', { stock_ticker: stockTicker })
}
