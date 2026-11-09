-- Endereço aproximado da batida (OpenStreetMap) e batidas feitas sem internet.
-- Colunas novas com valor padrão: as marcações existentes não mudam (a trava de imutabilidade
-- compara a linha inteira e passa a proteger estas colunas também).
ALTER TABLE "punch_clocks" ADD COLUMN "address" TEXT;
ALTER TABLE "punch_clocks" ADD COLUMN "offline" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "punch_clocks" ADD COLUMN "client_id" TEXT;

CREATE UNIQUE INDEX "punch_clocks_client_id_key" ON "punch_clocks"("client_id");
