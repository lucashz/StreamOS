import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, promises as fs } from 'node:fs';
import { join } from 'node:path';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

interface VoiceMapping {
  edgeVoice: string;
  pitch?: string;
  rate?: string;
  elevenVoiceId?: string;
}

const VOICE_PROFILES: Record<string, VoiceMapping> = {
  'voice-silvio': {
    edgeVoice: 'pt-BR-AntonioNeural',
    pitch: '+14%',
    rate: '+8%',
    elevenVoiceId: process.env.ELEVENLABS_VOICE_SILVIO,
  },
  'voice-galvao': {
    edgeVoice: 'pt-BR-AntonioNeural',
    pitch: '+2%',
    rate: '+16%',
    elevenVoiceId: process.env.ELEVENLABS_VOICE_GALVAO,
  },
  'voice-faustao': {
    edgeVoice: 'pt-BR-AntonioNeural',
    pitch: '-12%',
    rate: '+6%',
    elevenVoiceId: process.env.ELEVENLABS_VOICE_FAUSTAO,
  },
  'voice-mano': {
    edgeVoice: 'pt-BR-AntonioNeural',
    pitch: '-18%',
    rate: '-6%',
    elevenVoiceId: process.env.ELEVENLABS_VOICE_MANO,
  },
  'voice-craque': {
    edgeVoice: 'pt-BR-AntonioNeural',
    pitch: '+8%',
    rate: '+14%',
    elevenVoiceId: process.env.ELEVENLABS_VOICE_CRAQUE,
  },
  'voice-barba': {
    edgeVoice: 'pt-BR-AntonioNeural',
    pitch: '-14%',
    rate: '-10%',
    elevenVoiceId: process.env.ELEVENLABS_VOICE_BARBA,
  },
  'voice-capitao': {
    edgeVoice: 'pt-BR-AntonioNeural',
    pitch: '+4%',
    rate: '+8%',
    elevenVoiceId: process.env.ELEVENLABS_VOICE_CAPITAO,
  },
  'voice-monstro': {
    edgeVoice: 'pt-BR-AntonioNeural',
    pitch: '-20%',
    rate: '+12%',
    elevenVoiceId: process.env.ELEVENLABS_VOICE_MONSTRO,
  },
  'voice-xuxa': {
    edgeVoice: 'pt-BR-FranciscaNeural',
    pitch: '+16%',
    rate: '+6%',
    elevenVoiceId: process.env.ELEVENLABS_VOICE_XUXA,
  },
  'voice-filosofo': {
    edgeVoice: 'pt-BR-AntonioNeural',
    pitch: '-8%',
    rate: '-12%',
    elevenVoiceId: process.env.ELEVENLABS_VOICE_FILOSOFO,
  },
  'voice-jornalista': {
    edgeVoice: 'pt-BR-FranciscaNeural',
    pitch: '+2%',
    rate: '+8%',
    elevenVoiceId: process.env.ELEVENLABS_VOICE_JORNALISTA,
  },
  'voice-tradutor': {
    edgeVoice: 'pt-BR-FranciscaNeural',
    pitch: '0%',
    rate: '0%',
    elevenVoiceId: process.env.ELEVENLABS_VOICE_TRADUTOR,
  },
  'pt-br-masc': {
    edgeVoice: 'pt-BR-AntonioNeural',
    elevenVoiceId: process.env.ELEVENLABS_VOICE_MASC,
  },
  'pt-br-fem': {
    edgeVoice: 'pt-BR-FranciscaNeural',
    elevenVoiceId: process.env.ELEVENLABS_VOICE_FEM,
  },
  'pt-br-energetica': {
    edgeVoice: 'pt-BR-ThalitaMultilingualNeural',
    pitch: '+6%',
    rate: '+10%',
    elevenVoiceId: process.env.ELEVENLABS_VOICE_ENERGETICA,
  },
  'pt-br-gamer': {
    edgeVoice: 'pt-BR-AntonioNeural',
    pitch: '+8%',
    rate: '+10%',
    elevenVoiceId: process.env.ELEVENLABS_VOICE_GAMER,
  },
};

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);
  private readonly cacheDir = join(process.cwd(), '.runtime', 'tts-cache');

  constructor() {
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  async synthesize(voiceId: string, rawText: string): Promise<Buffer> {
    const text = (rawText || '').trim().slice(0, 300) || 'StreamOS';
    const defaultProfile: VoiceMapping = { edgeVoice: 'pt-BR-AntonioNeural' };
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

    // 2. Tentar síntese primária com ElevenLabs se configurado
    const elevenKey = process.env.ELEVENLABS_API_KEY;
    const elevenVoiceId = profile.elevenVoiceId;

    if (elevenKey && elevenVoiceId) {
      try {
        const audioBuffer = await this.synthesizeElevenLabs(
          elevenKey,
          elevenVoiceId,
          text,
        );
        if (audioBuffer && audioBuffer.length > 0) {
          void fs.writeFile(cachePath, audioBuffer).catch(() => null);
          return audioBuffer;
        }
      } catch (error) {
        this.logger.warn(
          `ElevenLabs falhou para voz ${voiceId}, acionando fallback neural: ${String(error)}`,
        );
      }
    }

    // 3. Fallback inteligente: Microsoft Edge Neural TTS
    try {
      const fallbackBuffer = await this.synthesizeEdgeNeural(profile, text);
      if (fallbackBuffer && fallbackBuffer.length > 0) {
        void fs.writeFile(cachePath, fallbackBuffer).catch(() => null);
        return fallbackBuffer;
      }
    } catch (error) {
      this.logger.error(
        `Falha na síntese Edge Neural TTS para ${voiceId}: ${String(error)}`,
      );
    }

    // 4. Fallback de emergência (frame silencioso de áudio MP3 válido)
    return Buffer.from([
      0xff, 0xfb, 0x90, 0x64, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
    ]);
  }

  private async synthesizeElevenLabs(
    apiKey: string,
    voiceId: string,
    text: string,
  ): Promise<Buffer> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': apiKey,
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
            },
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } finally {
      clearTimeout(timeout);
    }
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

