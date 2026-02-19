# OpenPersona
#### by TAEINN


---

**A macOS desktop AI Agent that lives in your menu bar.** Disney/Pixar-style characters sit at the bottom of your screen and chat with you in speech bubbles—each with a distinct personality and role (developer, doc expert, planner). Supports Gemini and OpenAI, with per-character conversation history, token usage tracking, and a glassmorphism UI.  

**메뉴 바에 상주하는 macOS 데스크톱 AI 에이전트.** 디즈니/픽사 스타일 캐릭터가 화면 하단에서 말풍선으로 대화하며, 캐릭터별 성격과 역할(개발자, 문서 전문가, 기획자)을 가집니다. Gemini·OpenAI 지원, 캐릭터별 대화 기록·토큰 사용량 추적·글래스모피즘 UI.

Future versions will evolve into an **orchestration-based architecture** using **RAG** (Retrieval-Augmented Generation) and **MCP** (Model Context Protocol) for richer context and tool-augmented workflows.  

추후 버전에서는 **RAG**(검색 증강 생성)와 **MCP**(Model Context Protocol)를 활용한 **오케스트레이션 기반** 구조로 확장되어, 더 풍부한 컨텍스트와 도구 연동 워크플로를 제공할 예정입니다.

---

<!-- 권장: 가로 800~1200px (GitHub에서 보기 좋음). PNG 또는 WebP. -->
<!-- Recommended: 800–1200px width for readability on GitHub. PNG or WebP. -->

![OpenPersona main screen](./docs/screenshot-main.png)

## Features

### Character AI Chatbots

- **Felix (Fox)** — Developer. Confident, witty, and a bit cocky.
- **Done (Pig)** — Doc Expert. Warm and meticulous; great at Excel, PowerPoint, Word, and reports.
- **Bomi (Rabbit)** — Planner. Energetic, upbeat, and quick to brainstorm.
- Separate conversation history per character.
- System prompts keep each character’s tone and role consistent.

- **펠릭스 (여우)** — 개발자. 능글맞고 자신감 넘치는 말투.
- **돈 (돼지)** — 문서 전문가. 다정하고 꼼꼼하며 엑셀·파워포인트·워드·보고서에 강함.
- **보미 (토끼)** — 기획자. 활발하고 에너지 넘치며 아이디어를 빠르게 정리.
- 캐릭터별로 독립적인 대화 기록.
- 시스템 프롬프트로 캐릭터 말투·역할 유지.

### Speech-Bubble UI

- Replies appear in bubbles above the character for a natural chat feel.
- Question chips let you jump back through previous turns.
- Copy a reply and the character responds in-character (e.g. “Copied!”).
- Option to clear the conversation.

- 캐릭터 머리 위 말풍선으로 답변 표시.
- 질문 칩으로 이전 대화로 이동.
- 답변 복사 시 캐릭터가 말투로 “복사됐어!” 등 반응.
- 대화 초기화 가능.

### Character Expressions

- Idle animations: blinking and smiling at random intervals (25–55 seconds).
- Each character has two variants (blink, happy) overlaid on the base image.

- 대기 시 눈 깜빡임·웃는 표정이 25~55초 간격으로 전환.
- 캐릭터당 blink·happy 2종 이미지를 기본 위에 오버레이.

### Multi-LLM Support

- **Gemini 2.0 Flash** (default)
- **GPT-4o** (OpenAI)
- Switch models from the system tray.

- **Gemini 2.0 Flash** (기본)
- **GPT-4o** (OpenAI)
- 시스템 트레이에서 모델 전환.

### Monitoring Panels

- **Token usage** — Today/monthly usage, per-model breakdown, monthly budget.
- **System monitor** — CPU/memory, RSS trend, basic memory-leak awareness.

- **토큰 사용량** — 오늘·이번 달 사용량, 모델별 내역, 월 예산.
- **시스템 모니터** — CPU·메모리, RSS 추이, 메모리 누수 감지.

### Other

- **Glassmorphism UI** — Transparent, blurred bottom bar.
- **Character animation** — Breathing, sway, typing motion.
- **System tray** — Show/hide, optional launch at login.

- **글래스모피즘 UI** — 투명·블러 처리된 하단 바.
- **캐릭터 애니메이션** — 호흡, 흔들림, 타이핑 모션.
- **시스템 트레이** — 표시/숨김, 로그인 시 자동 실행 선택.

---

