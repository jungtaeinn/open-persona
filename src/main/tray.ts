/**
 * 시스템 트레이 아이콘 및 컨텍스트 메뉴.
 */
import { Tray, Menu, nativeImage, app, BrowserWindow } from 'electron';
import path from 'path';

let tray: Tray | null = null;

/**
 * 시스템 트레이를 생성하고 컨텍스트 메뉴를 설정한다.
 * @param mainWindow - 토글할 메인 BrowserWindow
 */
export function createTray(mainWindow: BrowserWindow): void {
  const iconPath = path.join(app.getAppPath(), 'assets', 'icons', 'taeinn-tray.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 22, height: 22 });

  tray = new Tray(icon);
  tray.setToolTip('OpenPersona');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '채팅 열기',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('chat:toggle', { open: true });
      },
    },
    {
      label: '토큰 사용량',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('panel:open', { panel: 'token' });
      },
    },
    {
      label: '시스템 모니터',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('panel:open', { panel: 'system' });
      },
    },
    { type: 'separator' },
    {
      label: '캐릭터 숨기기',
      click: () => mainWindow.hide(),
    },
    { type: 'separator' },
    {
      label: '로그인 시 자동 시작',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (menuItem) => {
        app.setLoginItemSettings({ openAtLogin: menuItem.checked });
      },
    },
    { type: 'separator' },
    {
      label: '종료',
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
}
