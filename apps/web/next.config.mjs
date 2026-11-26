import createNextIntlPlugin from 'next-intl/plugin';
import { fileURLToPath } from 'node:url';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),
  typedRoutes: true,
  async redirects() {
    return ['auth', 'client', 'interpreter', 'admin'].map((section) => ({
      source: `/${section}/:path*`,
      destination: `/en/${section}/:path*`,
      permanent: false
    }));
  }
};

export default withNextIntl(nextConfig);
