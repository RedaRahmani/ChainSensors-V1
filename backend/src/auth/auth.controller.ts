import { Controller, Request, Post, UseGuards } from '@nestjs/common';
import { AuthService }     from './auth.service';
import { LocalAuthGuard }  from '../guards/local-auth.guard';
import { JwtAuthGuard }    from '../guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req) {
    return this.auth.login(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('profile')
  profile(@Request() req) {
    return req.user;
  }
}
