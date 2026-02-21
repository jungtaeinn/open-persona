/**
 * 디즈니/픽사 스타일 캐릭터 씬.
 * 투명 배경 PNG 이미지 + CSS 애니메이션으로 역동적 움직임.
 * 9가지 표정을 가중치 기반으로 순환하며, idle talk 말풍선을 트리거한다.
 */
import { useState, useEffect, useRef, useCallback } from 'react';

import pigImg from '../../../../assets/characters/pig.png';
import foxImg from '../../../../assets/characters/fox.png';
import rabbitImg from '../../../../assets/characters/rabbit.png';
import foxBlinkImg from '../../../../assets/characters/fox-blink.png';
import foxHappyImg from '../../../../assets/characters/fox-happy.png';
import foxSurprisedImg from '../../../../assets/characters/fox-surprised.png';
import foxSleepyImg from '../../../../assets/characters/fox-sleepy.png';
import foxLoveImg from '../../../../assets/characters/fox-love.png';
import foxWinkImg from '../../../../assets/characters/fox-wink.png';
import foxPoutImg from '../../../../assets/characters/fox-pout.png';
import foxThinkingImg from '../../../../assets/characters/fox-thinking.png';
import pigBlinkImg from '../../../../assets/characters/pig-blink.png';
import pigHappyImg from '../../../../assets/characters/pig-happy.png';
import pigSurprisedImg from '../../../../assets/characters/pig-surprised.png';
import pigSleepyImg from '../../../../assets/characters/pig-sleepy.png';
import pigLoveImg from '../../../../assets/characters/pig-love.png';
import pigWinkImg from '../../../../assets/characters/pig-wink.png';
import pigPoutImg from '../../../../assets/characters/pig-pout.png';
import pigThinkingImg from '../../../../assets/characters/pig-thinking.png';
import rabbitBlinkImg from '../../../../assets/characters/rabbit-blink.png';
import rabbitHappyImg from '../../../../assets/characters/rabbit-happy.png';
import rabbitSurprisedImg from '../../../../assets/characters/rabbit-surprised.png';
import rabbitSleepyImg from '../../../../assets/characters/rabbit-sleepy.png';
import rabbitLoveImg from '../../../../assets/characters/rabbit-love.png';
import rabbitWinkImg from '../../../../assets/characters/rabbit-wink.png';
import rabbitPoutImg from '../../../../assets/characters/rabbit-pout.png';
import rabbitThinkingImg from '../../../../assets/characters/rabbit-thinking.png';

import { useAgentStore } from '../../stores/agent-store';
import { getPersona } from '../../../shared/character-personas';

/* ───────── 타입 & 상수 ───────── */

type Expression = 'default' | 'blink' | 'happy' | 'surprised' | 'sleepy' | 'love' | 'wink' | 'pout' | 'thinking';

type CharacterImageSet = Record<Expression, string>;

const CHARACTER_IMAGES: Record<string, CharacterImageSet> = {
  fox: {
    default: foxImg, blink: foxBlinkImg, happy: foxHappyImg,
    surprised: foxSurprisedImg, sleepy: foxSleepyImg, love: foxLoveImg,
    wink: foxWinkImg, pout: foxPoutImg, thinking: foxThinkingImg,
  },
  pig: {
    default: pigImg, blink: pigBlinkImg, happy: pigHappyImg,
    surprised: pigSurprisedImg, sleepy: pigSleepyImg, love: pigLoveImg,
    wink: pigWinkImg, pout: pigPoutImg, thinking: pigThinkingImg,
  },
  rabbit: {
    default: rabbitImg, blink: rabbitBlinkImg, happy: rabbitHappyImg,
    surprised: rabbitSurprisedImg, sleepy: rabbitSleepyImg, love: rabbitLoveImg,
    wink: rabbitWinkImg, pout: rabbitPoutImg, thinking: rabbitThinkingImg,
  },
};

/* ───────── CSS 애니메이션 (한 번만 주입) ───────── */

const ANIM_CSS = `
  @keyframes charBreath {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-4px); }
  }
  @keyframes charBreathActive {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-8px); }
  }
  @keyframes charSway {
    0%, 100% { transform: rotate(0deg); }
    25% { transform: rotate(1.2deg); }
    75% { transform: rotate(-1.2deg); }
  }
  @keyframes charSwayActive {
    0%, 100% { transform: rotate(0deg); }
    25% { transform: rotate(2deg); }
    75% { transform: rotate(-2deg); }
  }
  @keyframes typing {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    15% { transform: translateY(-1px) rotate(0.3deg); }
    30% { transform: translateY(0.5px) rotate(-0.2deg); }
    45% { transform: translateY(-1.5px) rotate(0.4deg); }
    60% { transform: translateY(0px) rotate(-0.3deg); }
    75% { transform: translateY(-0.5px) rotate(0.2deg); }
    90% { transform: translateY(1px) rotate(-0.1deg); }
  }
  @keyframes glowPulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 1; }
  }
`;

