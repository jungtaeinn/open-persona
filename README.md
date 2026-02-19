# OpenPersona

<!-- 권장: 가로 800~1200px (GitHub에서 보기 좋음). PNG 또는 WebP. -->
<!-- Recommended: 800–1200px width for readability on GitHub. PNG or WebP. -->

![OpenPersona main screen](./docs/screenshot-main.png)

**Demo:** [Download video (MOV)](./docs/demo.mov)

---

**A macOS desktop AI chatbot that lives in your menu bar.** Disney/Pixar-style characters sit at the bottom of your screen and chat with you in speech bubbles—each with a distinct personality and role (developer, doc expert, planner). Supports Gemini and OpenAI, with per-character conversation history, token usage tracking, and a glassmorphism UI.

---

## Features

### Character AI Chatbots

- **Felix (Fox)** — Developer. Confident, witty, and a bit cocky.
- **Done (Pig)** — Doc Expert. Warm and meticulous; great at Excel, PowerPoint, Word, and reports.
- **Bomi (Rabbit)** — Planner. Energetic, upbeat, and quick to brainstorm.
- Separate conversation history per character.
- System prompts keep each character’s tone and role consistent.

### Speech-Bubble UI

- Replies appear in bubbles above the character for a natural chat feel.
- Question chips let you jump back through previous turns.
- Copy a reply and the character responds in-character (e.g. “Copied!”).
- Option to clear the conversation.

### Character Expressions

- Idle animations: blinking and smiling at random intervals (25–55 seconds).
- Each character has two variants (blink, happy) overlaid on the base image.

### Multi-LLM Support

- **Gemini 2.0 Flash** (default)
- **GPT-4o** (OpenAI)
- Switch models from the system tray.

### Monitoring Panels

- **Token usage** — Today/monthly usage, per-model breakdown, monthly budget.
- **System monitor** — CPU/memory, RSS trend, basic memory-leak awareness.

### Other

- **Glassmorphism UI** — Transparent, blurred bottom bar.
- **Character animation** — Breathing, sway, typing motion.
- **System tray** — Show/hide, optional launch at login.

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

---

## Setup & Run

### Requirements

- Node.js 18+
- pnpm

### Install

```bash
pnpm install
```

### Environment

Create a `.env` in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key   # optional
```

Get a Gemini API key from [Google AI Studio](https://aistudio.google.com).

### Run

```bash
pnpm start
```

### Build

```bash
pnpm make
```

---

## Adding a Character

1. Add character images under `assets/characters/` (base + `blink` + `happy`, transparent PNG).
2. Add a persona in `src/shared/character-personas.ts` (system prompt, greeting, copy/error messages).
3. Register the character in `DEFAULT_CHARACTERS` in `src/renderer/stores/agent-store.ts`.
4. In `src/renderer/components/scene/CharacterScene.tsx`, import the images and add them to `CHARACTER_IMAGES`.

---

## Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+Space` | Toggle character show/hide |
| `Enter` | Send message |
| `Esc` | Close chat |

---

## License

MIT
