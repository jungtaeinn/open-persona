# TypeScript 유틸리티 타입 완전 레퍼런스

## Partial<T> — 모든 속성을 optional로
- 모든 속성에 `?` 수정자를 추가
- 부분 업데이트 패턴에 유용

```typescript
// 구현 원리
type Partial<T> = { [K in keyof T]?: T[K] };

// 사용 예시
interface User {
  name: string;
  email: string;
  age: number;
}

function updateUser(id: string, updates: Partial<User>) {
  // updates는 { name?: string; email?: string; age?: number }
  return db.users.update(id, updates);
}

updateUser('1', { name: '펠릭스' }); // OK: 일부만 전달
```

## Required<T> — 모든 속성을 필수로
- 모든 optional 수정자(`?`)를 제거
- Partial의 반대

```typescript
// 구현 원리
type Required<T> = { [K in keyof T]-?: T[K] };

// 사용 예시
interface Config {
  host?: string;
  port?: number;
  debug?: boolean;
}

const defaultConfig: Required<Config> = {
  host: 'localhost',
  port: 3000,
  debug: false,
};
```

## Readonly<T> — 모든 속성을 읽기 전용으로
- 모든 속성에 `readonly` 수정자를 추가
- 재할당 시 컴파일 에러 발생 (런타임 보호는 아님)

```typescript
// 구현 원리
type Readonly<T> = { readonly [K in keyof T]: T[K] };

// 사용 예시
const user: Readonly<User> = { name: '펠릭스', email: 'f@x.com', age: 5 };
// user.name = 'Felix'; // Error: readonly

// React state에서 활용
function reducer(state: Readonly<State>, action: Action): State {
  // state 직접 변경 방지
  return { ...state, count: state.count + 1 };
}
```

## Record<K, T> — 키-값 매핑 타입
- 키 타입 K와 값 타입 T로 객체 타입 생성
- 모든 키에 동일한 값 타입을 강제

```typescript
// 구현 원리
type Record<K extends keyof any, T> = { [P in K]: T };

// 사용 예시
type Status = 'idle' | 'loading' | 'success' | 'error';

const statusMessages: Record<Status, string> = {
  idle: '대기 중',
  loading: '로딩 중...',
  success: '완료!',
  error: '오류 발생',
};

// 동적 키 매핑
type UserRoles = Record<string, 'admin' | 'user' | 'guest'>;
```

## Pick<T, K> — 특정 속성만 선택
- T에서 K에 해당하는 속성만 추출하여 새 타입 생성

```typescript
// 구현 원리
type Pick<T, K extends keyof T> = { [P in K]: T[P] };

// 사용 예시
interface Article {
  id: string;
  title: string;
  content: string;
  author: User;
  createdAt: Date;
  updatedAt: Date;
}

type ArticlePreview = Pick<Article, 'id' | 'title' | 'author'>;
// { id: string; title: string; author: User }

// API 응답 최소화
function getPreview(article: Article): ArticlePreview {
  const { id, title, author } = article;
  return { id, title, author };
}
```

## Omit<T, K> — 특정 속성 제외
- T에서 K에 해당하는 속성을 제외한 나머지로 새 타입 생성
- Pick의 반대

```typescript
// 구현 원리
type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>;

// 사용 예시
type CreateArticleInput = Omit<Article, 'id' | 'createdAt' | 'updatedAt'>;
// { title: string; content: string; author: User }

// 컴포넌트 props 확장
type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
  variant: 'primary' | 'secondary';
};
```

## Exclude<T, U> — 유니온에서 특정 타입 제외
- 유니온 T에서 U에 할당 가능한 타입을 제거

```typescript
// 구현 원리
type Exclude<T, U> = T extends U ? never : T;

// 사용 예시
type AllEvents = 'click' | 'focus' | 'blur' | 'keydown' | 'keyup';
type MouseEvents = 'click';
type NonMouseEvents = Exclude<AllEvents, MouseEvents>;
// 'focus' | 'blur' | 'keydown' | 'keyup'

// null/undefined 제거
type NonNullString = Exclude<string | null | undefined, null | undefined>;
// string
```

## Extract<T, U> — 유니온에서 특정 타입 추출
- 유니온 T에서 U에 할당 가능한 타입만 추출
- Exclude의 반대

```typescript
// 구현 원리
type Extract<T, U> = T extends U ? T : never;

// 사용 예시
type StringOrNumber = Extract<string | number | boolean, string | number>;
// string | number

// 공통 키 추출
type CommonKeys = Extract<keyof User, keyof Admin>;
```

## NonNullable<T> — null/undefined 제거
- T에서 `null`과 `undefined`를 제외

