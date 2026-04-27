import React, { createContext, useMemo, useRef, useCallback, useContext } from 'react';
import { jsx } from 'react/jsx-runtime';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { AxiosError } from 'axios';

// src/context.tsx
var AppDataContext = createContext(null);
function AppDataProvider({ api, authApi, children }) {
  const value = React.useMemo(() => ({ api, authApi }), [api, authApi]);
  return /* @__PURE__ */ jsx(AppDataContext.Provider, { value, children });
}
function useAppDataContext() {
  const ctx = useContext(AppDataContext);
  if (!ctx) {
    throw new Error(
      "[use-app-data] No context found.\nWrap your app with <AppDataProvider api={api} authApi={authApi}>"
    );
  }
  return ctx;
}
var normalizeKey = (key) => Array.isArray(key) ? key : [key];
function useAppData(options) {
  const {
    key,
    api: path,
    auth = false,
    initialData,
    placeholderData,
    enabled = true,
    staleTime = 5 * 60 * 1e3,
    gcTime = 30 * 60 * 1e3,
    extraHeaders,
    refetchOnMount = false,
    clientOnly = false,
    invalidateKeys = [],
    responseType,
    idField = "id",
    position = "append",
    optimistic = true,
    onSuccess,
    onError,
    serverRevalidate
  } = options;
  const { api, authApi } = useAppDataContext();
  const queryClient = useQueryClient();
  const axiosInstance = auth ? authApi : api;
  const queryKey = useMemo(() => normalizeKey(key), [key]);
  const headersJson = JSON.stringify(extraHeaders != null ? extraHeaders : {});
  const stableHeaders = useMemo(() => extraHeaders != null ? extraHeaders : {}, [headersJson]);
  const pathRef = useRef(path);
  pathRef.current = path;
  const fetchData = useCallback(async () => {
    const { data } = await axiosInstance.get(pathRef.current, { headers: stableHeaders });
    return data;
  }, [stableHeaders, axiosInstance]);
  const query = useQuery({
    queryKey,
    queryFn: fetchData,
    initialData,
    placeholderData,
    staleTime,
    gcTime,
    refetchOnWindowFocus: false,
    refetchOnMount,
    retry: 1,
    enabled: clientOnly ? enabled && typeof window !== "undefined" : enabled
  });
  const mutation = useMutation({
    mutationFn: async ({
      method,
      id,
      payload,
      action
    }) => {
      let url = pathRef.current.replace(/\/$/, "");
      if (id !== void 0) url += `/${id}`;
      if (action) url += `/${action}`;
      url += "/";
      const isFormData = payload instanceof FormData;
      const { data } = await axiosInstance.request({
        method,
        url,
        data: payload != null ? payload : {},
        headers: {
          ...stableHeaders,
          ...isFormData ? {} : { "Content-Type": "application/json" }
        }
      });
      return data;
    },
    onMutate: async ({ method, id, payload }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      const shouldOptimistic = typeof optimistic === "function" ? optimistic(method) : !!optimistic;
      if (!shouldOptimistic) return { previous };
      if (payload instanceof FormData) {
        console.warn(`[use-app-data] Optimistic skipped for FormData in ${method} \u2192 ${pathRef.current}`);
        return { previous };
      }
      queryClient.setQueryData(queryKey, (old) => {
        if (responseType === "array") {
          const items = old != null ? old : [];
          if (method === "POST") {
            const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
            const newItem = { [idField]: tempId, ...payload };
            if (typeof position === "number") {
              const copy = [...items];
              copy.splice(position, 0, newItem);
              return copy;
            }
            return position === "prepend" ? [newItem, ...items] : [...items, newItem];
          }
          if (method === "PATCH" && id !== void 0) {
            return items.map(
              (item) => String(item[idField]) === String(id) ? { ...item, ...payload } : item
            );
          }
          if (method === "DELETE" && id !== void 0) {
            return items.filter((item) => String(item[idField]) !== String(id));
          }
        } else if (responseType === "single" && method === "PATCH") {
          return old ? { ...old, ...payload } : old;
        }
        return old;
      });
      return { previous };
    },
    onError: (err, variables, context) => {
      if ((context == null ? void 0 : context.previous) !== void 0) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      const error = err instanceof AxiosError ? err : new AxiosError("Unknown error occurred");
      onError == null ? void 0 : onError(error, variables.method);
    },
    onSuccess: async (serverData, { method, id }) => {
      if (serverData && method !== "DELETE") {
        queryClient.setQueryData(queryKey, (old) => {
          if (responseType === "array") {
            let items = old != null ? old : [];
            if (method === "POST") {
              items = items.filter((item) => !String(item[idField]).startsWith("temp-"));
              if (typeof position === "number") {
                const copy = [...items];
                copy.splice(position, 0, serverData);
                return copy;
              }
              return position === "prepend" ? [serverData, ...items] : [...items, serverData];
            }
            if (method === "PATCH") {
              return items.map(
                (item) => {
                  var _a;
                  return String(item[idField]) === String((_a = serverData[idField]) != null ? _a : id) ? serverData : item;
                }
              );
            }
          } else if (responseType === "single") {
            return serverData;
          }
          return old;
        });
      }
      const keys = [queryKey, ...invalidateKeys.map(normalizeKey)];
      await Promise.allSettled([
        ...keys.map((k) => queryClient.invalidateQueries({ queryKey: k })),
        serverRevalidate == null ? void 0 : serverRevalidate()
      ]);
      onSuccess == null ? void 0 : onSuccess(serverData, method);
    }
  });
  const typedData = useMemo(() => {
    return responseType === "array" ? query.data : query.data;
  }, [query.data, responseType]);
  return useMemo(
    () => ({
      data: typedData,
      isLoading: query.isLoading,
      isFetching: query.isFetching,
      isMutating: mutation.isPending,
      isError: query.isError,
      isSuccess: query.isSuccess,
      error: query.error,
      create: (payload, action, id) => mutation.mutateAsync({ method: "POST", payload, action, id }),
      update: (id, payload, action) => mutation.mutateAsync({ method: "PATCH", id, payload, action }),
      remove: (id) => mutation.mutateAsync({ method: "DELETE", id }).then(() => void 0),
      refetch: async () => {
        const { data } = await query.refetch();
        return data;
      }
    }),
    [typedData, query.isLoading, query.isFetching, query.isError, query.isSuccess, query.error, mutation.isPending, mutation.mutateAsync]
  );
}

export { AppDataProvider, useAppData };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map