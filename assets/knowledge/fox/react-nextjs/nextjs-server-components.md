# Next.js Server & Client Components 가이드

## Server Component 기본

App Router에서 모든 컴포넌트는 기본적으로 Server Component이다. 서버에서만 실행되며 브라우저에 JavaScript를 전송하지 않는다.

```tsx
// Server Component — 기본값, 별도 디렉티브 불필요
import { db } from '@/lib/db';

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const product = await db.product.findUnique({
    where: { id },
    include: { reviews: true },
  });

  if (!product) notFound();

  return (
    <article>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <ReviewList reviews={product.reviews} />
    </article>
  );
}
```

Server Component에서 가능한 것:
- `async/await`로 데이터 페칭
- DB, ORM 직접 접근
- 파일 시스템 읽기
- API key 등 서버 전용 비밀 값 사용
- 대용량 의존성 사용 (번들에 포함 안 됨)

Server Component에서 불가능한 것:
- `useState`, `useEffect` 등 React Hook
- 브라우저 API (`window`, `document`, `localStorage`)
- 이벤트 핸들러 (`onClick`, `onChange`)

## Client Component ('use client')

인터랙션, 브라우저 API, React Hook이 필요한 컴포넌트에 `'use client'` 디렉티브를 선언한다.

```tsx
'use client';

import { useState, useTransition } from 'react';
import { addToCart } from '@/app/actions/cart';

export function AddToCartButton({ productId }: { productId: string }) {
  const [quantity, setQuantity] = useState(1);
  const [isPending, startTransition] = useTransition();

  const handleAdd = () => {
    startTransition(async () => {
      await addToCart(productId, quantity);
    });
  };

  return (
    <div>
      <select
        value={quantity}
        onChange={(e) => setQuantity(Number(e.target.value))}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
      <button onClick={handleAdd} disabled={isPending}>
        {isPending ? '추가 중...' : '장바구니에 추가'}
      </button>
    </div>
  );
}
```

- `'use client'`는 파일 최상단에 선언 — 해당 파일과 import하는 모든 모듈이 Client Bundle에 포함
- Client Component에서 Server Action을 호출할 수 있음 (서버에서 실행됨)
- Client Component 내부에서 import한 컴포넌트도 자동으로 Client Component가 됨

## Server vs Client 판단 기준

| 요구 사항 | Server | Client |
|---|:---:|:---:|
| 데이터 페칭 (DB, API) | ✅ | ❌ (Route Handler 경유) |
| 서버 리소스 직접 접근 | ✅ | ❌ |
| 민감한 정보 (API key, token) | ✅ | ❌ |
| 대용량 의존성 사용 | ✅ (번들 미포함) | ❌ (번들 증가) |
| 이벤트 핸들러 (onClick 등) | ❌ | ✅ |
| useState, useEffect 등 Hook | ❌ | ✅ |
| 브라우저 API (localStorage 등) | ❌ | ✅ |
| 사용자 인터랙션 (폼 입력 등) | ❌ | ✅ |

기본 원칙: **가능한 한 Server Component를 유지하고, 인터랙션이 필요한 최소 단위만 Client Component로 분리한다.**

## Server → Client 데이터 전달

Server Component에서 Client Component로 props를 전달할 때는 직렬화 가능한(serializable) 값만 가능하다.

```tsx
// ✅ 직렬화 가능한 타입
// string, number, boolean, null, Array, plain Object, Date (문자열로 변환)
// Map, Set, BigInt, Date는 Next.js가 자동 직렬화 지원

// ❌ 직렬화 불가능한 타입
// 함수, 클래스 인스턴스, Symbol, DOM 요소

// Server Component
export default async function ProductPage() {
  const product = await getProduct(); // DB에서 조회

  return (
    <div>
      <h1>{product.name}</h1>
      {/* ✅ serializable props */}
      <PriceDisplay price={product.price} currency={product.currency} />
      {/* ❌ 함수는 전달 불가 */}
      {/* <Button onClick={() => console.log('click')} /> */}
    </div>
  );
}
```

- Server Action은 참조(reference)로 전달 가능 — Client Component에서 호출 시 서버에서 실행
- Promise를 prop으로 전달하고 Client Component에서 `use()`로 resolve 가능

