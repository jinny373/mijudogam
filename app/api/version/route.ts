import { NextResponse } from "next/server";

// 이 값을 배포할 때마다 수동으로 바꾸거나, 빌드 시간으로 자동 설정
const BUILD_VERSION = Date.now().toString();

export async function GET() {
  return NextResponse.json({ 
    version: BUILD_VERSION 
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    }
  });
}
