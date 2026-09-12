import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './styles.css';
import './alert-layout.css';
import './design-foundations.css';
import './design-components.css';

export const metadata: Metadata = {
  title: 'Painel | StreamOS',
  description:
    'Painel para contribuições, alertas, widgets e controle de transmissões.',
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
