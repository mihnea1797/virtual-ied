/*
  Warnings:

  - You are about to drop the column `settingId` on the `sensor_data` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "sensor_data" DROP CONSTRAINT "sensor_data_settingId_fkey";

-- AlterTable
ALTER TABLE "sensor_data" DROP COLUMN "settingId";
