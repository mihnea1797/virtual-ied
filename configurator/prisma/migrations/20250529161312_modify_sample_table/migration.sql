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
CREATE TABLE "rms_voltage" (
    "id" SERIAL NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "app_id" TEXT NOT NULL,
    "phase" INTEGER NOT NULL,
    "rms_value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "rms_voltage_pkey" PRIMARY KEY ("id","time")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "rms_voltage_app_id_phase_time_idx" ON "rms_voltage"("app_id", "phase", "time");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
SELECT create_hypertable('rms_voltage', 'time');

SELECT set_chunk_time_interval('rms_voltage', INTERVAL '5 minutes');

CREATE OR REPLACE FUNCTION notify_rms_insert() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('rms_channel', 'new_data');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rms_insert_trigger
AFTER INSERT ON rms_voltage
FOR EACH STATEMENT
EXECUTE FUNCTION notify_rms_insert();