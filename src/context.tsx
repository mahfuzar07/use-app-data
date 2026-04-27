'use client';

import React, { createContext, useContext } from 'react';
import type { AxiosInstance } from 'axios';

// ──────────────────────────────────────────────
// Context
// ──────────────────────────────────────────────

interface AppDataContextValue {
	api: AxiosInstance;
	authApi: AxiosInstance;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

// ──────────────────────────────────────────────
// Provider
// ──────────────────────────────────────────────

interface AppDataProviderProps {
	/** Unauthenticated axios instance */
	api: AxiosInstance;
	/** Authenticated axios instance (with token interceptor etc.) */
	authApi: AxiosInstance;
	children: React.ReactNode;
}

export function AppDataProvider({ api, authApi, children }: AppDataProviderProps) {
	const value = React.useMemo(() => ({ api, authApi }), [api, authApi]);
	return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

// ──────────────────────────────────────────────
// Internal hook — used by useAppData
// ──────────────────────────────────────────────

export function useAppDataContext(): AppDataContextValue {
	const ctx = useContext(AppDataContext);
	if (!ctx) {
		throw new Error(
			'[use-app-data] No context found.\n' +
			'Wrap your app with <AppDataProvider api={api} authApi={authApi}>',
		);
	}
	return ctx;
}
