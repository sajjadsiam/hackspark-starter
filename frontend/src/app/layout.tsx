import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RentPi — The Next Generation Rental Platform',
  description: 'RentPi lets you rent anything — electronics, vehicles, tools, outdoor gear, and more. Powered by AI recommendations and real-time availability.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-dark-900 text-white antialiased">
        {children}
      </body>
    </html>
  )
}
