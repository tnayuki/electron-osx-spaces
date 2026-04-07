# electron-osx-spaces

Save and restore Electron window positions across macOS Spaces (virtual desktops).

## Why?

Electron does not participate in macOS State Restoration, so windows always open on the current Space. This package captures AppKit's native restoration data and replays it on the next launch, putting windows back on the Space where they were saved.

## Install

```bash
npm install electron-osx-spaces
```

Requires Xcode Command Line Tools for the native addon build.

## Usage

```js
const { app, BrowserWindow } = require('electron');
const spaces = require('electron-osx-spaces');

let win;

app.whenReady().then(() => {
  win = new BrowserWindow({ width: 800, height: 600 });

  // Restore from previously saved data
  const saved = loadState(); // your persistence layer
  if (saved) {
    spaces.restoreState(win, saved, { restoreSpace: true });
  }
});

app.on('before-quit', () => {
  // Save the window's Space + frame state
  const data = spaces.encodeState(win);
  if (data) {
    saveState(data); // store as Buffer or base64
  }
});
```

## API

### `spaces.encodeState(win: BrowserWindow): Buffer | null`

Encodes the window's current frame and Space information into an opaque Buffer. Returns `null` on non-macOS platforms or if encoding fails.

### `spaces.restoreState(win: BrowserWindow, data: Buffer, options?: RestoreOptions): boolean`

Restores the window's frame and Space from a previously encoded Buffer. Returns `true` if restoration succeeded.

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `restoreSpace` | `boolean` | `true` | Whether to restore the Space (virtual desktop) |

## How it works

1. `encodeState` calls `NSWindow.encodeRestorableStateWithCoder:` to capture AppKit's native restoration data (frame + Space info) as a binary archive
2. Your app persists the binary (e.g. as base64 in a JSON file)
3. On next launch, `restoreState` calls `NSWindow.restoreStateWithCoder:` to replay the data, and macOS moves the window to the original Space

An `NSKeyedArchiverDelegate` is used to skip objects that don't support `NSSecureCoding` (such as Electron's internal NSView subclasses).

On macOS 15+, a workaround for broken `NSWindowRestoresWorkspaceAtLaunch` is applied via a private API override. This makes the package **incompatible with Mac App Store** distribution.

## Platform support

- **macOS**: Full functionality
- **Other platforms**: No-op (functions return `null` / `false`)

## License

MIT