function injectStyleOnce(id: string, css: string) {
  const existing = document.head.querySelector(`[data-style-id="${id}"]`);
  if (existing) {
    existing.textContent = css;
    return;
  }
  const el = document.createElement('style');
  el.setAttribute('data-style-id', id);
  el.textContent = css;
  document.head.appendChild(el);
}
injectStyleOnce('char-anim', ANIM_CSS);

/* ───────── 표정 가중치 시스템 ───────── */

interface ExpressionWeight {
  expression: Expression;
  weight: number;
  duration: number;
}

interface ExpressionProfile {
  minDelay: number;
  maxDelay: number;
  weights: ExpressionWeight[];
}

const FOX_PROFILE: ExpressionProfile = {
  minDelay: 4000, maxDelay: 9000,
  weights: [
    { expression: 'blink',     weight: 20, duration: 600 },
    { expression: 'happy',     weight: 10, duration: 1800 },
    { expression: 'wink',      weight: 18, duration: 1000 },
    { expression: 'thinking',  weight: 16, duration: 2200 },
    { expression: 'surprised', weight: 8,  duration: 1300 },
    { expression: 'sleepy',    weight: 6,  duration: 2200 },
    { expression: 'love',      weight: 8,  duration: 1800 },
    { expression: 'pout',      weight: 14, duration: 1800 },
  ],
};

const PIG_PROFILE: ExpressionProfile = {
  minDelay: 5000, maxDelay: 12000,
  weights: [
    { expression: 'blink',     weight: 18, duration: 900 },
    { expression: 'happy',     weight: 14, duration: 2200 },
    { expression: 'love',      weight: 18, duration: 2000 },
    { expression: 'sleepy',    weight: 16, duration: 2500 },
    { expression: 'wink',      weight: 8,  duration: 1100 },
    { expression: 'thinking',  weight: 10, duration: 2300 },
    { expression: 'surprised', weight: 8,  duration: 1400 },
    { expression: 'pout',      weight: 8,  duration: 1800 },
  ],
};

const RABBIT_PROFILE: ExpressionProfile = {
  minDelay: 3000, maxDelay: 7000,
  weights: [
    { expression: 'blink',     weight: 15, duration: 500 },
    { expression: 'happy',     weight: 18, duration: 1500 },
    { expression: 'surprised', weight: 18, duration: 1200 },
    { expression: 'love',      weight: 12, duration: 1600 },
    { expression: 'wink',      weight: 12, duration: 900 },
    { expression: 'sleepy',    weight: 6,  duration: 2000 },
    { expression: 'thinking',  weight: 8,  duration: 2000 },
    { expression: 'pout',      weight: 11, duration: 1600 },
  ],
};

const PROFILES: Record<string, ExpressionProfile> = {
  fox: FOX_PROFILE, pig: PIG_PROFILE, rabbit: RABBIT_PROFILE,
};

function pickWeighted(weights: ExpressionWeight[]): ExpressionWeight {
  const total = weights.reduce((s, w) => s + w.weight, 0);
  let r = Math.random() * total;
  for (const w of weights) {
    r -= w.weight;
    if (r <= 0) return w;
  }
  return weights[weights.length - 1];
}

/* ───────── 안전 타이머 유틸 ───────── */

function useSafeTimers() {
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  const safeTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
    return id;
  }, []);

  const clearAll = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
  }, []);

  useEffect(() => () => clearAll(), [clearAll]);

  return { safeTimeout, clearAll };
}

/* ───────── 표정 순환 훅 ───────── */

const ACTIVE_HEIGHT = 440;
const INACTIVE_HEIGHT = 350;

function useExpressionCycle(characterId: string) {
  const [expression, setExpression] = useState<Expression>('default');
  const { safeTimeout } = useSafeTimers();

  useEffect(() => {
    const profile = PROFILES[characterId] ?? FOX_PROFILE;

    const scheduleNext = () => {
      const delay = profile.minDelay + Math.random() * (profile.maxDelay - profile.minDelay);
      safeTimeout(() => {
        const pick = pickWeighted(profile.weights);
        setExpression(pick.expression);
        safeTimeout(() => {
          setExpression('default');
          scheduleNext();
        }, pick.duration);
      }, delay);
    };

    const initialDelay = 1500 + Math.random() * 3000;
    safeTimeout(() => scheduleNext(), initialDelay);
  }, [characterId, safeTimeout]);

  return expression;
}

/* ───────── Idle Talk 훅 ───────── */

