const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');

function createTrayManager({ win, onRefresh, store }) {
  const iconPath = path.join(__dirname, '..', '..', 'assets', 'icon.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  const tray = new Tray(icon);

  function buildMenu() {
    const isLaunchAtStartup = store.get('launchAtStartup');

    return Menu.buildFromTemplate([
      {
        label: win.isVisible() ? '隐藏悬浮窗' : '显示悬浮窗',
        click: () => {
          if (win.isVisible()) {
            win.hide();
          } else {
            win.show();
          }
        },
      },
      {
        label: '立即刷新',
        click: () => onRefresh(),
      },
      { type: 'separator' },
      {
        label: '开机自启',
        type: 'checkbox',
        checked: isLaunchAtStartup,
        click: (menuItem) => {
          store.set('launchAtStartup', menuItem.checked);
          app.setLoginItemSettings({
            openAtLogin: menuItem.checked,
          });
        },
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          app.isQuitting = true;
          app.quit();
        },
      },
    ]);
  }

  tray.setToolTip('Usage Widget');
  tray.setContextMenu(buildMenu());

  // Rebuild menu on show/hide to update label
  win.on('show', () => tray.setContextMenu(buildMenu()));
  win.on('hide', () => tray.setContextMenu(buildMenu()));

  tray.on('double-click', () => {
    if (win.isVisible()) {
      win.hide();
    } else {
      win.show();
    }
  });

  return tray;
}

module.exports = { createTrayManager };
