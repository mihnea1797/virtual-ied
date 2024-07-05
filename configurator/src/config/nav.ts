import { SidebarLink } from "@/components/SidebarItems";
import { Globe, HomeIcon } from "lucide-react";

export const defaultLinks: SidebarLink[] = [
    { href: "/dashboard", title: "Home", icon: HomeIcon },
    {
        href: "/merging-unit-settings",
        title: "Merging Unit Settings",
        icon: Globe,
    },
];
