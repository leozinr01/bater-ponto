import { EnvService } from '@/infra/env/env.service';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

export const swaggerSetup = (app: INestApplication) => {
  const config = new DocumentBuilder()
    .setTitle('Sistema de Ponto')
    .setDescription(
      'API de controle de ponto. Autentique em POST /api/auth/login e use o accessToken no botão "Authorize".',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, documentFactory);
};

/** Configuração compartilhada entre a aplicação e os testes e2e. */
export const appSetup = (app: INestApplication, env: EnvService) => {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Cabeçalhos de segurança HTTP; a API só devolve JSON, então a CSP padrão não atrapalha
  app.use(helmet());

  const corsOrigin = env.get('CORS_ORIGIN');
  if (corsOrigin) {
    app.enableCors({ origin: corsOrigin.split(',').map((o) => o.trim()) });
  }

  // Documentação interativa só fora de produção: não expõe o mapa da API publicamente
  if (env.get('NODE_ENV') !== 'production') {
    swaggerSetup(app);
  }
};
