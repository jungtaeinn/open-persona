# Next.js 데이터 페칭 완전 가이드

## Server Component에서 fetch

Server Component는 `async` 함수로 선언하여 데이터를 직접 fetch할 수 있다. 별도의 API 레이어 없이 서버에서 바로 데이터를 가져온다.

```tsx
// app/posts/page.tsx — Server Component (기본값)
async function getPosts() {
  const res = await fetch('https://api.example.com/posts', {
    next: { revalidate: 3600 }, // 1시간마다 재검증
  });

  if (!res.ok) throw new Error('Failed to fetch posts');
  return res.json() as Promise<Post[]>;
}

export default async function PostsPage() {
  const posts = await getPosts();

  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
```

- Server Component는 기본적으로 서버에서만 실행 — API key 등 비밀 값 안전하게 사용 가능
- `fetch`는 자동으로 Request Memoization 적용 — 같은 URL/옵션이면 중복 요청 안 함
- 에러 발생 시 가장 가까운 `error.tsx` Error Boundary에서 처리

## ORM / Database 직접 쿼리

Server Component에서는 ORM이나 DB 클라이언트를 직접 사용할 수 있다.

```tsx
// app/users/page.tsx
import { db } from '@/lib/db';

export default async function UsersPage() {
  const users = await db.user.findMany({
    where: { active: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return <UserList users={users} />;
}
```

```tsx
// lib/db.ts — Prisma 클라이언트 싱글톤
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
```

- ORM 쿼리는 `fetch`가 아니므로 자동 캐싱/중복 제거 없음
- `React.cache()`로 같은 요청의 중복을 방지할 수 있음
- 개발 모드에서 Hot Reload 시 DB 커넥션 누수 방지를 위해 싱글톤 패턴 사용

## Client Component에서 데이터 페칭

Client Component에서는 SWR, TanStack Query, 또는 React의 `use` API를 활용한다.

```tsx
'use client';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function UserProfile({ userId }: { userId: string }) {
  const { data, error, isLoading } = useSWR(
    `/api/users/${userId}`,
    fetcher,
  );

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorMessage error={error} />;
  return <ProfileCard user={data} />;
}
```

```tsx
'use client';
import { use } from 'react';

export function Comments({
  commentsPromise,
}: {
  commentsPromise: Promise<Comment[]>;
}) {
  const comments = use(commentsPromise);

  return (
    <ul>
      {comments.map((c) => (
        <li key={c.id}>{c.body}</li>
      ))}
    </ul>
  );
}
```

- SWR/TanStack Query — 자동 캐싱, 재검증, 낙관적 업데이트 지원
- React `use()` API — Server Component에서 Promise를 생성해 Client Component에 전달하면 Suspense와 자동 통합
- Client Component에서 직접 DB 접근은 불가 — Route Handler나 Server Action 경유 필요

## 스트리밍과 Suspense

서버 렌더링 결과를 점진적으로 클라이언트에 전송하여 전체 페이지 로딩 차단을 방지한다.

```tsx
// app/dashboard/page.tsx
import { Suspense } from 'react';

export default function DashboardPage() {
  return (
    <div>
      <h1>Dashboard</h1>
      {/* 즉시 렌더링 */}
      <StaticHeader />

      {/* 데이터 준비되면 스트리밍 */}
      <Suspense fallback={<ChartSkeleton />}>
        <RevenueChart />
      </Suspense>

      <Suspense fallback={<TableSkeleton />}>
        <RecentOrders />
      </Suspense>
    </div>
  );
}

// 각각 독립적으로 데이터를 가져오는 Server Component
async function RevenueChart() {
  const data = await getRevenueData(); // 2초 소요
  return <Chart data={data} />;
}

async function RecentOrders() {
  const orders = await getRecentOrders(); // 1초 소요
  return <OrderTable orders={orders} />;
}
```

- `loading.tsx`는 해당 라우트 세그먼트 전체를 `<Suspense>`로 자동 래핑
- `<Suspense>`를 직접 사용하면 더 세밀한 단위로 스트리밍 경계를 설정 가능
- 스트리밍 중 fallback UI가 표시되고, 데이터 준비 완료 시 실제 콘텐츠로 교체
- TTFB(Time to First Byte)와 FCP(First Contentful Paint) 개선에 효과적

## 순차 vs 병렬 데이터 페칭

### 순차 페칭 (Waterfall)

```tsx
// ❌ 순차 — artist를 가져온 뒤 albums를 가져옴
async function ArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const artist = await getArtist(id);        // 1초
  const albums = await getAlbums(artist.id); // 1초 → 총 2초
  return <ArtistView artist={artist} albums={albums} />;
}
```

### 병렬 페칭 (Promise.all)

```tsx
// ✅ 병렬 — 두 요청을 동시에 시작
async function ArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [artist, albums] = await Promise.all([
    getArtist(id),    // 1초
    getAlbums(id),    // 1초 → 총 1초
  ]);
  return <ArtistView artist={artist} albums={albums} />;
}
```

