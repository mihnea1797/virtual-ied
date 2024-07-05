import { db } from "@/lib/db/index";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

let child: any = undefined;

const configFilePath = "/opt/virtual-merging-unit/config.json";
const configDirPath = path.dirname(configFilePath);

const ensureDirectoryExists = (dir: string) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

const removeUnwantedFields = (settings: any) => {
    const { id, createdAt, updatedAt, ...filteredSettings } = settings;
    return filteredSettings;
};

const writeConfigToFile = async () => {
    const gooseSettings = await db.gooseSetting.findFirst();
    const sampledValuesSettings = await db.sampledValuesSetting.findFirst();

    if (!gooseSettings) {
        throw new Error("No goose settings found");
    }

    if (!sampledValuesSettings) {
        throw new Error("No sampled values settings found");
    }

    const config = {
        gooseSettings: removeUnwantedFields(gooseSettings),
        sampledValuesSettings: removeUnwantedFields(sampledValuesSettings),
    };

    ensureDirectoryExists(configDirPath);
    fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));
};

export const startMergingUnit = async () => {
    await writeConfigToFile();

    const command = "/root/virtual-merging-unit/build/merging-unit";

    // console log the command with arguments
    console.log(`Starting merging unit with command: ${command}`);

    // Spawn the new process
    child = spawn(command, [], {
        detached: false,
    });

    child.stdout.on("data", (data: string) => {
        console.log(`stdout: ${data}`);
    });

    child.stderr.on("data", (data: string) => {
        console.error(`stderr: ${data}`);
    });

    child.on("close", (code: any) => {
        console.log(`child process exited with code ${code}`);
    });
};

export const stopMergingUnit = async () => {
    if (child) {
        child.kill("SIGTERM");
    }
};
