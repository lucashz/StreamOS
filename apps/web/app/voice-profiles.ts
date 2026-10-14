export type VoiceCategory = 'celebrities' | 'classic' | 'gaming';

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
    name: 'Silvio (O Dono do Baú)',
    analogy: 'Silvio Santos',
    detail: 'Quem quer dinheiro? Animada e clássica',
    avatar: '📺',
    category: 'celebrities',
    pitch: 1.3,
    rate: 1.1,
    gender: 'male',
    sample: 'Quem quer dinheiro? Obrigado pelo Pix, ma-oe!',
  },
  {
    id: 'voice-galvao',
    name: 'Galvão (Voz do Hexa)',
    analogy: 'Galvão Bueno',
    detail: 'Haja coração! Locução épica e empolgada',
    avatar: '⚽',
    category: 'celebrities',
    pitch: 0.95,
    rate: 1.08,
    gender: 'male',
    sample: 'Haja coração amigo! Olha o Pix que acabou de pintar na tela!',
  },
  {
    id: 'voice-faustao',
    name: 'Faustão (Ô Loco Meu)',
    analogy: 'Faustão',
    detail: 'Ô loco bicho! Potente, acelerada e sem freio',
    avatar: '⏱️',
    category: 'celebrities',
    pitch: 0.85,
    rate: 1.2,
    gender: 'male',
    sample: 'Ô loco bicho! Olha essa fera doando ao vivo na live meu!',
  },
  {
    id: 'voice-barba',
    name: 'O Companheiro (Orador)',
    analogy: 'Lula',
    detail: 'Grave, rouca, cadenciada e pausada',
    avatar: '🧔',
    category: 'celebrities',
    pitch: 0.68,
    rate: 0.82,
    gender: 'male',
    sample: 'Companheiro, nunca antes na história houve um Pix tão generoso!',
  },
  {
    id: 'voice-capitao',
    name: 'O Capitão (Comandante)',
    analogy: 'Bolsonaro',
    detail: 'Firme, impaciente, direta e enérgica',
    avatar: '🫡',
    category: 'celebrities',
    pitch: 0.88,
    rate: 1.22,
    gender: 'male',
    sample: 'Valeu pelo apoio aí, questão de honra na live, valeu!',
  },
  {
    id: 'voice-craque',
    name: 'Craque Revoltado',
    analogy: 'Craque Neto',
    detail: 'É uma barbaridade! Enfática e sem filtro',
    avatar: '😤',
    category: 'celebrities',
    pitch: 1.12,
    rate: 1.18,
    gender: 'male',
    sample:
      'É uma brincadeira, garotinho! Um Pix desse tamanho tem que aplaudir de pé!',
  },
  {
    id: 'voice-mano',
    name: 'Poeta da Quebrada',
    analogy: 'Mano Brown',
    detail: 'Grave pesado, rítmico e direto',
    avatar: '🕶️',
    category: 'celebrities',
    pitch: 0.58,
    rate: 0.88,
    gender: 'male',
    sample:
      '1 por amor, 2 por dinheiro. Se liga no Pix que chegou na humildade.',
  },
  {
    id: 'voice-filosofo',
    name: 'O Filósofo',
    analogy: 'Cortella',
    detail: 'Serena, profunda, reflexiva e solene',
    avatar: '🦉',
    category: 'celebrities',
    pitch: 0.82,
    rate: 0.85,
    gender: 'male',
    sample:
      'Faça o teu melhor, na condição que você tem, enquanto apoia a live.',
  },
  {
    id: 'voice-xuxa',
    name: 'Rainha dos Baixinhos',
    analogy: 'Xuxa',
    detail: 'Doce, fofa, alegre e bem aguda',
    avatar: '👑',
    category: 'celebrities',
    pitch: 1.5,
    rate: 1.05,
    gender: 'female',
    sample:
      'Um beijinho especial para o streamer e para você que mandou o Pix!',
  },
  {
    id: 'voice-monstro',
    name: 'Monstro da Jaula',
    analogy: 'Bodybuilder / Bambam',
    detail: 'Bora que tá saindo da jaula! Explosiva',
    avatar: '🏋️',
    category: 'celebrities',
    pitch: 0.42,
    rate: 1.15,
    gender: 'male',
    sample: 'Bora, não vai dar não? O monstro saiu da jaula com esse Pix!',
  },
  {
    id: 'voice-jornalista',
    name: 'Jornalista de Notícias',
    analogy: 'Apresentadora TV',
    detail: 'Formal, séria, dicção de telejornal',
    avatar: '📰',
    category: 'classic',
    pitch: 1.12,
    rate: 1.02,
    gender: 'female',
    sample:
      'Atenção para o plantão: apoio financeiro confirmado ao vivo nesta transmissão.',
  },
  {
    id: 'pt-BR-default',
    name: 'Google Tradutor',
    analogy: 'Voz Clássica',
    detail: 'A clássica voz neutra e direta da internet',
    avatar: '🤖',
    category: 'classic',
    pitch: 1.0,
    rate: 1.0,
    gender: 'default',
    sample:
      'Obrigado pelo apoio na live! Sua mensagem foi recebida com sucesso.',
  },
  {
    id: 'ai-popular-orator',
    name: 'Orador Popular',
    analogy: 'Líder de Massas',
    detail: 'Voz madura, pausada e reflexiva',
    avatar: '🗣️',
    category: 'classic',
    pitch: 0.72,
    rate: 0.78,
    gender: 'male',
    sample: 'Obrigado pelo apoio popular nesta transmissão!',
  },
  {
    id: 'ai-commander',
    name: 'Comandante Militar',
    analogy: 'Oficial',
    detail: 'Voz grave, marcial e decidida',
    avatar: '🎖️',
    category: 'gaming',
    pitch: 0.52,
    rate: 1.04,
    gender: 'male',
    sample: 'Apoio confirmado na base de operações!',
  },
  {
    id: 'character-cheerful',
    name: 'Torcida Animada',
    analogy: 'Gritador de Estádio',
    detail: 'Empolgação coletiva em alta voltagem',
    avatar: '🎉',
    category: 'gaming',
    pitch: 1.45,
    rate: 1.2,
    gender: 'male',
    sample: 'Bora que a live tá pegando fogo! Valeu demais pelo apoio!',
  },
  {
    id: 'character-robot',
    name: 'Androide Sintético',
    analogy: 'Ciborgue',
    detail: 'Digital, metálica e computadorizada',
    avatar: '👾',
    category: 'gaming',
    pitch: 0.25,
    rate: 0.75,
    gender: 'male',
    sample: 'Comando recebido. Notificação processada com sucesso no sistema.',
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
      const speech = new SpeechSynthesisUtterance(text);
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
