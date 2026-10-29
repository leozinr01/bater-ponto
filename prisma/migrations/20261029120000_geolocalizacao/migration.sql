-- CreateEnum
CREATE TYPE "PunchLocationStatus" AS ENUM ('INSIDE', 'OUTSIDE', 'UNAVAILABLE');

-- CreateTable
CREATE TABLE "workplaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radius_meters" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "workplaces_pkey" PRIMARY KEY ("id")
);

-- AlterTable: a localização é gravada junto com a marcação e fica protegida pela
-- trava de imutabilidade (o trigger compara a linha inteira)
ALTER TABLE "punch_clocks"
    ADD COLUMN "latitude" DOUBLE PRECISION,
    ADD COLUMN "longitude" DOUBLE PRECISION,
    ADD COLUMN "accuracy_meters" DOUBLE PRECISION,
    ADD COLUMN "location_status" "PunchLocationStatus",
    ADD COLUMN "workplace_name" TEXT,
    ADD COLUMN "distance_meters" INTEGER;
