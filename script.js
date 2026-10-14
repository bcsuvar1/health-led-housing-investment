// Health + Housing scrolly. Data comes from data.js (built by build_data.py).
const D = HBH;
const TILE = 'https://api.maptiler.com/maps/positron/{z}/{x}/{y}.png?key=tDhHlbfxdvJqCNl4l8ZN';
const TILE_ATTR = '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const PRIORITY_COLS = ['#1B5E45','#4CB748','#BDD62E','#FFD500','#F7941D','#ED5A29','#C01010'];
const HH_COLS = ['#FEF0D9','#FDCC8A','#FC8D59','#E34A33','#B30000'];
const EPC_COL = {D:'#FFD500',E:'#F7941D',F:'#ED1C24',G:'#9B1C1C'};
const EPC_OK = '#2E8B67';
const RP_CAT_COLS = ['#C95C3A','#7B4CA0','#2563EB','#B45309','#0891B2','#2E8B67','#7A7570'];
const N_PICK = 1000;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const gbp = v => '£' + Math.round(v || 0).toLocaleString();
const titleCase = s => (s || '—').toLowerCase().replace(/\b([a-z])/g, m => m.toUpperCase()).replace(/\bAnd\b/g, '&');
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
const $ = id => document.getElementById(id);

function baseMap(id, opts = {}) {
  const touch = L.Browser.mobile;
  const m = L.map(id, {preferCanvas: true, zoomControl: !!opts.zoom, scrollWheelZoom: false,
                       dragging: !touch || !!opts.drag, tap: false, attributionControl: true});
  L.tileLayer(TILE, {maxZoom: 20, tileSize: 512, zoomOffset: -1, attribution: TILE_ATTR}).addTo(m);
  m.setView([51.47, 0.06], 12);
  return m;
}

function kpis(el, items) {
  $(el).innerHTML = items.map(k => `<div class="kpi" style="border-left-color:${k.col}">
    <div class="kpi-label">${k.label}</div><div class="kpi-val" style="color:${k.col}">${k.val}</div>
    <div class="kpi-sub">${k.sub}</div></div>`).join('');
}

// ════════ ACT 1 — the tool ════════

function renderTracker() {
  const pill = {Current:'<span class="pill pill-g">Current</span>', Partial:'<span class="pill pill-a">Partial</span>',
                Overdue:'<span class="pill pill-r">Overdue</span>', 'Not surveyed':'<span class="pill pill-x">Not surveyed</span>'};
  const yr = y => !y ? '<span style="color:var(--text-muted)">Unknown</span>'
    : `<span style="font-weight:600;color:${y <= 2026 ? 'var(--red)' : y <= 2028 ? 'var(--amber-dark)' : 'var(--green)'}">${y}</span>`;
  const rows = D.sc.rows.slice(0, 120);
  $('sc-table').innerHTML = `<table class="tbl">
    <tr><th>Asset group</th><th class="r">Homes</th><th>Surveyed</th><th>Last survey</th><th>Status</th>
      <th>Bathroom due</th><th>Kitchen due</th><th>Roof due</th><th>Heating due</th><th>Electrical due</th></tr>
    ${rows.map(r => {
      const w = Math.round((r.surveyed || 0) / Math.max(r.total, 1) * 100);
      return `<tr><td class="ag">${esc(r.ag)}</td><td class="r">${r.total}</td>
        <td><div style="display:flex;align-items:center;gap:5px"><div style="width:46px;background:var(--off-white);border-radius:3px;height:7px;overflow:hidden">
          <div style="width:${Math.min(w,100)}%;height:100%;background:var(--green)"></div></div>${r.surveyed}</div></td>
        <td>${r.last_survey || 'None'}</td><td>${pill[r.status] || esc(r.status)}</td>
        <td>${yr(r.bathroom_due)}</td><td>${yr(r.kitchen_due)}</td><td>${yr(r.roof_due)}</td><td>${yr(r.heating_due)}</td><td>${yr(r.electrical_due)}</td></tr>`;
    }).join('')}</table>`;
}

