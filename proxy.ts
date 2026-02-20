import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function isLegacyPanelPath(pathname: string): boolean {
  return pathname === '/social-v2-app.html' || pathname === '/social-v2' || pathname.startsWith('/social-v2/');
}

function isBypassPath(pathname: string): boolean {
  if (pathname.startsWith('/api/')) return true;
  if (pathname.startsWith('/_next/')) return true;
  if (pathname.startsWith('/_vercel/')) return true;
  if (pathname === '/index.html') return true;
  if (pathname.startsWith('/public/')) return true;
  if (pathname === '/favicon.ico') return true;
  if (pathname === '/robots.txt') return true;
  if (pathname === '/sitemap.xml') return true;
  if (pathname === '/manifest.webmanifest') return true;
  if (pathname === '/manifest.json') return true;
  if (/\.[^/]+$/.test(pathname)) return true;
  return false;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isLegacyPanelPath(pathname)) {
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = '/index.html';
    nextUrl.search = '';
    return NextResponse.rewrite(nextUrl);
  }

  if (isBypassPath(pathname)) {
    return NextResponse.next();
  }

  const nextUrl = request.nextUrl.clone();
  nextUrl.pathname = '/index.html';
  nextUrl.search = '';
  return NextResponse.rewrite(nextUrl);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|favicon.ico|robots.txt|sitemap.xml).*)'],
};
