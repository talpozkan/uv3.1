import { Sidebar } from '@/components/layout/sidebar';
import { AuthGuard } from '@/components/auth/auth-guard';
import { BackButton } from '@/components/layout/back-button';
import { UserNav } from '@/components/layout/user-nav';
import { Breadcrumb } from '@/components/ui/breadcrumb';

import { AIScribeAction } from '@/components/layout/ai-scribe-action';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthGuard>
            <div className="flex h-screen">
                <Sidebar />
                <div className="flex-1 flex flex-col overflow-hidden">
                    <main className="flex-1 overflow-y-auto bg-slate-50 p-4 scroll-smooth">
                        <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <BackButton />
                                <Breadcrumb />
                            </div>
                            <div className="flex items-center gap-4">
                                <AIScribeAction />
                                <UserNav />
                            </div>
                        </div>
                        {children}
                    </main>
                </div>
            </div>
        </AuthGuard>
    );
}
