import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// We test Store by pointing it at a temp directory
const tmpDir = path.join(os.tmpdir(), 'usage-widget-test-' + Date.now());
const configPath = path.join(tmpDir, 'config.json');

// Mock app.getPath to return our temp dir
const mockGetPath = () => tmpDir;

describe('Store', () => {
  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns defaults when no config file exists', async () => {
    const { createStore } = await import('../src/main/store.js');
    const store = createStore(tmpDir);
    expect(store.get('mode')).toBe('mini');
    expect(store.get('pollInterval')).toBe(300000);
    expect(store.get('launchAtStartup')).toBe(false);
    expect(store.get('windowPosition')).toEqual({ x: 100, y: 100 });
  });

  it('persists and reads back values', async () => {
    const { createStore } = await import('../src/main/store.js');
    const store = createStore(tmpDir);
    store.set('mode', 'card');
    store.set('windowPosition', { x: 200, y: 300 });

    // Read from disk with a fresh instance
    const store2 = createStore(tmpDir);
    expect(store2.get('mode')).toBe('card');
    expect(store2.get('windowPosition')).toEqual({ x: 200, y: 300 });
  });

  it('handles corrupted config file gracefully', async () => {
    fs.writeFileSync(configPath, '{invalid json!!!');
    const { createStore } = await import('../src/main/store.js');
    const store = createStore(tmpDir);
    expect(store.get('mode')).toBe('mini');
  });
});