## Tech Stack

| Area | Stack |
|------|--------|
| Framework | Electron + Electron Forge |
| UI | React 18 + TypeScript |
| State | Zustand |
| LLM | Google Gemini (`@google/genai`), OpenAI (`openai`) |
| Build | Webpack 5 |
| Styling | CSS (glassmorphism, CSS animations) |

| 영역 | 기술 |
|------|--------|
| 프레임워크 | Electron + Electron Forge |
| UI | React 18 + TypeScript |
| 상태 | Zustand |
| LLM | Google Gemini (`@google/genai`), OpenAI (`openai`) |
| 빌드 | Webpack 5 |
| 스타일 | CSS (글래스모피즘, CSS 애니메이션) |

---

## Project Structure

```
src/
├── main/                        # Electron main process
│   ├── main.ts                  # App entry, window & tray
│   ├── tray.ts                  # System tray menu
│   ├── ipc-handlers.ts          # IPC (chat, model switch, tokens, system)
│   └── services/
│       ├── llm/
│       │   ├── llm-router.ts     # Multi-provider LLM router
│       │   ├── gemini-provider.ts
│       │   ├── openai-provider.ts
│       │   └── types.ts
│       ├── token-tracker.ts     # Token usage & monthly limits
│       └── memory-guard.ts      # Memory monitoring
├── renderer/                    # Electron renderer
│   ├── App.tsx                  # Root layout, bubbles, copy toast
│   ├── components/
│   │   ├── chat/BubbleChat.tsx
│   │   ├── scene/CharacterScene.tsx
│   │   └── panel/
│   │       ├── TokenUsagePanel.tsx
│   │       └── SystemMonitorPanel.tsx
│   ├── hooks/
│   │   ├── use-agent.ts
│   │   └── use-chat.ts
│   └── stores/agent-store.ts
├── preload/preload.ts           # IPC bridge (contextBridge)
└── shared/
    ├── types.ts
    └── character-personas.ts   # Personas (prompts, greetings, copy/error messages)

assets/
├── characters/                  # PNGs (transparent): base, blink, happy
│   ├── fox*, pig*, rabbit*
└── icons/                       # Tray icon
```

Electron 메인/렌더러, LLM 서비스, 캐릭터 페르소나 등 위와 같은 프로젝트 구조를 사용합니다.

---

## Setup & Run

### Requirements

- Node.js 18+
- pnpm

사전 요구사항: Node.js 18 이상, pnpm.

### Install

```bash
pnpm install
```

설치: 위 명령으로 의존성을 설치합니다.

### Environment

Create a `.env` in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key   # optional
```

Get a Gemini API key from [Google AI Studio](https://aistudio.google.com).

프로젝트 루트에 `.env` 파일을 만들고 위 변수를 설정하세요. Gemini API 키는 [Google AI Studio](https://aistudio.google.com)에서 발급받을 수 있습니다.

### Run

```bash
pnpm start
```

실행: `pnpm start`로 앱을 띄웁니다.

### Build

```bash
pnpm make
```

빌드: `pnpm make`로 패키징합니다.

---

## Adding a Character

1. Add character images under `assets/characters/` (base + `blink` + `happy`, transparent PNG).
2. Add a persona in `src/shared/character-personas.ts` (system prompt, greeting, copy/error messages).
3. Register the character in `DEFAULT_CHARACTERS` in `src/renderer/stores/agent-store.ts`.
4. In `src/renderer/components/scene/CharacterScene.tsx`, import the images and add them to `CHARACTER_IMAGES`.

1. `assets/characters/`에 캐릭터 이미지 추가 (기본·blink·happy, 투명 PNG).
2. `src/shared/character-personas.ts`에 페르소나 추가 (시스템 프롬프트, 인사말, 복사/에러 메시지).
3. `src/renderer/stores/agent-store.ts`의 `DEFAULT_CHARACTERS`에 캐릭터 등록.
4. `CharacterScene.tsx`에서 이미지를 import하고 `CHARACTER_IMAGES`에 등록.

---

## Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+Space` | Toggle character show/hide |
| `Enter` | Send message |
| `Esc` | Close chat |

| 단축키 | 동작 |
|--------|--------|
| `Cmd+Shift+Space` | 캐릭터 표시·숨기기 |
| `Enter` | 메시지 전송 |
| `Esc` | 채팅 닫기 |

---

## License

MIT

라이선스: MIT
