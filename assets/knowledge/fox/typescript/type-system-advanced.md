# TypeScript 고급 타입 시스템

## Generics 기본 — 타입 매개변수
- 재사용 가능한 컴포넌트를 만들기 위한 타입 변수
- 함수, 인터페이스, 클래스에 적용 가능
- 호출 시 타입 추론 또는 명시적 지정

```typescript
function identity<T>(value: T): T {
  return value;
}
const num = identity(42);        // T = number (추론)
const str = identity<string>('hello'); // T = string (명시)

// 여러 타입 매개변수
function pair<A, B>(first: A, second: B): [A, B] {
  return [first, second];
}

// 기본값
function createArray<T = string>(length: number, value: T): T[] {
  return Array(length).fill(value);
}
```

## Generic 제약 조건 — extends
- `extends`로 타입 매개변수가 만족해야 할 조건 지정
- 제약 조건 내의 속성/메서드에 안전하게 접근 가능

```typescript
interface HasLength {
  length: number;
}

function logLength<T extends HasLength>(value: T): T {
  console.log(value.length); // length 접근 보장
  return value;
}

logLength('hello');   // OK: string has length
logLength([1, 2, 3]); // OK: array has length
// logLength(123);    // Error: number에 length 없음

// keyof 제약
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
```

## Conditional Types — 조건부 타입
- `T extends U ? X : Y` 형태로 타입 수준의 조건 분기
- `infer` 키워드로 조건부 타입 내에서 타입 추출
- Union 타입에 적용 시 distributive (분배) 동작

```typescript
// 기본
type IsString<T> = T extends string ? true : false;
type A = IsString<'hello'>;  // true
type B = IsString<42>;       // false

// infer로 타입 추출
type UnpackPromise<T> = T extends Promise<infer U> ? U : T;
type C = UnpackPromise<Promise<string>>; // string
type D = UnpackPromise<number>;          // number

// 함수 반환 타입 추출
type GetReturn<T> = T extends (...args: any[]) => infer R ? R : never;
type E = GetReturn<() => boolean>; // boolean

// Distributive: Union의 각 멤버에 개별 적용
type ToArray<T> = T extends any ? T[] : never;
type F = ToArray<string | number>; // string[] | number[]
```

## Mapped Types — 매핑된 타입
- 기존 타입의 각 속성을 변환하여 새로운 타입 생성
- `in keyof`로 속성 순회, 수정자(`+`/`-`, `readonly`, `?`) 조작

```typescript
// 모든 속성을 optional로
type MyPartial<T> = {
  [K in keyof T]?: T[K];
};

// readonly 제거
type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};

// 속성 이름 변환 (as 절)
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

interface Person { name: string; age: number; }
type PersonGetters = Getters<Person>;
// { getName: () => string; getAge: () => number; }

// 특정 속성 필터링
type OnlyStrings<T> = {
  [K in keyof T as T[K] extends string ? K : never]: T[K];
};
```

## Template Literal Types — 템플릿 리터럴 타입
- 문자열 리터럴 타입을 조합하여 새로운 패턴 생성
- 내장 유틸리티: `Uppercase`, `Lowercase`, `Capitalize`, `Uncapitalize`

```typescript
type EventName = 'click' | 'focus' | 'blur';
type Handler = `on${Capitalize<EventName>}`;
// 'onClick' | 'onFocus' | 'onBlur'

type HexColor = `#${string}`;
type CSSUnit = `${number}${'px' | 'rem' | 'em' | '%'}`;

// 경로 파라미터 추출
type ExtractParams<T extends string> = 
  T extends `${string}:${infer Param}/${infer Rest}`
    ? Param | ExtractParams<Rest>
    : T extends `${string}:${infer Param}`
      ? Param
      : never;

type Params = ExtractParams<'/users/:userId/posts/:postId'>;
// 'userId' | 'postId'
```

## Indexed Access Types — 인덱스 접근 타입
- `T[K]`로 타입의 특정 속성 타입을 조회
- 배열 요소 타입: `T[number]`

```typescript
interface ApiResponse {
  data: { users: User[]; total: number };
  status: number;
}

