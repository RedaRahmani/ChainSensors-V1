import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
  ) {}

  async validateUser(email: string, pass: string) {
    const user = await this.users.findByEmail(email);
    if (user && (await bcrypt.compare(pass, user.passwordHash))) {
      const { passwordHash, ...u } = user.toObject();
      return u;
    }
    return null;
  }

  async login(user: any) {
    const payload = { sub: user._id, email: user.email };
    return {
      access_token: this.jwt.sign(payload),
      refresh_token: this.jwt.sign(payload, { expiresIn: '7d' }),
    };
  }
}
