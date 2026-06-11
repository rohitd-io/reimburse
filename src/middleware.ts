import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySession } from './lib/session'

export async function middleware(request: NextRequest) {
  const isDashboard = request.nextUrl.pathname.startsWith('/dashboard')
  const sessionToken = request.cookies.get('emertech_reimburse_session')?.value
  const session = sessionToken ? await verifySession(sessionToken) : null

  if (isDashboard && !session) {
    const response = NextResponse.redirect(new URL('/login', request.url))
    if (sessionToken) {
      response.cookies.delete('emertech_reimburse_session')
    }
    return response
  }
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
