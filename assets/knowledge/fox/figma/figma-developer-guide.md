# Figma 개발자 가이드

## Dev Mode — Inspect 패널 사용법
- Dev Mode: 개발자 전용 뷰 (Figma 우측 상단 `</>` 토글)
- Inspect 패널에서 선택한 요소의 CSS, iOS, Android 코드 스니펫 확인
- 요소 간 거리: 요소 선택 후 다른 요소에 마우스 오버 → 간격 표시
- 코드 포맷: CSS (기본), Tailwind CSS, Swift, XML 지원

```
/* Figma Inspect 패널에서 추출되는 CSS 예시 */
width: 320px;
height: 48px;
padding: 12px 16px;
border-radius: 8px;
background: #3B82F6;
font-family: 'Pretendard';
font-weight: 600;
font-size: 14px;
line-height: 20px;
color: #FFFFFF;
```

주의: Figma CSS는 절대 좌표 기반이므로 레이아웃(Flexbox/Grid)은 Auto Layout 구조에서 해석해야 함.

## CSS/Tailwind 코드 추출
- Figma Plugin으로 Tailwind CSS 클래스 자동 변환 가능
- Inspect 패널 하단에서 코드 포맷 선택 (CSS, Tailwind 등)
- 색상, 간격, 폰트는 디자인 토큰과 매핑하여 추출

```html
<!-- Figma 디자인 → Tailwind CSS 변환 예시 -->
<!-- Figma: w=320, h=48, padding=12/16, radius=8, bg=#3B82F6 -->
<button class="w-80 h-12 px-4 py-3 rounded-lg bg-blue-500 
               text-white font-semibold text-sm leading-5">
  버튼 텍스트
</button>
```

## Auto Layout → CSS Flexbox 매핑
- Auto Layout은 CSS Flexbox와 1:1 대응
- Figma의 방향, 간격, 패딩, 정렬이 flex 속성으로 변환

```
Figma Auto Layout          →  CSS Flexbox
─────────────────────────────────────────
Direction: Vertical        →  flex-direction: column
Direction: Horizontal      →  flex-direction: row
Gap: 12                    →  gap: 12px
Padding: 16, 24, 16, 24   →  padding: 16px 24px
Alignment: Center          →  align-items: center
Distribution: Space Between→  justify-content: space-between

Resizing:
  Fixed                    →  width: 200px (고정값)
  Hug Contents             →  width: fit-content
  Fill Container           →  flex: 1 또는 width: 100%
```

```css
/* Auto Layout 컨테이너 → CSS 변환 */
.card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding: 24px;
  width: 320px;           /* Fixed width */
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  align-self: stretch;    /* Fill Container → stretch */
}
```

## 디자인 토큰 — Figma Variables
- Figma Variables: Color, Number(Spacing), String, Boolean 4가지 타입
- Collection으로 그룹화, Mode로 다크/라이트 테마 전환
- 계층 구조: Primitives → Semantic → Component 토큰

```
Figma Variables 구조 예시:

[Primitives Collection]
  blue-50:  #EFF6FF
  blue-500: #3B82F6
  blue-900: #1E3A8A
  gray-50:  #F9FAFB
  gray-900: #111827
  space-1:  4
  space-2:  8
  space-4:  16

[Semantic Collection] (Mode: Light / Dark)
  bg-primary:     Light → {gray-50}    / Dark → {gray-900}
  text-primary:   Light → {gray-900}   / Dark → {gray-50}
  brand-primary:  Light → {blue-500}   / Dark → {blue-500}
  
[Component Collection]
  button-bg:      → {brand-primary}
  button-text:    → {white}
  button-radius:  → {space-2}
```

## Figma Variables → CSS Custom Properties 변환
- Figma Variables를 CSS Custom Properties(변수)로 매핑
- Mode → CSS 클래스 또는 `data-theme` 속성으로 전환
- Figma REST API 또는 Plugin으로 자동 추출 가능

