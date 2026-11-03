import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { IUserPublic, ITokenPair } from '@ananvi/shared';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: IUserPublic | null;
  isAuthenticated: boolean;
  setTokens: (tokens: ITokenPair) => void;
  setUser: (user: IUserPublic) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      setTokens: (tokens) =>
        set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          isAuthenticated: true,
        }),

      setUser: (user) => set({ user }),

      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
        }),
    }),
    { name: 'ananvi-auth', partialize: (s) => ({
      accessToken: s.accessToken,
      refreshToken: s.refreshToken,
    }) },
  ),
);
