import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Swimlane Studio',
  description: 'Drag-and-drop swimlane diagram builder with Mermaid export.',
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
