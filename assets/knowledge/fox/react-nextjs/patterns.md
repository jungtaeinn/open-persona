# React / Next.js 패턴 가이드

## React Server Components (RSC)
- 기본 = Server Component: 데이터 페칭, DB 접근 가능
- 'use client' 지시자: 인터랙션, 브라우저 API 필요 시만 사용
- Server → Client 전달: serializable props만 가능 (함수, Date 불가)
- Streaming: `<Suspense>` + `loading.tsx`로 점진적 렌더링

## Next.js App Router 패턴
- `layout.tsx`: 공유 레이아웃, 중첩 레이아웃
- `page.tsx`: 라우트 엔트리포인트
- `loading.tsx`: 로딩 UI (Suspense 자동 래핑)
- `error.tsx`: Error Boundary (자동 래핑)
- `not-found.tsx`: 404 페이지
- Route Groups `(group)`: URL에 영향 없는 폴더 정리
- Parallel Routes `@slot`: 같은 레이아웃에 여러 페이지

## 데이터 페칭 패턴
- Server Component 내 직접 fetch: `const data = await fetch(url)`
- `cache()`: 같은 요청 중복 제거 (Request Memoization)
- `revalidatePath()` / `revalidateTag()`: ISR 온디맨드 재검증
- Server Actions: `'use server'` 폼 제출, 데이터 변경

## 상태 관리
- URL State: `nuqs` (useQueryState) — 검색, 필터, 페이지네이션
- Server State: TanStack Query — 캐싱, 재검증, 낙관적 업데이트
- Client State: Zustand — 전역 UI 상태 (모달, 사이드바)
- Form State: React Hook Form + Zod — 폼 검증

## 성능 최적화
- `React.memo()`: props 불변일 때 리렌더링 방지
- `useMemo()` / `useCallback()`: 비용 높은 계산/콜백 메모이제이션
- `useTransition()`: 비긴급 상태 업데이트 지연
- `useDeferredValue()`: 비긴급 값의 렌더링 지연
- `dynamic(() => import(...))`: 코드 스플리팅
- Image 최적화: `next/image` → WebP 자동 변환, 사이즈 지정

## 컴포넌트 설계 패턴
- Compound Component: `<Select><Select.Trigger /><Select.Content /></Select>`
- Render Props: `<DataLoader render={(data) => ...} />`
- Headless Component: 로직만 제공, UI는 소비자가 결정
- Polymorphic Component: `as` prop으로 렌더링 요소 변경
