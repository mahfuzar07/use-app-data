# use-app-data

A powerful React hook for data fetching and mutation built on **TanStack Query v5** and **Axios**.

- Optimistic updates with automatic rollback
- Supports GET, POST, PATCH, DELETE
- Custom action URLs (`/resource/{id}/action/`)
- FormData / file upload support
- Cross-key cache invalidation
- Next.js `revalidatePath` support
- Full TypeScript support

---

## Installation

```bash
npm install @mahfuzar/use-app-data @tanstack/react-query axios
```

---

## Setup

Wrap your app with `AppDataProvider` and pass your own axios instances:

```tsx
// app/providers.tsx
'use client';

import axios from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppDataProvider } from '@mahfuzar/use-app-data';

const queryClient = new QueryClient();

// Unauthenticated instance
const api = axios.create({ baseURL: 'https://api.example.com' });

// Authenticated instance — add your token interceptor here
const authApi = axios.create({ baseURL: 'https://api.example.com' });
authApi.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <QueryClientProvider client={queryClient}>
            <AppDataProvider api={api} authApi={authApi}>
                {children}
            </AppDataProvider>
        </QueryClientProvider>
    );
}
```

---

## Usage

### 1. Fetch a list (GET)

```tsx
import { useAppData } from '@mahfuzar/use-app-data';

type Post = { id: number; title: string; body: string };

function PostList() {
    const { data: posts, isLoading } = useAppData<Post, 'array'>({
        key: ['posts'],
        api: '/api/posts',
        responseType: 'array',
    });

    if (isLoading) return <p>Loading...</p>;
    return <ul>{posts?.map((p) => <li key={p.id}>{p.title}</li>)}</ul>;
}
```

### 2. Fetch a single resource (GET)

```tsx
type UserProfile = { id: number; name: string; email: string };

function ProfilePage({ userId }: { userId: number }) {
    const { data: profile } = useAppData<UserProfile, 'single'>({
        key: ['profile', userId],
        api: `/api/users/${userId}`,
        auth: true,
        responseType: 'single',
    });

    return <p>{profile?.name}</p>;
}
```

### 3. Create (POST) with optimistic update

```tsx
function CreatePost() {
    const { create, isMutating } = useAppData<Post, 'array'>({
        key: ['posts'],
        api: '/api/posts',
        responseType: 'array',
        optimistic: true,
        position: 'prepend',
        onSuccess: () => toast.success('Created!'),
        onError: () => toast.error('Failed!'),
    });

    return (
        <button disabled={isMutating} onClick={() => create({ title: 'Hello', body: 'World' })}>
            {isMutating ? 'Creating...' : 'Create Post'}
        </button>
    );
}
```

### 4. Update (PATCH)

```tsx
function EditPost({ post }: { post: Post }) {
    const { update, isMutating } = useAppData<Post, 'array'>({
        key: ['posts'],
        api: '/api/posts',
        responseType: 'array',
        optimistic: true,
    });

    return (
        <button onClick={() => update(post.id, { title: 'Updated Title' })}>
            {isMutating ? 'Saving...' : 'Save'}
        </button>
    );
}
```

### 5. Delete with optimistic remove

```tsx
function DeletePost({ id }: { id: number }) {
    const { remove, isMutating } = useAppData<Post, 'array'>({
        key: ['posts'],
        api: '/api/posts',
        responseType: 'array',
        optimistic: true,
        onSuccess: () => toast.success('Deleted!'),
    });

    return <button onClick={() => remove(id)}>Delete</button>;
}
```

### 6. Custom action URL

```tsx
// POST /api/user/delivery-addresses/{id}/set_default/
function SetDefaultAddress({ addressId }: { addressId: number }) {
    const { create: setDefault, isMutating } = useAppData<Address, 'single'>({
        key: ['addresses'],
        api: '/api/user/delivery-addresses',
        auth: true,
        responseType: 'single',
        enabled: false,
        placeholderData: {} as Address,
        optimistic: false,
        invalidateKeys: [['addresses']],
        onSuccess: () => toast.success('Default updated!'),
    });

    return (
        <button onClick={() => setDefault({}, 'set_default', addressId)} disabled={isMutating}>
            Set as Default
        </button>
    );
}
```

### 7. Mutation only — no GET

```tsx
// Login, OTP verify, password change etc.
type AuthResponse = { token: string };

function LoginForm() {
    const { create: login, isMutating } = useAppData<AuthResponse, 'single'>({
        key: ['auth'],
        api: '/api/auth/login',
        responseType: 'single',
        enabled: false,
        placeholderData: {} as AuthResponse,
        optimistic: false,
        onSuccess: (data) => {
            localStorage.setItem('token', data?.token ?? '');
            toast.success('Logged in!');
        },
    });

    return (
        <button onClick={() => login({ email: 'a@b.com', password: '123' })}>
            {isMutating ? 'Logging in...' : 'Login'}
        </button>
    );
}
```