## Server/Client 인터리빙 (children 패턴)

Server Component를 Client Component의 children으로 전달하여 서버 렌더링을 유지한다.

```tsx
// ❌ 잘못된 패턴 — Server Component를 Client Component 내에서 import
'use client';
import ServerComponent from './ServerComponent'; // Client로 변환됨!

export function ClientWrapper() {
  return <ServerComponent />; // 더 이상 Server Component가 아님
}
```

```tsx
// ✅ 올바른 패턴 — children으로 전달
// app/page.tsx (Server Component)
import { ClientWrapper } from './ClientWrapper';
import { ServerContent } from './ServerContent';

export default function Page() {
  return (
    <ClientWrapper>
      <ServerContent /> {/* Server Component로 유지됨 */}
    </ClientWrapper>
  );
}

// ClientWrapper.tsx
'use client';

export function ClientWrapper({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  return isOpen ? <div>{children}</div> : null;
}
```

- Client Component에서 Server Component를 직접 import하면 Client로 변환됨
- `children` 또는 다른 React.ReactNode prop으로 전달하면 서버 렌더링 유지
- 이 패턴은 레이아웃, 모달, 사이드바 등에서 광범위하게 사용

## Context Provider 패턴

React Context는 Client Component에서만 사용 가능하므로, Provider를 Client Component로 래핑한다.

```tsx
// providers/theme-provider.tsx
'use client';

import { createContext, useContext, useState } from 'react';

type Theme = 'light' | 'dark';

const ThemeContext = createContext<{
  theme: Theme;
  toggleTheme: () => void;
} | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
```

```tsx
// app/layout.tsx (Server Component)
import { ThemeProvider } from '@/providers/theme-provider';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <ThemeProvider>
          {children} {/* Server Component 유지 */}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- Provider는 가능한 깊은 위치에 배치하여 Client Boundary를 최소화
- 서버에서 가져온 데이터를 Provider의 `initialValue`로 전달하면 효율적
- 여러 Provider를 하나의 `Providers` 컴포넌트로 합쳐서 관리하는 것이 일반적

## 서드파티 컴포넌트 래핑

서드파티 라이브러리의 Client 전용 컴포넌트를 Server Component에서 사용하려면 래핑한다.

```tsx
// components/carousel.tsx
'use client';

export { Carousel } from 'react-slick';
// 또는 더 커스텀하게:
import { Carousel as SlickCarousel } from 'react-slick';

export function Carousel(props: CarouselProps) {
  return <SlickCarousel {...props} />;
}
```

```tsx
// app/page.tsx (Server Component)
import { Carousel } from '@/components/carousel';

export default async function HomePage() {
  const images = await getHeroImages();
  return <Carousel images={images} />;
}
```

- 서드파티가 `'use client'` 디렉티브를 포함하지 않으면 Server Component에서 에러 발생
- 얇은 래퍼 파일에서 `'use client'`를 선언하고 re-export하는 것이 가장 간단한 해결법
- npm 패키지들이 점점 `'use client'` 디렉티브를 자체 포함하는 추세

## server-only / client-only 패키지

의도하지 않은 환경에서 코드가 실행되는 것을 빌드 타임에 방지한다.

```bash
pnpm add server-only client-only
```

```tsx
// lib/db.ts — 서버에서만 실행되어야 하는 코드
import 'server-only';

