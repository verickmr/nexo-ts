import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Nexo Assist · Service desk de TI', description: 'Seu problema de TI, resolvido em uma conversa.', robots: { index: false, follow: false } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="pt-BR"><head><link rel="stylesheet" href="/fonts/fonts.css"/></head><body>{children}</body></html>; }
