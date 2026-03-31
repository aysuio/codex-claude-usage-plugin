const fs = require('fs');
const path = require('path');

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const BETA_HEADER = 'oauth-2025-04-20';

function readCredentials(homeDir) {
  try {
    const credPath = path.join(homeDir, '.claude', '.credentials.json');
    const raw = fs.readFileSync(credPath, 'utf-8');
    const parsed = JSON.parse(raw);

    // Try claudeAiOauth.accessToken first, then top-level accessToken
    const token =
      parsed?.claudeAiOauth?.accessToken ||
      parsed?.accessToken ||
      null;
    return token || null;
  } catch {
    return null;
  }
}

function parseClaudeUsage(raw) {
  const result = {
    fiveHour: null,
    sevenDay: null,
    opus: null,
    sonnet: null,
    extraUsage: null,
  };

  if (raw.five_hour) {
    result.fiveHour = { pct: raw.five_hour.utilization, resetsAt: raw.five_hour.resets_at };
  }
  if (raw.seven_day) {
    result.sevenDay = { pct: raw.seven_day.utilization, resetsAt: raw.seven_day.resets_at };
  }
  if (raw.seven_day_opus) {
    result.opus = { pct: raw.seven_day_opus.utilization, resetsAt: raw.seven_day_opus.resets_at };
  }
  if (raw.seven_day_sonnet) {
    result.sonnet = { pct: raw.seven_day_sonnet.utilization, resetsAt: raw.seven_day_sonnet.resets_at };
  }
  if (raw.extra_usage && raw.extra_usage.is_enabled) {
    result.extraUsage = { pct: raw.extra_usage.utilization, limit: raw.extra_usage.monthly_limit, used: raw.extra_usage.used_credits };
  }

  return result;
}

function fetchClaudeUsage(accessToken) {
  // Use Electron's net module if available (handles system proxy correctly),
  // fall back to Node https for testing
  let netModule;
  try {
    netModule = require('electron').net;
  } catch {
    netModule = null;
  }

  if (netModule) {
    return fetchWithElectronNet(netModule, accessToken);
  }
  return fetchWithNodeHttps(accessToken);
}

function fetchWithElectronNet(net, accessToken) {
  return new Promise((resolve, reject) => {
    const req = net.request({
      url: USAGE_URL,
      method: 'GET',
    });

    req.setHeader('Authorization', `Bearer ${accessToken}`);
    req.setHeader('anthropic-beta', BETA_HEADER);

    let body = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      req.abort();
      reject(new Error('TIMEOUT'));
    }, 30000);

    req.on('response', (res) => {
      res.on('data', (chunk) => { body += chunk.toString(); });
      res.on('end', () => {
        clearTimeout(timer);
        if (timedOut) return;

        if (res.statusCode === 429) {
          reject(new Error('RATE_LIMITED'));
          return;
        }
        if (res.statusCode === 401 || res.statusCode === 403) {
          reject(new Error('AUTH_EXPIRED'));
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP_${res.statusCode}`));
          return;
        }
        try {
          const data = JSON.parse(body);
          resolve(parseClaudeUsage(data));
        } catch {
          reject(new Error('PARSE_ERROR'));
        }
      });
    });

    req.on('error', (err) => {
      clearTimeout(timer);
      if (!timedOut) reject(new Error(`NETWORK_ERROR: ${err.message}`));
    });

    req.end();
  });
}

function fetchWithNodeHttps(accessToken) {
  const https = require('https');
  return new Promise((resolve, reject) => {
    const url = new URL(USAGE_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'anthropic-beta': BETA_HEADER,
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode === 429) {
          reject(new Error('RATE_LIMITED'));
          return;
        }
        if (res.statusCode === 401 || res.statusCode === 403) {
          reject(new Error('AUTH_EXPIRED'));
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP_${res.statusCode}`));
          return;
        }
        try {
          const data = JSON.parse(body);
          resolve(parseClaudeUsage(data));
        } catch {
          reject(new Error('PARSE_ERROR'));
        }
      });
    });

    req.on('error', (err) => reject(new Error(`NETWORK_ERROR: ${err.message}`)));
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('TIMEOUT')); });
    req.end();
  });
}

module.exports = { readCredentials, parseClaudeUsage, fetchClaudeUsage };
