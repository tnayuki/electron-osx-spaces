if (process.platform !== 'darwin') {
  module.exports = {
    encodeState() {
      return null;
    },
    restoreState() {
      return false;
    },
  };
} else {
  const native = require('./build/Release/spaces.node');

  module.exports = {
    /**
     * Encode the current window state including Space (virtual desktop) info.
     * Returns a Buffer containing the opaque AppKit restoration data,
     * or null if encoding fails.
     *
     * @param {BrowserWindow} win - Electron BrowserWindow instance
     * @returns {Buffer|null}
     */
    encodeState(win) {
      try {
        return native.encodeState(win.getNativeWindowHandle());
      } catch {
        return null;
      }
    },

    /**
     * Restore the window's state (frame + Space) from previously encoded data.
     *
     * @param {BrowserWindow} win - Electron BrowserWindow instance
     * @param {Buffer} data - Data previously returned by encodeState()
     * @param {object} [options]
     * @param {boolean} [options.restoreSpace=true] - Whether to restore the Space
     * @returns {boolean} true if restoration succeeded
     */
    restoreState(win, data, options) {
      if (!data) return false;
      try {
        native.restoreState(win.getNativeWindowHandle(), data, options);
        return true;
      } catch {
        return false;
      }
    },
  };
}
