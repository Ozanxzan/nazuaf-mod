// fetchHtml + fetchJson dengan retry + backoff. Zero-dependency.
export async function fetchText(url, opts = {}) {
  const { retries = 3, timeoutMs = 30000, backoffMs = 1000, fetchFn = globalThis.fetch, headers = {} } = opts;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchFn(url, {
        signal: ctrl.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          ...headers,
        },
      });
      clearTimeout(timer);
      if (!res.ok) {
        const retryAfter = res.headers?.get?.('retry-after');
        if ((res.status === 429 || res.status >= 500) && attempt < retries) {
          const wait = retryAfter ? parseInt(retryAfter, 10) * 1000 : backoffMs * 2 ** attempt;
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      return await res.text();
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, backoffMs * 2 ** attempt));
    }
  }
  throw new Error(`fetch failed after ${retries + 1} attempts for ${url}: ${lastErr?.message || lastErr}`);
}

export async function fetchJson(url, opts = {}) {
  const text = await fetchText(url, { ...opts, headers: { Accept: 'application/json', ...(opts.headers || {}) } });
  return JSON.parse(text);
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Jalankan tasks dengan konkurensi terbatas (pool).
export async function runPool(items, worker, concurrency = 3, delayMs = 0) {
  const results = new Array(items.length);
  let next = 0;
  async function runOne() {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = { ok: true, value: await worker(items[i], i) };
      } catch (err) {
        results[i] = { ok: false, error: err };
      }
      if (delayMs) await sleep(delayMs);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runOne));
  return results;
}
