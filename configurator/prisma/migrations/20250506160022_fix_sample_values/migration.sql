/*
  Warnings:

  - You are about to drop the column `noiseType` on the `sensor_data` table. All the data in the column will be lost.
  - You are about to drop the `SampledValuesSetting` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "sensor_data" DROP CONSTRAINT "sensor_data_settingId_fkey";

-- DropIndex
DROP INDEX "sensor_data_noiseType_time_idx";

-- AlterTable
ALTER TABLE "sensor_data" DROP COLUMN "noiseType";

-- DropTable
DROP TABLE "SampledValuesSetting";

-- CreateTable
CREATE TABLE "sampled_values_setting" (
    "id" TEXT NOT NULL,
    "appId" INTEGER NOT NULL,
    "ethernetInterface" TEXT NOT NULL,
    "dstAddressCheck" BOOLEAN NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sampled_values_setting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sensor_data_time_idx" ON "sensor_data"("time");

-- AddForeignKey
ALTER TABLE "sensor_data" ADD CONSTRAINT "sensor_data_settingId_fkey" FOREIGN KEY ("settingId") REFERENCES "sampled_values_setting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
