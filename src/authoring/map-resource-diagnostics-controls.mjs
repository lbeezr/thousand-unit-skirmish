import { analyzeMapResources } from './map-resource-diagnostics.mjs';
import { formatMapResourceAmount as amount } from './map-resource-budgets.mjs';

const seatName = team => team ? 'Ember' : 'Azure';

// UI reads authored drafts only. Cached/debounced analysis stays out of pointer previews.
export function mountMapResourceDiagnostics({ host, readMap }) {
  const document = host.ownerDocument, view = document.defaultView;
  const panel = document.createElement('details');
  panel.className = 'studio-map-diagnostics'; panel.open = true;
  panel.innerHTML = `<summary>RESOURCE BUDGET &amp; ACCESS</summary>
    <button type="button" data-diagnostics="refresh">ANALYZE ACCESS</button>
    <p role="status" data-diagnostics="status">Open a map to analyze its resources.</p>
    <div data-diagnostics="results" hidden></div>`;
  host.append(panel);
  const results = panel.querySelector('[data-diagnostics="results"]');
  const status = panel.querySelector('[data-diagnostics="status"]');
  let timer = 0, pendingKey = null, analyzedKey = null;
  const paragraph = text => { const node = document.createElement('p'); node.textContent = text; return node; };
  function table(caption, headings, rows) {
    const wrapper = document.createElement('div'); wrapper.className = 'studio-diagnostics-table';
    wrapper.tabIndex = 0; wrapper.setAttribute('aria-label', caption);
    const table = document.createElement('table');
    const label = document.createElement('caption'); label.textContent = caption; table.append(label);
    const header = table.createTHead().insertRow();
    headings.forEach(text => { const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = text; header.append(cell); });
    const body = table.createTBody();
    rows.forEach(row => {
      const tr = body.insertRow();
      row.forEach((text, index) => {
        const cell = document.createElement(index === 0 ? 'th' : 'td');
        if (index === 0) cell.scope = 'row'; cell.textContent = text; tr.append(cell);
      });
    });
    wrapper.append(table); return wrapper;
  }
  function render(report) {
    const banks = table('Starting banks per seat', ['Seat', ...report.resourceTypes.map(type => type.toUpperCase())],
      report.startingPerSeat.map((bank, team) => [seatName(team), ...report.resourceTypes.map(type => amount(bank[type]))]));
    const stocks = table('Finite node stock by shorter initial route', ['Source', 'Map total', 'Azure closer', 'Ember closer', 'Equal', 'Neither'],
      report.resourceTypes.map(type => [`${type.toUpperCase()} nodes`, amount(report.total[type]),
        amount(report.closer[0][type]), amount(report.closer[1][type]), amount(report.equal[type]), amount(report.inaccessible[type])]));
    const reach = table('Node stock reachable from each seat', ['Seat', ...report.resourceTypes.map(type => type.toUpperCase())],
      report.reachable.map((stock, team) => [seatName(team), ...report.resourceTypes.map(type => amount(stock[type]))]));
    const forest = report.forest;
    const forestTable = table('Forest access', ['Seat', 'Initial edge cells', 'Wood potential after cutting'], [0, 1].map(team =>
      [seatName(team), amount(forest.initialEdgeCells[team]), amount(forest.reachableAfterCut[team])]));
    const nodes = document.createElement('details');
    const nodeTitle = document.createElement('summary'); nodeTitle.textContent = `NODE ACCESS · ${report.nodes.length}`; nodes.append(nodeTitle);
    nodes.append(table('Initial routes and working frontage', ['Node', 'Source / stock', 'Azure cells', 'Ember cells', 'Fronts A / E'], report.nodes.map(node =>
      [node.id, `${node.kind} · ${node.type} ${amount(node.stock)}`,
        ...node.distances.map(distance => distance === null ? 'Unreachable' : amount(distance)), `${node.frontage[0]} / ${node.frontage[1]}`])));
    const warnings = document.createElement('ul');
    report.issues.forEach(issue => { const li = document.createElement('li'); li.textContent = issue.message; warnings.append(li); });
    results.replaceChildren(banks, stocks,
      paragraph('Closer means fewer route cells, not ownership. Equal stock is counted once. Reachable stock can be shared by both seats.'), reach,
      paragraph(`FOREST · ${amount(forest.cells)} cells × ${forest.woodPerCell} wood = ${amount(forest.potential)} total potential, separate from wood nodes and banks.`), forestTable,
      paragraph('Potential after cutting assumes progressive forest clearance. Initial edges count forest cells beside reachable land; they are not worker capacity.'),
      nodes, warnings,
      paragraph('Static cardinal routes from spawn markers, with both starting Town Centers and authored height steps present. Routes end at markers; frontage counts reachable cardinal neighbors. This does not measure gather trips, income, congestion or match balance. Rewards, Farms, future buildings and naval routes are excluded.'));
    results.hidden = false;
    status.textContent = report.issues.length ? `${report.issues.length} access issue${report.issues.length === 1 ? '' : 's'} to review.`
      : 'Initial access checked. Compare both seats and verify the economy in a match.';
  }
  function clear() {
    view.clearTimeout(timer); timer = 0; pendingKey = analyzedKey = null;
    results.replaceChildren(); results.hidden = true;
    status.textContent = 'Open a map to analyze its resources.';
  }
  function refresh() {
    view.clearTimeout(timer); timer = 0;
    try {
      const map = readMap(); if (!map) { clear(); return; }
      const key = JSON.stringify(map); render(analyzeMapResources(map)); pendingKey = analyzedKey = key;
    } catch (error) {
      results.replaceChildren(); results.hidden = true; pendingKey = analyzedKey = null;
      status.textContent = `Analysis unavailable: ${error.message}`;
    }
  }
  function sync() {
    try {
      const map = readMap(); if (!map) { clear(); return; }
      const key = JSON.stringify(map); if (key === pendingKey || key === analyzedKey) return;
      view.clearTimeout(timer); pendingKey = key; results.hidden = true;
      status.textContent = 'Updating authored resource access…';
      timer = view.setTimeout(refresh, 160);
    } catch (error) {
      clear(); status.textContent = `Analysis unavailable: ${error.message}`;
    }
  }
  panel.querySelector('[data-diagnostics="refresh"]').addEventListener('click', refresh);
  host.closest('dialog')?.addEventListener('close', clear);
  sync(); return { sync, refresh, clear };
}
