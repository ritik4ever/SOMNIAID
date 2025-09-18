/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        transpilePackages: ['some-package'],
        // appDir: true,
    },
    images: {
        domains: [
            'api.somniaID.com',
            'ipfs.io',
            'gateway.pinata.cloud'
        ],
        formats: ['image/webp', 'image/avif'],
        deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
        imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    },
    env: {
        NEXT_PUBLIC_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
        NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL,
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    },
    webpack: (config, { dev, isServer }) => {
        config.resolve.fallback = {
            ...config.resolve.fallback,
            fs: false,
            net: false,
            tls: false,
        };

        // Optimize bundle size
        if (!dev && !isServer) {
            config.optimization.splitChunks.chunks = 'all';
            config.optimization.splitChunks.cacheGroups = {
                ...config.optimization.splitChunks.cacheGroups,
                vendor: {
                    test: /[\\/]node_modules[\\/]/,
                    name: 'vendors',
                    chunks: 'all',
                },
                wagmi: {
                    test: /[\\/]node_modules[\\/](wagmi|viem|@rainbow-me)[\\/]/,
                    name: 'wagmi',
                    chunks: 'all',
                },
                ui: {
                    test: /[\\/]node_modules[\\/](@headlessui|lucide-react|framer-motion)[\\/]/,
                    name: 'ui',
                    chunks: 'all',
                },
            };
        }

        return config;
    },
    // Enable compression
    compress: true,
    // PWA-like features
    poweredByHeader: false,
    // Optimize fonts
    optimizeFonts: true,
    // Enable static optimization
    output: 'standalone',
};

module.exports = nextConfig;