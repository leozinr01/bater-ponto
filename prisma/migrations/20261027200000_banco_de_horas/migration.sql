-- AlterEnum
ALTER TYPE "AbsenceType" ADD VALUE 'COMPENSATION';

-- CreateTable
CREATE TABLE "hour_bank_entries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT NOT NULL,
    "canceled_at" TIMESTAMP(3),
    "canceled_by_id" TEXT,

    CONSTRAINT "hour_bank_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hour_bank_entries_user_id_date_idx" ON "hour_bank_entries"("user_id", "date");

-- AddForeignKey
ALTER TABLE "hour_bank_entries" ADD CONSTRAINT "hour_bank_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hour_bank_entries" ADD CONSTRAINT "hour_bank_entries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hour_bank_entries" ADD CONSTRAINT "hour_bank_entries_canceled_by_id_fkey" FOREIGN KEY ("canceled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
