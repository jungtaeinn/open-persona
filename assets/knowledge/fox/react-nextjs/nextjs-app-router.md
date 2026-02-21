# Next.js App Router 완전 가이드

## 파일 기반 라우팅 컨벤션

App Router는 `app/` 디렉토리 내 특수 파일명으로 라우팅을 정의한다.

| 파일명 | 역할 |
|---|---|
| `page.tsx` | 라우트의 UI 엔트리포인트 (이 파일이 있어야 라우트가 공개됨) |
| `layout.tsx` | 공유 레이아웃 (하위 라우트 간 상태 유지) |
| `loading.tsx` | 로딩 UI — 자동으로 `<Suspense>`로 래핑됨 |
| `error.tsx` | 에러 UI — 자동으로 Error Boundary로 래핑됨 |
| `not-found.tsx` | 404 UI — `notFound()` 호출 시 렌더링 |
| `template.tsx` | layout과 유사하지만 네비게이션마다 새 인스턴스 생성 |
| `default.tsx` | Parallel Route의 폴백 UI |

```
app/
├── layout.tsx          # Root Layout (필수)
├── page.tsx            # / 경로
├── loading.tsx         # 전역 로딩
├── error.tsx           # 전역 에러
├── not-found.tsx       # 전역 404
├── dashboard/
│   ├── layout.tsx      # /dashboard 레이아웃
│   ├── page.tsx        # /dashboard 경로
│   └── settings/
│       └── page.tsx    # /dashboard/settings 경로
```

## 중첩 레이아웃 (Nested Layouts)

레이아웃은 `children` prop으로 하위 라우트를 감싼다. 네비게이션 시 레이아웃은 리렌더링되지 않으며 상태가 유지된다.

```tsx
// app/layout.tsx — Root Layout (html, body 태그 필수)
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
```

```tsx
// app/dashboard/layout.tsx — 중첩 레이아웃
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex">
      <aside><Sidebar /></aside>
      <main>{children}</main>
    </div>
  );
}
```

- Root Layout은 `app/layout.tsx`에 반드시 존재해야 하며 `<html>`, `<body>` 태그를 포함해야 한다
- 레이아웃은 기본적으로 Server Component이며, `'use client'`로 Client Component로 전환 가능
- 레이아웃에서 `searchParams`에 접근할 수 없다 — page에서만 접근 가능

## 동적 라우트 세그먼트

동적 세그먼트는 대괄호로 폴더명을 감싸서 정의한다.

| 패턴 | 예시 경로 | params 값 |
|---|---|---|
| `[slug]` | `/blog/hello` | `{ slug: 'hello' }` |
| `[...slug]` | `/docs/a/b/c` | `{ slug: ['a', 'b', 'c'] }` |
| `[[...slug]]` | `/docs` 또는 `/docs/a/b` | `{ slug: undefined }` 또는 `{ slug: ['a', 'b'] }` |

```tsx
// app/blog/[slug]/page.tsx
type Props = {
  params: Promise<{ slug: string }>;
};

export default async function BlogPost({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);
  return <article>{post.content}</article>;
}
```

- `[slug]` — 단일 동적 세그먼트
- `[...slug]` — Catch-all: 1개 이상의 세그먼트 필수 매칭
- `[[...slug]]` — Optional Catch-all: 0개 이상의 세그먼트 매칭 (루트 경로도 매칭)

## Route Groups

소괄호로 폴더명을 감싸면 URL 경로에 영향을 주지 않는다. 라우트 정리와 레이아웃 분리에 유용하다.

```
app/
├── (marketing)/
│   ├── layout.tsx      # 마케팅용 레이아웃
│   ├── about/page.tsx  # /about
│   └── blog/page.tsx   # /blog
├── (shop)/
│   ├── layout.tsx      # 쇼핑용 레이아웃
│   └── products/page.tsx # /products
```

- 같은 URL 레벨에서 서로 다른 레이아웃을 적용할 수 있다
- Route Group마다 별도의 Root Layout을 가질 수도 있다
- 여러 Route Group이 같은 URL 경로로 resolve되면 빌드 에러 발생

## Parallel Routes (@slot)

`@slot` 폴더로 같은 레이아웃 내에 여러 페이지를 동시에 렌더링한다.

```
app/
├── layout.tsx
├── page.tsx
├── @analytics/
│   ├── page.tsx
│   └── default.tsx
├── @team/
│   ├── page.tsx
│   └── default.tsx
```

```tsx
// app/layout.tsx
export default function Layout({
  children,
  analytics,
  team,
}: {
  children: React.ReactNode;
  analytics: React.ReactNode;
  team: React.ReactNode;
}) {
  return (
    <div>
      {children}
      <div className="grid grid-cols-2">
        {analytics}
        {team}
      </div>
    </div>
  );
}
```

- Slot은 URL 세그먼트가 아니므로 `@analytics`는 URL에 영향 없음
- `default.tsx`는 현재 URL과 매칭되지 않을 때 폴백으로 렌더링
- 조건부 렌더링에 활용 가능 — 인증 상태에 따라 다른 slot 렌더링

## Intercepting Routes

현재 레이아웃 내에서 다른 라우트를 가로채서 표시한다. 모달 패턴에 주로 사용한다.

| 컨벤션 | 매칭 대상 |
|---|---|
| `(.)route` | 같은 레벨 |
| `(..)route` | 한 레벨 위 |
| `(..)(..)route` | 두 레벨 위 |
| `(...)route` | 루트(`app/`)부터 |

