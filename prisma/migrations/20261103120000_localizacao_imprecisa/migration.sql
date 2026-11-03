-- Localização com margem de erro grande demais para dizer se a pessoa estava no local
-- (ex.: computador localizado pela rede). Antes ela virava "fora do local".
ALTER TYPE "PunchLocationStatus" ADD VALUE 'IMPRECISE';
