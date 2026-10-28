-- Reforça a trava das marcações:
-- - desconsiderar exige quem fez e o motivo (voided_by_id e void_reason), como na API;
-- - a comparação usa a linha inteira, então colunas criadas no futuro também ficam protegidas.
CREATE OR REPLACE FUNCTION "punch_clocks_imutaveis"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('DELETE', 'TRUNCATE') THEN
    RAISE EXCEPTION 'Marcações de ponto não podem ser apagadas: use a correção (desconsiderar)';
  END IF;

  IF OLD."voided_at" IS NOT NULL
    OR NEW."voided_at" IS NULL
    OR (to_jsonb(NEW) - 'voided_at' - 'voided_by_id' - 'void_reason')
       IS DISTINCT FROM
       (to_jsonb(OLD) - 'voided_at' - 'voided_by_id' - 'void_reason')
  THEN
    RAISE EXCEPTION 'Marcações de ponto não podem ser alteradas: use a correção (desconsiderar e incluir)';
  END IF;

  IF NEW."voided_by_id" IS NULL OR coalesce(trim(NEW."void_reason"), '') = '' THEN
    RAISE EXCEPTION 'Para desconsiderar uma marcação, informe quem fez e o motivo';
  END IF;

  RETURN NEW;
END;
$$;
