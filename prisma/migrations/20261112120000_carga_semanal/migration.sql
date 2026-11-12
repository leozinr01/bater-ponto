-- Jornada passa de carga diária para carga semanal (diária × dias de trabalho).
ALTER TABLE "work_schedules" ADD COLUMN "weekly_minutes" INTEGER;
UPDATE "work_schedules" SET "weekly_minutes" = "daily_minutes" * cardinality("work_days");
ALTER TABLE "work_schedules" ALTER COLUMN "weekly_minutes" SET NOT NULL;
ALTER TABLE "work_schedules" DROP COLUMN "daily_minutes";

ALTER TABLE "schedule_history" ADD COLUMN "weekly_minutes" INTEGER;
UPDATE "schedule_history" SET "weekly_minutes" = "daily_minutes" * cardinality("work_days")
  WHERE "daily_minutes" IS NOT NULL;
ALTER TABLE "schedule_history" DROP COLUMN "daily_minutes";
