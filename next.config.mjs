/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // 배포마다 새 빌드ID 강제 생성
  generateBuildId: async () => {
    return `build-${Date.now()}`
  },
  async headers() {
    return [
      {
        // 모든 페이지 캐시 최소화
        source: '/:path*',
        headers: [
          { 
            key: 'Cache-Control', 
            value: 'no-cache, no-store, must-revalidate' 
          },
          {
            key: 'Pragma',
            value: 'no-cache'
          },
          {
            key: 'Expires',
            value: '0'
          }
        ],
      },
    ]
  },
}

export default nextConfig
