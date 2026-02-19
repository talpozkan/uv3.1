import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
    id: number;
    username: string;
    full_name?: string;
    role?: string;
    is_superuser?: boolean;
}

interface AuthState {
    token: string | null;
    refreshToken: string | null;
    user: User | null;
    setAuth: (token: string, refreshToken: string) => void;
    logout: () => void;
    isAuthenticated: () => boolean;
    isSessionExpired: boolean;
    triggerSessionExpired: () => void;
    clearSessionExpired: () => void;
    _hasHydrated: boolean;
    setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            token: null,
            refreshToken: null,
            user: null,
            setAuth: (token, refreshToken) => {
                // Decode user from JWT (simple base64 decode)
                try {
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    set({
                        token,
                        refreshToken,
                        user: {
                            id: parseInt(payload.sub),
                            username: payload.username || payload.name || 'user',
                            full_name: payload.name,
                            role: payload.role,
                            is_superuser: payload.is_superuser === true
                        }
                    });
                } catch {
                    set({ token, refreshToken, user: null });
                }
            },
            logout: () => set({ token: null, refreshToken: null, user: null }),
            isAuthenticated: () => !!get().token,
            isSessionExpired: false,
            triggerSessionExpired: () => {
                // Clear sensitive state immediately
                set({
                    token: null,
                    refreshToken: null,
                    user: null,
                    isSessionExpired: true
                });

                // Clear other sensitive persisted stores manually if needed
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('patient-storage');
                }
            },
            clearSessionExpired: () => set({ isSessionExpired: false }),
            _hasHydrated: false,
            setHasHydrated: (state: boolean) => set({ _hasHydrated: state }),
        }),
        {
            name: 'urolog-auth',
            onRehydrateStorage: () => (state) => {
                state?.setHasHydrated(true);
            },
        }
    )
);
