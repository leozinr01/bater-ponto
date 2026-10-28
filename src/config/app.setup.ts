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

  // Cabeçalhos de segurança HTTP. Sem upgrade-insecure-requests: em HTTP fora do localhost
  // (celular na rede, container) ele forçaria os arquivos do Swagger para https e a página ficaria em branco
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } },
    }),
  );

  const trustProxy = env.get('TRUST_PROXY');
  if (trustProxy !== undefined) {
    app.getHttpAdapter().getInstance().set('trust proxy', trustProxy);
  }

  const corsOrigin = env.get('CORS_ORIGIN');
  if (corsOrigin) {
    app.enableCors({
      origin: corsOrigin.split(',').map((o) => o.trim()),
      // O app acerta o relógio pelo Date das respostas, mesmo em outro domínio
      exposedHeaders: ['Date'],
    });
  }

  // Documentação interativa só quando ligada de propósito: um deploy que esqueça
  // alguma variável não expõe o mapa da API
  if (env.get('SWAGGER_ENABLED')) {
    swaggerSetup(app);
  }
};