```css
/* Primitives */
:root {
  --color-blue-50: #EFF6FF;
  --color-blue-500: #3B82F6;
  --color-blue-900: #1E3A8A;
  --space-1: 4px;
  --space-2: 8px;
  --space-4: 16px;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 16px;
}

/* Semantic — Light Mode */
[data-theme="light"] {
  --bg-primary: var(--color-gray-50);
  --text-primary: var(--color-gray-900);
  --brand-primary: var(--color-blue-500);
}

/* Semantic — Dark Mode */
[data-theme="dark"] {
  --bg-primary: var(--color-gray-900);
  --text-primary: var(--color-gray-50);
  --brand-primary: var(--color-blue-500);
}
```

## 타이포그래피 매핑
- Figma 텍스트 속성을 CSS font 속성으로 1:1 변환
- Line Height: Figma의 `%` 또는 `px` → CSS `line-height`
- Letter Spacing: Figma의 `%` → CSS `em` 단위 변환 필요

```
Figma Typography         →  CSS
──────────────────────────────────────
Font Family: Pretendard  →  font-family: 'Pretendard', sans-serif
Font Size: 16            →  font-size: 16px (또는 1rem)
Font Weight: SemiBold    →  font-weight: 600
Line Height: 150%        →  line-height: 1.5
Letter Spacing: -1.5%    →  letter-spacing: -0.015em
Text Align: Left         →  text-align: left
Text Decoration: Strike  →  text-decoration: line-through
Text Transform: Upper    →  text-transform: uppercase
```

```typescript
// Figma 타이포그래피 스케일 → Tailwind config 예시
const typography = {
  'heading-1': { fontSize: '32px', lineHeight: '40px', fontWeight: 700 },
  'heading-2': { fontSize: '24px', lineHeight: '32px', fontWeight: 700 },
  'heading-3': { fontSize: '20px', lineHeight: '28px', fontWeight: 600 },
  'body-1':    { fontSize: '16px', lineHeight: '24px', fontWeight: 400 },
  'body-2':    { fontSize: '14px', lineHeight: '20px', fontWeight: 400 },
  'caption':   { fontSize: '12px', lineHeight: '16px', fontWeight: 400 },
} as const;
```

## 색상 시스템 — 토큰 계층
- 3단계 토큰 구조: Primitives → Semantic → Component
- Primitives: 순수 색상값 (blue-500, gray-200 등)
- Semantic: 의미 부여 (bg-primary, text-danger 등)
- Component: 컴포넌트 전용 (button-bg, input-border 등)

```typescript
// 토큰 계층 구현 예시
const primitives = {
  blue: { 50: '#EFF6FF', 500: '#3B82F6', 700: '#1D4ED8' },
  red:  { 50: '#FEF2F2', 500: '#EF4444', 700: '#B91C1C' },
  gray: { 50: '#F9FAFB', 200: '#E5E7EB', 900: '#111827' },
} as const;

const semantic = {
  light: {
    bgPrimary: primitives.gray[50],
    textPrimary: primitives.gray[900],
    brandPrimary: primitives.blue[500],
    danger: primitives.red[500],
  },
  dark: {
    bgPrimary: primitives.gray[900],
    textPrimary: primitives.gray[50],
    brandPrimary: primitives.blue[500],
    danger: primitives.red[500],
  },
} as const;
```

## 그림자/블러 → CSS 변환
- Figma의 Drop Shadow → CSS `box-shadow`
- Figma의 Layer Blur → CSS `filter: blur()`
- Figma의 Background Blur → CSS `backdrop-filter: blur()`

```
Figma Effect                    →  CSS
───────────────────────────────────────────────
Drop Shadow                     →  box-shadow
  X: 0, Y: 4, Blur: 12,        →  box-shadow: 0px 4px 12px 0px
  Spread: 0, Color: #00000026      rgba(0, 0, 0, 0.15);

Inner Shadow                    →  box-shadow: inset ...
  X: 0, Y: 2, Blur: 4            box-shadow: inset 0px 2px 4px ...

Layer Blur: 8                   →  filter: blur(8px)
Background Blur: 12             →  backdrop-filter: blur(12px)
```

