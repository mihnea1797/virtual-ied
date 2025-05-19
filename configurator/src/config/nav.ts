import { SidebarLink } from "@/components/SidebarItems";
import { Globe, HomeIcon,User } from "lucide-react";

export const defaultLinks: SidebarLink[] = [
    { href: "/dashboard", title: "Home", icon: HomeIcon },
    {
        href: "/merging-unit-settings",
        title: "vIED Settings",
        icon: Globe,
    },
    {
        href: "/admin",
        title: "Admin",
        icon: User,
    },
];
