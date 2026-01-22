'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function PageViewTracker() {
  const pathname = usePathname()

  useEffect(() => {
    const trackPageView = async () => {
      try {
        await supabase.from('page_views').insert({
          page_path: pathname,
          referrer: document.referrer || null,
          user_agent: navigator.userAgent
        })
      } catch (error) {
        console.error('Page view tracking error:', error)
      }
    }

    trackPageView()
  }, [pathname])

  return null
}