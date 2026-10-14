import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { FintavaService } from './fintava.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
    }),
  ],
  providers: [FintavaService],
  exports: [FintavaService],
})
export class FintavaModule {}
