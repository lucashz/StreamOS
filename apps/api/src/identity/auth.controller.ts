import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  Param,
  Put,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';

const COOKIE = 'streamos_session';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post('register')
  async register(
    @Body()
    body: {
      email: string;
      password: string;
      displayName: string;
      acceptTerms: boolean;
    },
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.register(body, this.metadata(request));
    this.setCookie(response, result.sessionToken);
    return result.user;
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: { email: string; password: string },
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(body, this.metadata(request));
    this.setCookie(response, result.sessionToken);
    return { ok: true };
  }

  @Get('me')
  me(@Req() request: Request) {
    return this.auth.me(request.cookies?.[COOKIE] as string | undefined);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(request.cookies?.[COOKIE] as string | undefined);
    response.clearCookie(COOKIE);
  }

  @Post('organizations/:id/select')
  @HttpCode(200)
  selectOrganization(@Param('id') id: string, @Req() request: Request) {
    return this.auth.selectOrganization(
      request.cookies?.[COOKIE] as string | undefined,
      id,
    );
  }

  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(@Body() body: { email: string }) {
    return this.auth.requestPasswordReset(body.email ?? '');
  }

  @Post('reset-password')
  @HttpCode(200)
  resetPassword(@Body() body: { token: string; password: string }) {
    return this.auth.resetPassword(body.token ?? '', body.password ?? '');
  }

  @Put('account/profile')
  updateProfile(
    @Req() request: Request,
    @Body()
    body: {
      email: string;
      displayName: string;
      bio?: string;
      avatarUrl?: string;
    },
  ) {
    return this.auth.updateProfile(
      request.cookies?.[COOKIE] as string | undefined,
      body,
    );
  }

  @Put('account/password')
  changePassword(
    @Req() request: Request,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.auth.changePassword(
      request.cookies?.[COOKIE] as string | undefined,
      body.currentPassword ?? '',
      body.newPassword ?? '',
    );
  }

  @Get('account/sessions')
  sessions(@Req() request: Request) {
    return this.auth.sessions(request.cookies?.[COOKIE] as string | undefined);
  }

  @Delete('account/sessions/:id')
  async revokeSession(
    @Param('id') id: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.revokeSession(
      request.cookies?.[COOKIE] as string | undefined,
      id,
    );
    if (result.current) response.clearCookie(COOKIE);
    return result;
  }

  @Post('account/logout-all')
  @HttpCode(204)
  async logoutAll(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logoutAll(request.cookies?.[COOKIE] as string | undefined);
    response.clearCookie(COOKIE);
  }

  @Post('account/deactivate-organization')
  @HttpCode(204)
  async deactivateOrganization(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() body: { confirmation: string },
  ) {
    await this.auth.deactivateOrganization(
      request.cookies?.[COOKIE] as string | undefined,
      body.confirmation ?? '',
    );
    response.clearCookie(COOKIE);
  }

  private metadata(request: Request) {
    return {
      userAgent: request.get('user-agent'),
      ipAddress: request.ip,
    };
  }

  private setCookie(response: Response, token: string) {
    response.cookie(COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 30,
      path: '/',
    });
  }
}
