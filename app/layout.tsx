import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Swimlane Studio',
  description: '業務フローやシステム開発に必要なフロー図作成をスイムレーン形式で作成する専用アプリ',
  metadataBase: new URL('https://staging-swimlane-studio.vercel.app'),
  openGraph: {
    title: 'Swimlane Studio',
    description:
      '業務フローやシステム開発に必要なフロー図作成をスイムレーン形式で作成する専用アプリ',
    url: 'https://staging-swimlane-studio.vercel.app',
    siteName: 'Swimlane Studio',
    locale: 'ja_JP',
    type: 'website',
    images: [
      {
        url: '/ogp.jpeg',
        width: 1200,
        height: 630,
        alt: 'Swimlane Studio でスイムレーン図を作成',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Swimlane Studio',
    description:
      '業務フローやシステム開発に必要なフロー図作成をスイムレーン形式で作成する専用アプリ',
    images: ['/og-image.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.png' },
      { url: '/favicon.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon.png', type: 'image/png', sizes: '16x16' },
    ],
  },
}; 

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className="bg-muted">
      <body className={`${inter.className} min-h-screen bg-muted text-slate-900`}>{children}</body>
    </html>
  );
}
