import { db } from "@/lib/db/index";
import { send } from "@/lib/message-queue/producer";
import { spawn } from "child_process";

let child: any = undefined;

export const startMergingUnit = async () => {
    const gooseSettings = await db.gooseSetting.findFirst();

    if (!gooseSettings) {
        throw new Error("No goose settings found");
    }

    const args: string[] = [];
    for (const [key, value] of Object.entries(gooseSettings)) {
        if (key === "id" || key === "createdAt" || key === "updatedAt") {
            continue;
        }
        args.push(`--goose-${key}`);
        args.push(`${value}`);
    }

    const sampledValuesSettings = await db.sampledValuesSetting.findFirst();

    if (!sampledValuesSettings) {
        throw new Error("No sampled values settings found");
    }

    for (const [key, value] of Object.entries(sampledValuesSettings)) {
        if (key === "id" || key === "createdAt" || key === "updatedAt") {
            continue;
        }
        args.push(`--sampled-values-${key}`);
        args.push(`${value}`);
    }

    const command = "/root/virtual-merging-unit/build/merging-unit";

    // console log the command with arguments
    console.log(
        `Starting merging unit with command: ${command} ${args.join(" ")}`
    );

    // Spawn the new process
    child = spawn(command, args, {
        detached: false,
    });
};

export const stopMergingUnit = async () => {
    if (child) {
        child.kill("SIGTERM");
    }
};
