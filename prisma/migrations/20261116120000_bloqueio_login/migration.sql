-- Bloqueio temporário de login depois de muitas senhas erradas seguidas.
-- Fica no banco (e não na memória do servidor) para valer em todas as instâncias da Vercel.
ALTER TABLE "users" ADD COLUMN "failed_logins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "locked_until" TIMESTAMP(3);
