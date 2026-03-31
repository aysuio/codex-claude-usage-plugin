const MAX_INTERVAL = 2400000; // 40 minutes
const RECOVERY_COUNT = 3;

function createPoller({ fetcher, onData, onError, interval }) {
  let currentInterval = interval;
  let timerId = null;
  let inFlight = false;
  let consecutiveSuccesses = 0;
  let lastData = null;
  let lastUpdatedAt = null;

  async function doFetch() {
    if (inFlight) return;
    inFlight = true;

    try {
      const data = await fetcher();
      lastData = data;
      lastUpdatedAt = Date.now();
      consecutiveSuccesses++;

      if (consecutiveSuccesses >= RECOVERY_COUNT && currentInterval > interval) {
        currentInterval = interval;
        consecutiveSuccesses = 0;
      }

      onData({ ...data, updatedAt: lastUpdatedAt });
    } catch (err) {
      consecutiveSuccesses = 0;

      if (err.message === 'RATE_LIMITED') {
        currentInterval = Math.min(currentInterval * 2, MAX_INTERVAL);
      }

      onError(err.message, lastData, lastUpdatedAt);
    } finally {
      inFlight = false;
    }
  }

  function scheduleNext() {
    timerId = setTimeout(async () => {
      await doFetch();
      if (timerId !== null) {
        scheduleNext();
      }
    }, currentInterval);
  }

  return {
    start() {
      doFetch();
      scheduleNext();
    },
    stop() {
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
    },
    refresh() {
      doFetch();
    },
    getCurrentInterval() {
      return currentInterval;
    },
    getLastData() {
      return lastData;
    },
    getLastUpdatedAt() {
      return lastUpdatedAt;
    },
  };
}

module.exports = { createPoller };
