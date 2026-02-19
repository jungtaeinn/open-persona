/**
 * 에이전트 초기화 훅.
 * 앱 시작 시 사용 가능한 LLM 모델 목록을 가져오고,
 * 트레이 메뉴에서 보내는 chat:toggle / panel:open 이벤트를 수신한다.
 */
import { useEffect } from 'react';
import { useAgentStore } from '../stores/agent-store';
import type { PanelType } from '../stores/agent-store';
import type { ModelInfo } from '../../shared/types';

export function useAgentInit() {
  const setModels = useAgentStore((s) => s.setModels);
  const setChatOpen = useAgentStore((s) => s.setChatOpen);
  const setActivePanel = useAgentStore((s) => s.setActivePanel);

  useEffect(() => {
    let isMounted = true;

    async function loadModels() {
      try {
        const models = (await window.electronAPI.invoke('model:list')) as ModelInfo[];
        if (isMounted) setModels(models);
      } catch {
        // API 키 미설정 시 빈 배열로 유지
      }
    }

    void loadModels();

    const unsubToggle = window.electronAPI.on(
      'chat:toggle',
      (data: unknown) => {
        const { open } = data as { open: boolean };
        if (isMounted) setChatOpen(open);
      },
    );

    const unsubPanel = window.electronAPI.on(
      'panel:open',
      (data: unknown) => {
        const { panel } = data as { panel: PanelType };
        if (isMounted) setActivePanel(panel);
      },
    );

    return () => {
      isMounted = false;
      unsubToggle();
      unsubPanel();
    };
  }, [setModels, setChatOpen, setActivePanel]);
}
