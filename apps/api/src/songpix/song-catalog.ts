export type CatalogSong = {
  id: string;
  title: string;
  artist: string;
  genre: string;
  durationSeconds: number;
  provider?: string;
  artworkUrl?: string | null;
  playbackUrl?: string | null;
  available?: boolean;
  restrictions?: {
    playback: 'DIRECT_STREAM' | 'METADATA_ONLY';
    attribution?: string;
    expiresAt?: string;
  };
};

export const MOCK_SONGS: CatalogSong[] = [
  {
    id: 'sertanejo-1',
    title: 'Estrada de Terra',
    artist: 'Duo Horizonte',
    genre: 'Sertanejo',
    durationSeconds: 198,
  },
  {
    id: 'sertanejo-2',
    title: 'Noite no Interior',
    artist: 'Clara & Bento',
    genre: 'Sertanejo',
    durationSeconds: 224,
  },
  {
    id: 'sertanejo-3',
    title: 'Coração na Arena',
    artist: 'Lucas do Vale',
    genre: 'Sertanejo',
    durationSeconds: 245,
  },
  {
    id: 'rock-1',
    title: 'Cidade Elétrica',
    artist: 'Os Volts',
    genre: 'Rock',
    durationSeconds: 272,
  },
  {
    id: 'rock-2',
    title: 'Sem Sinal',
    artist: 'Rota 404',
    genre: 'Rock',
    durationSeconds: 205,
  },
  {
    id: 'pop-1',
    title: 'Luzes da Madrugada',
    artist: 'Maya Sol',
    genre: 'Pop',
    durationSeconds: 188,
  },
  {
    id: 'pop-2',
    title: 'Replay',
    artist: 'Neon Club',
    genre: 'Pop',
    durationSeconds: 201,
  },
  {
    id: 'mpb-1',
    title: 'Janela para o Mar',
    artist: 'Marina Lua',
    genre: 'MPB',
    durationSeconds: 236,
  },
  {
    id: 'game-1',
    title: 'Final Stage',
    artist: 'Pixel Orchestra',
    genre: 'Games',
    durationSeconds: 179,
  },
  {
    id: 'funk-1',
    title: 'Bate o Combo',
    artist: 'DJ Respawn',
    genre: 'Funk',
    durationSeconds: 164,
  },
];