```
app/
├── feed/
│   ├── page.tsx           # 피드 목록
│   ├── layout.tsx
│   ├── @modal/
│   │   ├── (..)photo/[id]/page.tsx  # 모달로 인터셉트
│   │   └── default.tsx
│   └── photo/[id]/
│       └── page.tsx       # 직접 접근 시 전체 페이지
```

- 소프트 네비게이션 (Link 클릭) 시 인터셉트된 라우트가 모달로 표시
- 하드 네비게이션 (URL 직접 접근, 새로고침) 시 원래 라우트 전체 페이지 렌더링
- Parallel Routes와 함께 사용하여 모달 패턴 구현

## Middleware

`middleware.ts`를 프로젝트 루트(또는 `src/`)에 배치하면 모든 요청 전에 실행된다.

```ts
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/dashboard')) {
    const token = request.cookies.get('auth-token');
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  const response = NextResponse.next();
  response.headers.set('x-pathname', pathname);
  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
```

- `matcher`로 미들웨어가 실행될 경로를 제한 (성능 최적화)
- Edge Runtime에서 실행 — Node.js API 일부 사용 불가
- 요청 리디렉트, 리라이트, 헤더/쿠키 조작 가능
- `NextResponse.next()`로 다음 처리로 넘기기

## Route Handlers (route.ts)

`route.ts` 파일로 Web API Request/Response를 직접 다루는 커스텀 API 엔드포인트를 만든다.

```ts
// app/api/posts/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const page = Number(searchParams.get('page') ?? '1');

  const posts = await db.post.findMany({
    skip: (page - 1) * 10,
    take: 10,
  });

  return NextResponse.json(posts);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const post = await db.post.create({ data: body });
  return NextResponse.json(post, { status: 201 });
}
```

- `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS` 지원
- `route.ts`와 `page.tsx`는 같은 세그먼트에 공존할 수 없다
- GET 핸들러에서 Response 객체를 사용하고 동적 함수를 쓰지 않으면 기본 정적 캐싱
- `request.nextUrl.searchParams`로 쿼리 파라미터 접근

## searchParams와 params 사용법

Next.js 15+ 부터 `params`와 `searchParams`는 Promise로 전달된다.

```tsx
// app/shop/[category]/page.tsx
type Props = {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ sort?: string; page?: string }>;
};

export default async function ShopPage({ params, searchParams }: Props) {
  const { category } = await params;
  const { sort = 'newest', page = '1' } = await searchParams;

  const products = await getProducts({
    category,
    sort,
    page: Number(page),
  });

  return <ProductList products={products} />;
}
```

- `params` — URL의 동적 세그먼트 값 (Promise)
- `searchParams` — URL의 쿼리 스트링 값 (Promise, page.tsx에서만 사용 가능)
- `searchParams`를 사용하면 해당 페이지는 자동으로 동적 렌더링
- `generateStaticParams()`로 빌드 시 정적 params 생성 가능

## Link 컴포넌트와 useRouter

```tsx
import Link from 'next/link';

// 기본 네비게이션
<Link href="/about">About</Link>

// 동적 경로
<Link href={`/blog/${post.slug}`}>Read More</Link>

// 쿼리 파라미터
<Link href={{ pathname: '/search', query: { q: 'nextjs' } }}>
  Search
</Link>

// prefetch 비활성화 (대형 페이지에서 유용)
<Link href="/heavy-page" prefetch={false}>Heavy Page</Link>
```

```tsx
'use client';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export function NavigationExample() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleNavigate = () => {
    router.push('/dashboard');   // 히스토리에 추가
    router.replace('/login');    // 히스토리 교체
    router.back();               // 뒤로가기
    router.refresh();            // 현재 라우트 새로고침 (서버 리페치)
  };

  return <button onClick={handleNavigate}>Navigate</button>;
}
```

- `<Link>`는 자동 prefetch — viewport에 보이면 백그라운드에서 미리 로드
- `useRouter`는 Client Component에서만 사용 가능
- `router.refresh()`는 서버에서 데이터를 다시 가져오되 클라이언트 상태는 유지
- `usePathname()`으로 현재 경로, `useSearchParams()`로 쿼리 파라미터 접근

## PageProps, LayoutProps 타입 정의

```tsx
// Page 컴포넌트 타입
type PageProps<
  TParams extends Record<string, string> = {},
  TSearchParams extends Record<string, string | string[] | undefined> = {}
> = {
  params: Promise<TParams>;
  searchParams: Promise<TSearchParams>;
};

// 사용 예시
export default async function Page({
  params,
  searchParams,
}: PageProps<{ id: string }, { tab?: string }>) {
  const { id } = await params;
  const { tab } = await searchParams;
  // ...
}
```

```tsx
// Layout 컴포넌트 타입
type LayoutProps<TParams extends Record<string, string> = {}> = {
  children: React.ReactNode;
  params: Promise<TParams>;
};

// Parallel Routes가 있는 Layout
type DashboardLayoutProps = {
  children: React.ReactNode;
  analytics: React.ReactNode;
  notifications: React.ReactNode;
  params: Promise<{ teamId: string }>;
};
```

- `params`는 항상 `Promise`로 타입 지정 (Next.js 15+)
- `searchParams`는 `page.tsx`에서만 사용 가능 — layout에는 전달되지 않음
- `generateMetadata()`도 동일한 `params`, `searchParams` 타입을 받는다