export async function getSecretData() {
  const apiKey = process.env.SECRET_API_KEY; // 서버 전용 환경 변수
  return fetch('https://api.example.com/secret', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

// 이 모듈을 Client Component에서 import하면 빌드 에러 발생!
```

```tsx
// hooks/use-local-storage.ts — 클라이언트에서만 실행되어야 하는 코드
import 'client-only';

export function useLocalStorage<T>(key: string, initialValue: T) {
  // localStorage 사용 로직
}

// 이 모듈을 Server Component에서 import하면 빌드 에러 발생!
```

- 런타임 에러 대신 빌드 타임에 잘못된 import를 잡아줌
- API key 등 민감한 값이 클라이언트 번들에 포함되는 것을 방지
- 패키지 진입점에서 import하면 해당 모듈의 모든 export가 보호됨

## RSC Payload

RSC(React Server Components) Payload는 서버에서 렌더링된 컴포넌트 트리의 직렬화된 표현이다.

RSC Payload에 포함되는 것:
- Server Component의 렌더링 결과 (HTML이 아닌 React 트리 구조)
- Client Component가 렌더링될 위치의 플레이스홀더 + 해당 JS 파일 참조
- Server Component에서 Client Component로 전달된 props

동작 흐름:
1. 서버에서 Server Component 트리를 렌더링하여 RSC Payload 생성
2. Client Component 위치에는 플레이스홀더를 삽입하고 JS 번들 참조를 포함
3. RSC Payload를 스트리밍으로 클라이언트에 전송
4. 클라이언트에서 RSC Payload로 DOM 업데이트 + Client Component Hydration

- RSC Payload는 JSON과 유사하지만 React 전용 직렬화 포맷
- 네비게이션 시 전체 HTML이 아닌 변경된 부분의 RSC Payload만 전송
- Server Component의 코드(import 포함)는 클라이언트에 전송되지 않음

## Hydration 프로세스

서버에서 렌더링된 정적 HTML에 JavaScript 이벤트 핸들러를 연결하는 과정이다.

1. **서버**: Server Component 렌더링 → HTML 생성 + RSC Payload
2. **클라이언트 (초기)**: HTML을 즉시 표시 (비인터랙티브)
3. **클라이언트 (Hydration)**: Client Component의 JS 로드 → 이벤트 핸들러 연결
4. **완료**: 페이지가 완전히 인터랙티브

```tsx
// Hydration 불일치 방지
'use client';

import { useState, useEffect } from 'react';

// ❌ Hydration Mismatch — 서버와 클라이언트 결과가 다름
function BadExample() {
  return <p>{new Date().toLocaleString()}</p>; // 서버/클라이언트 시간 차이
}

// ✅ 올바른 패턴 — useEffect로 클라이언트 전용 값 처리
function GoodExample() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    setTime(new Date().toLocaleString());
  }, []);

  if (!time) return <p>Loading...</p>;
  return <p>{time}</p>;
}
```

- Hydration 불일치는 서버/클라이언트 렌더링 결과가 다를 때 발생
- `window`, `localStorage`, `Math.random()`, 현재 시간 등은 서버/클라이언트에서 다른 값을 반환
- `suppressHydrationWarning` prop으로 경고를 억제할 수 있지만, 근본 원인 해결이 우선

## JS 번들 크기 줄이기 패턴

### 1. Client Boundary를 최소 단위로 분리

```tsx
// ❌ 전체 페이지를 Client Component로 만들지 않기
'use client';
export default function ProductPage() {
  /* 데이터 페칭 + 렌더링 + 인터랙션 모두 여기에 */
}

// ✅ 인터랙션이 필요한 부분만 Client Component로 분리
// page.tsx (Server Component)
export default async function ProductPage() {
  const product = await getProduct();
  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.description}</p>        {/* 서버 렌더링 */}
      <AddToCartButton id={product.id} /> {/* 최소 Client 영역 */}
    </div>
  );
}
```

### 2. 동적 import로 코드 스플리팅

```tsx
import dynamic from 'next/dynamic';

const HeavyChart = dynamic(() => import('@/components/Chart'), {
  loading: () => <ChartSkeleton />,
  ssr: false, // 서버 렌더링 불필요 시
});

export default function DashboardPage() {
  return (
    <div>
      <StaticContent />
      <HeavyChart />
    </div>
  );
}
```

### 3. 조건부 로딩

```tsx
'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

const MarkdownEditor = dynamic(() => import('@/components/MarkdownEditor'));

export function PostEditor() {
  const [showEditor, setShowEditor] = useState(false);

  return (
    <div>
      <button onClick={() => setShowEditor(true)}>에디터 열기</button>
      {showEditor && <MarkdownEditor />}
    </div>
  );
}
```

번들 최적화 원칙:
- Server Component는 JS 번들에 포함되지 않음 — 최대한 Server Component 활용
- `'use client'` 경계를 트리 하단으로 밀어내기 (Leaf Components)
- 무거운 라이브러리는 `dynamic()`으로 지연 로딩
- `@next/bundle-analyzer`로 번들 크기를 시각화하고 병목 파악
