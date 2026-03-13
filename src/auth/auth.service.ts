import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from 'src/users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  login(user: User) {
    const payload = {
      username: user.username,
      sub: user.id,
      email: user.email,
      isSeller: user.isSeller || false,
      stripeConnectAccountId: user.stripeConnectAccountId || null,
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