const rpOpen = new Set();
function renderRepairs() {
  const R = D.rp, base = R.borough.cat_per_home;
  const shade = (v, h, ci) => { const r = base[ci] > 0 && h > 0 ? (v / h) / base[ci] : 0;
    return r > 1 ? `background:rgba(201,92,58,${Math.min(.55, (r - 1) * .28).toFixed(2)})` : ''; };
  const rows = R.ags.map((a, i) => ({a, i})).sort((x, y) => y.a.n - x.a.n);
  const ncol = 7 + R.cats.length;
  $('rp-table').innerHTML = `<table class="tbl"><tr><th></th><th>Asset group</th><th>Ward</th><th class="r">Homes</th><th class="r">Repairs</th>
    ${R.cats.map((c, ci) => `<th class="r"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${RP_CAT_COLS[ci]};margin-right:4px"></span>${c}</th>`).join('')}
    <th class="r">Spend</th><th>${R.fys[0]} → ${R.fys[R.fys.length - 1]}</th></tr>
    ${rows.map(({a, i}) => {
      const mx = Math.max(...a.fy, 1), open = rpOpen.has(i);
      return `<tr onclick="rpToggle(${i})" style="cursor:pointer"><td style="color:var(--green)">${open ? '▾' : '▸'}</td>
        <td class="ag" style="font-weight:600">${esc(a.ag)}</td><td style="font-size:10px;color:var(--text-muted)">${esc(titleCase(a.ward))}</td>
        <td class="r">${a.h.toLocaleString()}</td><td class="r" style="font-weight:600">${a.n.toLocaleString()}</td>
        ${a.c.map((v, ci) => `<td class="r" style="${shade(v, a.h, ci)}">${v ? v.toLocaleString() : '<span style="color:#ccc">0</span>'}</td>`).join('')}
        <td class="r">${gbp(a.cost)}</td>
        <td><div style="display:flex;align-items:flex-end;gap:2px;height:16px">${a.fy.map(v => `<div style="width:8px;height:${Math.max(2, v / mx * 16)}px;background:var(--green-mid);border-radius:1px"></div>`).join('')}</div></td></tr>`
        + (open ? `<tr><td colspan="${ncol}" style="white-space:normal;background:var(--green-pale);font-size:11px;line-height:1.55;padding:10px 14px">${esc(a.s)}</td></tr>` : '');
    }).join('')}</table>`;
}
function rpToggle(i) { const el = $('rp-table'), top = el.scrollTop; rpOpen.has(i) ? rpOpen.delete(i) : rpOpen.add(i); renderRepairs(); el.scrollTop = top; }

let ovMap, ovMarkers = [], ovRanked = [];
function initOverview() {
  const rows = D.ov;
  const tot = rows.reduce((s, r) => s + (r.total || 0), 0), lease = rows.reduce((s, r) => s + (r.lease || 0), 0);
  kpis('ov-kpis', [
    {label:'Total properties', val:tot.toLocaleString(), sub:`${rows.length} asset groups`, col:'var(--green)'},
    {label:'Leasehold', val:lease.toLocaleString(), sub:`${Math.round(lease / tot * 100)}% of stock`, col:'var(--green-mid)'},
    {label:'Repairs logged', val:D.rp.borough.repairs.toLocaleString(), sub:'April 2023 – March 2026', col:'var(--amber-dark)'},
    {label:'Wards', val:new Set(rows.map(r => r.ward).filter(Boolean)).size, sub:'across the borough', col:'var(--green)'},
  ]);
  // Same ordering as the portal's "worst asset groups" list
  ovRanked = [...rows].sort((a, b) => (b.red - a.red) || (b.amber - a.amber) || (b.total - a.total));
  ovRanked.forEach((r, i) => r.rank = i + 1);

  ovMap = baseMap('ov-map');
  ovMarkers = rows.filter(r => r.lat && r.lon).map(r => {
    const flagged = [...r.rag].filter(c => c !== 'G').length;
    const m = L.circleMarker([r.lat, r.lon], {radius: 4 + Math.min((r.total || 0) / 30, 7), fillColor: PRIORITY_COLS[flagged],
      color: '#fff', weight: 1.2, fillOpacity: .9});
    m.bindTooltip(`<b>${esc(r.ag)}</b><br>${r.total} homes · ${flagged} of 6 components flagged`);
    m._row = r;
    return m.addTo(ovMap);
  });
  const lg = L.control({position: 'bottomleft'});
  lg.onAdd = () => { const d = L.DomUtil.create('div', 'map-legend'); d.style.position = 'static';
    d.innerHTML = '<div style="font-weight:600;color:#1B5E45;margin-bottom:4px">Components flagged (red or amber)</div><div style="display:flex;gap:3px">' +
      PRIORITY_COLS.map((c, i) => `<div style="text-align:center"><div style="width:18px;height:9px;border-radius:2px;background:${c}"></div>${i}</div>`).join('') + '</div>';
    return d; };
  lg.addTo(ovMap);

  $('ov-table').innerHTML = `<table class="tbl"><tr><th>#</th><th>Asset group</th><th class="r">Homes</th><th class="r">Red</th><th class="r">Amber</th></tr>
    ${ovRanked.slice(0, 60).map(r => `<tr data-rank="${r.rank}"><td style="color:var(--text-muted)">${r.rank}</td><td class="ag" style="max-width:190px">${esc(r.ag)}</td>
      <td class="r">${r.total}</td><td class="r"><b style="color:var(--red)">${r.red}</b></td><td class="r" style="color:var(--amber-dark)">${r.amber}</td></tr>`).join('')}</table>`;
}
let ovTopLayer;
function ovHighlight(on) {
  const TOP = 15;
  ovMarkers.forEach(m => m.setStyle({fillOpacity: on && m._row.rank > TOP ? .15 : .9, opacity: on && m._row.rank > TOP ? .2 : 1}));
  document.querySelectorAll('#ov-table tr[data-rank]').forEach(tr => tr.classList.toggle('hl', on && +tr.dataset.rank <= TOP));
  if (ovTopLayer) { ovMap.removeLayer(ovTopLayer); ovTopLayer = null; }
  if (on) {
    ovTopLayer = L.layerGroup(ovRanked.slice(0, TOP).filter(r => r.lat).map(r => L.marker([r.lat, r.lon], {interactive: false,
      icon: L.divIcon({className: '', iconSize: [20, 20], html: `<div style="width:20px;height:20px;border-radius:50%;background:#035341;color:#CFEF6C;font:600 10px/20px DM Sans;text-align:center;box-shadow:0 0 0 2px #fff">${r.rank}</div>`})}))).addTo(ovMap);
  }
}

// ════════ ACT 2 — health ════════

// Map areas carry COPD & asthma (and other QOF) values; breaks are quintiles across areas
function quintiles(vals) { const v = vals.filter(x => x != null).sort((a, b) => a - b); const q = p => v[Math.min(v.length - 1, Math.floor(p * v.length))]; return {lo: v[0], hi: v[v.length - 1], b: [q(.2), q(.4), q(.6), q(.8)]}; }
const ASTHMA_Q = quintiles(Object.values(D.health.areas).map(a => a.v.copd_asthma));
const hhColour = v => { if (v == null) return '#D9D6D0'; let i = 0; while (i < 4 && v > ASTHMA_Q.b[i]) i++; return HH_COLS[i]; };

function lsoaLayer(map, opacity) {
  return L.geoJSON(D.health.geo, {interactive: false,
    style: f => ({weight: .5, color: '#fff', fillOpacity: opacity, fillColor: hhColour((D.health.areas[f.properties.k] || {v: {}}).v.copd_asthma)})}).addTo(map);
}

let qofMap;
function initQof() {
  qofMap = baseMap('qof-map');
  const layer = lsoaLayer(qofMap, .78);
  qofMap.fitBounds(layer.getBounds(), {padding: [8, 8]});
  L.layerGroup(D.whf.homes.map(h => L.circleMarker([h[0], h[1]], {radius: 1.4, weight: 0, fillColor: '#1B3D33', fillOpacity: .55, interactive: false}))).addTo(qofMap);
  const f = v => v.toFixed(2), bounds = [ASTHMA_Q.lo, ...ASTHMA_Q.b, ASTHMA_Q.hi];
  $('qof-legend').innerHTML = `<div style="font-weight:600;color:var(--green);margin-bottom:5px">COPD &amp; asthma prevalence (QOF)</div>` +
    HH_COLS.map((c, i) => `<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px"><div style="width:14px;height:10px;border-radius:2px;background:${c}"></div>${i ? f(bounds[i]) + ' – ' + f(bounds[i + 1]) : 'up to ' + f(bounds[1])}</div>`).join('') +
    `<div style="display:flex;align-items:center;gap:6px;margin-top:4px"><div style="width:6px;height:6px;border-radius:50%;background:#1B3D33;margin:0 4px"></div>Social home</div>`;
}

