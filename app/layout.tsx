import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://schwank.cvtps2dq.chatgpt.site'),
  title: 'schwank — Our shared home',
  description: 'One cozy place for meals, money, tasks, lists, and household chat.',
  openGraph: {
    title: 'schwank — Our shared home',
    description: 'Meals, money, tasks, lists & chat.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'schwank — Our shared home' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'schwank — Our shared home',
    description: 'Meals, money, tasks, lists & chat.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
