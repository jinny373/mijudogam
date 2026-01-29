"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Search, PieChart, Sparkles, Heart } from "lucide-react"

const tabs = [
  {
    name: "종목",
    href: "/",
    icon: Search,
    matchPaths: ["/", "/stock"],
  },
  {
    name: "섹터",
    href: "/sector",
    icon: PieChart,
    matchPaths: ["/sector"],
  },
  {
    name: "발견",
    href: "/discover",
    icon: Sparkles,
    matchPaths: ["/discover"],
  },
  {
    name: "관심",
    href: "/watchlist",
    icon: Heart,
    matchPaths: ["/watchlist"],
  },
]

export function BottomNav() {
  const pathname = usePathname()

  // 현재 경로가 해당 탭에 해당하는지 확인
  const isActive = (tab: typeof tabs[0]) => {
    if (tab.href === "/") {
      // 홈은 정확히 "/" 이거나 "/stock"으로 시작할 때
      return pathname === "/" || pathname.startsWith("/stock")
    }
    return tab.matchPaths.some(path => pathname.startsWith(path))
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t safe-area-bottom">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-around h-16">
          {tabs.map((tab) => {
            const active = isActive(tab)
            const Icon = tab.icon
            
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                  active 
                    ? "text-primary" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon 
                  className={`h-5 w-5 mb-1 ${
                    active && tab.name === "관심" ? "fill-current" : ""
                  }`} 
                />
                <span className={`text-xs ${active ? "font-semibold" : ""}`}>
                  {tab.name}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
