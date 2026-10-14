import { ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { useContainer } from 'class-validator';
import { GlobalExceptionFilter } from './common/utils/exception.filters';
import * as bodyParser from 'body-parser';
import { setupBullBoard } from './config/queue/bull-board.setup';
import { swaggerSetup } from './config/swagger/swagger.setup';
import { NextFunction, Request, Response } from 'express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const frontendPath = join(process.cwd(), 'frontend');

  const page = (fileName: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return next();
      }
      return res.sendFile(join(frontendPath, fileName));
    };
  };

  app.use('/login', page('login.html'));
  app.use('/dashboard', page('dashboard.html'));
  app.use('/transactions', page('transactions.html'));
  app.use('/generate', page('generate.html'));
  app.use(
    '/beneficiary/:id',
    (req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return next();
      }
      return res.sendFile(join(frontendPath, 'beneficiary.html'));
    },
  );
  app.useStaticAssets(frontendPath);
  app.setGlobalPrefix('api');
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      /* set to true in production to disable error messages from showing in response body */
      disableErrorMessages: false,
      whitelist: true,
      transform: true,
    }),
  );
  useContainer(app.select(AppModule), { fallbackOnErrors: true });
  const httpAdapterHost = app.get(HttpAdapterHost);
  app.useGlobalFilters(new GlobalExceptionFilter(httpAdapterHost));
  swaggerSetup(app);
  setupBullBoard(app);
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

  const port = process.env.appPort || 4001;
  await app.listen(port);
}
bootstrap();