function useIdleTalkCycle(characterId: string) {
  const { safeTimeout, clearAll } = useSafeTimers();
  const isChatOpen = useAgentStore((s) => s.isChatOpen);
  const agentState = useAgentStore((s) => s.state);
  const copyToast = useAgentStore((s) => s.copyToastMessage);
  const showIdleTalk = useAgentStore((s) => s.showIdleTalk);

  useEffect(() => {
    const canTalk = !isChatOpen && agentState === 'idle' && !copyToast;
    if (!canTalk) return clearAll;

    const scheduleNext = () => {
      const delay = 20000 + Math.random() * 20000;
      safeTimeout(() => {
        const persona = getPersona(characterId);
        const talks = persona.idleTalks;
        if (talks.length > 0) {
          showIdleTalk(talks[Math.floor(Math.random() * talks.length)]);
        }
        scheduleNext();
      }, delay);
    };

    const initialDelay = 8000 + Math.random() * 12000;
    safeTimeout(() => scheduleNext(), initialDelay);

    return clearAll;
  }, [characterId, isChatOpen, agentState, copyToast, showIdleTalk, safeTimeout, clearAll]);
}

/* ───────── 캐릭터 카드 컴포넌트 ───────── */

interface CharacterCardProps {
  characterId: string;
  isActive: boolean;
  onClick: () => void;
  delay: number;
  forceExpression?: Expression | null;
}

function CharacterCard({ characterId, isActive, onClick, delay, forceExpression }: CharacterCardProps) {
  const imageSet = CHARACTER_IMAGES[characterId];
  const [isHovered, setIsHovered] = useState(false);
  const cycleExpression = useExpressionCycle(characterId);
  const h = isActive ? ACTIVE_HEIGHT : INACTIVE_HEIGHT;

  const expression = (isActive && forceExpression) ? forceExpression : cycleExpression;
  const currentSrc = imageSet?.[expression] ?? imageSet?.default;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'relative',
        cursor: 'pointer',
        zIndex: isActive ? 10 : isHovered ? 5 : 1,
        marginLeft: '-30px',
        marginRight: '-30px',
        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        transform: isHovered && !isActive ? 'translateY(-12px) scale(1.08)' : 'translateY(0) scale(1)',
        filter: isActive
          ? 'drop-shadow(0 6px 20px rgba(99,102,241,0.45))'
          : isHovered
            ? 'drop-shadow(0 8px 20px rgba(255,255,255,0.2)) brightness(1.1)'
            : 'drop-shadow(0 3px 6px rgba(0,0,0,0.25))',
      }}
    >
      <div style={{
        animation: isActive
          ? `charBreathActive 2.5s ease-in-out infinite ${delay}s`
          : `charBreath 3.5s ease-in-out infinite ${delay}s`,
      }}>
        <div style={{
          animation: isActive
            ? `charSwayActive 4s ease-in-out infinite ${delay + 0.5}s`
            : `charSway 6s ease-in-out infinite ${delay + 0.5}s`,
          transformOrigin: 'center bottom',
        }}>
          <div style={{
            animation: isActive ? 'typing 1.2s ease-in-out infinite' : 'none',
          }}>
            <img
              src={currentSrc}
              alt={characterId}
              style={{
                height: `${h}px`, width: 'auto', objectFit: 'contain',
                pointerEvents: 'none', userSelect: 'none',
                transition: 'height 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                display: 'block',
              }}
              draggable={false}
            />
          </div>
        </div>
      </div>
      {isActive && (
        <div style={{
          position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '60%', height: '4px', borderRadius: '2px',
          background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.9), transparent)',
          animation: 'glowPulse 2s ease-in-out infinite',
        }} />
      )}
    </div>
  );
}

/* ───────── 메인 씬 ───────── */

const STATE_EXPRESSION_MAP: Partial<Record<string, Expression>> = {
  acting: 'thinking',
  thinking: 'thinking',
};

export function CharacterScene() {
  const characters = useAgentStore((s) => s.characters);
  const activeCharacter = useAgentStore((s) => s.activeCharacter);
  const setActiveCharacter = useAgentStore((s) => s.setActiveCharacter);
  const agentState = useAgentStore((s) => s.state);

  useIdleTalkCycle(activeCharacter.id);

  const forceExpression = STATE_EXPRESSION_MAP[agentState] ?? null;

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      position: 'relative', pointerEvents: 'none',
    }}>
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        position: 'relative', zIndex: 2, bottom: '-85px',
        width: '92%', margin: '0 auto', pointerEvents: 'auto',
      }}>
        {characters.map((char, i) => (
          <CharacterCard
            key={char.id}
            characterId={char.id}
            isActive={activeCharacter.id === char.id}
            onClick={() => setActiveCharacter(char)}
            delay={i * 0.3}
            forceExpression={forceExpression}
          />
        ))}
      </div>
      <div style={{
        position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)',
        width: '92%', height: '100px', borderRadius: '28px',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.04))',
        backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
        border: '1px solid rgba(255,255,255,0.15)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.15)',
        zIndex: 1,
      }} />
    </div>
  );
}
