import { Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private readonly transport = nodemailer.createTransport({
    host: process.env.MAIL_HOST ?? 'localhost',
    port: Number(process.env.MAIL_PORT ?? 1025),
    secure: false,
  });

  async sendPasswordReset(email: string, token: string) {
    const url = `${process.env.APP_URL ?? 'http://localhost:3000'}/redefinir-senha?token=${encodeURIComponent(token)}`;
    await this.transport.sendMail({
      from: 'StreamOS Local <no-reply@streamos.local>',
      to: email,
      subject: 'Redefina sua senha do StreamOS',
      text: `Use este link para redefinir sua senha: ${url}\n\nO link expira em 30 minutos.`,
      html: `<h1>Redefina sua senha</h1><p>O link abaixo expira em 30 minutos.</p><p><a href="${url}">Criar nova senha</a></p>`,
    });
  }
}
