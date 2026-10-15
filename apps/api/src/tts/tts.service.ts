import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, promises as fs } from 'node:fs';
import { join } from 'node:path';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

interface VoiceMapping {
  speakerFile?: string;
  edgeVoice: string;
  pitch?: string;
  rate?: string;
}

const VOICE_PROFILES: Record<string, VoiceMapping> = {
  'voice-silvio': {
    speakerFile: 'silvio.mp3',
    edgeVoice: 'pt-BR-AntonioNeural',
    pitch: '+12%',
    rate: '+6%',
  },
  'voice-faustao': {
    speakerFile: 'faustao.mp3',
    edgeVoice: 'pt-BR-AntonioNeural',
    pitch: '-12%',
    rate: '+8%',
  },
  'voice-galvao': {
    speakerFile: 'galvao.mp3',
    edgeVoice: 'pt-BR-AntonioNeural',
    pitch: '+2%',
    rate: '+14%',
  },
  'voice-craque': {
    speakerFile: 'craque.mp3',
    edgeVoice: 'pt-BR-AntonioNeural',
    pitch: '+6%',
    rate: '+12%',
  },
  'voice-mano': {
    speakerFile: 'mano.mp3',
    edgeVoice: 'pt-BR-AntonioNeural',
    pitch: '-18%',
    rate: '-6%',
  },
};

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);
  private readonly cacheDir = join(process.cwd(), '.runtime', 'tts-cache');
  private readonly speakersDir: string;

  constructor() {
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }
    const rootSpeakers = join(process.cwd(), 'apps', 'api', 'voices', 'speakers');
    const localSpeakers = join(process.cwd(), 'voices', 'speakers');
    this.speakersDir = existsSync(rootSpeakers) ? rootSpeakers : localSpeakers;
  }

  async synthesize(voiceId: string, rawText: string): Promise<Buffer> {
    const text = (rawText || '').trim().slice(0, 300);
    const defaultProfile: VoiceMapping = {
      edgeVoice: 'pt-BR-AntonioNeural',
      speakerFile: 'silvio.mp3',
    };
    const profile: VoiceMapping =
      VOICE_PROFILES[voiceId] ??
      VOICE_PROFILES['voice-silvio'] ??
      defaultProfile;

    // 1. Verificar cache em disco (SHA256 da voz + texto)
    const hash = createHash('sha256')
      .update(`${voiceId}:${text}`)
      .digest('hex');
    const cachePath = join(this.cacheDir, `${hash}.mp3`);

    try {
      if (existsSync(cachePath)) {
        return await fs.readFile(cachePath);
      }
    } catch {
      // Ignora erro de leitura do cache e prossegue com a síntese
    }

    // 2. Carregar o bordão autêntico da celebridade
    let introBuffer: Buffer | null = null;
    if (profile.speakerFile) {
      const speakerPath = join(this.speakersDir, profile.speakerFile);
      if (existsSync(speakerPath)) {
        try {
          introBuffer = await fs.readFile(speakerPath);
        } catch {
          introBuffer = null;
        }
      }
    }

    // Se o texto for vazio ou o texto padrão da persona, toca o áudio 100% original da celebridade!
    if (!text || text === 'Alerta StreamOS' || text === 'Boa sorte na live!') {
      if (introBuffer && introBuffer.length > 0) {
        void fs.writeFile(cachePath, introBuffer).catch(() => null);
        return introBuffer;
      }
    }

    // 3. Sintetizar a mensagem do doador com Edge Neural TTS
    try {
      const messageBuffer = await this.synthesizeEdgeNeural(profile, text);
      if (messageBuffer && messageBuffer.length > 0) {
        // Se temos o bordão original, combina: [BORDÃO ORIGINAL] + [MENSAGEM DO PIX]
        const finalBuffer =
          introBuffer && introBuffer.length > 0
            ? Buffer.concat([introBuffer, messageBuffer])
            : messageBuffer;

        void fs.writeFile(cachePath, finalBuffer).catch(() => null);
        return finalBuffer;
      }
    } catch (error) {
      this.logger.error(
        `Falha na síntese Edge Neural TTS para ${voiceId}: ${String(error)}`,
      );
    }

    // Se a síntese falhar mas tivermos o bordão original, retorna o bordão autêntico
    if (introBuffer && introBuffer.length > 0) {
      return introBuffer;
    }

    // Fallback de emergência (frame silencioso de áudio MP3 válido)
    return Buffer.from([
      0xff, 0xfb, 0x90, 0x64, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
    ]);
  }

  private async synthesizeEdgeNeural(
    profile: VoiceMapping,
    text: string,
  ): Promise<Buffer> {
    // Escapar caracteres XML para montagem do SSML
    const sanitized = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const tts = new MsEdgeTTS();
    await tts.setMetadata(
      profile.edgeVoice,
      OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3,
    );

    const { audioStream } = tts.toStream(sanitized, {
      pitch: profile.pitch ?? '+0%',
      rate: profile.rate ?? '+0%',
    });

    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const timer = setTimeout(() => {
        try {
          tts.close();
        } catch {
          // Ignora erro ao fechar socket
        }
        reject(new Error('Edge TTS síntese atingiu timeout de 7s'));
      }, 7000);

      audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
      audioStream.on('end', () => {
        clearTimeout(timer);
        try {
          tts.close();
        } catch {
          // Ignora erro ao fechar socket
        }
        resolve(Buffer.concat(chunks));
      });
      audioStream.on('error', (err: unknown) => {
        clearTimeout(timer);
        try {
          tts.close();
        } catch {
          // Ignora erro ao fechar socket
        }
        reject(err);
      });
    });
  }
}

