const fs = require('fs');
const path = require('path');

function findLatestSessionFile(homeDir) {
  const sessionsRoot = path.join(homeDir, '.codex', 'sessions');
  if (!fs.existsSync(sessionsRoot)) return null;

  // Walk year/month/day directories to find the latest day
  const years = readdirSorted(sessionsRoot).reverse();
  for (const year of years) {
    const yearPath = path.join(sessionsRoot, year);
    const months = readdirSorted(yearPath).reverse();
    for (const month of months) {
      const monthPath = path.join(yearPath, month);
      const days = readdirSorted(monthPath).reverse();
      for (const day of days) {
        const dayPath = path.join(monthPath, day);
        const files = readdirSorted(dayPath)
          .filter((f) => f.endsWith('.jsonl'))
          .reverse();
        if (files.length > 0) {
          return path.join(dayPath, files[0]);
        }
      }
    }
  }
  return null;
}

function readdirSorted(dir) {
  try {
    return fs.readdirSync(dir).sort();
  } catch {
    return [];
  }
}

function extractLastRateLimits(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }

  const lines = content.split('\n').filter((l) => l.trim());
  let lastRateLimits = null;

  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (
        obj.type === 'event_msg' &&
        obj.payload?.type === 'token_count' &&
        obj.payload?.rate_limits
      ) {
        lastRateLimits = obj.payload.rate_limits;
      }
    } catch {
      // Skip corrupt lines
    }
  }

  return lastRateLimits;
}

function parseCodexUsage(homeDir) {
  const latestFile = findLatestSessionFile(homeDir);
  if (!latestFile) return null;

  const rateLimits = extractLastRateLimits(latestFile);
  if (!rateLimits) return null;

  // Normalize Unix timestamps to ISO strings for consistency with Claude API
  const toISO = (ts) => ts ? new Date(ts * 1000).toISOString() : null;

  return {
    primary: {
      pct: rateLimits.primary?.used_percent ?? 0,
      resetsAt: toISO(rateLimits.primary?.resets_at),
    },
    secondary: {
      pct: rateLimits.secondary?.used_percent ?? 0,
      resetsAt: toISO(rateLimits.secondary?.resets_at),
    },
    planType: rateLimits.plan_type ?? 'unknown',
  };
}

module.exports = { parseCodexUsage };
