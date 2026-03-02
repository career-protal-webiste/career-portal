// middleware.ts — Clerk auth middleware for Next.js 13 Pages Router
// All job pages and API routes are PUBLIC (no login required to browse).
// Only /profile and /saved-jobs will require auth in future.
import { authMiddleware } from '@clerk/nextjs';

export default authMiddleware({
  // These routes are always accessible without being signed in
  publicRoutes: [
    '/',
    '/all-jobs',
    '/engineering-jobs',
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/api/(.*)',
    '/jobs/(.*)',
    '/cron-status',
  ],
});

export const config = {
  // Run middleware on all routes except static files and _next internals
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
