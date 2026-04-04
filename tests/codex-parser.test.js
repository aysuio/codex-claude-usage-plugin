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
    expect(result.primary.resetsAt).toBe(new Date(1777000000 * 1000).toISOString());
    expect(result.secondary.pct).toBe(5.0);
    expect(result.secondary.resetsAt).toBe(new Date(1778000000 * 1000).toISOString());
    expect(result.planType).toBe('pro');
  });

  it('returns 0% and rolls forward resetsAt when reset time has passed', async () => {
    const staleFile = path.join(sessionsDir, 'rollout-2026-03-28T20-00-00-stale.jsonl');
    const pastTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
    const line = JSON.stringify({
      type: 'event_msg',
      payload: {
        type: 'token_count',
        info: { total_token_usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 } },
        rate_limits: {
          limit_id: 'codex',
          primary: { used_percent: 42.0, window_minutes: 300, resets_at: pastTimestamp },
          secondary: { used_percent: 18.0, window_minutes: 10080, resets_at: pastTimestamp },
          plan_type: 'pro',
        },
      },
    });
    fs.writeFileSync(staleFile, line + '\n');

    const { parseCodexUsage } = await import('../src/main/codex-parser.js');
    const result = parseCodexUsage(tmpDir);
    expect(result).not.toBeNull();
    expect(result.primary.pct).toBe(0);
    expect(result.secondary.pct).toBe(0);
    // resetsAt should be rolled forward to a future time
    expect(new Date(result.primary.resetsAt).getTime()).toBeGreaterThan(Date.now());
    expect(new Date(result.secondary.resetsAt).getTime()).toBeGreaterThan(Date.now());
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
