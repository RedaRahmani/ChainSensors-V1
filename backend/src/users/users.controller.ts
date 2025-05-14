import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import * as bcrypt from 'bcrypt';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post('register')
  async register(
    @Body() body: { email: string; password: string }
  ) {
    const existing = await this.users.findByEmail(body.email);
    if (existing) throw new BadRequestException('Email already in use');
    const hash = await bcrypt.hash(body.password, 10);
    return this.users.create(body.email, hash);
  }
}
