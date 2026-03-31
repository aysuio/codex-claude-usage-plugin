(function () {
  // --- DOM References ---
  const widget = document.getElementById('widget');
  const expandBtn = document.getElementById('expand-btn');
  const collapseBtn = document.getElementById('collapse-btn');
  const closeBtn = document.getElementById('close-btn');
  const refreshBtn = document.getElementById('refresh-btn');
  const updateTimeEl = document.getElementById('update-time');

  // Claude elements
  const claudeMinBar = document.getElementById('claude-mini-bar');
  const claudeMinPct = document.getElementById('claude-mini-pct');
  const claude5hBar = document.getElementById('claude-5h-bar');
  const claude5hPct = document.getElementById('claude-5h-pct');
  const claude5hReset = document.getElementById('claude-5h-reset');
  const claude7dBar = document.getElementById('claude-7d-bar');
  const claude7dPct = document.getElementById('claude-7d-pct');
  const claude7dReset = document.getElementById('claude-7d-reset');
  const claudeSubModels = document.getElementById('claude-sub-models');
  const claudeError = document.getElementById('claude-error');

  // Codex elements
  const codexMinBar = document.getElementById('codex-mini-bar');
  const codexMinPct = document.getElementById('codex-mini-pct');
  const codex5hBar = document.getElementById('codex-5h-bar');
  const codex5hPct = document.getElementById('codex-5h-pct');
  const codex5hReset = document.getElementById('codex-5h-reset');
  const codex7dBar = document.getElementById('codex-7d-bar');
  const codex7dPct = document.getElementById('codex-7d-pct');
  const codex7dReset = document.getElementById('codex-7d-reset');
  const codexError = document.getElementById('codex-error');

  // --- Helpers ---
  function getBarClass(pct) {
    if (pct == null) return 'gray';
    if (pct < 50) return 'green';
    if (pct < 80) return 'yellow';
    return 'red';
  }

  function setBar(barEl, pctEl, pct) {
    if (pct == null) {
      barEl.style.width = '0%';
      barEl.className = 'progress-fill gray';
      if (pctEl) pctEl.textContent = '--%';
      return;
    }
    barEl.style.width = Math.min(pct, 100) + '%';
    barEl.className = 'progress-fill ' + getBarClass(pct);
    if (pctEl) pctEl.textContent = Math.round(pct) + '%';
  }

  function formatResetTime(resetsAt) {
    if (!resetsAt) return '';
    const resetDate = new Date(resetsAt);

    const now = new Date();
    const diffMs = resetDate - now;

    const absTime = resetDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

    if (diffMs <= 0) return '已重置';

    const hours = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    let relative;
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      relative = days + 'd ' + (hours % 24) + 'h';
    } else if (hours > 0) {
      relative = hours + 'h ' + mins + 'm';
    } else {
      relative = mins + 'm';
    }

    return '重置于 ' + absTime + ' (' + relative + ')';
  }

  function formatUpdateTime(timestamp) {
    if (!timestamp) return '加载中...';
    const d = new Date(timestamp);
    return '更新于 ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }

  // --- Set loading state ---
  function setLoading() {
    [claudeMinBar, codexMinBar, claude5hBar, claude7dBar, codex5hBar, codex7dBar].forEach((bar) => {
      bar.className = 'progress-fill loading';
      bar.style.width = '100%';
    });
  }

  // --- Render usage data ---
  function renderData(data) {
    // Claude
    if (data.claude) {
      claudeError.classList.remove('visible');

      const fh = data.claude.fiveHour;
      setBar(claudeMinBar, claudeMinPct, fh?.pct);
      setBar(claude5hBar, claude5hPct, fh?.pct);
      claude5hReset.textContent = formatResetTime(fh?.resetsAt);

      const sd = data.claude.sevenDay;
      setBar(claude7dBar, claude7dPct, sd?.pct);
      claude7dReset.textContent = formatResetTime(sd?.resetsAt);

      // Sub-model info
      const parts = [];
      if (data.claude.opus) parts.push('Opus: ' + Math.round(data.claude.opus.pct) + '%');
      if (data.claude.sonnet) parts.push('Sonnet: ' + Math.round(data.claude.sonnet.pct) + '%');
      claudeSubModels.textContent = parts.join('  ');
    }

    // Codex
    if (data.codex) {
      codexError.classList.remove('visible');

      const pri = data.codex.primary;
      setBar(codexMinBar, codexMinPct, pri?.pct);
      setBar(codex5hBar, codex5hPct, pri?.pct);
      codex5hReset.textContent = formatResetTime(pri?.resetsAt);

      const sec = data.codex.secondary;
      setBar(codex7dBar, codex7dPct, sec?.pct);
      codex7dReset.textContent = formatResetTime(sec?.resetsAt);
    }

    updateTimeEl.textContent = formatUpdateTime(data.updatedAt);
  }

  // --- Render error ---
  function renderError(err) {
    const errorMessages = {
      AUTH_EXPIRED: '请运行 claude auth login',
      NETWORK_ERROR: '网络连接失败',
      RATE_LIMITED: '请求过于频繁',
      TIMEOUT: '请求超时',
      PARSE_ERROR: '凭证读取失败',
      NO_CREDENTIALS: '未登录 Claude Code',
      CODEX_NOT_INSTALLED: 'Codex 未安装',
      CODEX_NO_DATA: '无用量数据',
    };

    if (err.source === 'claude') {
      claudeError.textContent = errorMessages[err.message] || err.message;
      claudeError.classList.add('visible');
    } else if (err.source === 'codex') {
      codexError.textContent = errorMessages[err.message] || err.message;
      codexError.classList.add('visible');
    }

    if (err.updatedAt) {
      updateTimeEl.textContent = '离线 · ' + formatUpdateTime(err.updatedAt);
    }
  }

  // --- Mode switching ---
  expandBtn.addEventListener('click', () => {
    widget.classList.remove('mini');
    widget.classList.add('card');
    window.api.toggleMode();
  });

  collapseBtn.addEventListener('click', () => {
    widget.classList.remove('card');
    widget.classList.add('mini');
    window.api.toggleMode();
  });

  closeBtn.addEventListener('click', () => {
    window.api.hide();
  });

  refreshBtn.addEventListener('click', () => {
    window.api.refresh();
  });

  // --- IPC listeners ---
  window.api.onUsageData(renderData);
  window.api.onFetchError(renderError);

  // Start in loading state
  setLoading();
})();
