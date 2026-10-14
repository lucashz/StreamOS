import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './styles.css';
import './alert-layout.css';
import './design-foundations.css';
import './design-components.css';
import './landing-page.css';

export const metadata: Metadata = {
  title: {
    default: 'StreamOS — A infraestrutura da monetização ao vivo',
    template: '%s | StreamOS',
  },
  description:
    'Plataforma para contribuições Pix, alertas OBS, widgets, SongPix, VideoPix e monetização de transmissões.',
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