// Warm Homes programme builder: social rented, retrofit-priority homes
// home = [lat, lon, agIdx, typeIdx, lease, epc, sap, damp, asthma, mould, fabricDue]
const SOCIAL = D.whf.homes.filter(h => !h[4]);
let whfMap, whfLayer;
function initWhf() {
  whfMap = baseMap('whf-map');
  const lg = L.control({position: 'bottomleft'});
  lg.onAdd = () => { const d = L.DomUtil.create('div', 'map-legend'); d.style.position = 'static';
    d.innerHTML = '<div style="font-weight:600;color:#1B5E45;margin-bottom:3px">EPC rating</div>' +
      Object.entries(EPC_COL).map(([k, c]) => `<span style="display:inline-flex;align-items:center;gap:3px;margin-right:6px"><span style="width:9px;height:9px;border-radius:50%;background:${c}"></span>${k}</span>`).join('') +
      `<div style="display:flex;align-items:center;gap:3px;margin-top:3px"><span style="width:9px;height:9px;border-radius:50%;background:${EPC_OK}"></span>C or better (fabric due / mould)</div>`;
    return d; };
  lg.addTo(whfMap);
  whfRender(false);
}
let whfHealthOn = null;
function whfRender(health) {
  if (health === whfHealthOn) return;
  whfHealthOn = health;
  const thr = D.whf.asthma.median;
  const sel = health ? SOCIAL.filter(h => h[8] != null && h[8] >= thr) : SOCIAL;
  $('whf-health').classList.toggle('live', health);
  $('whf-thr').textContent = health ? '≥ ' + thr.toFixed(2) + ' (median)' : 'off';
  $('whf-range').style.width = health ? ((thr - D.whf.asthma.min) / (D.whf.asthma.max - D.whf.asthma.min) * 100) + '%' : '0';
  const n = f => sel.filter(f).length;
  kpis('whf-kpis', [
    {label:'Homes in programme', val:sel.length.toLocaleString(), sub:`of ${SOCIAL.length.toLocaleString()} priority homes`, col:'var(--green)'},
    {label:'Asset groups', val:new Set(sel.map(h => h[2])).size, sub:`of ${D.whf.ags.length}`, col:'var(--green-mid)'},
    {label:'EPC D–G', val:n(h => 'DEFG'.includes(h[5]) && h[5]).toLocaleString(), sub:'below EPC C', col:'#F7941D'},
    {label:'Fabric due by 2030', val:n(h => h[10]).toLocaleString(), sub:'loft, CWI, EWI, windows', col:'var(--amber-dark)'},
    health ? {label:'Avg COPD & asthma', val:mean(sel.map(h => h[8])).toFixed(2), sub:'area rate, homes selected', col:'var(--health)'}
           : {label:`${D.whf.mould_min}+ mould repairs`, val:n(h => h[9] >= D.whf.mould_min).toLocaleString(), sub:'not leak-related, 3 yrs', col:'var(--red)'},
  ]);
  if (whfLayer) whfMap.removeLayer(whfLayer);
  whfLayer = L.layerGroup(sel.map(h => L.circleMarker([h[0], h[1]], {radius: 2.6, weight: .4, color: '#fff',
    fillColor: EPC_COL[h[5]] || EPC_OK, fillOpacity: .9, interactive: false}))).addTo(whfMap);
}

