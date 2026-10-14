import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const email = this.configService.get<string>('ADMIN_EMAIL')?.trim().toLowerCase();
    const password = this.configService.get<string>('ADMIN_PASSWORD');
    const name = this.configService.get<string>('ADMIN_NAME')?.trim() || 'Administrator';

    if (!email || !password) {
      throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be configured');
    }

    const existing = await this.userRepository.findOne({ where: { email } });
    const passwordHash = await bcrypt.hash(password, 10);

    if (!existing) {
      await this.userRepository.save(
        this.userRepository.create({ email, name, passwordHash }),
      );
      return;
    }

    const samePassword = await bcrypt.compare(password, existing.passwordHash);
    if (!samePassword || existing.name !== name) {
      existing.passwordHash = samePassword ? existing.passwordHash : passwordHash;
      existing.name = name;
      await this.userRepository.save(existing);
    }
  }

  async validateUser(email: string, password: string): Promise<AuthUser> {
    const normalized = email?.trim().toLowerCase();
    const user = normalized
      ? await this.userRepository.findOne({ where: { email: normalized } })
      : null;
    const matches =
      user && password
        ? await bcrypt.compare(password, user.passwordHash)
        : false;

    if (!user || !matches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return { id: user.id, email: user.email, name: user.name };
  }

  async findById(id: string): Promise<AuthUser | null> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      return null;
    }
    return { id: user.id, email: user.email, name: user.name };
  }

  async login(user: AuthUser) {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });

    return {
      statusCode: 200,
      message: 'Logged in',
      data: {
        accessToken,
        email: user.email,
        name: user.name,
      },
    };
  }
}
