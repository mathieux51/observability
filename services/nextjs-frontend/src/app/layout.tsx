import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Observability Stack Demo',
  description: 'Monitoring with Prometheus, Tempo, Quickwit, and Grafana',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
