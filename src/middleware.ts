// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('__session');
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/signup', '/privacy-policy', '/terms'];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route)) || pathname === '/';

  // Allow public routes without authentication
  if (isPublicRoute) {
    // If user has session and tries to access login, signup, OR the root landing page, redirect to dashboard
    if (sessionCookie && (pathname.startsWith('/login') || pathname.startsWith('/signup') || pathname === '/')) {
      console.log(`✅ [Middleware] Session exists, redirecting from ${pathname} to /dashboard`);
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // Protected routes - require session cookie
  if (!sessionCookie) {
    console.log('🚫 [Middleware] No session cookie, redirecting to login');
    const response = NextResponse.redirect(new URL('/login', request.url));
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder files (images, manifests, etc.)
     * - api routes (handle their own auth)
     * - sw.js and related service worker files
     */
    '/((?!_next/static|_next/image|favicon.ico|icon-.*\\.png|manifest\\.json|sw.*\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$|api/).*)',
  ],
};
