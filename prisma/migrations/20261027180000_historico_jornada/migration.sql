-- CreateTable
CREATE TABLE "schedule_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "effective_from" TEXT NOT NULL,
    "work_schedule_id" TEXT,
    "start_time" TEXT,
    "daily_minutes" INTEGER,
    "work_days" INTEGER[],
    "late_tolerance_minutes" INTEGER,
    "overtime_tolerance_minutes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "schedule_history_user_id_effective_from_key" ON "schedule_history"("user_id", "effective_from");

-- AddForeignKey
ALTER TABLE "schedule_history" ADD CONSTRAINT "schedule_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_history" ADD CONSTRAINT "schedule_history_work_schedule_id_fkey" FOREIGN KEY ("work_schedule_id") REFERENCES "work_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Linha base: cada funcionário mantém a jornada atual para todo o passado
INSERT INTO "schedule_history" (
    "id", "user_id", "effective_from", "work_schedule_id",
    "start_time", "daily_minutes", "work_days",
    "late_tolerance_minutes", "overtime_tolerance_minutes"
)
SELECT
    gen_random_uuid()::text, u."id", '1970-01-01', ws."id",
    ws."start_time", ws."daily_minutes", COALESCE(ws."work_days", ARRAY[]::INTEGER[]),
    ws."late_tolerance_minutes", ws."overtime_tolerance_minutes"
FROM "users" u
LEFT JOIN "work_schedules" ws ON ws."id" = u."work_schedule_id";
