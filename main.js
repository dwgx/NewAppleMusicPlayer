const { app, BrowserWindow, screen, ipcMain, globalShortcut } = require('electron');
const path = require('path');

let win;

function createWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth } = primaryDisplay.workAreaSize;

    // 动态计算窗口宽度为屏幕宽度的固定比例（例如50%）
    const windowWidth = Math.floor(screenWidth * 0.5); // 50%屏幕宽度，可调整
    const windowHeight = 120; // 固定高度
    const x = Math.floor((screenWidth - windowWidth) / 2); // 水平居中
    const y = 10; // 固定距离顶部10px

    win = new BrowserWindow({
        width: windowWidth,
        height: windowHeight,
        x: x,
        y: y,
        frame: false,
        transparent: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        movable: true
    });

    win.loadFile('electron-notch.html');
    win.setAlwaysOnTop(true, 'screen-saver');
    // win.webContents.openDevTools();
}

function updateWindowPosition() {
    if (!win) return;

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth } = primaryDisplay.workAreaSize;
    const windowWidth = Math.floor(screenWidth * 0.5); // 保持50%宽度
    const x = Math.floor((screenWidth - windowWidth) / 2); // 重新计算居中位置
    const y = 10; // 固定顶部位置

    win.setSize(windowWidth, 120); // 更新宽度，高度不变
    win.setPosition(x, y); // 更新位置
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    // 监听屏幕分辨率变化，动态调整窗口位置
    screen.on('display-metrics-changed', () => {
        updateWindowPosition();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

let dragging = false;
let offsetX, offsetY;

ipcMain.on('start-drag', (event, { x, y }) => {
    const [winX, winY] = win.getPosition();
    offsetX = x - winX;
    offsetY = y - winY;
    dragging = true;
});

app.on('browser-window-blur', () => {
    dragging = false;
});

ipcMain.on('open-settings', () => {
    const settingsWin = new BrowserWindow({
        width: 400,
        height: 300,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    settingsWin.loadFile('settings.html');
});

app.on('ready', () => {
    app.on('browser-window-created', (e, window) => {
        window.webContents.on('did-finish-load', () => {
            window.webContents.send('init-drag');
        });
    });

    // 处理窗口拖动
    const moveWindow = (e) => {
        if (dragging && win) {
            win.setPosition(e.screenX - offsetX, e.screenY - offsetY);
        }
    };

    const stopDragging = () => {
        dragging = false;
    };

    // 移除不必要的重复监听器
    screen.on('display-metrics-changed', () => {
        updateWindowPosition();
    });

    app.on('will-quit', () => {
        screen.removeAllListeners();
    });

    globalShortcut.register('CommandOrControl+Q', () => app.quit());

    app.on('mousemove', moveWindow);
    app.on('mouseup', stopDragging);
});