type Data = ApiResponse['data'];           // { users: User[]; total: number }
type Users = ApiResponse['data']['users']; // User[]
type SingleUser = ApiResponse['data']['users'][number]; // User

// 유니온 키로 여러 속성 타입 조회
type StatusOrData = ApiResponse['status' | 'data'];

// 튜플 요소 접근
type Tuple = [string, number, boolean];
type First = Tuple[0];     // string
type TupleEl = Tuple[number]; // string | number | boolean
```

## keyof와 typeof 연산자
- `keyof T`: 타입 T의 모든 공개 속성 이름을 유니온으로 추출
- `typeof value`: 값에서 타입을 추출 (타입 컨텍스트에서 사용)

```typescript
interface Config {
  host: string;
  port: number;
  debug: boolean;
}
type ConfigKey = keyof Config; // 'host' | 'port' | 'debug'

// typeof로 값에서 타입 추출
const config = { host: 'localhost', port: 3000, debug: true } as const;
type ConfigType = typeof config;
// { readonly host: "localhost"; readonly port: 3000; readonly debug: true }

// 조합 패턴
type ConfigValues = (typeof config)[keyof typeof config];
// "localhost" | 3000 | true
```

## Discriminated Unions — 판별 유니온
- 공통 리터럴 속성(태그)으로 유니온 멤버를 구분
- `switch`/`if`로 타입 좁히기 자동 적용

```typescript
type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'rect'; width: number; height: number }
  | { kind: 'triangle'; base: number; height: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle': return Math.PI * shape.radius ** 2;
    case 'rect': return shape.width * shape.height;
    case 'triangle': return (shape.base * shape.height) / 2;
  }
}

// API 응답 패턴
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function handle(result: Result<User>) {
  if (result.ok) {
    console.log(result.data.name); // data 접근 가능
  } else {
    console.error(result.error);   // error 접근 가능
  }
}
```

## Type Guards — 타입 가드
- 런타임 검사를 통해 타입을 좁히는 패턴
- `is` (사용자 정의), `in`, `instanceof`, `typeof` 네 가지 방식

```typescript
// 사용자 정의 타입 가드 (is)
function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' && value !== null &&
    'name' in value && 'email' in value
  );
}

// in 연산자
function handle(event: MouseEvent | KeyboardEvent) {
  if ('key' in event) {
    console.log(event.key); // KeyboardEvent
  } else {
    console.log(event.clientX); // MouseEvent
  }
}

// typeof (primitives)
function process(value: string | number) {
  if (typeof value === 'string') {
    return value.toUpperCase(); // string
  }
  return value.toFixed(2); // number
}
```

## satisfies 연산자
- 타입 추론을 유지하면서 타입 호환성만 검사
- `as` 단언과 달리 추론된 구체적 타입이 보존됨

```typescript
type ColorMap = Record<string, string | number[]>;

// as 사용 시: 타입이 ColorMap으로 넓혀짐
const colors1 = {
  red: '#ff0000',
  green: [0, 255, 0],
} as ColorMap;
// colors1.red는 string | number[] (넓음)

// satisfies 사용 시: 추론된 구체적 타입 유지
const colors2 = {
  red: '#ff0000',
  green: [0, 255, 0],
} satisfies ColorMap;
// colors2.red는 string (좁음, toUpperCase 가능)
// colors2.green은 number[] (좁음, map 가능)
```

## as const 단언과 never 타입
- `as const`: 모든 값을 readonly 리터럴 타입으로 좁힘
- `never`: 절대 발생하지 않는 타입. exhaustive check에 활용

```typescript
// as const
const ROUTES = {
  home: '/',
  about: '/about',
  users: '/users',
} as const;
type Route = (typeof ROUTES)[keyof typeof ROUTES];
// '/' | '/about' | '/users'

// never로 exhaustive check
function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${value}`);
}

function getLabel(status: 'active' | 'inactive' | 'pending'): string {
  switch (status) {
    case 'active': return '활성';
    case 'inactive': return '비활성';
    case 'pending': return '대기';
    default: return assertNever(status); // 새 상태 추가 시 컴파일 에러
  }
}
```
