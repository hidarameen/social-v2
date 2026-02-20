import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function isBypassPath(pathname: string): boolean {
  if (pathname.startsWith('/api/')) return true;
  if (pathname.startsWith('/_next/')) return true;
  if (pathname.startsWith('/_vercel/')) return true;
  if (pathname === '/index.html') return true;
  if (pathname.startsWith('/social-v2')) return true;
  if (pathname === '/social-v2-app.html') return true;
  if (pathname.startsWith('/public/')) return true;
  if (pathname === '/favicon.ico') return true;
  if (pathname === '/robots.txt') return true;
  if (pathname === '/sitemap.xml') return true;
  if (pathname === '/manifest.webmanifest') return true;
  if (pathname === '/manifest.json') return true;
  if (/\.[^/]+$/.test(pathname)) return true;
  return false;
}

function normalizeV2Route(pathname: string): string {
  if (pathname === '/' || pathname === '') return '/';

  if (pathname === '/login') return '/login';
  if (pathname === '/register') return '/signup';
  if (pathname === '/forgot-password') return '/forgot-password';
  if (pathname === '/verify-email') return '/verify-email';
  if (pathname === '/reset-password') return '/forgot-password';

  if (pathname.startsWith('/dashboard/accounts') || pathname === '/accounts') {
    return '/dashboard/accounts';
  }
  if (pathname.startsWith('/dashboard/tasks') || pathname.startsWith('/tasks')) {
    return '/dashboard/tasks';
  }
  if (pathname.startsWith('/dashboard/manual-publish') || pathname.startsWith('/manual-publish')) {
    return '/dashboard/manual-publish';
  }
  if (pathname.startsWith('/dashboard/executions') || pathname.startsWith('/executions')) {
    return '/dashboard/executions';
  }
  if (pathname.startsWith('/dashboard/analytics') || pathname === '/analytics') {
    return '/dashboard/analytics';
  }
  if (pathname.startsWith('/dashboard/settings') || pathname === '/settings') {
    return '/dashboard/settings';
  }
  if (pathname.startsWith('/dashboard/help') || pathname === '/help') {
    return '/dashboard/help';
  }
  if (pathname.startsWith('/dashboard')) return '/dashboard';

  return '/dashboard';
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isBypassPath(pathname)) {
    return NextResponse.next();
  }

  const nextUrl = request.nextUrl.clone();
  nextUrl.pathname = '/index.html';
  nextUrl.search = '';

  const mappedRoute = normalizeV2Route(pathname);
  nextUrl.hash = `${mappedRoute}${search || ''}`;
  return NextResponse.redirect(nextUrl);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|social-v2|favicon.ico|robots.txt|sitemap.xml).*)'],
};
