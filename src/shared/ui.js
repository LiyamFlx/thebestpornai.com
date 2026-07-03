/* Shared UI render helpers used by creator, manager, and viewer.
   metric() is the canonical version (includes the up/down arrow) —
   manager's previous copy was missing it; this fixes that divergence. */

export function metric(label, value, delta, up) {
  return `<div class="metric"><div class="label">${label}</div><div class="value">${value}</div>${delta ? `<div class="delta ${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${delta}</div>` : ''}</div>`;
}

export function barChart(values, labels) {
  const max = Math.max(...values, 1);
  return `
    <div class="bars">${values.map(v => `<div class="bar" style="height:${Math.round(v / max * 100)}%"></div>`).join("")}</div>
    <div class="bars-x">${(labels || values.map((_, i) => i + 1)).map(l => `<div>${l}</div>`).join("")}</div>`;
}

export function distRows(arr) {
  return arr.map(d => `
    <div style="margin:10px 0">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
        <span>${d.c}</span><span class="small">${d.p}%</span>
      </div>
      <div style="height:6px;background:var(--surface3);border-radius:999px;overflow:hidden">
        <div style="height:100%;width:${d.p}%;background:linear-gradient(90deg,var(--accent),var(--accent2))"></div>
      </div>
    </div>`).join("");
}
