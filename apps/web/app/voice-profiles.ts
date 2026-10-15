export type VoiceCategory = 'tv' | 'personalities';

export type VoiceProfile = {
  id: string;
  name: string;
  analogy: string;
  detail: string;
  avatar: string;
  category: VoiceCategory;
  pitch: number;
  rate: number;
  gender: 'male' | 'female' | 'default';
  sample: string;
};

export const voiceProfiles: readonly VoiceProfile[] = [
  {
    id: 'voice-silvio',
    name: 'Silvio Santos',
    analogy: 'O Dono do Baú',
    detail: 'Quem quer dinheiro? Ma-oê!',
    avatar: '📺',
    category: 'tv',
    pitch: 1.25,
    rate: 1.08,
    gender: 'male',
    sample: 'Quem quer dinheiro? Obrigado pelo Pix, ma-oê!',
  },
  {
    id: 'voice-faustao',
    name: 'Faustão',
    analogy: 'Ô Loco Meu',
    detail: 'Ô loco meu! Essa fera aí!',
    avatar: '⏱️',
    category: 'tv',
    pitch: 0.85,
    rate: 1.15,
    gender: 'male',
    sample: 'Ô loco meu! Olha essa fera doando ao vivo na live!',
  },
  {
    id: 'voice-galvao',
    name: 'Galvão Bueno',
    analogy: 'Voz do Hexa',
    detail: 'Haja coração amigo! Olha o que ele fez!',
    avatar: '⚽',
    category: 'tv',
    pitch: 1.02,
    rate: 1.14,
    gender: 'male',
    sample: 'Haja coração amigo! Olha o Pix que acabou de pintar na tela!',
  },
  {
    id: 'voice-craque',
    name: 'Craque Neto',
    analogy: 'Os Donos da Bola',
    detail: 'Cês tão de brincadeira! Não vai dar, Cascão!',
    avatar: '😤',
    category: 'personalities',
    pitch: 1.1,
    rate: 1.15,
    gender: 'male',
    sample:
      'Cês tão de brincadeira garotinho! Um Pix desse tamanho tem que aplaudir de pé!',
  },
  {
    id: 'voice-mano',
    name: 'Mano Brown',
    analogy: 'Voz da Quebrada',
    detail: 'Aqui estou mais um dia...',
    avatar: '🕶️',
    category: 'personalities',
    pitch: 0.65,
    rate: 0.92,
    gender: 'male',
    sample: 'Aqui estou mais um dia... Se liga no Pix de respeito que chegou na moral.',
  },
];

let currentTtsAudio: HTMLAudioElement | null = null;

export function stopTtsVoice() {
  if (currentTtsAudio) {
    currentTtsAudio.pause();
    currentTtsAudio.currentTime = 0;
    currentTtsAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export type PreviewTtsOptions = {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
};

export function previewTtsVoice(
  voiceId: string,
  customText?: string,
  options?: PreviewTtsOptions,
) {
  if (typeof window === 'undefined') return;
  const profile =
    voiceProfiles.find((item) => item.id === voiceId) ?? voiceProfiles[0];
  if (!profile) return;
  const text = customText || profile.sample;

  stopTtsVoice();

  const apiOrigin =
    process.env.NEXT_PUBLIC_API_URL?.startsWith('http')
      ? process.env.NEXT_PUBLIC_API_URL
      : 'http://localhost:3001';
  const ttsUrl = `${apiOrigin}/public/tts?voice=${encodeURIComponent(voiceId)}&text=${encodeURIComponent(text)}`;

  const audio = new Audio(ttsUrl);
  currentTtsAudio = audio;

  const fallbackToSpeechSynthesis = () => {
    if ('speechSynthesis' in window) {
      const speech = new SpeechSynthesisUtterance(text || profile.sample);
      speech.lang = 'pt-BR';
      const available = window.speechSynthesis.getVoices();
      const portuguese = available.filter((item) =>
        item.lang.toLowerCase().startsWith('pt'),
      );
      const pool = portuguese.length ? portuguese : available;

      let candidate = pool[0];
      if (profile.gender === 'female') {
        candidate =
          pool.find((v) =>
            /female|femin|maria|francisca|vitoria|luciana/i.test(v.name),
          ) ?? pool[0];
      } else if (profile.gender === 'male') {
        candidate =
          pool.find((v) =>
            /male|mascul|antonio|daniel|ricardo|felipe/i.test(v.name),
          ) ?? pool[0];
      }

      if (candidate) {
        speech.voice = candidate;
        speech.lang = candidate.lang;
      }
      speech.pitch = profile.pitch;
      speech.rate = profile.rate;
      speech.onstart = () => options?.onStart?.();
      speech.onend = () => options?.onEnd?.();
      speech.onerror = () => {
        options?.onEnd?.();
        options?.onError?.();
      };
      window.speechSynthesis.speak(speech);
    } else {
      options?.onEnd?.();
      options?.onError?.();
    }
  };

  audio.onplay = () => {
    options?.onStart?.();
  };
  audio.onended = () => {
    if (currentTtsAudio === audio) {
      currentTtsAudio = null;
    }
    options?.onEnd?.();
  };
  audio.onerror = () => {
    if (currentTtsAudio === audio) {
      currentTtsAudio = null;
    }
    fallbackToSpeechSynthesis();
  };

  audio.play().catch(() => {
    fallbackToSpeechSynthesis();
  });
}
