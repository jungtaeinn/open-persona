# TAEINN-Bot

macOS 데스크탑 AI 챗봇 에이전트. 디즈니/픽사 스타일 캐릭터들이 화면 하단에 상주하며, 캐릭터 고유의 말투로 말풍선 대화를 나눈다.

## 주요 기능

### 캐릭터 AI 챗봇
- **Felix (여우)** — Developer. 능글맞고 자신감 넘치는 개발자
- **Done (돼지)** — Doc Expert. 다정하고 꼼꼼한 문서 전문가 (엑셀/파워포인트/워드)
- **Bomi (토끼)** — Planner. 활발하고 에너지 넘치는 기획자
- 각 캐릭터별 독립적인 대화 히스토리
- 캐릭터별 시스템 프롬프트로 일관된 말투 유지

### 캐릭터 말풍선 UI
- 캐릭터 머리 위에서 말풍선이 올라오는 자연스러운 답변 표시
- 질문 칩 네비게이션으로 이전 대화 탐색
- 답변 복사 시 캐릭터가 고유 말투로 "복사됐어!" 토스트 표시
- 대화 초기화 기능

### 캐릭터 표정 변화
- 눈 깜빡임, 웃는 표정 등 주기적으로 자연스러운 표정 전환
- 각 캐릭터당 2종 변형 이미지 (blink, happy)
- 25~55초 간격으로 랜덤하게 표정이 변하며, 원본 이미지 위에 오버레이

### 멀티 LLM 지원
- Gemini 2.0 Flash (기본)
- GPT-4o (OpenAI)
- 시스템 트레이에서 모델 전환 가능

### 모니터링 패널
- **토큰 사용량** — 오늘/이번달 토큰 소비량, 모델별 사용량, 월간 예산 설정
- **시스템 모니터** — CPU/메모리 사용량, RSS 트렌드 그래프, 메모리 누수 감지

### 기타
- 글래스모피즘 UI — 투명 배경에 블러 처리된 하단 바
- 캐릭터 애니메이션 — 호흡, 좌우 흔들림, 타이핑 모션
- 시스템 트레이 통합 — 숨기기/보이기, 로그인 시 자동 시작

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Electron + Electron Forge |
| UI | React 18 + TypeScript |
| 상태관리 | Zustand |
| LLM | Google Gemini (`@google/genai`), OpenAI (`openai`) |
| 빌드 | Webpack 5 |
| 스타일 | CSS-in-JS (글래스모피즘, CSS 애니메이션) |

## 프로젝트 구조

```
src/
├── main/                        # Electron Main Process
│   ├── main.ts                  # 앱 진입점, 윈도우/트레이 생성
│   ├── tray.ts                  # 시스템 트레이 메뉴
│   ├── ipc-handlers.ts          # IPC 핸들러 (채팅, 모델전환, 토큰, 시스템)
│   └── services/
│       ├── llm/
│       │   ├── llm-router.ts          # LLM 라우터 (멀티 프로바이더)
│       │   ├── gemini-provider.ts     # Gemini API 프로바이더
│       │   ├── openai-provider.ts     # OpenAI API 프로바이더
│       │   └── types.ts               # LLM 추상화 인터페이스
│       ├── token-tracker.ts     # 토큰 사용량 추적 + 월간 한도 관리
│       └── memory-guard.ts      # 메모리 사용량 모니터링
├── renderer/                    # Electron Renderer Process
│   ├── App.tsx                  # 루트 레이아웃, 답변 말풍선 오버레이, 복사 토스트
│   ├── components/
│   │   ├── chat/
│   │   │   └── BubbleChat.tsx         # 입력바 + 질문 칩 네비게이션
│   │   ├── scene/
│   │   │   └── CharacterScene.tsx     # 캐릭터 씬 + 표정 변화 + 글래스바
│   │   └── panel/
│   │       ├── TokenUsagePanel.tsx    # 토큰 사용량 패널 + 월간 예산 게이지
│   │       └── SystemMonitorPanel.tsx # CPU/메모리 모니터링 패널
│   ├── hooks/
│   │   ├── use-agent.ts         # 에이전트 IPC 이벤트 리스너 훅
│   │   └── use-chat.ts          # 채팅 전송 훅
│   └── stores/
│       └── agent-store.ts       # Zustand 글로벌 상태
├── preload/
│   └── preload.ts               # IPC 브릿지 (contextBridge)
└── shared/
    ├── types.ts                 # 공유 타입 정의 (IPC 채널, 모델, 메시지)
    └── character-personas.ts    # 캐릭터 페르소나 설정 (프롬프트, 인사말, 복사 메시지)

assets/
├── characters/                  # 캐릭터 이미지 (투명 배경 PNG)
│   ├── fox.png / fox-blink.png / fox-happy.png
│   ├── pig.png / pig-blink.png / pig-happy.png
│   └── rabbit.png / rabbit-blink.png / rabbit-happy.png
└── icons/
    └── taeinn-tray.png          # 시스템 트레이 아이콘
```

## 설치 및 실행

### 사전 요구사항

- Node.js 18+
- pnpm

### 설치

```bash
pnpm install
```

### 환경변수

프로젝트 루트에 `.env` 파일 생성:

```env
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key   # 선택
```

Gemini API 키는 [Google AI Studio](https://aistudio.google.com)에서 발급.

### 실행

```bash
pnpm start
```

### 빌드

```bash
pnpm make
```

## 캐릭터 추가 방법

1. `assets/characters/`에 캐릭터 이미지 추가 (기본 + blink + happy, 투명 배경 PNG)
2. `src/shared/character-personas.ts`에 페르소나 항목 추가 (프롬프트, 인사말, 복사/에러 메시지)
3. `src/renderer/stores/agent-store.ts`의 `DEFAULT_CHARACTERS`에 캐릭터 등록
4. `src/renderer/components/scene/CharacterScene.tsx`에서 이미지 import 및 `CHARACTER_IMAGES`에 등록

## 단축키

| 단축키 | 동작 |
|--------|------|
| `Cmd+Shift+Space` | 캐릭터 표시/숨기기 토글 |
| `Enter` | 메시지 전송 |
| `Esc` | 채팅 닫기 |

## 라이선스

MIT
