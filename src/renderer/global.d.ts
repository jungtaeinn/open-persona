import type { ElectronAPI } from '../preload/preload';

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.webp' {
  const src: string;
  export default src;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
