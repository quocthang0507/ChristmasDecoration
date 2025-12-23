(() => {
  const elPerf = document.getElementById('bench-perf');
  const elStart = document.getElementById('bench-start');
  const elStop = document.getElementById('bench-stop');
  const elStatus = document.getElementById('bench-status');
  const elResult = document.getElementById('bench-result');

  const PERF_KEY = 'cd.benchmark.perf.v1';
  const LAST_KEY = 'cd.benchmark.last.v1';

  function loadBool(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      if (v === null) return fallback;
      return v === '1';
    } catch {
      return fallback;
    }
  }

  function saveBool(key, val) {
    try {
      localStorage.setItem(key, val ? '1' : '0');
    } catch {
      // ignore
    }
  }

  function setText(el, text) {
    if (!el) return;
    el.textContent = text;
  }

  function percentile(values, p) {
    if (!values.length) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * (sorted.length - 1))));
    return sorted[idx];
  }

  function scoreFrom(avgFps, p95Ms) {
    // Thresholds tuned for a smooth-looking canvas experience.
    // Use both avg FPS and p95 frame time to avoid "average lies".
    if (avgFps >= 58 && p95Ms <= 20) return 'High';
    if (avgFps >= 45 && p95Ms <= 28) return 'Medium';
    return 'Low';
  }

  let running = false;
  let stopRequested = false;

  async function runTest({ name, durationMs, applyScene }) {
    applyScene();

    const samples = [];
    let frames = 0;
    let minFps = Infinity;

    let last = performance.now();
    const start = last;

    return await new Promise((resolve) => {
      function raf(now) {
        if (stopRequested) {
          resolve({ name, durationMs, frames, minFps: Number.isFinite(minFps) ? minFps : 0, p95Ms: percentile(samples, 95), avgFps: (frames * 1000) / Math.max(1, now - start) });
          return;
        }

        const dt = now - last;
        last = now;
        if (dt > 0 && dt < 200) {
          samples.push(dt);
          const fps = 1000 / dt;
          if (fps < minFps) minFps = fps;
        }
        frames++;

        const elapsed = now - start;
        setText(elStatus, `${name}… ${Math.min(100, Math.round((elapsed / durationMs) * 100))}%`);

        if (elapsed >= durationMs) {
          const totalMs = Math.max(1, elapsed);
          const avgFps = (frames * 1000) / totalMs;
          const p95Ms = percentile(samples, 95);
          resolve({ name, durationMs, frames, minFps: Number.isFinite(minFps) ? minFps : 0, p95Ms, avgFps });
          return;
        }

        requestAnimationFrame(raf);
      }

      requestAnimationFrame(raf);
    });
  }

  function applyBaseScene({ perf }) {
    window.CD_Scene?.setSettings(
      {
        mode: 'default',
        fireworks: false,
        snow: true,
        perf,
        density: perf ? 1.0 : 1.15,
      },
      { rebuild: true }
    );
  }

  async function runAll() {
    if (running) return;
    running = true;
    stopRequested = false;

    if (elStart) elStart.style.display = 'none';
    if (elStop) elStop.style.display = '';

    const perf = Boolean(elPerf?.checked);
    saveBool(PERF_KEY, perf);

    const tests = [
      {
        name: 'Test 1/3: Tree + Snow',
        durationMs: 9000,
        applyScene: () => applyBaseScene({ perf }),
      },
      {
        name: 'Test 2/3: Dense Lights',
        durationMs: 9000,
        applyScene: () => {
          window.CD_Scene?.setSettings(
            {
              mode: 'default',
              fireworks: false,
              snow: true,
              perf,
              density: perf ? 1.25 : 1.55,
            },
            { rebuild: true }
          );
        },
      },
      {
        name: 'Test 3/3: Fireworks On',
        durationMs: 9000,
        applyScene: () => {
          window.CD_Scene?.setSettings(
            {
              mode: 'default',
              fireworks: true,
              snow: true,
              perf,
              density: perf ? 1.0 : 1.2,
            },
            { rebuild: false }
          );
        },
      },
    ];

    const results = [];
    for (const t of tests) {
      if (stopRequested) break;
      results.push(await runTest(t));
    }

    const avg = results.length ? results.reduce((a, r) => a + r.avgFps, 0) / results.length : 0;
    const p95 = results.length ? Math.max(...results.map((r) => r.p95Ms)) : 0;
    const score = scoreFrom(avg, p95);

    const lines = [];
    lines.push(`Kết quả: ${score}`);
    lines.push(`Avg: ${avg.toFixed(1)} FPS  |  p95: ${p95.toFixed(1)} ms`);
    if (score === 'Low') lines.push('Gợi ý: bật Performance; tắt Pháo hoa; giảm Mật độ.');
    else if (score === 'Medium') lines.push('Gợi ý: bật Performance khi cần; cân nhắc tắt Pháo hoa.');

    lines.push('');
    for (const r of results) {
      // Short per-test line
      const shortName = String(r.name).replace(/^Test \d\/\d: /, '');
      lines.push(`${shortName}: avg ${r.avgFps.toFixed(1)} FPS, p95 ${r.p95Ms.toFixed(1)} ms`);
    }

    setText(elStatus, stopRequested ? 'Đã dừng.' : 'Hoàn tất.');
    setText(elResult, lines.join('\n'));

    try {
      localStorage.setItem(LAST_KEY, JSON.stringify({ at: Date.now(), score, avgFps: avg, p95Ms: p95, results }));
    } catch {
      // ignore
    }

    if (elStart) elStart.style.display = '';
    if (elStop) elStop.style.display = 'none';

    running = false;
  }

  function stop() {
    stopRequested = true;
  }

  function init() {
    window.CD_UI?.initCornerPanel({
      panelSelector: '.card-ui__panel',
      toggleSelector: '#bench-panel-toggle',
      storageKey: 'cd.benchmark.panelCollapsed.v1',
      defaultCollapsed: false,
      collapsedLabel: 'Benchmark',
      expandedLabel: 'Thu gọn',
    });

    if (elPerf) elPerf.checked = loadBool(PERF_KEY, false);

    elStart?.addEventListener('click', runAll);
    elStop?.addEventListener('click', stop);

    // Base scene while idle
    applyBaseScene({ perf: Boolean(elPerf?.checked) });
    elPerf?.addEventListener('change', () => applyBaseScene({ perf: Boolean(elPerf?.checked) }));

    try {
      const last = localStorage.getItem(LAST_KEY);
      if (last && elResult) {
        const parsed = JSON.parse(last);
        if (parsed?.score) {
          elResult.textContent = `Lần gần nhất: ${parsed.score}\nAvg: ${Number(parsed.avgFps || 0).toFixed(1)} FPS  |  p95: ${Number(parsed.p95Ms || 0).toFixed(1)} ms`;
        }
      }
    } catch {
      // ignore
    }
  }

  init();
})();
