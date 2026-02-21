# Next.js 캐싱 및 재검증 가이드

## fetch 캐시 옵션

Next.js는 `fetch` API를 확장하여 요청별 캐시 동작을 제어할 수 있다.

```tsx
// 기본값 — 캐시 사용 (정적 렌더링 시)
const data = await fetch('https://api.example.com/data');

// 캐시 강제 사용 (명시적)
const data = await fetch('https://api.example.com/data', {
  cache: 'force-cache',
});

// 캐시 비활성화 — 매 요청마다 새로운 데이터
const data = await fetch('https://api.example.com/data', {
  cache: 'no-store',
});
```

- `force-cache` — Data Cache에 저장, 이후 요청은 캐시에서 응답
- `no-store` — 매번 서버에서 새 데이터를 가져옴 (동적 렌더링으로 전환)
- 라우트 세그먼트 설정으로 기본값 변경 가능: `export const dynamic = 'force-dynamic'`

## 시간 기반 재검증 (Time-based Revalidation)

일정 시간이 지나면 캐시를 무효화하고 새 데이터를 가져온다.

```tsx
// 개별 fetch에 재검증 시간 설정
const posts = await fetch('https://api.example.com/posts', {
  next: { revalidate: 3600 }, // 3600초(1시간) 후 재검증
});

// 라우트 세그먼트 레벨에서 기본 재검증 시간 설정
// app/posts/layout.tsx
export const revalidate = 3600;
```

- `revalidate: 0`은 `cache: 'no-store'`와 동일 효과 (매번 새로 가져옴)
- Stale-While-Revalidate 전략 — 캐시된 데이터를 즉시 반환하고 백그라운드에서 갱신
- 여러 fetch에 서로 다른 `revalidate` 값이 있으면 가장 짧은 값이 적용

## 태그 기반 재검증 (On-demand Revalidation)

캐시에 태그를 붙이고 특정 태그를 가진 캐시만 선택적으로 무효화한다.

```tsx
// 1) fetch에 태그 부여
const post = await fetch(`https://api.example.com/posts/${id}`, {
  next: { tags: ['posts', `post-${id}`] },
});
```

```tsx
// 2) Server Action이나 Route Handler에서 태그로 재검증
'use server';

import { revalidateTag } from 'next/cache';

export async function updatePost(id: string, data: PostData) {
  await db.post.update({ where: { id }, data });

  revalidateTag(`post-${id}`); // 특정 포스트 캐시만 무효화
  revalidateTag('posts');       // 포스트 목록 캐시도 무효화
}
```

- 태그는 문자열 배열로 여러 개를 하나의 fetch에 붙일 수 있음
- `revalidateTag(tag)` — 해당 태그가 붙은 모든 캐시 엔트리를 무효화
- 시간 기반보다 정밀한 캐시 제어가 가능

## cacheTag 함수 (use cache 디렉티브)

`use cache` 디렉티브와 함께 `cacheTag`를 사용하여 컴포넌트나 함수 단위로 캐시를 태깅한다.

```tsx
// 함수 레벨 캐시 + 태그
import { cacheTag } from 'next/cache';

async function getPost(id: string) {
  'use cache';
  cacheTag(`post-${id}`, 'posts');

  return db.post.findUnique({ where: { id } });
}
```

```tsx
// 컴포넌트 레벨 캐시 + 태그
import { cacheTag } from 'next/cache';

async function PostList() {
  'use cache';
  cacheTag('posts');

  const posts = await db.post.findMany();
  return (
    <ul>
      {posts.map((p) => <li key={p.id}>{p.title}</li>)}
    </ul>
  );
}
```

- `'use cache'`는 함수/컴포넌트의 결과를 자동으로 캐시
- `cacheTag()`로 태그를 붙여 `revalidateTag()`로 선택적 무효화 가능
- `fetch`를 사용하지 않는 DB 쿼리에도 태그 기반 재검증을 적용할 수 있음
- 실험적 기능 — `next.config.ts`에서 `useCache: true` 설정 필요

## revalidateTag / revalidatePath

캐시를 즉시 무효화하는 두 가지 방법이다.

```tsx
'use server';

import { revalidateTag, revalidatePath } from 'next/cache';

export async function publishPost(id: string) {
  await db.post.update({
    where: { id },
    data: { published: true },
  });

  // 태그 기반 — 정밀한 무효화
  revalidateTag(`post-${id}`);

  // 경로 기반 — 해당 경로의 모든 캐시 무효화
  revalidatePath('/posts');

  // 레이아웃 포함 전체 무효화
  revalidatePath('/posts', 'layout');

  // 전체 사이트 무효화
  revalidatePath('/', 'layout');
}
```

- `revalidateTag(tag)` — 해당 태그가 붙은 Data Cache 엔트리 무효화
- `revalidatePath(path)` — 해당 경로의 Route Cache와 Data Cache 무효화
- `revalidatePath(path, 'layout')` — 해당 경로 + 하위 모든 라우트까지 무효화
- Server Action, Route Handler 내에서만 호출 가능

## unstable_cache (레거시)

`fetch`를 사용하지 않는 DB 쿼리 등에 캐시를 적용하는 레거시 방법이다. `use cache` 디렉티브로 대체 예정이다.

```tsx
import { unstable_cache } from 'next/cache';

