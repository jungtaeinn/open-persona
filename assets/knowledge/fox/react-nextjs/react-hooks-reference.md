# React Hooks 완전 레퍼런스

## useState — 기본 상태 관리
- 컴포넌트에 상태 변수를 추가하는 가장 기본적인 Hook
- 초기값으로 함수를 전달하면 lazy initialization (첫 렌더링에만 실행)
- setter에 함수를 전달하면 이전 상태 기반 업데이트 (함수형 업데이트)

```tsx
const [count, setCount] = useState(0);
setCount(prev => prev + 1); // 함수형 업데이트 (배치 안전)

// 객체 상태: 반드시 새 객체로 교체
const [user, setUser] = useState({ name: '', age: 0 });
setUser(prev => ({ ...prev, name: '펠릭스' }));

// lazy initialization: 비용 높은 초기값
const [data, setData] = useState(() => expensiveComputation());
```

주의: setter는 다음 렌더링에 반영됨. 호출 직후 state를 읽으면 이전 값.

## useReducer — 복잡한 상태 로직
- 여러 하위 값이 있거나 다음 상태가 이전 상태에 의존할 때 사용
- Redux와 동일한 `(state, action) => newState` 패턴

```tsx
type State = { count: number; step: number };
type Action = 
  | { type: 'increment' }
  | { type: 'decrement' }
  | { type: 'setStep'; payload: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'increment': return { ...state, count: state.count + state.step };
    case 'decrement': return { ...state, count: state.count - state.step };
    case 'setStep': return { ...state, step: action.payload };
  }
}

const [state, dispatch] = useReducer(reducer, { count: 0, step: 1 });
dispatch({ type: 'increment' });
dispatch({ type: 'setStep', payload: 5 });
```

## useContext — Context 소비
- `React.createContext`로 생성한 Context의 현재 값을 읽는 Hook
- 가장 가까운 상위 Provider의 `value`를 반환
- Provider value가 변경되면 해당 Context를 구독하는 모든 컴포넌트 리렌더링

```tsx
const ThemeContext = createContext<'light' | 'dark'>('light');

// Provider 설정
function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  return (
    <ThemeContext.Provider value={theme}>
      <Main />
    </ThemeContext.Provider>
  );
}

// 소비
function ThemedButton() {
  const theme = useContext(ThemeContext);
  return <button className={theme}>Click</button>;
}
```

성능 주의: value가 객체일 때 매 렌더마다 새 참조 → 불필요한 리렌더링. `useMemo`로 value 메모이제이션 필요.

## useRef — DOM 참조와 값 저장
- `.current` 속성에 변경 가능한 값을 저장하는 컨테이너
- 값 변경 시 리렌더링을 트리거하지 않음
- 두 가지 용도: DOM 요소 참조, 렌더링 간 값 유지

```tsx
// DOM 참조
function TextInput() {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleClick = () => inputRef.current?.focus();
  return <input ref={inputRef} />;
}

// 렌더링 간 값 유지 (이전 값 추적)
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => { ref.current = value; });
  return ref.current;
}
```

## forwardRef와 useImperativeHandle
- `forwardRef`: 부모가 자식 DOM에 ref를 전달할 수 있게 하는 래퍼
- `useImperativeHandle`: 부모에 노출할 ref 인터페이스를 커스터마이즈

```tsx
interface InputHandle {
  focus: () => void;
  clear: () => void;
}

const CustomInput = forwardRef<InputHandle, InputProps>((props, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);
  
  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    clear: () => { if (inputRef.current) inputRef.current.value = ''; },
  }));

  return <input ref={inputRef} {...props} />;
});

// 부모에서 사용
const ref = useRef<InputHandle>(null);
ref.current?.focus();
ref.current?.clear();
```

## useEffect — 외부 시스템 동기화
- 렌더링 후 실행되는 부수효과 관리 (데이터 페칭, DOM 조작, 구독)
- 의존성 배열이 effect 재실행 타이밍을 결정
- cleanup 함수로 구독 해제, 타이머 정리

```tsx
// 기본 패턴: 의존성이 변경될 때마다 실행
useEffect(() => {
  const controller = new AbortController();
  fetch(`/api/users/${userId}`, { signal: controller.signal })
    .then(res => res.json())
    .then(setUser);
  
  return () => controller.abort(); // cleanup
}, [userId]);

// 마운트 시 한 번만 (빈 배열)
useEffect(() => {
  const handler = (e: KeyboardEvent) => { /* ... */ };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);
```

실행 타이밍: 브라우저 페인트 후 비동기 실행. DOM 측정이 필요하면 `useLayoutEffect` 사용.

## useLayoutEffect — DOM 측정
- `useEffect`와 동일한 시그니처지만 브라우저 페인트 전 동기 실행
- DOM 크기/위치 측정 후 즉시 반영이 필요할 때 사용
- 남용 시 페인트 블로킹으로 성능 저하

```tsx
function Tooltip({ anchorRef, children }: TooltipProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const tooltip = tooltipRef.current;
    if (!anchor || !tooltip) return;
    
    const rect = anchor.getBoundingClientRect();
    setPosition({ top: rect.bottom + 8, left: rect.left });
  }, [anchorRef]);

  return <div ref={tooltipRef} style={position}>{children}</div>;
}
```

