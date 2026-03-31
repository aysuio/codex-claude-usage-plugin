import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('claude-api', () => {
  describe('readCredentials', () => {
    it('reads accessToken from credentials file', async () => {
      const tmpDir = path.join(os.tmpdir(), 'claude-api-test-' + Date.now());
      const claudeDir = path.join(tmpDir, '.claude');
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(
        path.join(claudeDir, '.credentials.json'),
        JSON.stringify({
          claudeAiOauth: {
            accessToken: 'test-token-123',
            expiresAt: '2099-01-01T00:00:00Z',
          },
        })
      );

      const { readCredentials } = await import('../src/main/claude-api.js');
      const token = readCredentials(tmpDir);
      expect(token).toBe('test-token-123');

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('returns null when credentials file is missing', async () => {
      const { readCredentials } = await import('../src/main/claude-api.js');
      const token = readCredentials('/nonexistent/path');
      expect(token).toBeNull();
    });

    it('returns null when credentials file is malformed', async () => {
      const tmpDir = path.join(os.tmpdir(), 'claude-api-test2-' + Date.now());
      const claudeDir = path.join(tmpDir, '.claude');
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, '.credentials.json'), 'not json');

      const { readCredentials } = await import('../src/main/claude-api.js');
      const token = readCredentials(tmpDir);
      expect(token).toBeNull();

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  describe('parseClaudeUsage', () => {
    it('extracts five_hour and seven_day from API response', async () => {
      const { parseClaudeUsage } = await import('../src/main/claude-api.js');
      const raw = {
        five_hour: { utilization: 72.0, resets_at: '2026-03-31T14:30:00.000000+00:00' },
        seven_day: { utilization: 38.0, resets_at: '2026-04-04T00:00:00.000000+00:00' },
        seven_day_opus: null,
        seven_day_sonnet: { utilization: 1.0, resets_at: '2026-04-05T00:00:00.000000+00:00' },
        extra_usage: { is_enabled: false, monthly_limit: null, used_credits: null, utilization: null },
      };
      const result = parseClaudeUsage(raw);

      expect(result.fiveHour.pct).toBe(72.0);
      expect(result.fiveHour.resetsAt).toBe('2026-03-31T14:30:00.000000+00:00');
      expect(result.sevenDay.pct).toBe(38.0);
      expect(result.opus).toBeNull();
      expect(result.sonnet.pct).toBe(1.0);
      expect(result.extraUsage).toBeNull();
    });

    it('includes extra_usage when enabled', async () => {
      const { parseClaudeUsage } = await import('../src/main/claude-api.js');
      const raw = {
        five_hour: { utilization: 10.0, resets_at: '2026-03-31T14:30:00Z' },
        seven_day: { utilization: 5.0, resets_at: '2026-04-04T00:00:00Z' },
        seven_day_opus: null,
        seven_day_sonnet: null,
        extra_usage: { is_enabled: true, monthly_limit: 100, used_credits: 25, utilization: 25.0 },
      };
      const result = parseClaudeUsage(raw);
      expect(result.extraUsage.pct).toBe(25.0);
    });
  });
});
