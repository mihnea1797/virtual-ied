"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LucideIcon } from "lucide-react";

import { defaultLinks } from "@/config/nav";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { useRef, useState } from "react";

export interface SidebarLink {
    title: string;
    href: string;
    icon: LucideIcon;
}

const SidebarItems = () => {
    const [startMergingUnitDisabled, setStartMergingUnitDisabled] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const [fileContent, setFileContent] = useState<object | null>(null);
    const [fileName, setFileName] = useState('');

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


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type === "application/json") {
          const reader = new FileReader();
          reader.onload = (event) => {
            try {
              const json = JSON.parse(event.target?.result as string);
              setFileContent(json);
            } catch (err) {
              alert("File doesn't have a valid JSON");
            }
          };
          reader.readAsText(file);
          setFileName(file.name);
        } else {
          alert("Only JSON files");
        }
      };

      const handleRemoveFile = () => {
        if (inputRef.current) {
          inputRef.current.value = '';
        }
        setFileContent(null);
        setFileName('');
      };
      

    const handleButtonClick = () => {
        inputRef.current?.click();
    };

    return (
        <>
            <SidebarLinkGroup links={defaultLinks} />
            <div className="flex flex-col items-center w-full gap-2 ">
                <input
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    ref={inputRef}
                    onChange={handleFileChange}
                />
                <Button
                    type="button"
                    onClick={handleButtonClick}
                    className="w-full h-6 bg-gray-500 text-white hover:text-black"
                >
                    {fileName ? 'Change Config File' : 'Add Config File Test'}
                </Button>
                {fileName && 
                    <div className="flex flex-col items-center text-sm text-white font-bold bg-gray-500 p-2 rounded-lg w-full">
                        <span>Current config file: </span>{fileName}
                        <Button className="bg-red-500 hover:bg-red-400 text-white" onClick={handleRemoveFile}>Remove</Button>
                    </div>}
            </div>
            <Button
                disabled={isMergingUnitStarting}
                onClick={() => {
                    if (startMergingUnitDisabled) {
                      stopMergingUnit();
                    } else {
                      if (fileContent) {
                        startMergingUnit(fileContent);
                      } else {
                        alert("Trebuie să adaugi un fișier înainte de a porni vIED!");
                        return;
                      }
                    }
                    setStartMergingUnitDisabled(!startMergingUnitDisabled);
                  }}
                className={`w-full mt-4 ${startMergingUnitDisabled ? "bg-red-500 hover:bg-red-500" : ""}`}
            >
                {startMergingUnitDisabled ? "Stop vIED" : "Start vIED"}
            </Button>
            {/* <Button
                // onClick={() => stopMergingUnit()}
                disabled={isMergingUnitStopping}
                className="w-full mt-4"
            >
                Stop vIED
            </Button> */}
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
            className={`group transition-colors p-2 inline-block hover:bg-popover hover:text-primary text-muted-foreground text-xs hover:shadow rounded-md w-full${active ? " text-primary font-semibold" : ""
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
