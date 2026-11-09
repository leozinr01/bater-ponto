-- Lembretes de entrada e saída por e-mail: ligados por padrão, cada funcionário pode desligar.
ALTER TABLE "users" ADD COLUMN "email_reminders" BOOLEAN NOT NULL DEFAULT true;
