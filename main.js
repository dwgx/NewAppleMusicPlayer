const { app, BrowserWindow, screen, ipcMain, globalShortcut } = require('electron');
const path = require('path');

let win;

function createWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth } = primaryDisplay.workAreaSize;

    const windowWidth = Math.floor(screenWidth * 0.5);
    const windowHeight = 120;
    const x = Math.floor((screenWidth - windowWidth) / 2);
    const y = 10;

    win = new BrowserWindow({
        width: windowWidth,
        height: windowHeight,
        x,
        y,
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
    win.setIgnoreMouseEvents(true, { forward: true });
    // 移除开发者工具注释，避免不必要的开销
}

function updateWindowPosition() {
    if (!win) return;
    const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
    const windowWidth = Math.floor(screenWidth * 0.5);
    win.setSize(windowWidth, 120);
    win.setPosition(Math.floor((screenWidth - windowWidth) / 2), 10);
}

app.whenReady().then(() => {
    createWindow();

    // 延迟绑定事件提升启动速度
    process.nextTick(() => {
        ipcMain.on('toggle-mouse-events', (event, ignore) => {
            win?.setIgnoreMouseEvents(ignore, { forward: true });
        });

        ipcMain.on('start-drag', (event, { x, y }) => {
            const [winX, winY] = win.getPosition();
            offsetX = x - winX;
            offsetY = y - winY;
            dragging = true;
            win.setIgnoreMouseEvents(false);
        });

        screen.on('display-metrics-changed', updateWindowPosition);
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

let dragging = false;
let offsetX, offsetY;

app.on('ready', () => {
    const moveWindow = (e) => {
        if (dragging && win) {
            win.setPosition(e.screenX - offsetX, e.screenY - offsetY);
        }
    };

    const stopDragging = () => {
        dragging = false;
        win?.setIgnoreMouseEvents(true, { forward: true });
    };

    app.on('mousemove', moveWindow);
    app.on('mouseup', stopDragging);
    globalShortcut.register('CommandOrControl+Q', () => app.quit());
});