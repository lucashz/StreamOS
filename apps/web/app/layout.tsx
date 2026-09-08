import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './styles.css';
import './alert-layout.css';

export const metadata: Metadata = {
  title: 'Painel | StreamOS',
  description: 'Painel de monetização e experiências ao vivo do StreamOS.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
