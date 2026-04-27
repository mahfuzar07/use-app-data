import * as react_jsx_runtime from 'react/jsx-runtime';
import React from 'react';
import { AxiosInstance, AxiosError } from 'axios';
import { QueryKey } from '@tanstack/react-query';

interface AppDataProviderProps {
    /** Unauthenticated axios instance */
    api: AxiosInstance;
    /** Authenticated axios instance (with token interceptor etc.) */
    authApi: AxiosInstance;
    children: React.ReactNode;
}
declare function AppDataProvider({ api, authApi, children }: AppDataProviderProps): react_jsx_runtime.JSX.Element;

type Method = 'POST' | 'PATCH' | 'DELETE';
type ResponseType = 'array' | 'single';
type IdField = 'id' | '_id' | 'uuid';
type Position = 'append' | 'prepend' | number;
interface UseAppDataOptions<T, TResponse extends ResponseType> {
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
interface UseAppDataResult<T, TResponse extends ResponseType> {
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
declare function useAppData<T, TResponse extends ResponseType = 'array'>(options: UseAppDataOptions<T, TResponse>): UseAppDataResult<T, TResponse>;

export { AppDataProvider, type IdField, type Method, type Position, type ResponseType, type UseAppDataOptions, type UseAppDataResult, useAppData };
