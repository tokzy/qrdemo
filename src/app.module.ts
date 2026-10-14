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
        const password = configService.get<string>('REDIS_PASSWORD')?.trim();
        const username = configService.get<string>('REDIS_USERNAME')?.trim();

        return {
          redis: {
            host: configService.get<string>('REDIS_HOST') || 'localhost',
            port: Number(configService.get('REDIS_PORT') || 6379),
            ...(username ? { username } : {}),
            ...(password ? { password } : {}),
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
