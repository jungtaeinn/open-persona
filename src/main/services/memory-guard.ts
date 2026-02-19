/**
 * 메모리 감시 서비스.
 * 주기적으로 RSS 메모리를 비동기로 확인하고,
 * 임계치를 초과하면 사용자에게 알린 뒤 graceful shutdown 을 수행한다.
 */
import { app, Notification } from 'electron';

const MEMORY_LIMIT_MB = 512;
const CHECK_INTERVAL_MS = 30_000;

export class MemoryGuard {
  private timer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  /** 메모리 감시를 시작한다 */
  start(): void {
    this.timer = setInterval(() => {
      void this.check();
    }, CHECK_INTERVAL_MS);
  }

  /** 메모리 감시를 중지한다 */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** 현재 RSS 메모리(MB)를 반환한다 */
  async getCurrentRSS(): Promise<number> {
    const rss = await process.memoryUsage.rss();
    return rss / 1024 / 1024;
  }

  private async check(): Promise<void> {
    if (this.isShuttingDown) return;

    const rssMB = await this.getCurrentRSS();
    if (rssMB > MEMORY_LIMIT_MB) {
      await this.gracefulShutdown(rssMB);
    }
  }

  private async gracefulShutdown(currentMB: number): Promise<void> {
    this.isShuttingDown = true;
    this.stop();

    try {
      new Notification({
        title: 'OpenPersona',
        body: `메모리 ${Math.round(currentMB)}MB 초과 (제한: ${MEMORY_LIMIT_MB}MB). 안전하게 종료합니다.`,
      }).show();
    } catch {
      // 알림 실패 시에도 종료 진행
    }

    // 약간의 딜레이로 알림이 표시될 시간 확보
    await new Promise((r) => setTimeout(r, 1500));
    app.quit();
  }
}
