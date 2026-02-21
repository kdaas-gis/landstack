import type { MetadataRoute } from 'next'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'LandStack',
        short_name: 'LandStack',
        description: 'Stack government documents on a map.',
        start_url: `${basePath}/`,
        display: 'standalone',
        background_color: '#0a0a0b',
        theme_color: '#0a0a0b',
        orientation: 'any',
        icons: [
            {
                src: `${basePath}/icons/earth.png`,
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any',
            },
            {
                src: `${basePath}/icons/earth.png`,
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any',
            },
        ],
    }
}