// ════════ Comparison — 1,000 homes with and without health ════════

// Percentile rank in [0,1]; tied values share their average rank
function pctRank(vals) {
  const idx = vals.map((_, i) => i).sort((a, b) => vals[a] - vals[b]);
  const out = new Array(vals.length), n = Math.max(vals.length - 1, 1);
  for (let i = 0; i < idx.length;) {
    let j = i; while (j + 1 < idx.length && vals[idx[j + 1]] === vals[idx[i]]) j++;
    for (let k = i; k <= j; k++) out[idx[k]] = (i + j) / 2 / n;
    i = j + 1;
  }
  return out;
}

function rankHomes() {
  const pool = SOCIAL;
  const saps = pool.map(h => h[6]).filter(Boolean).sort((a, b) => a - b), sapMed = saps[saps.length >> 1];
  const aMin = D.whf.asthma.min;
  const pDamp = pctRank(pool.map(h => h[7]));                        // more damp & mould repairs → higher
  const pNeed = pctRank(pool.map(h => -(h[6] || sapMed)));           // lower SAP → higher retrofit need
  const pLse  = pctRank(pool.map(h => -D.whf.ags[h[2]].lse));        // fewer leaseholders in the group → easier delivery
  const pAsth = pctRank(pool.map(h => h[8] ?? aMin));                // higher COPD & asthma prevalence → higher
  const home = pool.map((_, i) => (pDamp[i] + pNeed[i] + pLse[i]) / 3);
  const health = pool.map((_, i) => .5 * pAsth[i] + .5 * home[i]);
  const top = score => pool.map((_, i) => i).sort((a, b) => (score[b] - score[a]) || (home[b] - home[a]) || (a - b)).slice(0, N_PICK);
  return {pool, A: top(home), B: top(health)};
}

