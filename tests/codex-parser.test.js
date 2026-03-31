import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('codex-parser', () => {
  const tmpDir = path.join(os.tmpdir(), 'codex-parser-test-' + Date.now());
  const sessionsDir = path.join(tmpDir, '.codex', 'sessions', '2026', '03', '28');

  beforeEach(() => {
    fs.mkdirSync(sessionsDir, { recursive: true });
    // Copy fixture
    const fixture = fs.readFileSync(
      path.join(__dirname, 'fixtures', 'codex-session.jsonl'),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(sessionsDir, 'rollout-2026-03-28T10-12-51-test-uuid.jsonl'),
      fixture
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('extracts the last token_count rate_limits from the latest session', async () => {
    const { parseCodexUsage } = await import('../src/main/codex-parser.js');
    const result = parseCodexUsage(tmpDir);

    expect(result).not.toBeNull();
    expect(result.primary.pct).toBe(7.0);
    expect(result.primary.resetsAt).toBe(new Date(1774677676 * 1000).toISOString());
    expect(result.secondary.pct).toBe(5.0);
    expect(result.secondary.resetsAt).toBe(new Date(1775181552 * 1000).toISOString());
    expect(result.planType).toBe('pro');
  });

  it('returns null when sessions directory does not exist', async () => {
    const { parseCodexUsage } = await import('../src/main/codex-parser.js');
    const result = parseCodexUsage('/nonexistent/path');
    expect(result).toBeNull();
  });

  it('handles corrupt lines gracefully', async () => {
    // Append a corrupt line
    const sessionFile = path.join(sessionsDir, 'rollout-2026-03-28T10-12-51-test-uuid.jsonl');
    fs.appendFileSync(sessionFile, '\n{corrupt line!!!}\n');

    const { parseCodexUsage } = await import('../src/main/codex-parser.js');
    const result = parseCodexUsage(tmpDir);
    expect(result).not.toBeNull();
    expect(result.primary.pct).toBe(7.0);
  });

  it('returns null when no token_count events exist', async () => {
    const noTokenFile = path.join(sessionsDir, 'rollout-2026-03-28T11-00-00-no-tokens.jsonl');
    // Remove the fixture file, add one without token_count
    fs.rmSync(path.join(sessionsDir, 'rollout-2026-03-28T10-12-51-test-uuid.jsonl'));
    fs.writeFileSync(noTokenFile, '{"type":"session_meta","payload":{"id":"x"}}\n');

    const { parseCodexUsage } = await import('../src/main/codex-parser.js');
    const result = parseCodexUsage(tmpDir);
    expect(result).toBeNull();
  });
});
