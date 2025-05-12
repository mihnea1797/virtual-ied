-- CreateEnum
CREATE TYPE "NoiseType" AS ENUM ('NOISY', 'CLEAN');

-- AlterTable
ALTER TABLE "sensor_data" ADD COLUMN     "noiseType" "NoiseType" NOT NULL DEFAULT 'CLEAN';

-- CreateIndex
CREATE INDEX "sensor_data_noiseType_time_idx" ON "sensor_data"("noiseType", "time");