const getCachedUser = unstable_cache(
  async (id: string) => {
    return db.user.findUnique({ where: { id } });
  },
  ['user-cache'],           // 캐시 키 프리픽스
  {
    tags: ['users'],         // 재검증 태그
    revalidate: 3600,        // 시간 기반 재검증 (초)
  },
);

export default async function UserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCachedUser(id);
  return <UserProfile user={user} />;
}
```

- 첫 번째 인자: 캐시할 비동기 함수
- 두 번째 인자: 캐시 키 배열 (함수 인자와 결합하여 고유 키 생성)
- 세 번째 인자: `tags`, `revalidate` 등 옵션
- `'use cache'` + `cacheTag`가 안정화되면 이 API는 더 이상 사용하지 않을 예정

## Request Memoization

React가 `fetch` 호출을 렌더링 트리 내에서 자동으로 메모이제이션한다.

```tsx
// 두 컴포넌트가 같은 URL을 fetch → 실제 네트워크 요청은 1번
async function Header() {
  const config = await fetch('/api/config'); // 요청 #1 (실행됨)
  return <nav>{/* ... */}</nav>;
}

async function Footer() {
  const config = await fetch('/api/config'); // 요청 #2 (메모이제이션 — 실행 안 됨)
  return <footer>{/* ... */}</footer>;
}
```

- 동일한 URL + 동일한 옵션인 `fetch` 호출만 메모이제이션
- 한 번의 서버 렌더링 사이클 동안만 유효 (요청 간 공유 안 됨)
- `POST` 요청은 메모이제이션되지 않음 (GET만 대상)
- `fetch`가 아닌 ORM 쿼리 등은 `React.cache()`로 직접 메모이제이션 해야 함

## Data Cache vs Full Route Cache

Next.js에는 여러 캐시 레이어가 있다. 각각의 역할과 범위를 이해해야 한다.

| 캐시 | 저장 위치 | 대상 | 지속 시간 |
|---|---|---|---|
| Request Memoization | 서버 (메모리) | fetch 결과 | 단일 렌더링 사이클 |
| Data Cache | 서버 (영구) | fetch 응답 데이터 | 재검증 전까지 영구 |
| Full Route Cache | 서버 (영구) | HTML + RSC Payload | 재검증 전까지 영구 |
| Router Cache | 클라이언트 (메모리) | RSC Payload | 세션 동안 (자동 만료) |

### 캐시 동작 흐름

1. 빌드 시 정적 라우트의 HTML + RSC Payload 생성 → **Full Route Cache**
2. 요청 시 `fetch` 결과를 **Data Cache**에 저장
3. 같은 렌더링 중 동일 `fetch`는 **Request Memoization**으로 중복 제거
4. 클라이언트 네비게이션 시 **Router Cache**에서 이전 방문 라우트를 즉시 표시

- `cache: 'no-store'` 또는 동적 함수 사용 시 Data Cache와 Full Route Cache 모두 비활성화
- `revalidatePath`/`revalidateTag`는 Data Cache와 Full Route Cache를 함께 무효화

## 정적 렌더링 vs 동적 렌더링

Next.js는 라우트별로 자동으로 정적/동적 렌더링을 결정한다.

### 정적 렌더링 (Static Rendering)

빌드 시 HTML을 생성하고 CDN에서 서빙한다.

```tsx
// 정적 — 빌드 시 렌더링
export default async function AboutPage() {
  const content = await fetch('https://cms.example.com/about', {
    cache: 'force-cache',
  });
  return <div>{content}</div>;
}

// 동적 경로를 정적으로 생성
export async function generateStaticParams() {
  const posts = await fetch('https://api.example.com/posts').then((r) =>
    r.json(),
  );
  return posts.map((post: Post) => ({ slug: post.slug }));
}
```

### 동적 렌더링 (Dynamic Rendering)

요청 시마다 서버에서 렌더링한다.

```tsx
// 동적 — 다음 중 하나라도 사용하면 자동 전환
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;           // searchParams 접근
  const session = await auth();                // cookies/headers 접근
  const data = await fetch('/api/data', {
    cache: 'no-store',                         // 캐시 비활성화
  });

  return <Dashboard data={data} />;
}
```

동적 렌더링으로 전환되는 조건:
- `searchParams` 사용
- `cookies()`, `headers()` 등 동적 함수 호출
- `cache: 'no-store'` fetch
- `export const dynamic = 'force-dynamic'` 설정
- `connection()` 호출

정적 렌더링이 가능하면 항상 정적으로 유지하는 것이 성능상 유리하다.