```typescript
// 구현 원리
type NonNullable<T> = T & {};

// 사용 예시
type MaybeString = string | null | undefined;
type DefiniteString = NonNullable<MaybeString>; // string

function processValue(value: MaybeString) {
  const safe: DefiniteString = value!; // 단언 필요
  // 또는 가드 후 사용
  if (value != null) {
    const safe: DefiniteString = value; // OK
  }
}
```

## Parameters<T>와 ReturnType<T> — 함수 타입 분해
- `Parameters<T>`: 함수 타입의 매개변수를 튜플로 추출
- `ReturnType<T>`: 함수 타입의 반환 타입을 추출

```typescript
// 구현 원리
type Parameters<T extends (...args: any) => any> =
  T extends (...args: infer P) => any ? P : never;
type ReturnType<T extends (...args: any) => any> =
  T extends (...args: any) => infer R ? R : any;

// 사용 예시
function createUser(name: string, age: number): User {
  return { name, age, email: '' };
}

type CreateUserParams = Parameters<typeof createUser>; // [string, number]
type CreateUserReturn = ReturnType<typeof createUser>; // User

// 래퍼 함수에서 활용
function withLogging<T extends (...args: any[]) => any>(fn: T) {
  return (...args: Parameters<T>): ReturnType<T> => {
    console.log('Calling with:', args);
    return fn(...args);
  };
}
```

## ConstructorParameters<T>와 InstanceType<T>
- `ConstructorParameters<T>`: 클래스 생성자의 매개변수 타입 추출
- `InstanceType<T>`: 클래스의 인스턴스 타입 추출

```typescript
class ApiClient {
  constructor(public baseUrl: string, public timeout: number) {}
}

type ClientParams = ConstructorParameters<typeof ApiClient>;
// [baseUrl: string, timeout: number]

type ClientInstance = InstanceType<typeof ApiClient>;
// ApiClient

// 팩토리 패턴
function createInstance<T extends new (...args: any[]) => any>(
  Ctor: T,
  ...args: ConstructorParameters<T>
): InstanceType<T> {
  return new Ctor(...args);
}

const client = createInstance(ApiClient, 'https://api.com', 5000);
```

## Awaited<T> — Promise 해제
- Promise를 재귀적으로 언래핑하여 최종 resolve 타입 추출

```typescript
// 사용 예시
type A = Awaited<Promise<string>>;           // string
type B = Awaited<Promise<Promise<number>>>;  // number (재귀)
type C = Awaited<string | Promise<number>>;  // string | number

// async 함수 반환값 추론
async function fetchUser(): Promise<User> { /* ... */ }
type FetchedUser = Awaited<ReturnType<typeof fetchUser>>; // User
```

## NoInfer<T> — 타입 추론 방지
- 특정 위치에서 타입 추론을 차단하여 다른 위치에서 추론 강제
- TypeScript 5.4에서 추가

```typescript
function createFSM<S extends string>(config: {
  initial: NoInfer<S>;
  states: S[];
}) { /* ... */ }

createFSM({
  initial: 'idle',    // NoInfer: 여기서 S를 추론하지 않음
  states: ['idle', 'loading', 'done'], // S는 여기서 추론
});
// initial에 'idle' | 'loading' | 'done' 이외의 값 → 에러
```

## ThisParameterType<T>와 OmitThisParameter<T>
- `ThisParameterType<T>`: 함수의 `this` 매개변수 타입 추출
- `OmitThisParameter<T>`: `this` 매개변수를 제거한 함수 타입

```typescript
function greet(this: User, greeting: string) {
  return `${greeting}, ${this.name}!`;
}

type GreetThis = ThisParameterType<typeof greet>; // User
type GreetFn = OmitThisParameter<typeof greet>;   // (greeting: string) => string

const boundGreet: GreetFn = greet.bind({ name: '펠릭스', email: '', age: 5 });
```

## 커스텀 유틸리티 타입 패턴
- 내장 유틸리티를 조합하여 프로젝트 전용 타입 생성

```typescript
// DeepPartial: 중첩 객체까지 모든 속성을 optional로
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

// DeepReadonly: 중첩 객체까지 모든 속성을 readonly로
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};

// ValueOf: 객체 타입의 모든 값 타입을 유니온으로
type ValueOf<T> = T[keyof T];

// RequireAtLeastOne: 최소 하나의 속성 필수
type RequireAtLeastOne<T, Keys extends keyof T = keyof T> =
  Pick<T, Exclude<keyof T, Keys>> &
  { [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>> }[Keys];

// Prettify: 인터섹션 타입을 단일 객체로 펼침 (IDE 표시 개선)
type Prettify<T> = { [K in keyof T]: T[K] } & {};

// StrictOmit: keyof T에 존재하는 키만 제거 가능 (Omit보다 안전)
type StrictOmit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
```
