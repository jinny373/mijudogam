import { supabase } from './supabase'

// 페이지뷰 기록
export async function trackPageView(pagePath: string) {
  await supabase.from('page_views').insert({
    page_path: pagePath,
    referrer: document.referrer || null,
    user_agent: navigator.userAgent
  })
}

// 이벤트 기록
export async function trackEvent(eventName: string, eventData?: object) {
  await supabase.from('events').insert({
    event_name: eventName,
    event_data: eventData || {},
    page_path: window.location.pathname
  })
}

// 검색 기록
export async function trackSearch(searchTerm: string) {
  await supabase.from('searches').insert({
    search_term: searchTerm
  })
}