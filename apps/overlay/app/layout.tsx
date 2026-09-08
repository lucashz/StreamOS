import type { ReactNode } from 'react';

import './styles.css';

export default function OverlayLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
