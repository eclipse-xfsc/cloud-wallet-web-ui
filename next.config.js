const path = require('path');

const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  async rewrites() {
    if (process.env.MOCK_MODE !== 'true') return [];
    return {
      beforeFiles: [
        ...[
          'presentation/:path*',
          'configuration',
          'configuration/:path*',
          'auth/:path*',
          'credentials',
          'history',
          'offers',
          'offers/:path*',
          'presentations',
          'presentations/:path*',
          'redirect/:path*',
          'requests/:path*',
          'links/:path*',
          'issuer-metadata',
          'nonce',
          'credential',
        ].map(path => ({ source: `/api/${path}`, destination: `/api/mock/${path}` })),
        { source: '/v1/:tenantId/api/presentation/:path*', destination: '/api/mock/holder/:tenantId/:path*' },
        { source: '/.well-known/openid-credential-issuer', destination: '/api/mock/issuer-metadata' },
      ],
    };
  },
  output: 'standalone',
  sassOptions: {
    includePaths: [path.join(__dirname, 'styles')],
  },
  env: Object.fromEntries(
    Object.entries(process.env)
      .filter(([key]) => key.startsWith('NEXT_PUBLIC_'))
      .map(([key, value]) => [key.replace('NEXT_PUBLIC_', ''), value])
  ),
};

module.exports = withNextIntl(nextConfig);
