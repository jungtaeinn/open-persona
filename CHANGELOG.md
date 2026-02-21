# open-persona

## 2.0.0

### Major Changes

- **RAG 기반 오케스트레이션 아키텍처 전면 도입**

  기존 단순 LLM 호출 구조에서 Intent 분류 → RAG 검색 → Smart Model 선택 → Tool Call Loop 오케스트레이션 아키텍처로 전환.

  - Orchestrator: 모든 요청의 중앙 허브, Intent → RAG → Model → Tool 파이프라인 관장
  - Intent Classifier: 키워드 기반 의도 분류 (10종 IntentType)
  - Smart Model Selector: Gemini 우선 전략, 사용 가능 Provider 자동 감지 + 폴백
  - Context Builder: 시스템 프롬프트 + RAG 컨텍스트 + 히스토리 + 첨부파일 통합

### Minor Changes

- **RAG Engine (Vectra + OpenAI Embedding)**

  - Vectra LocalIndex 기반 벡터 DB (로컬 파일 저장, 비용 무료)
  - OpenAI text-embedding-3-small 임베딩 (1536차원)
  - 하이브리드 검색: 벡터 시맨틱 + BM25 키워드 검색 → RRF 병합
  - Gemini Flash 기반 LLM 리랭킹
  - 캐릭터별 static/learned 이중 인덱스 관리
  - Structure-Aware Chunker (500토큰, 50토큰 오버랩)
  - Document Loader: Excel(.xlsx), Word(.docx), Markdown 파서

- **Tool Calling 시스템**

  - 8종 파일시스템 도구: readFile, writeFile, listDirectory, createDirectory, deleteFile, moveFile, copyFile, fileInfo
  - 3종 Excel 전용 도구: readExcel (시트별 구조/데이터 Markdown 반환), writeExcel (JSON→xlsx 생성, 다중 시트/스타일/자동필터), queryExcel (컬럼 조건 필터링→새 파일 저장)
  - Tool Guardrails: 시스템 경로 차단, 파일 크기 제한(10MB), 세션 호출 제한(30회), writeExcel 확인 필요
  - Tool Registry: 도구 등록/실행/배치 실행 관리, 도구별 타임아웃 (FS 30초, Excel 60초)
  - Tool Call Loop: LLM → 도구 실행 → 결과 피드백 최대 5라운드 반복

- **Excel 실무 워크플로우 지원**

  - 엑셀 파일 첨부 → readExcel로 데이터 분석 → 사용자에게 구조 설명
  - 조건별 파일 분리: readExcel → queryExcel(여러 조건) → 각각 새 파일 생성
  - 데이터 종합: readExcel(복수 파일) → writeExcel로 통합 파일 생성
  - 조건 필터링: queryExcel (eq, neq, contains, gt, gte, lt, lte, empty, notEmpty 9종 연산자)
  - Done(Pig) 시스템 프롬프트에 Excel 도구 활용 워크플로우 가이드 내장

- **캐릭터 전문가 역할 확장**

  - Felix(Fox): 개발 전문가 + QA (코드 리뷰, 디자인 QA, 기능 QA)
  - Done(Pig): 문서 전문가 (Excel, PowerPoint, Word, HWP 문법) + Excel 실무 도구 활용
  - Bomi(Rabbit): 번역 전문가 (한↔영, 한↔일, 문서 번역)
  - 캐릭터별 RAG 지식베이스 (Markdown) 탑재

- **대규모 RAG 학습 문서 확충 (공식 문서 기반)**

  - Felix(Fox) — 개발 전문가:
    - Next.js: App Router, Data Fetching, Server Components, Caching (4종)
    - React: Hooks Reference (1종)
    - TypeScript: Advanced Type System, Utility Types (2종)
    - Figma: Developer Guide (1종)
  - Done(Pig) — 문서 전문가:
    - Excel: Advanced Formulas, Pivot Tables, Charts, Data Validation (4종)
    - PowerPoint: Master Templates, Advanced Features (2종)
    - HWP: Document Structure, Tables & Forms (2종)
  - 총 16개 RAG 학습 문서, Structure-Aware Chunker에 최적화된 Markdown 형식

- **도구 실행 진행 표시 시스템 (캐릭터 로딩 인디케이터)**

  - 도구 실행 중 캐릭터가 귀여운 말풍선으로 진행 상태 표시 (로딩바 역할)
  - 캐릭터별 도구별 진행 메시지 (toolProgressMessages) — readExcel, writeExcel, queryExcel, readFile, writeFile 등
  - ToolProgressOverlay: 캐릭터 색상 그라데이션 + 펄스 애니메이션 + 진행 점(...) 순차 깜빡임
  - 도구 실행 중 캐릭터 표정 자동 전환 → thinking 표정 고정 (acting/thinking 상태 매핑)
  - 텍스트 응답 시작 시 자동 해제

- **9가지 캐릭터 표정 시스템**

  - 기존 3종(default, blink, happy) → 9종(+ surprised, sleepy, love, wink, pout, thinking) 확장
  - AI 생성 + rembg 배경 제거로 투명 PNG 18장 (캐릭터 3 × 표정 6)
  - 가중치 기반 랜덤 표정 선택 (캐릭터별 개성 반영)
  - 캐릭터별 타이밍 프로필: Fox 4-9초, Pig 5-12초, Rabbit 3-7초
  - 에이전트 상태 기반 표정 오버라이드: acting/thinking 시 thinking 표정 고정