- 의존 관계가 없는 데이터는 항상 `Promise.all`로 병렬 페칭
- 의존 관계가 있으면 순차 페칭이 불가피 — 이 경우 Suspense로 UX 개선
- `Promise.allSettled`로 일부 실패를 허용하는 페칭도 가능

## 데이터 프리로딩 패턴

데이터 페칭을 더 일찍 시작하여 워터폴을 줄이는 패턴이다.

```tsx
// lib/preload.ts
import { cache } from 'react';

export const getUser = cache(async (id: string) => {
  const res = await fetch(`/api/users/${id}`);
  return res.json() as Promise<User>;
});

export const preloadUser = (id: string) => {
  void getUser(id);
};
```

```tsx
// app/user/[id]/page.tsx
import { getUser, preloadUser } from '@/lib/preload';

export default async function UserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  preloadUser(id);

  return (
    <main>
      <Suspense fallback={<Skeleton />}>
        <UserProfile id={id} />
      </Suspense>
    </main>
  );
}

async function UserProfile({ id }: { id: string }) {
  const user = await getUser(id); // 이미 프리로딩 시작됨 — cache hit
  return <div>{user.name}</div>;
}
```

- `preload` 함수는 `void`로 호출하여 Promise를 기다리지 않음
- `React.cache()`로 래핑해야 동일 요청이 중복 실행되지 않음
- 레이아웃에서 프리로드하고 페이지에서 결과를 소비하는 패턴에 유용

## React.cache로 요청 중복 제거

`React.cache()`는 같은 렌더링 사이클 내에서 동일 인자의 함수 호출을 메모이제이션한다.

```tsx
import { cache } from 'react';
import { db } from '@/lib/db';

export const getUser = cache(async (id: string) => {
  return db.user.findUnique({ where: { id } });
});
```

```tsx
// 여러 Server Component에서 같은 함수를 호출해도 DB 쿼리는 1번만 실행
// app/user/[id]/page.tsx
async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(id); // DB 쿼리 실행
  return <UserProfile user={user} />;
}

// app/user/[id]/sidebar.tsx
async function UserSidebar({ userId }: { userId: string }) {
  const user = await getUser(userId); // 캐시 히트 — 쿼리 안 함
  return <div>{user.name}</div>;
}
```

- `fetch` API는 자동으로 Request Memoization 적용 — `cache()` 불필요
- ORM, DB 직접 쿼리 등 `fetch`가 아닌 호출에는 `cache()` 래핑 권장
- 메모이제이션 범위는 하나의 서버 렌더링 사이클 (요청 단위)
- React 서버 렌더링 중에만 작동 — Client Component에서는 효과 없음

## Server Actions로 데이터 변경

`'use server'` 디렉티브로 서버에서 실행되는 비동기 함수를 정의한다. form 제출이나 이벤트 핸들러에서 호출 가능하다.

```tsx
// app/actions/post.ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const PostSchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(1),
});

export async function createPost(formData: FormData) {
  const validated = PostSchema.safeParse({
    title: formData.get('title'),
    content: formData.get('content'),
  });

  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  await db.post.create({ data: validated.data });

  revalidatePath('/posts');
  redirect('/posts');
}
```

- Server Action은 POST 요청으로 실행 — CSRF 보호 내장
- `revalidatePath()` / `revalidateTag()`로 관련 캐시 무효화
- `redirect()`는 try/catch 밖에서 호출해야 함 (내부적으로 에러를 throw)
- 반환값으로 에러 상태를 전달하여 클라이언트에서 처리 가능

## form action으로 Server Action 사용

```tsx
// app/posts/new/page.tsx
import { createPost } from '@/app/actions/post';

export default function NewPostPage() {
  return (
    <form action={createPost}>
      <input name="title" placeholder="제목" required />
      <textarea name="content" placeholder="내용" required />
      <SubmitButton />
    </form>
  );
}
```

```tsx
'use client';
import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { createPost } from '@/app/actions/post';

// useFormStatus로 제출 상태 표시
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? '저장 중...' : '저장'}
    </button>
  );
}

// useActionState로 에러 처리 + 낙관적 업데이트
function PostForm() {
  const [state, formAction, isPending] = useActionState(createPost, null);

  return (
    <form action={formAction}>
      <input name="title" />
      {state?.error?.title && <p className="text-red-500">{state.error.title}</p>}
      <textarea name="content" />
      <button disabled={isPending}>저장</button>
    </form>
  );
}
```

- `<form action={serverAction}>`으로 JavaScript 없이도 동작 (Progressive Enhancement)
- `useFormStatus()`는 `<form>` 내부 자식 컴포넌트에서만 사용 가능
- `useActionState()`로 이전 상태와 에러를 관리할 수 있음
- `useOptimistic()`으로 서버 응답 전에 UI를 먼저 업데이트하는 낙관적 패턴 구현 가능
