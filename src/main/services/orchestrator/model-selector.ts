/**
 * Smart Model Selector.
 * 의도, 복잡성, 비용을 고려하여 최적의 LLM 모델을 동적 선택한다.
 * 사용 가능한 Provider만 후보에 포함하고, 폴백을 지원한다.
 *
 * 기본 전략: Gemini 우선 (무료 티어 + 빠름 + 멀티모달 지원)
 * OpenAI는 Gemini 미등록 시 폴백으로만 사용.
 */
import type { Intent } from './types';

export interface ModelSelection {
  provider: 'openai' | 'gemini';
  model: string;
  reason: string;
}

type ProviderName = 'openai' | 'gemini';

const GEMINI_FLASH = 'gemini-2.0-flash';
const GEMINI_PRO = 'gemini-2.0-pro';
const OPENAI_DEFAULT = 'gpt-4o';
const OPENAI_MINI = 'gpt-4o-mini';

/**
 * 사용 가능한 Provider 중에서 최적 모델을 선택한다.
 * @param intent - 분류된 사용자 의도
 * @param availableProviders - 현재 등록된 Provider 이름 목록
 */
export function selectModel(
  intent: Intent,
  availableProviders: ProviderName[] = ['gemini', 'openai'],
): ModelSelection {
  const hasGemini = availableProviders.includes('gemini');
  const hasOpenAI = availableProviders.includes('openai');

  if (!hasGemini && !hasOpenAI) {
    return {
      provider: 'gemini',
      model: GEMINI_FLASH,
      reason: 'No providers available — will fail gracefully',
    };
  }

  // Gemini 사용 가능 → Gemini 우선
  if (hasGemini) {
    return getGeminiSelection(intent);
  }

  // Gemini 없으면 OpenAI 폴백
  return getOpenAIFallback(intent);
}

/** Gemini 기반 모델 선택 */
function getGeminiSelection(intent: Intent): ModelSelection {
  switch (intent.type) {
    case 'code_review':
    case 'code_generation':
    case 'design_qa':
    case 'functional_qa':
      return {
        provider: 'gemini',
        model: GEMINI_FLASH,
        reason: 'Gemini Flash handles code/QA tasks efficiently',
      };

    case 'translation':
      return {
        provider: 'gemini',
        model: GEMINI_FLASH,
        reason: 'Gemini Flash excels at multilingual translation',
      };

    case 'document_generation':
      return {
        provider: 'gemini',
        model: GEMINI_FLASH,
        reason: 'Gemini Flash handles document generation well',
      };

    case 'file_operation':
      return {
        provider: 'gemini',
        model: GEMINI_FLASH,
        reason: 'Simple file ops only need fast model for tool orchestration',
      };

    case 'knowledge_query':
      return {
        provider: 'gemini',
        model: GEMINI_FLASH,
        reason: 'RAG-backed knowledge queries work well with Gemini Flash',
      };

    case 'help_request':
    case 'general_chat':
    default:
      return {
        provider: 'gemini',
        model: GEMINI_FLASH,
        reason: 'General chat optimized for speed and cost with Gemini Flash',
      };
  }
}

/** OpenAI 폴백 (Gemini 미사용 시) */
function getOpenAIFallback(intent: Intent): ModelSelection {
  switch (intent.type) {
    case 'code_review':
    case 'code_generation':
    case 'design_qa':
    case 'functional_qa':
      return {
        provider: 'openai',
        model: OPENAI_DEFAULT,
        reason: 'Fallback to GPT-4o for code/QA (Gemini unavailable)',
      };

    case 'document_generation':
      return {
        provider: 'openai',
        model: OPENAI_MINI,
        reason: 'Fallback to GPT-4o Mini for documents (Gemini unavailable)',
      };

    default:
      return {
        provider: 'openai',
        model: OPENAI_MINI,
        reason: 'Fallback to GPT-4o Mini (Gemini unavailable)',
      };
  }
}
