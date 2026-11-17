/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  serverExternalPackages: ['pg', '@prisma/client'],
  images: {
    unoptimized: true
  }
};

export default nextConfig;
