'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { ThemeInitializer } from '@/components/layout/theme-initializer';
import { SessionOverlay } from '@/components/layout/session-overlay';

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () => new QueryClient({
            defaultOptions: {
                queries: {
                    staleTime: 60 * 1000,
                    refetchOnWindowFocus: false,
                },
            },
        })
    );

    return (
        <QueryClientProvider client={queryClient}>
            <ThemeInitializer />
            <SessionOverlay />
            {children}
            <Toaster position="top-left" />
        </QueryClientProvider>
    );
}