function selStats(pool, ids) {
  const hs = ids.map(i => pool[i]);
  const sap = hs.map(h => h[6]).filter(Boolean);
  return {
    asthma: mean(hs.map(h => h[8]).filter(v => v != null)),
    topFifth: hs.filter(h => h[8] != null && h[8] > ASTHMA_Q.b[3]).length / hs.length,
    damp: mean(hs.map(h => h[7])),
    mould: hs.filter(h => h[9] >= D.whf.mould_min).length,
    sap: mean(sap),
    epcEG: hs.filter(h => 'EFG'.includes(h[5]) && h[5]).length,
    ags: new Set(hs.map(h => h[2])).size,
  };
}

const cmpMaps = [];
function initCompare() {
  const {pool, A, B} = rankHomes();
  const inA = new Set(A), inB = new Set(B), both = A.filter(i => inB.has(i)).length;
  const sA = selStats(pool, A), sB = selStats(pool, B);
  $('cmp-pool').textContent = pool.length.toLocaleString();

  // Maps: unique picks in the list colour, shared picks grey; drawn shared-first so unique sit on top
  [['map-home', A, inB, 'var(--home)', '#035341'], ['map-health', B, inA, 'var(--health)', '#7A2E8C']].forEach(([id, ids, other, , col]) => {
    const m = baseMap(id, {zoom: true});  // no one-finger drag on touch, so the page still scrolls
    const layer = lsoaLayer(m, .38);
    m.fitBounds(layer.getBounds(), {padding: [6, 6]});
    const pts = [...ids].sort((a, b) => other.has(b) - other.has(a));
    L.layerGroup(pts.map(i => { const h = pool[i], shared = other.has(i);
      return L.circleMarker([h[0], h[1]], {radius: shared ? 2.6 : 3.4, weight: .5, color: '#fff', fillColor: shared ? '#9AA5A0' : col, fillOpacity: .95, interactive: false}); })).addTo(m);
    cmpMaps.push(m);
  });
  // Keep the two maps in step
  let syncing = false;
  cmpMaps.forEach((m, i) => m.on('move', () => { if (syncing) return; syncing = true; cmpMaps[1 - i].setView(m.getCenter(), m.getZoom(), {animate: false}); syncing = false; }));

  // Overlap
  const pct = v => Math.round(v * 100) + '%';
  $('cmp-overlap').innerHTML = `<b>${both.toLocaleString()}</b><p>of the ${N_PICK.toLocaleString()} homes appear on <b>both</b> lists. Considering health changes <b>${(N_PICK - both).toLocaleString()}</b> homes in the programme.</p>
    <div class="venn" aria-hidden="true"><i style="flex:${N_PICK - both};background:var(--home)"></i><i style="flex:${both};background:var(--both);margin:0 -1px"></i><i style="flex:${N_PICK - both};background:var(--health)"></i></div>`;

  const rows = [
    ['Average COPD &amp; asthma prevalence', 'neighbourhood rate', sA.asthma.toFixed(2), sB.asthma.toFixed(2), sB.asthma > sA.asthma],
    ['Homes in the highest-prevalence fifth of areas', '', pct(sA.topFifth), pct(sB.topFifth), sB.topFifth > sA.topFifth],
    ['Average damp &amp; mould repairs', 'per home, 3 years', sA.damp.toFixed(1), sB.damp.toFixed(1), sB.damp > sA.damp],
    [`Homes with ${D.whf.mould_min}+ mould repairs`, 'not leak-related', sA.mould, sB.mould, sB.mould > sA.mould],
    ['Average SAP score', 'lower = less efficient', sA.sap.toFixed(0), sB.sap.toFixed(0), sB.sap < sA.sap],
    ['Homes rated <span style="white-space:nowrap">EPC E–G</span>', '',sA.epcEG, sB.epcEG, sB.epcEG > sA.epcEG],
    ['Asset groups reached', '', sA.ags, sB.ags, false],
  ];
  $('cmp-table').innerHTML = `<tr><th></th><th class="home">Without health</th><th class="health">With health</th></tr>` +
    rows.map(([l, s, a, b, up]) => `<tr><td>${l}${s ? `<small>${s}</small>` : ''}</td><td>${a}</td><td class="${up ? 'up' : ''}" style="${up ? 'color:var(--health)' : ''}">${b}</td></tr>`).join('');
}

