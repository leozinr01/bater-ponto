// Função serverless da Vercel: a API NestJS inteira atende /api/* (veja vercel.json).
// Usa o build da API (dist/), que já resolve os imports com "@/".
const express = require('express');
const { NestFactory } = require('@nestjs/core');
const { ExpressAdapter } = require('@nestjs/platform-express');
const { AppModule } = require('../dist/app.module');
const { appSetup } = require('../dist/config/app.setup');
const { EnvService } = require('../dist/infra/env/env.service');

// A mesma instância atende várias requisições enquanto a função estiver "quente"
let ready;

async function bootstrap() {
  const server = express();
  // Atrás do proxy da Vercel: o IP real vem do X-Forwarded-For (usado no limite de tentativas de login)
  server.set('trust proxy', true);

  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    logger: ['error', 'warn'],
  });
  appSetup(app, app.get(EnvService));
  await app.init();
  return server;
}

module.exports = async (req, res) => {
  ready ??= bootstrap().catch((error) => {
    // Falhou ao subir (ex.: variável de ambiente inválida): tenta de novo na próxima requisição
    ready = undefined;
    throw error;
  });
  const server = await ready;
  server(req, res);
};
