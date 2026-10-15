import {
  Controller,
  Get,
  Inject,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { TtsService } from './tts.service';

@Controller('public/tts')
export class TtsController {
  constructor(@Inject(TtsService) private readonly tts: TtsService) {}

  @Get()
  async getTts(
    @Query('voice') voice: string | undefined,
    @Query('text') text: string | undefined,
    @Res() res: Response,
  ) {
    const audioBuffer = await this.tts.synthesize(
      voice || 'voice-silvio',
      text || 'Alerta StreamOS',
    );

    const isWav =
      audioBuffer.length >= 4 &&
      audioBuffer[0] === 0x52 && // 'R'
      audioBuffer[1] === 0x49 && // 'I'
      audioBuffer[2] === 0x46 && // 'F'
      audioBuffer[3] === 0x46; // 'F'

    res.setHeader('Content-Type', isWav ? 'audio/wav' : 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.setHeader('Content-Length', audioBuffer.length);
    res.status(200).end(audioBuffer);
  }
}

