import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import envs from './config/envs';
import { Logger } from '@nestjs/common';
import { Transport } from '@nestjs/microservices';

async function bootstrap() {

  const logger = new Logger('Orders-MS')

  const app = await NestFactory.createMicroservice(AppModule, {
    transport: Transport.TCP,
    options: {
      port: envs.port,
  
    }
  });
  await app.listen();

  


  logger.log(`Microserivces started on port ${envs.port}`)

}
bootstrap();
