/** @type {import('next').NextConfig} */
const basePath = '/landstack';

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath
  }
};

export default nextConfig;
