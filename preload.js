const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("notchBridge", {
    setMouseEventsIgnore(ignore) {
        ipcRenderer.send("toggle-mouse-events", Boolean(ignore));
    },
});
