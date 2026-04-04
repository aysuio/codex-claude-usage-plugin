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

  const now = Date.now();

  // If reset time has passed, usage is 0% and roll forward to next reset
  const resolve = (limit) => {
    const pct = limit?.used_percent ?? 0;
    if (!limit?.resets_at) return { pct, resetsAt: null };

    const resetMs = limit.resets_at * 1000;
    if (resetMs >= now) {
      return { pct, resetsAt: new Date(resetMs).toISOString() };
    }

    // Stale: roll forward by window_minutes to find next reset
    const windowMs = (limit.window_minutes || 300) * 60 * 1000;
    let next = resetMs;
    while (next < now) next += windowMs;
    return { pct: 0, resetsAt: new Date(next).toISOString() };
  };

  const pri = resolve(rateLimits.primary);
  const sec = resolve(rateLimits.secondary);

  return {
    primary: { pct: pri.pct, resetsAt: pri.resetsAt },
    secondary: { pct: sec.pct, resetsAt: sec.resetsAt },
    planType: rateLimits.plan_type ?? 'unknown',
  };
}

module.exports = { parseCodexUsage };
