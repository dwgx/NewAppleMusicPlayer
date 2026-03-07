const { app, BrowserWindow, screen, ipcMain, globalShortcut } = require("electron");
const path = require("path");

let win = null;
let ipcInitialized = false;

function computeWindowBounds() {
    const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
    const width = Math.floor(screenWidth * 0.5);
    const height = 120;
    const x = Math.floor((screenWidth - width) / 2);
    const y = 10;
    return { width, height, x, y };
}

function createWindow() {
    const bounds = computeWindowBounds();
    win = new BrowserWindow({
        ...bounds,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        movable: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
        },
    });

    win.loadFile("electron-notch.html");
    win.setAlwaysOnTop(true, "screen-saver");
    win.setIgnoreMouseEvents(true, { forward: true });
    win.on("closed", () => {
        win = null;
    });
}

function updateWindowPosition() {
    if (!win || win.isDestroyed()) {
        return;
    }
    const bounds = computeWindowBounds();
    win.setSize(bounds.width, bounds.height);
    win.setPosition(bounds.x, bounds.y);
}

function registerIpcHandlers() {
    if (ipcInitialized) {
        return;
    }
    ipcMain.on("toggle-mouse-events", (_event, ignore) => {
        if (!win || win.isDestroyed()) {
            return;
        }
        win.setIgnoreMouseEvents(Boolean(ignore), { forward: true });
    });
    ipcInitialized = true;
}

function registerShortcuts() {
    const ok = globalShortcut.register("CommandOrControl+Q", () => app.quit());
    if (!ok) {
        console.warn("globalShortcut register failed: CommandOrControl+Q");
    }
}

app.whenReady().then(() => {
    registerIpcHandlers();
    createWindow();
    registerShortcuts();
    screen.on("display-metrics-changed", updateWindowPosition);

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("will-quit", () => {
    globalShortcut.unregisterAll();
    screen.removeListener("display-metrics-changed", updateWindowPosition);
});