// ════════ Scroll choreography ════════

const ACTS = {
  frame1: {tracker:['p-tracker'], repairs:['p-tracker','p-repairs'], overview:['p-overview'], 'overview-top':['p-overview']},
  frame2: {evidence:['p-evidence'], links:['p-links'], qof:['p-qof'], whf:['p-whf'], 'whf-health':['p-whf']},
};
const TABS = {tracker:'Stock condition', repairs:'Repairs', overview:'Overview', 'overview-top':'Overview',
              evidence:'Evidence', links:'Evidence', qof:'Housing + Health', whf:'Warm Homes Fund', 'whf-health':'Warm Homes Fund'};

function setState(frameId, step) {
  const frame = $(frameId);
  frame.dataset.state = step;
  const on = ACTS[frameId][step] || [];
  frame.querySelectorAll('.panel').forEach(p => p.classList.toggle('on', on.includes(p.id)));
  $(frameId === 'frame1' ? 'tab1' : 'tab2').textContent = TABS[step] || '';
  // Leaflet needs a size check once a panel is visible
  setTimeout(() => [ovMap, qofMap, whfMap].forEach(m => m && m.invalidateSize()), 50);
  if (frameId === 'frame1') ovHighlight(step === 'overview-top');
  if (step === 'whf' || step === 'whf-health') whfRender(step === 'whf-health');
}

// Tables drift downwards as the reader scrolls through their steps
function driftTables(step, p) {
  const tr = $('sc-table'), rp = $('rp-table'), ov = $('ov-table');
  const max = el => Math.max(0, el.scrollHeight - el.clientHeight);
  if (step === 'tracker') tr.scrollTop = p * max(tr) * .22;
  if (step === 'repairs') { tr.scrollTop = (.22 + p * .12) * max(tr); rp.scrollTop = p * max(rp) * .18; }
  if (step === 'overview-top') ov.scrollTop = 0;
}

function initScroll() {
  ['act1', 'act2'].forEach(act => {
    const frameId = act === 'act1' ? 'frame1' : 'frame2';
    const steps = document.querySelectorAll(`#${act} .step`);
    // On phones the text scrolls over the graphic, so switch it before the card covers it
    scrollama().setup({step: steps, offset: matchMedia('(max-width:900px)').matches ? .88 : .6, progress: true})
      .onStepEnter(({element}) => {
        steps.forEach(s => s.classList.toggle('is-active', s === element));
        setState(frameId, element.dataset.step);
      })
      .onStepProgress(({element, progress}) => driftTables(element.dataset.step, progress));
  });
  setState('frame1', 'tracker');
  setState('frame2', 'evidence');
}

function initHbhPopup() {
  const pop = $('hpop'), target = document.querySelector('.closing');
  let closed = false;
  try { closed = sessionStorage.getItem('hpop-closed') === '1'; } catch (e) {}
  if (!pop || !target || closed) return;
  pop.hidden = false;
  new IntersectionObserver((es, o) => es.forEach(e => {
    if (e.isIntersecting) { pop.classList.add('show'); o.disconnect(); }
  }), {threshold: .3}).observe(target);
  $('hpop-x').addEventListener('click', () => {
    pop.classList.remove('show');
    try { sessionStorage.setItem('hpop-closed', '1'); } catch (e) {}
  });
}

document.addEventListener('DOMContentLoaded', () => {
  renderTracker();
  renderRepairs();
  initOverview();
  initQof();
  initWhf();
  initCompare();
  initScroll();
  initHbhPopup();
  window.addEventListener('resize', () => [ovMap, qofMap, whfMap, ...cmpMaps].forEach(m => m && m.invalidateSize()));
});
