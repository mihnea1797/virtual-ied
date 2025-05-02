import { db } from "@/lib/db/index";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { promises as fsPromises } from "fs";
import fsSync from "fs"; // pentru existsSync, mkdirSync
import path from "path";

let child: ChildProcessWithoutNullStreams | undefined = undefined;

const configFilePath = "/opt/virtual-merging-unit/config.json";
const configDirPath = path.dirname(configFilePath);

const ensureDirectoryExists = (dir: string) => {
    if (!fsSync.existsSync(dir)) {
        fsSync.mkdirSync(dir, { recursive: true });
    }
};

const removeUnwantedFields = (settings: any) => {
    const { id, createdAt, updatedAt, ...filteredSettings } = settings;
    return filteredSettings;
};

const writeConfigToFile = async (configFile: any = null) => {
    let config;
    if(!configFile)
    {
        const gooseSettings = await db.gooseSetting.findFirst();
        const sampledValuesSettings = await db.sampledValuesSetting.findFirst();

        if (!gooseSettings) {
            throw new Error("No goose settings found");
        }

        if (!sampledValuesSettings) {
            throw new Error("No sampled values settings found");
        }

        config= {
            gooseSettings: removeUnwantedFields(gooseSettings),
            sampledValuesSettings: removeUnwantedFields(sampledValuesSettings),
        };
    }
    ensureDirectoryExists(configDirPath);
    await fsPromises.writeFile(configFilePath, JSON.stringify(configFile ? configFile : config, null, 2));
};

export const startMergingUnit = async (configFile: any = null) => {
    await writeConfigToFile(configFile);

    const command = "/opt/virtual-merging-unit/merging-unit";

    console.log(`Starting merging unit with command: ${command}`);

    child = spawn(command, [], {
        detached: false,
    });

    child.stdout.on("data", (data: Buffer) => {
        console.log(`stdout: ${data.toString()}`);
    });

    child.stderr.on("data", (data: Buffer) => {
        console.error(`stderr: ${data.toString()}`);
    });

    child.on("close", (code: number | null) => {
        console.log(`child process exited with code ${code}`);
    });
};

export const stopMergingUnit = async () => {
    if (child) {
        child.kill("SIGTERM");
    }
};
