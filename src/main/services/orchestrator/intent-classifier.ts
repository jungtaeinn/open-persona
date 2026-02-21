/**
 * Intent Classifier.
 * 사용자 메시지를 분석하여 의도(Intent)를 분류한다.
 * 키워드 기반 1차 분류 후, 신뢰도가 낮으면 LLM으로 2차 판단.
 */
import type { Intent, IntentType } from './types';

/** 캐릭터별 주요 의도 매핑 */
const CHARACTER_INTENTS: Record<string, IntentType[]> = {
  fox: ['code_review', 'code_generation', 'design_qa', 'functional_qa'],
  pig: ['document_generation', 'knowledge_query', 'file_operation'],
  rabbit: ['translation', 'knowledge_query'],
};

/** 키워드-의도 매핑 규칙 */
const KEYWORD_RULES: Array<{ pattern: RegExp; type: IntentType; needsKnowledge: boolean; needsTool: boolean }> = [
  // 파일 조작
  { pattern: /파일\s*(읽|쓰|생성|삭제|이동|복사|목록|열어|만들어)/i, type: 'file_operation', needsKnowledge: false, needsTool: true },
  { pattern: /(read|write|create|delete|move|copy)\s*file/i, type: 'file_operation', needsKnowledge: false, needsTool: true },
  { pattern: /폴더|디렉토리/i, type: 'file_operation', needsKnowledge: false, needsTool: true },

  // 코드 리뷰 / QA
  { pattern: /코드\s*리뷰|review|리팩/i, type: 'code_review', needsKnowledge: true, needsTool: false },
  { pattern: /디자인\s*QA|디자인\s*검수|UI\s*확인/i, type: 'design_qa', needsKnowledge: true, needsTool: false },
  { pattern: /기능\s*QA|기능\s*테스트|QA\s*체크/i, type: 'functional_qa', needsKnowledge: true, needsTool: false },

  // 코드 생성
  { pattern: /코드\s*(작성|생성|만들어)|구현해|개발해/i, type: 'code_generation', needsKnowledge: true, needsTool: true },

  // 번역
  { pattern: /번역|translate|翻訳|통역/i, type: 'translation', needsKnowledge: true, needsTool: false },
  { pattern: /한국어로|영어로|일본어로|중국어로/i, type: 'translation', needsKnowledge: true, needsTool: false },

  // 문서 생성
  { pattern: /엑셀|excel|스프레드시트/i, type: 'document_generation', needsKnowledge: true, needsTool: true },
  { pattern: /파워포인트|pptx?|슬라이드|프레젠테이션/i, type: 'document_generation', needsKnowledge: true, needsTool: true },
  { pattern: /워드|docx?|문서\s*(작성|생성|만들어)/i, type: 'document_generation', needsKnowledge: true, needsTool: true },
  { pattern: /한글|hwp/i, type: 'document_generation', needsKnowledge: true, needsTool: true },
  { pattern: /보고서|리포트|report/i, type: 'document_generation', needsKnowledge: true, needsTool: true },

  // 지식 쿼리
  { pattern: /어떻게|방법|사용법|문법|함수|API/i, type: 'knowledge_query', needsKnowledge: true, needsTool: false },
];

/**
 * 사용자 메시지와 캐릭터 정보를 기반으로 의도를 분류한다.
 *
 * @param message - 사용자 메시지
 * @param characterId - 현재 대화 캐릭터 ID
 * @param hasImage - 이미지 첨부 여부
 */
export function classifyIntent(
  message: string,
  characterId: string,
  hasImage: boolean,
): Intent {
  const characterIntents = CHARACTER_INTENTS[characterId] ?? [];

  // 키워드 기반 1차 분류
  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(message)) {
      const isCharacterSpecialty = characterIntents.includes(rule.type);
      return {
        type: rule.type,
        category: inferCategory(rule.type, message, characterId),
        needsKnowledge: rule.needsKnowledge,
        needsTool: rule.needsTool,
        hasImage,
        confidence: isCharacterSpecialty ? 0.9 : 0.7,
      };
    }
  }

  // 캐릭터 전문 분야에 따른 기본 의도
  if (characterIntents.length > 0) {
    return {
      type: 'knowledge_query',
      category: inferCategory('knowledge_query', message, characterId),
      needsKnowledge: true,
      needsTool: false,
      hasImage,
      confidence: 0.5,
    };
  }

  return {
    type: 'general_chat',
    needsKnowledge: false,
    needsTool: false,
    hasImage,
    confidence: 0.8,
  };
}

/** 캐릭터와 의도에 맞는 RAG 검색 카테고리를 추론 */
function inferCategory(
  intentType: IntentType,
  message: string,
  characterId: string,
): string | undefined {
  if (characterId === 'pig') {
    if (/엑셀|excel|xlsx/i.test(message)) return 'excel';
    if (/파워포인트|pptx?|슬라이드/i.test(message)) return 'powerpoint';
    if (/워드|docx/i.test(message)) return 'word';
    if (/한글|hwp/i.test(message)) return 'hwp';
    return 'general';
  }

  if (characterId === 'fox') {
    if (intentType === 'code_review') return 'code-review';
    if (intentType === 'design_qa') return 'design-qa';
    if (intentType === 'functional_qa') return 'functional-qa';
    if (/react|next/i.test(message)) return 'react-nextjs';
    if (/typescript|ts/i.test(message)) return 'typescript';
    return 'general';
  }

  if (characterId === 'rabbit') {
    if (/한국어|korean|ko/i.test(message) && /영어|english|en/i.test(message)) return 'ko-en';
    if (/영어|english|en/i.test(message) && /한국어|korean|ko/i.test(message)) return 'en-ko';
    if (/일본어|japanese|ja/i.test(message)) return 'ja-ko';
    return 'ko-en';
  }

  return undefined;
}
