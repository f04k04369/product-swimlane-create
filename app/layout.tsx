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
    images: ['/ogp.jpeg'],
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
      <body className={`${inter.className} min-h-screen bg-muted text-slate-900`}>
        <div className="hidden min-h-screen flex-col lg:flex">{children}</div>
        <div className="flex min-h-screen items-center justify-center bg-muted px-6 py-12 lg:hidden">
          <div className="max-w-md rounded-2xl border border-slate-200 bg-white/90 p-6 text-center shadow-lg">
            <h1 className="text-lg font-semibold text-slate-800">Swimlane Studio</h1>
            <p className="mt-3 text-sm text-slate-600">
              このエディタは横幅 1024px 以上の環境でのみご利用いただけます。
              デスクトップやタブレット等の大きな画面でアクセスしてください。
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
