import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('DataPoller', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls fetcher immediately on start', async () => {
    const { createPoller } = await import('../src/main/data-poller.js');
    const fetcher = vi.fn().mockResolvedValue({ claude: null, codex: null });
    const onData = vi.fn();
    const onError = vi.fn();

    const poller = createPoller({ fetcher, onData, onError, interval: 5000 });
    poller.start();

    // Wait for the immediate async call
    await vi.advanceTimersByTimeAsync(0);

    expect(fetcher).toHaveBeenCalledTimes(1);
    poller.stop();
  });

  it('backs off on RATE_LIMITED error', async () => {
    const { createPoller } = await import('../src/main/data-poller.js');
    const fetcher = vi.fn().mockRejectedValue(new Error('RATE_LIMITED'));
    const onData = vi.fn();
    const onError = vi.fn();

    const poller = createPoller({ fetcher, onData, onError, interval: 5000 });
    poller.start();

    await vi.advanceTimersByTimeAsync(0);
    expect(poller.getCurrentInterval()).toBe(10000); // doubled

    poller.stop();
  });

  it('prevents overlapping fetches with in-flight lock', async () => {
    const { createPoller } = await import('../src/main/data-poller.js');
    let resolveFirst;
    const slowFetcher = vi.fn().mockImplementation(
      () => new Promise((resolve) => { resolveFirst = resolve; })
    );
    const onData = vi.fn();
    const onError = vi.fn();

    const poller = createPoller({ fetcher: slowFetcher, onData, onError, interval: 5000 });
    poller.start();

    // First call starts
    await vi.advanceTimersByTimeAsync(0);
    expect(slowFetcher).toHaveBeenCalledTimes(1);

    // Manual refresh while first is in-flight — should be ignored
    poller.refresh();
    expect(slowFetcher).toHaveBeenCalledTimes(1);

    resolveFirst({ claude: null, codex: null });
    poller.stop();
  });

  it('recovers to normal interval after 3 consecutive successes', async () => {
    const { createPoller } = await import('../src/main/data-poller.js');
    let callCount = 0;
    const fetcher = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.reject(new Error('RATE_LIMITED'));
      return Promise.resolve({ claude: null, codex: null });
    });
    const onData = vi.fn();
    const onError = vi.fn();

    const poller = createPoller({ fetcher, onData, onError, interval: 5000 });
    poller.start();

    // First call: rate limited → interval doubles to 10000
    await vi.advanceTimersByTimeAsync(0);
    expect(poller.getCurrentInterval()).toBe(10000);

    // 3 successes to recover
    await vi.advanceTimersByTimeAsync(10000);
    await vi.advanceTimersByTimeAsync(10000);
    await vi.advanceTimersByTimeAsync(10000);
    expect(poller.getCurrentInterval()).toBe(5000);

    poller.stop();
  });
});
