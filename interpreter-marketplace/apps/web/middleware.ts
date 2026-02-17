import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: ['/', '/(en|ar|hi|ur|ml|fil|fa|bn|ta)/:path*', '/((?!api|_next|_vercel|.*\..*).*)']
};
