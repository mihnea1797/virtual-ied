"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LucideIcon } from "lucide-react";

import { defaultLinks } from "@/config/nav";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

export interface SidebarLink {
    title: string;
    href: string;
    icon: LucideIcon;
}

const SidebarItems = () => {
    const { mutate: startMergingUnit, isLoading: isMergingUnitStarting } =
        trpc.gooseSettings.startMergingUnit.useMutation({
            onSuccess: (res) => onSuccess("create"),
            onError: (err) => onError("create", { error: err.message }),
        });

    const { mutate: stopMergingUnit, isLoading: isMergingUnitStopping } =
        trpc.gooseSettings.stopMergingUnit.useMutation({
            onSuccess: (res) => onSuccess("create"),
            onError: (err) => onError("create", { error: err.message }),
        });

    const onSuccess = async (
        action: "create" | "update" | "delete",
        data?: { error?: string }
    ) => {};

    const onError = async (
        action: "create" | "update" | "delete",
        data?: { error?: string }
    ) => {};

    return (
        <>
            <SidebarLinkGroup links={defaultLinks} />
            <Button
                onClick={() => startMergingUnit()}
                disabled={isMergingUnitStarting}
                className="w-full mt-4"
            >
                Start Merging Unit
            </Button>
            <Button
                onClick={() => stopMergingUnit()}
                disabled={isMergingUnitStopping}
                className="w-full mt-4"
            >
                Stop Merging Unit
            </Button>
        </>
    );
};
export default SidebarItems;

const SidebarLinkGroup = ({
    links,
    title,
    border,
}: {
    links: SidebarLink[];
    title?: string;
    border?: boolean;
}) => {
    const fullPathname = usePathname();
    const pathname = "/" + fullPathname.split("/")[1];

    return (
        <div className={border ? "border-border border-t my-8 pt-4" : ""}>
            {title ? (
                <h4 className="px-2 mb-2 text-xs uppercase text-muted-foreground tracking-wider">
                    {title}
                </h4>
            ) : null}
            <ul>
                {links.map((link) => (
                    <li key={link.title}>
                        <SidebarLink
                            link={link}
                            active={pathname === link.href}
                        />
                    </li>
                ))}
            </ul>
        </div>
    );
};
const SidebarLink = ({
    link,
    active,
}: {
    link: SidebarLink;
    active: boolean;
}) => {
    return (
        <Link
            href={link.href}
            className={`group transition-colors p-2 inline-block hover:bg-popover hover:text-primary text-muted-foreground text-xs hover:shadow rounded-md w-full${
                active ? " text-primary font-semibold" : ""
            }`}
        >
            <div className="flex items-center">
                <div
                    className={cn(
                        "opacity-0 left-0 h-6 w-[4px] absolute rounded-r-lg bg-primary",
                        active ? "opacity-100" : ""
                    )}
                />
                <link.icon className="h-3.5 mr-1" />
                <span>{link.title}</span>
            </div>
        </Link>
    );
};
