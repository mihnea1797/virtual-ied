import Sidebar from "@/components/Sidebar";
import { Toaster } from "@/components/ui/sonner";
import { checkAuth } from "@/lib/auth/utils";

export default async function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    await checkAuth();

    return (
        <>
            <main className="flex h-full">
                <Sidebar />
                {children}
            </main>
            <Toaster richColors />
        </>
    );
}
