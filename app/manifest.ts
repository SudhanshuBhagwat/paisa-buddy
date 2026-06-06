import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Paisa Buddy',
    short_name: 'Paisa Buddy',
    description: 'Personal finance tracker',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1A936F',
    icons: [
      {
        src: '/apple-icon',
        sizes: '200x200',
        type: 'image/png',
      },
    ],
  }
}