### 8. File / FormData upload

```tsx
function UploadProduct() {
    const { create, isMutating } = useAppData<Product, 'array'>({
        key: ['products'],
        api: '/api/products',
        auth: true,
        responseType: 'array',
        optimistic: false,
    });

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const form = new FormData();
        form.append('name', 'My Product');
        form.append('image', file);
        create(form);
    };

    return <input type="file" onChange={handleUpload} disabled={isMutating} />;
}
```

### 9. Cross-key invalidation

```tsx
// Place order → invalidate both cart and orders
function PlaceOrder() {
    const { create: placeOrder, isMutating } = useAppData<Order, 'single'>({
        key: ['orders'],
        api: '/api/orders',
        auth: true,
        responseType: 'single',
        enabled: false,
        placeholderData: {} as Order,
        optimistic: false,
        invalidateKeys: [['cart'], ['orders']],
        onSuccess: () => toast.success('Order placed!'),
    });

    return (
        <button onClick={() => placeOrder({ addressId: 1 })} disabled={isMutating}>
            {isMutating ? 'Placing...' : 'Place Order'}
        </button>
    );
}
```

### 10. Next.js server revalidation

```tsx
async function revalidatePosts() {
    await fetch('/api/revalidate?path=/posts', { method: 'POST' });
}

function CreatePostWithSSR() {
    const { create, isMutating } = useAppData<Post, 'array'>({
        key: ['posts'],
        api: '/api/posts',
        responseType: 'array',
        serverRevalidate: revalidatePosts,
    });

    return (
        <button onClick={() => create({ title: 'SSR Post' })} disabled={isMutating}>
            Create
        </button>
    );
}
```

---

## API Reference

### `useAppData<T, TResponse>(options)`

| Option | Type | Default | Description |
|---|---|---|---|
| `key` | `string \| QueryKey` | required | TanStack Query cache key |
| `api` | `string` | required | Base API endpoint URL |
| `auth` | `boolean` | `false` | Use authenticated axios instance |
| `responseType` | `'array' \| 'single'` | required | Shape of the response data |
| `enabled` | `boolean` | `true` | Enable/disable the query |
| `initialData` | `T \| T[]` | — | Seeds cache, prevents initial GET |
| `placeholderData` | `T \| T[]` | — | Shown while fetching, does not mark cache as fresh |
| `optimistic` | `boolean \| ((method) => boolean)` | `true` | Enable optimistic updates |
| `position` | `'append' \| 'prepend' \| number` | `'append'` | Where to insert new list items |
| `idField` | `'id' \| '_id' \| 'uuid'` | `'id'` | Primary key field for list operations |
| `invalidateKeys` | `QueryKey[]` | `[]` | Extra keys to invalidate on success |
| `staleTime` | `number` | `300000` | ms before data is stale |
| `gcTime` | `number` | `1800000` | ms before cache is garbage collected |
| `extraHeaders` | `Record<string, string>` | — | Additional request headers |
| `refetchOnMount` | `boolean` | `false` | Refetch when component mounts |
| `clientOnly` | `boolean` | `false` | Skip query during SSR |
| `onSuccess` | `(data, method) => void` | — | Mutation success callback |
| `onError` | `(error, method) => void` | — | Mutation error callback |
| `serverRevalidate` | `() => Promise<void>` | — | Server cache revalidation function |

### Return value

| Field | Type | Description |
|---|---|---|
| `data` | `T[] \| T \| undefined` | Query data |
| `isLoading` | `boolean` | Initial loading state |
| `isFetching` | `boolean` | Any fetch in progress |
| `isMutating` | `boolean` | Mutation in progress |
| `isError` | `boolean` | Query error state |
| `isSuccess` | `boolean` | Query success state |
| `error` | `AxiosError \| null` | Query error object |
| `create(payload, action?, id?)` | `Promise<T>` | POST request |
| `update(id?, payload?, action?)` | `Promise<T>` | PATCH request |
| `remove(id)` | `Promise<void>` | DELETE request |
| `refetch()` | `Promise<T \| T[]>` | Manual refetch |

### URL construction

```
create(payload, action?, id?)  →  POST  {api}/{id?}/{action?}/
update(id?, payload?, action?) →  PATCH {api}/{id?}/{action?}/
remove(id)                     →  DELETE {api}/{id}/
```

---

## License

MIT
