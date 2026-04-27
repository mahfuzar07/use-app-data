'use client';

import { useCallback, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient, QueryKey } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { useAppDataContext } from './context';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type Method = 'POST' | 'PATCH' | 'DELETE';
export type ResponseType = 'array' | 'single';
export type IdField = 'id' | '_id' | 'uuid';
export type Position = 'append' | 'prepend' | number;

export interface UseAppDataOptions<T, TResponse extends ResponseType> {
	/** TanStack Query cache key */
	key: string | QueryKey;
	/** API endpoint base URL */
	api: string;
	/** Use authenticated axios instance. Default: false */
	auth?: boolean;
	/** Seed the cache immediately — prevents initial GET */
	initialData?: TResponse extends 'array' ? T[] : T;
	/**
	 * Placeholder shown while fetching — prevents initial GET call
	 * unlike initialData, this does NOT mark cache as "fresh"
	 */
	placeholderData?: TResponse extends 'array' ? T[] : T;
	/** Enable/disable query. Default: true */
	enabled?: boolean;
	/** ms before data is considered stale. Default: 5min */
	staleTime?: number;
	/** ms before inactive cache is garbage collected. Default: 30min */
	gcTime?: number;
	/** Extra request headers */
	extraHeaders?: Record<string, string>;
	/** Refetch on component mount. Default: false */
	refetchOnMount?: boolean;
	/** Only run in browser (skip SSR). Default: false */
	clientOnly?: boolean;
	/** Additional query keys to invalidate on mutation success */
	invalidateKeys?: (string | QueryKey)[];
	/** 'array' for list endpoints, 'single' for detail/resource endpoints */
	responseType: TResponse;
	/** Primary key field name for list operations. Default: 'id' */
	idField?: IdField;
	/** Where to insert new items in a list. Default: 'append' */
	position?: Position;
	/**
	 * Enable optimistic updates.
	 * Pass a function to control per-method.
	 * Default: true
	 */
	optimistic?: boolean | ((method: Method) => boolean);
	/** Called after any successful mutation */
	onSuccess?: (data: TResponse extends 'array' ? T[] : T | undefined, method: Method) => void;
	/** Called on mutation error */
	onError?: (error: AxiosError, method?: Method) => void;
	/** Optional server-side cache revalidation (e.g. Next.js revalidatePath) */
	serverRevalidate?: () => Promise<void>;
}

