import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '5mb' }));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors({ exposedHeaders: ['Content-Disposition'] });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Stock Service API')
    .setDescription(
      'Dịch vụ theo dõi giá cổ phiếu Việt Nam.\n\n' +
        '**Xác thực:** Tất cả endpoint yêu cầu header `x-api-key`. ' +
        'Đặt biến môi trường `API_KEY` để bật guard.\n\n' +
        '**Settings quan trọng** (cấu hình qua `PUT /settings`):\n' +
        '- `stock.apiBaseUrl` — URL của stock-alert FastAPI service\n' +
        '- `stock.apiSource` — Nguồn dữ liệu mặc định (`KBS`, `VCI`)\n' +
        '- `stock.alertThresholdPercent` — Ngưỡng % biến động để gửi cảnh báo\n' +
        '- `discord.alertChannelId` — Channel ID Discord nhận cảnh báo',
    )
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'x-api-key')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(process.env.API_PORT ?? 3000, '0.0.0.0').then((server) => {
    server.setTimeout(400000);
    console.log(`App run on domain ${process.env.APP_DOMAIN}`);
    console.log(`App run on port ${process.env.API_PORT}`);
  });
}
bootstrap();
