import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from './database/typeorm.config';
import { AuthModule } from './modules/auth/auth.module';
import { QrcodeModule } from './modules/qrcode/qrcode.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // cache:true,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>('REDIS_HOST')?.trim();
        const username = configService.get<string>('REDIS_USERNAME')?.trim();
        const password = configService.get<string>('REDIS_PASSWORD')?.trim();
        const tls =
          host && host !== 'localhost' && host !== '127.0.0.1'
            ? { rejectUnauthorized: false }
            : undefined;

        return {
          redis: {
            host,
            port: Number(configService.get<string>('REDIS_PORT')),
            family: 4,
            connectTimeout: 10000,
            enableReadyCheck: false,
            maxRetriesPerRequest: null,
            ...(username ? { username } : {}),
            ...(password ? { password } : {}),
            ...(tls ? { tls } : {}),
          },
        };
      },
    }),
    DatabaseModule,
    AuthModule,
    QrcodeModule,
  ],
  providers: [],
})
export class AppModule {}
