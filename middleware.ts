import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = new Set(['/login', '/register']);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);

  const next = () => {
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    response.headers.set('x-request-id', requestId);
    return response;
  };

  if (pathname.startsWith('/api/')) return next();
  if (pathname.startsWith('/api/auth')) return next();
  if (pathname.startsWith('/api/oauth')) return next();
  if (pathname.startsWith('/api/twitter/webhook')) return next();
  if (pathname.startsWith('/api/twitter/stream/sync')) return next();
  if (pathname.startsWith('/api/twitter/stream/debug')) return next();
  if (pathname.startsWith('/api/twitter/poll/now')) return next();
  if (pathname.startsWith('/api/telegram/webhook')) return next();
  if (PUBLIC_PATHS.has(pathname)) return next();
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/_vercel') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/public')
  ) {
    return next();
  }

  const taskDetailMatch = pathname.match(/^\/tasks\/([^/]+)$/);
  if (taskDetailMatch && taskDetailMatch[1] !== 'new') {
    const url = request.nextUrl.clone();
    url.pathname = '/tasks';
    const response = NextResponse.redirect(url);
    response.headers.set('x-request-id', requestId);
    return response;
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    const response = NextResponse.redirect(url);
    response.headers.set('x-request-id', requestId);
    return response;
  }

  return next();
}

export const config = {
  matcher: ['/((?!api/auth|api/oauth|api/telegram/webhook|api/twitter/webhook|api/twitter/stream/sync|api/twitter/stream/debug|api/twitter/poll/now|_next|_vercel|static|public|favicon.ico).*)'],
};