export interface UseAppDataResult<T, TResponse extends ResponseType> {
	data: TResponse extends 'array' ? T[] | undefined : T | undefined;
	isLoading: boolean;
	isFetching: boolean;
	isMutating: boolean;
	isError: boolean;
	isSuccess: boolean;
	error: AxiosError | null;
	/**
	 * POST to the endpoint.
	 * URL shape: `{api}/{id?}/{action?}/`
	 */
	create: (payload: Partial<T> | FormData, action?: string, id?: string | number) => Promise<T | undefined>;
	/**
	 * PATCH to the endpoint.
	 * URL shape: `{api}/{id?}/{action?}/`
	 */
	update: (id?: string | number, payload?: Partial<T> | FormData, action?: string) => Promise<T | undefined>;
	/**
	 * DELETE to the endpoint.
	 * URL shape: `{api}/{id}/`
	 */
	remove: (id: string | number) => Promise<void>;
	/** Manually trigger a refetch */
	refetch: () => Promise<TResponse extends 'array' ? T[] : T | undefined>;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const normalizeKey = (key: string | QueryKey): QueryKey => (Array.isArray(key) ? key : [key]);

// ──────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────

export function useAppData<T, TResponse extends ResponseType = 'array'>(
	options: UseAppDataOptions<T, TResponse>,
): UseAppDataResult<T, TResponse> {
	const {
		key,
		api: path,
		auth = false,
		initialData,
		placeholderData,
		enabled = true,
		staleTime = 5 * 60 * 1000,
		gcTime = 30 * 60 * 1000,
		extraHeaders,
		refetchOnMount = false,
		clientOnly = false,
		invalidateKeys = [],
		responseType,
		idField = 'id',
		position = 'append',
		optimistic = true,
		onSuccess,
		onError,
		serverRevalidate,
	} = options;

	const { api, authApi } = useAppDataContext();
	const queryClient = useQueryClient();
	const axiosInstance = auth ? authApi : api;
	const queryKey = useMemo(() => normalizeKey(key), [key]);

	// Stable headers without rules-of-hooks violation
	const headersJson = JSON.stringify(extraHeaders ?? {});
	const stableHeaders = useMemo(() => extraHeaders ?? {}, [headersJson]);

	// Always-fresh path ref — fixes stale closure on dynamic URLs
	const pathRef = useRef(path);
	pathRef.current = path;

	// ── Query ──────────────────────────────────
	const fetchData = useCallback(async () => {
		const { data } = await axiosInstance.get(pathRef.current, { headers: stableHeaders });
		return data as TResponse extends 'array' ? T[] : T;
	}, [stableHeaders, axiosInstance]);

	const query = useQuery({
		queryKey,
		queryFn: fetchData,
		initialData,
		placeholderData: placeholderData as any,
		staleTime,
		gcTime,
		refetchOnWindowFocus: false,
		refetchOnMount,
		retry: 1,
		enabled: clientOnly ? enabled && typeof window !== 'undefined' : enabled,
	});

	// ── Mutation ───────────────────────────────
	const mutation = useMutation({
		mutationFn: async ({
			method,
			id,
			payload,
			action,
		}: {
			method: Method;
			id?: string | number;
			payload?: Partial<T> | FormData;
			action?: string;
		}) => {
			// Uses pathRef so dynamic URLs work without stale closures
			let url = pathRef.current.replace(/\/$/, '');

			if (id !== undefined) url += `/${id}`;
			if (action) url += `/${action}`;
			url += '/';

			const isFormData = payload instanceof FormData;

			const { data } = await axiosInstance.request<T>({
				method,
				url,
				data: payload ?? {},
				headers: {
					...stableHeaders,
					...(isFormData ? {} : { 'Content-Type': 'application/json' }),
				},
			});

			return data;
		},

		onMutate: async ({ method, id, payload }) => {
			await queryClient.cancelQueries({ queryKey });
			const previous = queryClient.getQueryData(queryKey);

			const shouldOptimistic = typeof optimistic === 'function' ? optimistic(method) : !!optimistic;
			if (!shouldOptimistic) return { previous };

			if (payload instanceof FormData) {
				console.warn(`[use-app-data] Optimistic skipped for FormData in ${method} → ${pathRef.current}`);
				return { previous };
			}

			queryClient.setQueryData(queryKey, (old: unknown) => {
				if (responseType === 'array') {
					const items = (old as T[] | undefined) ?? [];

					if (method === 'POST') {
						const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
						const newItem = { [idField]: tempId, ...payload } as T;
						if (typeof position === 'number') {
							const copy = [...items];
							copy.splice(position, 0, newItem);
							return copy;
						}
						return position === 'prepend' ? [newItem, ...items] : [...items, newItem];
					}

					if (method === 'PATCH' && id !== undefined) {
						return items.map((item) =>
							String((item as any)[idField]) === String(id) ? { ...item, ...payload } : item,
						);
					}

					if (method === 'DELETE' && id !== undefined) {
						return items.filter((item) => String((item as any)[idField]) !== String(id));
					}
				} else if (responseType === 'single' && method === 'PATCH') {
					return old ? { ...(old as T), ...payload } : old;
				}

				return old;
			});

			return { previous };
		},

		onError: (err, variables, context) => {
			// Rollback optimistic update
			if (context?.previous !== undefined) {
				queryClient.setQueryData(queryKey, context.previous);
			}
			const error = err instanceof AxiosError ? err : new AxiosError('Unknown error occurred');
			onError?.(error, variables.method);
		},

		onSuccess: async (serverData, { method, id }) => {
			// Sync cache with server response
			if (serverData && method !== 'DELETE') {
				queryClient.setQueryData(queryKey, (old: unknown) => {
					if (responseType === 'array') {
						let items = (old as T[] | undefined) ?? [];

						if (method === 'POST') {
							// Replace temp item with real server data
							items = items.filter((item) => !String((item as any)[idField]).startsWith('temp-'));
							if (typeof position === 'number') {
								const copy = [...items];
								copy.splice(position, 0, serverData as T);
								return copy;
							}
							return position === 'prepend' ? [serverData as T, ...items] : [...items, serverData as T];
						}

						if (method === 'PATCH') {
							return items.map((item) =>
								String((item as any)[idField]) === String((serverData as any)[idField] ?? id)
									? (serverData as T)
									: item,
							);
						}
					} else if (responseType === 'single') {
						return serverData as T;
					}

					return old;
				});
			}

			// Background revalidation
			const keys = [queryKey, ...invalidateKeys.map(normalizeKey)];
			await Promise.allSettled([
				...keys.map((k) => queryClient.invalidateQueries({ queryKey: k })),
				serverRevalidate?.(),
			]);

			// Fire for ALL methods including DELETE
			onSuccess?.(serverData as any, method);
		},
	});

	// ── Typed data ─────────────────────────────
	const typedData = useMemo(() => {
		return responseType === 'array'
			? (query.data as T[] | undefined)
			: (query.data as T | undefined);
	}, [query.data, responseType]) as TResponse extends 'array' ? T[] | undefined : T | undefined;

	return useMemo(
		() => ({
			data: typedData,
			isLoading: query.isLoading,
			isFetching: query.isFetching,
			isMutating: mutation.isPending,
			isError: query.isError,
			isSuccess: query.isSuccess,
			error: query.error as AxiosError | null,

			create: (payload, action?, id?) =>
				mutation.mutateAsync({ method: 'POST', payload, action, id }),

			update: (id, payload, action?) =>
				mutation.mutateAsync({ method: 'PATCH', id, payload, action }),

			remove: (id) =>
				mutation.mutateAsync({ method: 'DELETE', id }).then(() => void 0),

			refetch: async () => {
				const { data } = await query.refetch();
				return data as TResponse extends 'array' ? T[] : T | undefined;
			},
		}),
		[typedData, query.isLoading, query.isFetching, query.isError, query.isSuccess, query.error, mutation.isPending, mutation.mutateAsync],
	);
}
