/**
 * Cria o primeiro administrador. Não existe cadastro público: depois disso,
 * novos usuários são criados por um administrador em POST /api/employees.
 *
 * Uso: ADMIN_NAME="Nome" ADMIN_EMAIL=admin@empresa.com ADMIN_PASSWORD='...' npm run admin:create
 */
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import 'dotenv/config';

async function main() {
  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!name || !email || !password) {
    throw new Error('Defina ADMIN_NAME, ADMIN_EMAIL e ADMIN_PASSWORD');
  }
  if (password.length < 8 || password.length > 72) {
    throw new Error('A senha deve ter entre 8 e 72 caracteres');
  }

  const prisma = new PrismaClient();
  try {
    if (await prisma.user.findUnique({ where: { email } })) {
      throw new Error(`Já existe um usuário com o e-mail ${email}`);
    }
    const user = await prisma.user.create({
      data: { name, email, role: 'ADMIN', password: await hash(password, 10) },
    });
    console.log(`Administrador criado: ${user.email} (${user.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
