-- CreateEnum
CREATE TYPE "PunchSource" AS ENUM ('EMPLOYEE', 'ADMIN');

-- AlterTable
ALTER TABLE "punch_clocks" ADD COLUMN     "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by_id" TEXT,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "replaces_id" TEXT,
ADD COLUMN     "source" "PunchSource" NOT NULL DEFAULT 'EMPLOYEE',
ADD COLUMN     "void_reason" TEXT,
ADD COLUMN     "voided_at" TIMESTAMPTZ(3),
ADD COLUMN     "voided_by_id" TEXT,
ALTER COLUMN "type" DROP NOT NULL,
-- Valores antigos foram gravados pelo Prisma em UTC: converter preservando o instante.
ALTER COLUMN "timestamp" SET DATA TYPE TIMESTAMPTZ(3) USING "timestamp" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "token_version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "work_schedule_id" TEXT;

-- CreateTable
CREATE TABLE "work_schedules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "daily_minutes" INTEGER NOT NULL,
    "work_days" INTEGER[],
    "late_tolerance_minutes" INTEGER NOT NULL DEFAULT 10,
    "overtime_tolerance_minutes" INTEGER NOT NULL DEFAULT 10,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "work_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "punch_clocks_userId_timestamp_idx" ON "punch_clocks"("userId", "timestamp");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_work_schedule_id_fkey" FOREIGN KEY ("work_schedule_id") REFERENCES "work_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_clocks" ADD CONSTRAINT "punch_clocks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_clocks" ADD CONSTRAINT "punch_clocks_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_clocks" ADD CONSTRAINT "punch_clocks_replaces_id_fkey" FOREIGN KEY ("replaces_id") REFERENCES "punch_clocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