- **Idle Talk 말풍선**

  - 20-40초 간격으로 캐릭터가 뜬금없이 귀여운 한마디
  - CopyToast와 동일한 팝업 애니메이션 패턴
  - 채팅 열림/복사 토스트/도구 실행 중 자동 비활성화

- **예시 질문 시스템**

  - 캐릭터별 전문 분야 예시 질문 + 도움 제안 메시지
  - Done(Pig): 실용적 Excel 예시 추가 (파일 분석, 조건별 분리, 데이터 통합, 조건 필터링)
  - helpOffer, exampleQuestions 페르소나 속성 추가

- **멀티모달 지원**

  - 이미지/파일 첨부 업로드 UI (클립 버튼)
  - ContentPart[] 기반 멀티모달 메시지 처리 (OpenAI Vision, Gemini Vision)

- **연속 학습 시스템**

  - 대화 메모리: 의미 있는 Q&A 쌍 자동 학습 (learned 인덱스)
  - 사용자 피드백: 좋아요/싫어요/수정 반영
  - 지식 업로드: 사용자가 문서 추가하여 캐릭터 지식 동적 확장

- **Gemini 우선 전략**

  - 모든 Intent에서 Gemini 2.0 Flash를 기본 선택
  - OpenAI는 Gemini 미등록 시 폴백으로만 사용
  - Provider 실패 시 자동 폴백 (quota/auth 에러 감지)

- **캐릭터 에러 메시지**

  - API 에러를 quota/network/default로 자동 분류
  - 원시 에러 대신 캐릭터 말투의 친근한 에러 메시지 표시

### Patch Changes

- **메모리 누수 전면 리팩토링**

  - CharacterScene: useSafeTimers 패턴으로 중첩 setTimeout 안전 관리
  - agent-store: showCopyToast/showIdleTalk 타이머 중복 방지
  - BubbleChat: CSS 중복 주입 방지 (injectStyleOnce), setTimeout cleanup
  - ipc-handlers: 핸들러 중복 등록 방지, AbortController 스트림 취소, win.isDestroyed() 체크
  - rag-engine: chunkCache LRU 사이즈 제한 (최대 20), MAX_CHUNKS_PER_ENTRY(500), dummyVector 재사용
  - orchestrator: context message 바운딩 (MAX_CONTEXT_MESSAGES = 30), 세션당 도구 카운터 리셋
  - App.tsx: AnswerCopyButton 타이머 cleanup, CSS 안전 주입
  - TokenTracker: 90일 초과 레코드 자동 정리, async writeFile, 중복 flush 방지
  - GeminiProvider: AbortController 추가로 스트림 취소 지원
  - OpenAIProvider: 동시 스트림 생성 시 이전 스트림 자동 abort
  - TokenUsagePanel / SystemMonitorPanel: isMounted 가드로 언마운트 후 setState 방지
  - readFile 도구: fs.open() + handle.read()로 대용량 파일 부분 읽기 (50KB 제한)
  - Tool Registry: withTimeout 유틸로 도구 실행 무한 대기 방지 (FS 30초, Excel 60초)
  - chatHistoryByCharacter: FIFO → LRU 캐시 전환
  - main.ts: app quit 시 llmRouter.dispose(), cleanupIpcTimers() 호출로 리소스 완전 정리

- **TypeScript 타입 안전성 개선**

  - assets.d.ts 분리 (PNG/JPG/WebP 모듈 선언)
  - IntentType에 help_request 추가
  - ChunkMetadata 인덱스 시그니처 제거

- **라이센스 변경: MIT → Apache License 2.0**

  - 저작자(JUNGTAEINN) 표기 의무화
  - LICENSE 파일 + NOTICE 파일 추가
  - README.md 라이센스 섹션 업데이트

- **README.md 한/영 이중 문서화**

  - 모든 섹션에 영문 단락 직후 한국어 번역 추가
  - 아키텍처, 기능, 모델 선택, 도구 시스템, 메모리/성능, UI 특징, 프로젝트 구조 등 전체 반영
  - package.json description/keywords v2.0 전면 업데이트

---

## 1.0.0

### Minor Changes

- ### 캐릭터 말풍선 채팅 UI

  - 캐릭터 머리 위에서 말풍선이 올라오는 답변 표시
  - 질문 칩 네비게이션으로 이전 대화 탐색
  - 답변 복사 시 캐릭터 고유 말투로 토스트 표시

  ### 캐릭터 표정 변화

  - 눈 깜빡임/웃는 표정 등 주기적 표정 전환 (25~55초 간격)
  - 각 캐릭터당 blink, happy 변형 이미지

  ### 모니터링 패널

  - 토큰 사용량 패널 (월간 예산 설정 포함)
  - CPU/메모리 시스템 모니터 패널

  ### 설치형 빌드

  - macOS .dmg 설치 파일 생성 지원
  - .icns 앱 아이콘 추가

  ### 버전 관리

  - changesets 기반 CHANGELOG.md 자동 관리
