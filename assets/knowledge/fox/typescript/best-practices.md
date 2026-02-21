# TypeScript 베스트 프랙티스

## 타입 시스템 활용
- `unknown` > `any`: 타입 안전성을 위해 unknown 선호
- Discriminated Union: `type Result = { ok: true; data: T } | { ok: false; error: Error }`
- Template Literal Types: `type Route = '/api/${string}'`
- Mapped Types: `Partial<T>`, `Required<T>`, `Pick<T, K>`, `Omit<T, K>`
- Conditional Types: `T extends U ? X : Y`
- `satisfies` 연산자: 타입 추론을 유지하면서 타입 체크
- `as const` 단언: 리터럴 타입으로 좁히기

## 에러 처리 패턴
- Result 패턴: `type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E }`
- Custom Error 클래스: `class AppError extends Error { constructor(public code: string, message: string) {} }`
- exhaustiveCheck: `function assertNever(x: never): never { throw new Error() }`
- Zod 스키마 검증: 런타임 타입 안전성

## 함수 설계
- 순수 함수 선호: 부수효과 최소화
- 오버로드 vs 유니온: 호출 시 타입 좁힘이 필요하면 오버로드
- 기본값: `function fetch(url: string, options: Options = {})` 
- 제네릭 제약: `function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K>`

## 프로젝트 구조
- barrel export (`index.ts`): 공개 API만 re-export
- 모듈별 types.ts: 타입 정의를 한 곳에
- 의존성 방향: 단방향 의존성 유지 (순환 참조 방지)

## 성능 팁
- `const enum`: 인라인 치환으로 런타임 비용 0
- `ReadonlyArray<T>`: 불변 배열로 의도 명시
- `Record<string, T>` vs `Map<string, T>`: 정적 키이면 Record, 동적이면 Map