```css
/* Figma elevation 시스템 → CSS */
.shadow-sm { box-shadow: 0px 1px 2px 0px rgba(0, 0, 0, 0.05); }
.shadow-md { box-shadow: 0px 4px 6px -1px rgba(0, 0, 0, 0.1),
                         0px 2px 4px -2px rgba(0, 0, 0, 0.1); }
.shadow-lg { box-shadow: 0px 10px 15px -3px rgba(0, 0, 0, 0.1),
                         0px 4px 6px -4px rgba(0, 0, 0, 0.1); }

/* 글래스모피즘 */
.glass {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}
```

## Figma Plugin API 기초
- `figma.currentPage`: 현재 활성 페이지
- `figma.createRectangle()`: 도형 생성
- `figma.currentPage.selection`: 선택된 노드 배열
- Plugin은 TypeScript로 작성, `manifest.json`으로 설정

```typescript
// 선택된 요소의 CSS 색상 추출 Plugin 예시
const selection = figma.currentPage.selection;

for (const node of selection) {
  if ('fills' in node) {
    const fills = node.fills as readonly Paint[];
    for (const fill of fills) {
      if (fill.type === 'SOLID') {
        const { r, g, b } = fill.color;
        const hex = `#${[r, g, b]
          .map(c => Math.round(c * 255).toString(16).padStart(2, '0'))
          .join('')}`;
        console.log(`${node.name}: ${hex}`);
      }
    }
  }
}

// 텍스트 스타일 정보 추출
if (node.type === 'TEXT') {
  console.log({
    fontFamily: node.fontName,
    fontSize: node.fontSize,
    fontWeight: node.fontWeight,
    lineHeight: node.lineHeight,
    letterSpacing: node.letterSpacing,
  });
}
```

## Code Connect — 코드와 디자인 연결
- Figma Code Connect: 디자인 컴포넌트와 실제 코드를 연결
- Dev Mode에서 선택한 컴포넌트의 실제 코드 스니펫 표시
- `.figma.tsx` 파일로 매핑 정의

```tsx
// Button.figma.tsx — Code Connect 설정 파일
import figma from '@figma/code-connect';
import { Button } from './Button';

figma.connect(Button, 'https://figma.com/file/xxx#node-id=1:23', {
  props: {
    label: figma.string('Label'),
    variant: figma.enum('Variant', {
      Primary: 'primary',
      Secondary: 'secondary',
      Ghost: 'ghost',
    }),
    disabled: figma.boolean('Disabled'),
    icon: figma.instance('Icon'),
  },
  example: ({ label, variant, disabled, icon }) => (
    <Button variant={variant} disabled={disabled} icon={icon}>
      {label}
    </Button>
  ),
});
```

설정 후 Dev Mode에서 Button 컴포넌트 선택 시 실제 React 코드 표시.

## 디자인 QA 체크리스트
- 구현 결과물과 Figma 디자인의 일치도 검증 항목
- Figma Dev Mode의 비교 기능 또는 오버레이 플러그인 활용

```
[Spacing & Layout]
□ 요소 간 간격이 디자인 토큰과 일치하는가 (4px 단위)
□ 패딩이 Figma Auto Layout 값과 일치하는가
□ Flex 방향/정렬이 Auto Layout 설정과 일치하는가
□ Fill Container / Hug Contents 동작이 정확한가

[Typography]
□ Font Family, Size, Weight가 디자인과 일치하는가
□ Line Height, Letter Spacing이 정확한가
□ 텍스트 색상이 semantic 토큰과 일치하는가
□ 말줄임(...) 처리가 디자인과 동일한가

[Colors & Effects]
□ 배경색, 텍스트색이 디자인 토큰과 일치하는가
□ 다크 모드에서 올바른 semantic 토큰이 적용되는가
□ 그림자(box-shadow)가 Figma Drop Shadow와 일치하는가
□ 투명도(opacity)가 정확한가

[Responsive]
□ 브레이크포인트별 레이아웃이 디자인과 일치하는가
  - Mobile: 375px
  - Tablet: 768px
  - Desktop: 1280px
□ 컨테이너 최대 너비가 정확한가
□ 이미지/아이콘이 비율 유지하며 리사이즈되는가

[Interactive States]
□ Hover, Active, Focus, Disabled 상태가 구현되었는가
□ 트랜지션/애니메이션 타이밍이 디자인 의도와 일치하는가
□ 포커스 링(focus ring)이 접근성 기준을 충족하는가
```
