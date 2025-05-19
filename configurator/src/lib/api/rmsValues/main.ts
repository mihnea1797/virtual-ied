import { db } from "@/lib/db/index";
import { Client } from "pg";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { promises as fs } from "fs";
import path from "path";

const configFilePath = "/opt/virtual-merging-unit/rms-config.json";
const configDirPath = path.dirname(configFilePath);
let listenerProcess: ChildProcessWithoutNullStreams | null = null;

const ensureDirectoryExists = (dir: string) => {
  return fs.mkdir(dir, { recursive: true }).catch(() => {});
};

const writeRmsConfig = async () => {
  const latest = await db.sampledValue.findMany({
    take: 10,
    orderBy: { time: "desc" },
  });

  await ensureDirectoryExists(configDirPath);
  await fs.writeFile(configFilePath, JSON.stringify({ lastSamples: latest }, null, 2));
};

export const startRmsListener = async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query("LISTEN rms_channel");

  console.log("📡 Listening for RMS updates on 'rms_channel'");

  client.on("notification", async (msg) => {
    if (msg.channel === "rms_channel") {
      console.log("🔄 New RMS data inserted, regenerating config...");
      await writeRmsConfig();
    }
  });

  listenerProcess = client as any;
};

export const stopRmsListener = async () => {
  if (listenerProcess) {
    await (listenerProcess as any).end();
    listenerProcess = null;
    console.log("🛑 RMS listener stopped");
  }
};

export const isRmsListenerRunning = () => {
  return !!listenerProcess;
};
