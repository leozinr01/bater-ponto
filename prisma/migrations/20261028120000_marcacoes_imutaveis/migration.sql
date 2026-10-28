-- Marcações de ponto não podem ser apagadas nem alteradas, nem direto no banco.
-- A única mudança permitida é desconsiderar uma marcação ainda válida (voided_at,
-- voided_by_id e void_reason), que é o que a correção da API faz.
CREATE FUNCTION "punch_clocks_imutaveis"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('DELETE', 'TRUNCATE') THEN
    RAISE EXCEPTION 'Marcações de ponto não podem ser apagadas: use a correção (desconsiderar)';
  END IF;

  IF OLD."voided_at" IS NOT NULL
    OR NEW."voided_at" IS NULL
    OR (NEW."id", NEW."userId", NEW."timestamp", NEW."source", NEW."created_at",
        NEW."created_by_id", NEW."reason", NEW."replaces_id")
       IS DISTINCT FROM
       (OLD."id", OLD."userId", OLD."timestamp", OLD."source", OLD."created_at",
        OLD."created_by_id", OLD."reason", OLD."replaces_id")
  THEN
    RAISE EXCEPTION 'Marcações de ponto não podem ser alteradas: use a correção (desconsiderar e incluir)';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "punch_clocks_imutaveis_linha"
BEFORE UPDATE OR DELETE ON "punch_clocks"
FOR EACH ROW EXECUTE FUNCTION "punch_clocks_imutaveis"();

CREATE TRIGGER "punch_clocks_imutaveis_truncate"
BEFORE TRUNCATE ON "punch_clocks"
FOR EACH STATEMENT EXECUTE FUNCTION "punch_clocks_imutaveis"();
