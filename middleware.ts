import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // HTML 페이지에 대해서만 캐시를 무효화합니다.
  // 정적 파일(_next/static)은 캐시 유지 (성능)
  if (
    request.nextUrl.pathname.startsWith('/_next/static') === false &&
    request.nextUrl.pathname.includes('.') === false
  ) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
  }

  return response
}

// 미들웨어가 실행될 경로 설정
export const config = {
  matcher: [
    // 정적 파일 제외
    '/((?!_next/static|_next/image|favicon.ico|icons|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
  ],
}
