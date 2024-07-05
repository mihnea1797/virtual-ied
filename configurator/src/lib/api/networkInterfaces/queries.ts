import { execSync } from "child_process";

export type NetworkInterface = {
    name: string;
    ipAddress: string;
    netMask: string;
    macAddress: string;
    isUp: boolean;
    isRunning: boolean;
    isInPromiscuousMode: boolean;
};

export type NetworkInterfaces = NetworkInterface[];

function parseIfconfigOutput(output: string): NetworkInterfaces {
    const interfaces: NetworkInterfaces = [];
    const blocks = output.split(/\n\n/); // Split by double newlines

    blocks.forEach((block) => {
        const lines = block.split("\n");
        const interfaceLine = lines[0];

        if (interfaceLine) {
            const interfaceMatch = interfaceLine.match(
                /^(\S+):\s+flags=(\d+)<(.+)>/
            );
            if (interfaceMatch) {
                const name = interfaceMatch[1];
                const flags = interfaceMatch[3].split(",");

                const isUp = flags.includes("UP");
                const isRunning = flags.includes("RUNNING");
                const isInPromiscuousMode = flags.includes("PROMISC");

                let ipAddress = "";
                let netMask = "";
                let macAddress = "";

                lines.forEach((line) => {
                    const inetMatch = line.match(
                        /\s+inet\s+(\S+)\s+netmask\s+(\S+)/
                    );
                    if (inetMatch) {
                        ipAddress = inetMatch[1];
                        netMask = inetMatch[2];
                    }

                    const etherMatch = line.match(/\s+ether\s+(\S+)/);
                    if (etherMatch) {
                        macAddress = etherMatch[1];
                    }
                });

                interfaces.push({
                    name,
                    ipAddress,
                    netMask,
                    macAddress,
                    isUp,
                    isRunning,
                    isInPromiscuousMode,
                });
            }
        }
    });

    return interfaces;
}

export function getNetworkInterfaces(): {
    networkInterfaces: NetworkInterfaces | null;
} {
    let networkInterfaces;

    try {
        const stdout = execSync("ifconfig", { encoding: "utf-8" });
        networkInterfaces = {
            networkInterfaces: parseIfconfigOutput(stdout),
        };
    } catch (error) {
        console.error(`Could not get network interfaces: ${error}`);
        networkInterfaces = {
            networkInterfaces: null,
        };
    }

    return networkInterfaces;
}
