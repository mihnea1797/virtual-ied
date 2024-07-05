import { type NetworkInterface } from "@/lib/api/networkInterfaces/queries";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "../ui/hover-card";

type NetworkInterfaceCardProps = {
    networkInterface: NetworkInterface;
};

const CARD_OPEN_DELAY = 0;
const CARD_CLOSE_DELAY = 0;

export default function NetworkInterfaceCard({
    networkInterface,
}: NetworkInterfaceCardProps) {
    return (
        <HoverCard openDelay={CARD_OPEN_DELAY} closeDelay={CARD_CLOSE_DELAY}>
            <HoverCardTrigger>{networkInterface.name}</HoverCardTrigger>
            <HoverCardContent className="w-fit">
                <p>
                    <strong>{`Name: ${networkInterface.name}`}</strong>
                </p>
                <p>
                    <strong>
                        {`MAC Address: ${
                            networkInterface.macAddress
                                ? networkInterface.macAddress.toUpperCase()
                                : "N/A"
                        }`}
                    </strong>
                </p>
                <p>
                    <strong>
                        {`IP Address: ${
                            networkInterface.ipAddress
                                ? networkInterface.ipAddress
                                : "N/A"
                        }`}
                    </strong>
                </p>
                <p>
                    <strong>
                        {`Subnet Mask: ${
                            networkInterface.netMask
                                ? networkInterface.netMask
                                : "N/A"
                        }`}
                    </strong>
                </p>
                <p>
                    <strong>
                        {`Status: ${networkInterface.isUp ? "UP" : "DOWN"}`}
                    </strong>
                </p>
                <p>
                    <strong>
                        {`Running Status: ${
                            networkInterface.isRunning
                                ? "RUNNING"
                                : "NOT RUNNING"
                        }`}
                    </strong>
                </p>
                <p>
                    <strong>
                        {`Promiscuous Mode: ${
                            networkInterface.isInPromiscuousMode ? "ON" : "OFF"
                        }`}
                    </strong>
                </p>
            </HoverCardContent>
        </HoverCard>
    );
}
