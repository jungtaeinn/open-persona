/**
 * 디즈니/픽사 스타일 캐릭터 씬.
 * 투명 배경 PNG 이미지 + CSS 애니메이션으로 역동적 움직임.
 * 주기적으로 표정이 변한다 (눈 깜빡임, 미소 등).
 */
import { useState, useEffect, useRef } from 'react';
import pigImg from '../../../../assets/characters/pig.png';
import foxImg from '../../../../assets/characters/fox.png';
import rabbitImg from '../../../../assets/characters/rabbit.png';
import foxBlinkImg from '../../../../assets/characters/fox-blink.png';
import foxHappyImg from '../../../../assets/characters/fox-happy.png';
import pigBlinkImg from '../../../../assets/characters/pig-blink.png';
import pigHappyImg from '../../../../assets/characters/pig-happy.png';
import rabbitBlinkImg from '../../../../assets/characters/rabbit-blink.png';
import rabbitHappyImg from '../../../../assets/characters/rabbit-happy.png';
import { useAgentStore } from '../../stores/agent-store';

type Expression = 'default' | 'blink' | 'happy';

interface CharacterImageSet {
  default: string;
  blink: string;
  happy: string;
}

const CHARACTER_IMAGES: Record<string, CharacterImageSet> = {
  fox: { default: foxImg, blink: foxBlinkImg, happy: foxHappyImg },
  pig: { default: pigImg, blink: pigBlinkImg, happy: pigHappyImg },
  rabbit: { default: rabbitImg, blink: rabbitBlinkImg, happy: rabbitHappyImg },
};

const ANIM_STYLE = document.createElement('style');
ANIM_STYLE.textContent = `
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
  @keyframes expressionFade {
    0% { opacity: 0; }
    8% { opacity: 1; }
    92% { opacity: 1; }
    100% { opacity: 0; }
  }
`;
if (!document.head.querySelector('[data-char-anim]')) {
  ANIM_STYLE.setAttribute('data-char-anim', '');
  document.head.appendChild(ANIM_STYLE);
}

const ACTIVE_HEIGHT = 440;
const INACTIVE_HEIGHT = 350;

function useExpressionCycle(characterId: string) {
  const [expression, setExpression] = useState<Expression>('default');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const scheduleNext = () => {
      const baseDelay = 25000 + Math.random() * 30000;
      timerRef.current = setTimeout(() => {
        const nextExpr: Expression = Math.random() > 0.5 ? 'blink' : 'happy';
        setExpression(nextExpr);

        const duration = nextExpr === 'blink' ? 800 : 2500;
        setTimeout(() => {
          setExpression('default');
          scheduleNext();
        }, duration);
      }, baseDelay);
    };

    const initialDelay = 5000 + Math.random() * 15000;
    timerRef.current = setTimeout(() => {
      scheduleNext();
    }, initialDelay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [characterId]);

  return expression;
}

interface CharacterCardProps {
  characterId: string;
  isActive: boolean;
  onClick: () => void;
  delay: number;
}

function CharacterCard({ characterId, isActive, onClick, delay }: CharacterCardProps) {
  const imageSet = CHARACTER_IMAGES[characterId];
  const [isHovered, setIsHovered] = useState(false);
  const expression = useExpressionCycle(characterId);
  const h = isActive ? ACTIVE_HEIGHT : INACTIVE_HEIGHT;

  const showOverlay = expression !== 'default' && imageSet;
  const overlaySrc = showOverlay ? imageSet[expression] : null;

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
      {/* 호흡 레이어 */}
      <div style={{
        animation: isActive
          ? `charBreathActive 2.5s ease-in-out infinite ${delay}s`
          : `charBreath 3.5s ease-in-out infinite ${delay}s`,
      }}>
        {/* 좌우 흔들림 레이어 */}
        <div style={{
          animation: isActive
            ? `charSwayActive 4s ease-in-out infinite ${delay + 0.5}s`
            : `charSway 6s ease-in-out infinite ${delay + 0.5}s`,
          transformOrigin: 'center bottom',
        }}>
          {/* 타이핑 미세 움직임 (활성만) */}
          <div style={{
            animation: isActive ? 'typing 1.2s ease-in-out infinite' : 'none',
            position: 'relative',
          }}>
            {/* 기본 이미지 — 항상 렌더 */}
            <img
              src={imageSet?.default}
              alt={characterId}
              style={{
                height: `${h}px`,
                width: 'auto',
                objectFit: 'contain',
                pointerEvents: 'none',
                userSelect: 'none',
                transition: 'height 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                display: 'block',
              }}
              draggable={false}
            />

            {/* 표정 오버레이 — 기본 이미지 위에 겹침 */}
            {showOverlay && overlaySrc && (
              <img
                key={`${characterId}-${expression}`}
                src={overlaySrc}
                alt={`${characterId}-${expression}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: `${h}px`,
                  width: 'auto',
                  objectFit: 'contain',
                  pointerEvents: 'none',
                  userSelect: 'none',
                  animation: expression === 'blink'
                    ? 'expressionFade 0.8s ease-in-out forwards'
                    : 'expressionFade 2.5s ease-in-out forwards',
                }}
                draggable={false}
              />
            )}
          </div>
        </div>
      </div>

      {/* 활성 글로우 바 */}
      {isActive && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '60%',
          height: '4px',
          borderRadius: '2px',
          background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.9), transparent)',
          animation: 'glowPulse 2s ease-in-out infinite',
        }} />
      )}
    </div>
  );
}

export function CharacterScene() {
  const characters = useAgentStore((s) => s.characters);
  const activeCharacter = useAgentStore((s) => s.activeCharacter);
  const setActiveCharacter = useAgentStore((s) => s.setActiveCharacter);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      position: 'relative',
      pointerEvents: 'none',
    }}>
      {/* 캐릭터들 - 하반신이 글래스바 안에 걸침 */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        position: 'relative',
        zIndex: 2,
        bottom: '-85px',
        width: '92%',
        margin: '0 auto',
        pointerEvents: 'auto',
      }}>
        {characters.map((char, i) => (
          <CharacterCard
            key={char.id}
            characterId={char.id}
            isActive={activeCharacter.id === char.id}
            onClick={() => setActiveCharacter(char)}
            delay={i * 0.3}
          />
        ))}
      </div>

      {/* 하단 글래스바 */}
      <div style={{
        position: 'absolute',
        bottom: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '92%',
        height: '100px',
        borderRadius: '28px',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.04))',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        border: '1px solid rgba(255,255,255,0.15)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.15)',
        zIndex: 1,
      }} />
    </div>
  );
}
