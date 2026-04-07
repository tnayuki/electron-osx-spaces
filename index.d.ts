import { BrowserWindow } from 'electron';

export interface RestoreOptions {
  /** Whether to restore the Space (virtual desktop). Defaults to true. */
  restoreSpace?: boolean;
}

/**
 * Encode the current window state including Space (virtual desktop) info.
 * Returns a Buffer containing the opaque AppKit restoration data,
 * or null on non-macOS platforms or if encoding fails.
 */
export function encodeState(win: BrowserWindow): Buffer | null;

/**
 * Restore the window's state (frame + Space) from previously encoded data.
 * Returns true if restoration succeeded, false otherwise.
 * No-op on non-macOS platforms.
 */
export function restoreState(
  win: BrowserWindow,
  data: Buffer,
  options?: RestoreOptions,
): boolean;