## useInsertionEffect — CSS-in-JS 라이브러리 전용
- `useLayoutEffect`보다 먼저 실행 (DOM 변경 전)
- CSS-in-JS 라이브러리가 `<style>` 태그를 삽입하는 데 특화
- 일반 앱 코드에서는 거의 사용하지 않음

```tsx
// CSS-in-JS 라이브러리 내부 구현 예시
function useCSS(rule: string) {
  useInsertionEffect(() => {
    const style = document.createElement('style');
    style.textContent = rule;
    document.head.appendChild(style);
    return () => style.remove();
  });
}
```

## useMemo — 비용 높은 계산 캐시
- 의존성이 변경되지 않으면 이전 계산 결과를 재사용
- 비용 높은 계산, 참조 동일성 유지에 사용
- 모든 계산에 남용하지 말 것 — 메모이제이션 자체도 비용

```tsx
const sortedItems = useMemo(() => {
  return items
    .filter(item => item.category === selectedCategory)
    .sort((a, b) => a.name.localeCompare(b.name));
}, [items, selectedCategory]);

// 참조 동일성 유지 (자식 컴포넌트 props)
const chartData = useMemo(() => ({
  labels: data.map(d => d.label),
  values: data.map(d => d.value),
}), [data]);
```

## useCallback — 함수 메모이제이션
- `useMemo(() => fn, deps)`의 축약형
- 자식 컴포넌트에 콜백 전달 시 불필요한 리렌더링 방지
- `React.memo`와 함께 사용해야 효과가 있음

```tsx
const handleDelete = useCallback((id: string) => {
  setItems(prev => prev.filter(item => item.id !== id));
}, []);

// React.memo와 조합
const ItemRow = memo(({ item, onDelete }: ItemRowProps) => (
  <li>
    {item.name}
    <button onClick={() => onDelete(item.id)}>삭제</button>
  </li>
));
```

## useTransition — 비긴급 상태 업데이트
- 상태 업데이트를 "비긴급"으로 표시하여 UI 응답성 유지
- `isPending`으로 전환 중 로딩 표시 가능
- 입력 필드의 즉각 반응 + 무거운 목록 업데이트 분리에 적합

```tsx
function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Item[]>([]);
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value); // 긴급: 입력 즉시 반영
    startTransition(() => {
      setResults(filterLargeDataset(e.target.value)); // 비긴급
    });
  };

  return (
    <>
      <input value={query} onChange={handleChange} />
      {isPending ? <Spinner /> : <ResultList items={results} />}
    </>
  );
}
```

## useDeferredValue — 지연 렌더링
- 값의 "지연된 버전"을 생성하여 긴급 업데이트 우선 처리
- `useTransition`과 유사하지만 값 기반 (상태 setter에 접근 없을 때)
- 자식 컴포넌트를 `memo()`로 감싸야 효과적

```tsx
function SearchResults({ query }: { query: string }) {
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;

  return (
    <div style={{ opacity: isStale ? 0.5 : 1 }}>
      <HeavyList query={deferredQuery} />
    </div>
  );
}
```

## useId — 고유 ID 생성
- SSR/CSR 간 일치하는 고유 ID 생성 (hydration 안전)
- 접근성 속성(aria-describedby 등)의 ID 연결에 사용
- 리스트 key로는 사용 금지 (데이터에서 key 생성할 것)

```tsx
function FormField({ label }: { label: string }) {
  const id = useId();
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input id={id} />
      <p id={`${id}-error`}>에러 메시지</p>
    </>
  );
}
```

## useSyncExternalStore — 외부 스토어 구독
- React 외부의 데이터 소스(브라우저 API, 전역 변수 등) 구독
- tearing 방지: concurrent 렌더링에서 일관된 값 보장

```tsx
function useOnlineStatus() {
  return useSyncExternalStore(
    (callback) => {
      window.addEventListener('online', callback);
      window.addEventListener('offline', callback);
      return () => {
        window.removeEventListener('online', callback);
        window.removeEventListener('offline', callback);
      };
    },
    () => navigator.onLine,       // 클라이언트 스냅샷
    () => true                    // 서버 스냅샷
  );
}
```

## useActionState — 서버 액션 상태 관리
- React 19에서 추가된 폼 액션 상태 관리 Hook
- Server Action과 함께 사용하여 폼 제출 상태 추적

```tsx
async function submitForm(prevState: FormState, formData: FormData) {
  'use server';
  const name = formData.get('name') as string;
  if (!name) return { error: '이름을 입력하세요' };
  await saveUser(name);
  return { error: null, success: true };
}

function SignupForm() {
  const [state, formAction, isPending] = useActionState(submitForm, { error: null });
  return (
    <form action={formAction}>
      <input name="name" />
      {state.error && <p>{state.error}</p>}
      <button disabled={isPending}>가입</button>
    </form>
  );
}
```

## Custom Hooks 작성 패턴
- `use` 접두사 필수 — React가 Hook 규칙 검사에 사용
- 하나의 관심사만 캡슐화 (단일 책임)
- 내부에서 다른 Hook 자유롭게 조합

```tsx
// 로컬 스토리지 동기화
function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}

// 디바운스
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
```
