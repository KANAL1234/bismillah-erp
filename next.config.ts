import type { NextConfig } from "next";

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',

  // Cache everything!
  cacheOnFrontEndNav: true,

  fallbacks: {
    document: '/mobile/offline'
  },

  runtimeCaching: [
    // 1. Cache HTML pages (CRITICAL!)
    {
      urlPattern: /^https?:\/\/[^/]+\/mobile.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'html-pages-cache',
        expiration: {
          maxEntries: 30,
          maxAgeSeconds: 24 * 60 * 60
        },
        networkTimeoutSeconds: 3
      }
    },

    // 2. Cache Next.js static files
    {
      urlPattern: /\/_next\/static\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'next-static',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 365 * 24 * 60 * 60
        }
      }
    },

    // 3. Cache Next.js data
    {
      urlPattern: /\/_next\/data\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'next-data',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 24 * 60 * 60
        },
        networkTimeoutSeconds: 3
      }
    },

    // 4. Cache Supabase
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'supabase-api',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 15 * 60 // 15 mins for real-time vibe
        },
        networkTimeoutSeconds: 5
      }
    },

    // 5. Cache images
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: {
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60
        }
      }
    },

    // 6. Cache fonts
    {
      urlPattern: /\.(?:woff|woff2|ttf|otf|eot)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'fonts',
        expiration: {
          maxEntries: 20,
          maxAgeSeconds: 365 * 24 * 60 * 60
        }
      }
    }
  ]
})

const nextConfig: NextConfig = {
  /* config options here */
};

export default withPWA(nextConfig);
