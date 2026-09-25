// DJ Nexus Deck Lab for Windows, macOS and Linux: the Deck Lab page and the
// WebAssembly engine in an Electron window. Files are served from an app://
// scheme (a secure context, so AudioWorklet, Workers and fetch() of the
// .wasm work), and Web MIDI is allowed, including SysEx for controller
// keep-alives (the DDJ-FLX4 needs them).
const { app, BrowserWindow, protocol, session, shell, net } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
]);

// Audio starts from the page's Start button, but let it play without a second gesture.
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

const root = path.join(__dirname, "decklab");
const allowed = new Set(["midi", "midiSysex", "media"]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 380,
    minHeight: 500,
    backgroundColor: "#07060D",
    title: "DJ Nexus Deck Lab",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true }
  });
  win.loadURL("app://decklab/index.html");
  // Links to other sites open in the normal browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith("app://")) {
      e.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });
}

app.whenReady().then(() => {
  protocol.handle("app", (request) => {
    const { pathname } = new URL(request.url);
    const file = path.normalize(path.join(root, decodeURIComponent(pathname)));
    if (!file.startsWith(root)) return new Response("not found", { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => callback(allowed.has(permission)));
  session.defaultSession.setPermissionCheckHandler((wc, permission) => allowed.has(permission));
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
