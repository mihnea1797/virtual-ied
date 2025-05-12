-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "hashedPassword" TEXT NOT NULL,
    "name" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GooseSetting" (
    "id" TEXT NOT NULL,
    "vlanPriority" INTEGER NOT NULL,
    "vlanId" INTEGER NOT NULL,
    "appId" INTEGER NOT NULL,
    "dstAddress" TEXT,
    "ethernetInterface" TEXT NOT NULL,
    "useVlanTag" BOOLEAN,
    "goId" TEXT NOT NULL,
    "goCb" TEXT NOT NULL,
    "timeAllowedToLive" INTEGER NOT NULL,
    "dataSetRef" TEXT NOT NULL,
    "simulation" BOOLEAN,
    "confRev" INTEGER NOT NULL,
    "ndsCom" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GooseSetting_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "sensor_data" (
    "id" SERIAL NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "settingId" TEXT NOT NULL,

    CONSTRAINT "sensor_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensor_data" ADD CONSTRAINT "sensor_data_settingId_fkey" FOREIGN KEY ("settingId") REFERENCES "SampledValuesSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
