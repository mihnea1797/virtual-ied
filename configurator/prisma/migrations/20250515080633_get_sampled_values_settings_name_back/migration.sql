/*
  Warnings:

  - You are about to drop the `sampled_values_setting` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "sampled_values_setting";

-- CreateTable
CREATE TABLE "SampledValuesSetting" (
    "id" TEXT NOT NULL,
    "appId" INTEGER NOT NULL,
    "ethernetInterface" TEXT NOT NULL,
    "dstAddressCheck" BOOLEAN NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SampledValuesSetting_pkey" PRIMARY KEY ("id")
);
