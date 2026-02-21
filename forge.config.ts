import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: 'OpenPersona',
    executableName: 'OpenPersona',
    appBundleId: 'com.openpersona.app',
    appCategoryType: 'public.app-category.productivity',
    icon: './assets/icons/taeinn-bot',
    extraResource: [
      './assets/knowledge',
      './assets/icons',
    ],
  },
  makers: [
    new MakerZIP({}, ['darwin']),
    new MakerDMG({
      format: 'ULFO',
      name: 'OpenPersona',
      icon: './assets/icons/taeinn-bot.icns',
      overwrite: true,
      contents: (opts) => [
        { x: 130, y: 220, type: 'file', path: opts.appPath },
        { x: 410, y: 220, type: 'link', path: '/Applications' },
      ],
    }),
  ],
  plugins: [
    new WebpackPlugin({
      mainConfig,
      port: 9123,
      loggerPort: 9124,
      devContentSecurityPolicy: "default-src 'self' 'unsafe-inline' 'unsafe-eval' data:; connect-src 'self' https: ws: wss:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:;",
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: './src/renderer/index.html',
            js: './src/renderer/index.tsx',
            name: 'main_window',
            preload: {
              js: './src/preload/preload.ts',
            },
          },
        ],
      },
    }),
  ],
};

export default config;
