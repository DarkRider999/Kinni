import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI Image Generator',
  description: 'Enterprise-grade AI image generation with safety and creator tools',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="bg-light dark:bg-dark text-gray-900 dark:text-gray-50">
        <div className="min-h-screen">
          {children}
        </div>
      </body>
    </html>
  )
}
