const LINES = [
  { id: 'green', name: 'Green Loop', short: 'G', color: '#b7ff3c', stations: ['harbor', 'market', 'central', 'museum', 'river'], terminus: 'River' },
  { id: 'cyan', name: 'Cyan Cross', short: 'C', color: '#4fd8ff', stations: ['north', 'university', 'central', 'stadium', 'garden'], terminus: 'Garden' },
  { id: 'amber', name: 'Amber Line', short: 'A', color: '#ffb454', stations: ['old-town', 'depot', 'stadium', 'garden', 'airport'], terminus: 'Airport' },
  { id: 'rose', name: 'Rose Arc', short: 'R', color: '#ff6b9d', stations: ['observatory', 'east', 'river', 'garden'], terminus: 'Garden' }
];

const STATIONS = {
  harbor: { name: 'Harbor', x: 72, y: 320, label: 'Harbor', ly: 294, anchor: 'middle' },
  market: { name: 'Market', x: 220, y: 320, label: 'Market', ly: 294, anchor: 'middle' },
  central: { name: 'Central', x: 370, y: 320, label: 'Central', ly: 294, anchor: 'middle' },
  museum: { name: 'Museum', x: 520, y: 320, label: 'Museum', ly: 294, anchor: 'middle' },
  river: { name: 'River', x: 680, y: 320, label: 'River', ly: 294, anchor: 'middle' },
  north: { name: 'North Gate', x: 220, y: 100, label: 'North Gate', ly: 76, anchor: 'middle' },
  university: { name: 'University', x: 326, y: 214, label: 'University', ly: 191, anchor: 'middle' },
  stadium: { name: 'Stadium', x: 520, y: 444, label: 'Stadium', ly: 478, anchor: 'middle' },
  garden: { name: 'Garden', x: 742, y: 444, label: 'Garden', ly: 478, anchor: 'middle' },
  'old-town': { name: 'Old Town', x: 72, y: 504, label: 'Old Town', ly: 538, anchor: 'middle' },
  depot: { name: 'Depot', x: 220, y: 444, label: 'Depot', ly: 478, anchor: 'middle' },
  airport: { name: 'Airport', x: 846, y: 504, label: 'Airport', ly: 538, anchor: 'middle' },
  observatory: { name: 'Observatory', x: 846, y: 160, label: 'Observatory', ly: 136, anchor: 'middle' },
  east: { name: 'East Bank', x: 720, y: 276, label: 'East Bank', ly: 252, anchor: 'middle' }
};

const ALERTS = [
  { color: '#b7ff3c', title: 'Green Loop', text: 'Extra trains between Harbor and River until 19:00.' },
  { color: '#ffb454', title: 'Amber Line', text: 'Airport bound services are running 2 minutes late.' },
  { color: '#ff6b9d', title: 'Rose Arc', text: 'Weekend works: Observatory to East Bank closes after 23:00.' },
  { color: '#4fd8ff', title: 'Cyan Cross', text: 'Stadium station lift is back in service.' }
];

const LINE_MINUTES = [4, 3, 5, 4, 4];
const state = {
  activeLines: new Set(LINES.map((line) => line.id)),
  from: 'harbor',
  to: 'airport',
  pickStage: 0,
  route: null,
  trains: [],
  lastFrame: 0
};

const map = document.getElementById('map');
const fromSelect = document.getElementById('from');
const toSelect = document.getElementById('to');
const routeBox = document.getElementById('route');
const departuresBox = document.getElementById('departures');
const lineList = document.getElementById('line-list');
const mapNote = document.getElementById('map-note');
const mapTip = document.getElementById('map-tip');
const tip = document.getElementById('map-tip');

function stationLines(id) {
  return LINES.filter((line) => line.stations.includes(id));
}

function lineForPair(a, b) {
  return LINES.find((line) => {
    const i = line.stations.indexOf(a);
    const j = line.stations.indexOf(b);
    return i !== -1 && j !== -1 && Math.abs(i - j) === 1;
  });
}

function buildGraph() {
  const graph = {};
  Object.keys(STATIONS).forEach((id) => { graph[id] = []; });
  LINES.forEach((line) => {
    line.stations.forEach((id, index) => {
      if (index === line.stations.length - 1) return;
      const next = line.stations[index + 1];
      const minutes = LINE_MINUTES[index] || 4;
      graph[id].push({ from: id, to: next, minutes, line: line.id });
      graph[next].push({ from: next, to: id, minutes, line: line.id });
    });
  });
  return graph;
}

function findRoute(start, end) {
  const graph = buildGraph();
  if (!state.activeLines.size) return null;
  const distances = new Map();
  const previous = new Map();
  const queue = [{ station: start, line: null, cost: 0 }];
  distances.set(`${start}|none`, 0);
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift();
    if (current.station === end) {
      const edges = [];
      let key = `${current.station}|${current.line || 'none'}`;
      while (previous.has(key)) {
        const prior = previous.get(key);
        edges.unshift(prior.edge);
        key = prior.key;
      }
      return summarize(edges, start, end);
    }
    graph[current.station].forEach((edge) => {
      if (!state.activeLines.has(edge.line)) return;
      const penalty = current.line && current.line !== edge.line ? 4 : 0;
      const cost = current.cost + edge.minutes + penalty;
      const key = `${edge.to}|${edge.line}`;
      if (!distances.has(key) || cost < distances.get(key)) {
        distances.set(key, cost);
        previous.set(key, { key: `${current.station}|${current.line || 'none'}`, edge });
        queue.push({ station: edge.to, line: edge.line, cost });
      }
    });
  }
  return null;
}

function summarize(edges, start, end) {
  const steps = [];
  let current = null;
  edges.forEach((edge) => {
    if (!current || current.line !== edge.line) {
      current = { line: edge.line, from: edge.from || null, stations: [edge.from, edge.to], minutes: edge.minutes };
      steps.push(current);
    } else {
      current.stations.push(edge.to);
      current.minutes += edge.minutes;
    }
  });
  const lineChanges = steps.length - 1;
  const total = edges.reduce((sum, edge) => sum + edge.minutes, 0);
  const fare = 2.4 + Math.max(0, edges.length - 1) * 0.22;
  return { start, end, steps, transfers: lineChanges, minutes: total, fare };
}

function drawMap() {
  const width = 900;
  const height = 580;
  map.innerHTML = '';
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = '<pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path class="grid-line" d="M 40 0 L 0 0 0 40" fill="none"/></pattern>';
  map.appendChild(defs);
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', width);
  bg.setAttribute('height', height);
  bg.setAttribute('fill', 'url(#grid)');
  map.appendChild(bg);

  const blocks = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  [
    [100, 150, 80, 55], [300, 60, 110, 46], [470, 160, 70, 62], [760, 220, 80, 35],
    [120, 380, 55, 56], [300, 380, 90, 40], [590, 500, 90, 38], [820, 330, 46, 58]
  ].forEach(([x, y, w, h]) => {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x); rect.setAttribute('y', y); rect.setAttribute('width', w); rect.setAttribute('height', h);
    rect.setAttribute('rx', 7); rect.setAttribute('class', 'block');
    blocks.appendChild(rect);
  });
  map.appendChild(blocks);

  const water = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  water.setAttribute('d', 'M 760 -20 C 700 90, 790 170, 745 260 C 700 350, 800 430, 760 600');
  water.setAttribute('class', 'water');
  map.appendChild(water);

  LINES.forEach((line) => {
    const points = line.stations.map((id) => `${STATIONS[id].x},${STATIONS[id].y}`).join(' ');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    path.setAttribute('points', points);
    path.setAttribute('class', `route-line${state.activeLines.has(line.id) ? '' : ' dim'}`);
    path.setAttribute('stroke', line.color);
    path.dataset.line = line.id;
    map.appendChild(path);
  });

  Object.entries(STATIONS).forEach(([id, station]) => {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', `station${state.from === id ? ' is-from' : ''}${state.to === id ? ' is-to' : ''}`);
    group.setAttribute('tabindex', '0');
    group.setAttribute('role', 'button');
    group.setAttribute('aria-label', `${station.name} station`);
    group.dataset.station = id;
    if (stationLines(id).length > 1) {
      const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ring.setAttribute('cx', station.x); ring.setAttribute('cy', station.y); ring.setAttribute('r', 12);
      ring.setAttribute('class', 'ring');
      group.appendChild(ring);
    }
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', station.x); dot.setAttribute('cy', station.y); dot.setAttribute('r', 6.5);
    dot.setAttribute('class', 'dot');
    group.appendChild(dot);
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', station.x); label.setAttribute('y', station.ly);
    label.setAttribute('text-anchor', station.anchor); label.setAttribute('class', 'label');
    label.textContent = station.label;
    group.appendChild(label);
    group.addEventListener('click', () => pickStation(id));
    group.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pickStation(id); }
    });
    group.addEventListener('mouseenter', (event) => showTip(id, event));
    group.addEventListener('mousemove', (event) => positionTip(event));
    group.addEventListener('mouseleave', () => { tip.hidden = true; });
    map.appendChild(group);
  });

  state.trains = [];
  LINES.forEach((line) => {
    [0.16, 0.63].forEach((offset, index) => {
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('class', 'train');
      group.style.color = line.color;
      const body = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      body.setAttribute('x', -7); body.setAttribute('y', -5); body.setAttribute('width', 14); body.setAttribute('height', 10); body.setAttribute('rx', 3);
      body.setAttribute('class', 'body');
      const windowRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      windowRect.setAttribute('x', -2); windowRect.setAttribute('y', -2); windowRect.setAttribute('width', 5); windowRect.setAttribute('height', 4); windowRect.setAttribute('rx', 1);
      windowRect.setAttribute('class', 'window');
      group.appendChild(body); group.appendChild(windowRect);
      group.dataset.line = line.id;
      map.appendChild(group);
      const totalDistance = line.stations.slice(0, -1).reduce((sum, id, i) => sum + distance(STATIONS[id], STATIONS[line.stations[i + 1]]), 0);
      state.trains.push({ line, group, progress: totalDistance * offset, speed: 38 + index * 8 + LINES.indexOf(line) * 4 });
    });
  });
  updateTrainVisibility();
}

function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function updateTrainVisibility() {
  state.trains.forEach((train) => {
    train.group.style.opacity = state.activeLines.has(train.line.id) ? '1' : '0.08';
  });
}

function animateTrains(now) {
  if (!state.lastFrame) state.lastFrame = now;
  const delta = Math.min(now - state.lastFrame, 80);
  state.lastFrame = now;
  state.trains.forEach((train) => {
    const coords = train.line.stations.map((id) => STATIONS[id]);
    const total = coords.slice(0, -1).reduce((sum, point, i) => sum + distance(point, coords[i + 1]), 0);
    train.progress = (train.progress + (train.speed * delta) / 1000) % total;
    let remaining = train.progress;
    let a = coords[0];
    let b = coords[1];
    for (let i = 0; i < coords.length - 1; i += 1) {
      const segment = distance(coords[i], coords[i + 1]);
      if (remaining <= segment) { a = coords[i]; b = coords[i + 1]; break; }
      remaining -= segment;
    }
    const t = remaining / Math.max(1, distance(a, b));
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    train.group.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
  });
  requestAnimationFrame(animateTrains);
}

function pickStation(id) {
  if (state.pickStage === 0) {
    state.from = id;
    state.pickStage = 1;
    mapNote.textContent = `${STATIONS[id].name} selected. Now choose a destination.`;
  } else {
    if (id === state.from) {
      mapNote.textContent = 'Pick a different destination.';
      return;
    }
    state.to = id;
    state.pickStage = 0;
    mapNote.textContent = `${STATIONS[state.from].name} → ${STATIONS[state.to].name}. Route updated.`;
    fromSelect.value = state.from;
    toSelect.value = state.to;
    state.route = findRoute(state.from, state.to);
    drawMap();
    renderRoute();
    renderDepartures();
    return;
  }
  drawMap();
  renderDepartures();
}

function showTip(id, event) {
  const station = STATIONS[id];
  const lines = stationLines(id).map((line) => line.name).join(' · ');
  tip.innerHTML = `<strong>${station.name}</strong><small>${lines || 'No active line'}<br>Click to set ${state.pickStage === 0 ? 'origin' : 'destination'}</small>`;
  tip.hidden = false;
  positionTip(event);
}

function positionTip(event) {
  const box = document.getElementById('map-wrap').getBoundingClientRect();
  tip.style.left = `${Math.min(box.width - 170, event.clientX - box.left + 12)}px`;
  tip.style.top = `${Math.max(4, event.clientY - box.top + 12)}px`;
}

function buildSelects() {
  Object.entries(STATIONS).sort((a, b) => a[1].name.localeCompare(b[1].name)).forEach(([id, station]) => {
    [fromSelect, toSelect].forEach((select) => {
      const option = document.createElement('option');
      option.value = id; option.textContent = station.name;
      select.appendChild(option);
    });
  });
  fromSelect.value = state.from;
  toSelect.value = state.to;
}

function renderLines() {
  lineList.innerHTML = '';
  LINES.forEach((line) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `line-toggle${state.activeLines.has(line.id) ? '' : ' off'}`;
    button.style.setProperty('--c', line.color);
    button.innerHTML = `<span class="swatch"></span><span><b>${line.name}</b><small>${line.stations.length} stations</small></span><span class="toggle-mark">${state.activeLines.has(line.id) ? '●' : '○'}</span>`;
    button.addEventListener('click', () => {
      if (state.activeLines.has(line.id)) {
        if (state.activeLines.size === 1) {
          mapNote.textContent = 'Keep at least one line active.';
          return;
        }
        state.activeLines.delete(line.id);
      } else {
        state.activeLines.add(line.id);
      }
      state.route = findRoute(state.from, state.to);
      renderLines();
      drawMap();
      renderRoute();
      renderDepartures();
      document.getElementById('line-count').textContent = String(state.activeLines.size).padStart(2, '0');
    });
    lineList.appendChild(button);
  });
  document.getElementById('line-count').textContent = String(state.activeLines.size).padStart(2, '0');
}

function renderAlerts() {
  const box = document.getElementById('alerts');
  box.innerHTML = '';
  ALERTS.forEach((alert) => {
    const item = document.createElement('div');
    item.className = 'alert';
    item.style.setProperty('--accent', alert.color);
    item.innerHTML = `<b>${alert.title}</b>${alert.text}`;
    box.appendChild(item);
  });
}

function renderRoute() {
  const route = state.route;
  if (!route) {
    routeBox.innerHTML = `<p class="route-note">No route connects these stations with the selected lines. Re-enable a line or choose another journey.</p>`;
    return;
  }
  const lineMap = Object.fromEntries(LINES.map((line) => [line.id, line]));
  routeBox.innerHTML = '';
  const summary = document.createElement('div');
  summary.className = 'route-summary';
  summary.innerHTML = `<div><b>${route.minutes}</b><small>Minutes</small></div><div><b>${route.transfers}</b><small>Changes</small></div><div><b>$${route.fare.toFixed(2)}</b><small>Fare</small></div>`;
  routeBox.appendChild(summary);
  const steps = document.createElement('div');
  steps.className = 'route-steps';
  route.steps.forEach((step, index) => {
    const line = lineMap[step.line];
    const last = index === route.steps.length - 1;
    const next = !last ? route.steps[index + 1].stations[0] : '';
    const item = document.createElement('div');
    item.className = 'route-step';
    item.innerHTML = `<span class="line-pip" style="--c:${line.color}"></span><div><b>${line.name} → ${last ? STATIONS[route.end].name : STATIONS[next].name}</b><small>${step.stations.length - 1} stop${step.stations.length - 1 === 1 ? '' : 's'} · ${step.minutes} min${last ? '' : ' · change'}</small></div>`;
    steps.appendChild(item);
  });
  routeBox.appendChild(steps);
  const note = document.createElement('p');
  note.className = 'route-note';
  note.textContent = `${STATIONS[route.start].name} to ${STATIONS[route.end].name} · ${route.steps.length} line${route.steps.length === 1 ? '' : 's'} · contactless fare estimate`;
  routeBox.appendChild(note);
}

function renderDepartures() {
  const from = state.from;
  const to = state.to;
  const route = findRoute(from, to);
  departuresBox.innerHTML = '';
  document.getElementById('departure-station').textContent = STATIONS[from].name;
  const now = new Date();
  const base = now.getHours() * 60 + now.getMinutes();
  const options = [];
  LINES.forEach((line) => {
    const index = line.stations.indexOf(from);
    if (index === -1) return;
    const toward = index === 0 ? line.stations[1] : line.stations[index - 1];
    const direction = route && route.steps[0] && route.steps[0].line === line.id ? 'recommended' : 'all services';
    for (let i = 0; i < 2; i += 1) {
      const wait = (i * 6 + 2 + LINES.indexOf(line) * 2) % 11;
      const minutes = wait + 1;
      options.push({ line, toward, direction, minutes });
    }
  });
  options.sort((a, b) => a.minutes - b.minutes).slice(0, 5).forEach((option) => {
    const row = document.createElement('div');
    row.className = 'departure';
    row.innerHTML = `<span class="badge" style="--c:${option.line.color}">${option.line.short}</span><div><b>${STATIONS[option.toward].name}</b><small>${option.direction}</small></div><div class="time">${option.minutes}<span> min</span></div>`;
    departuresBox.appendChild(row);
  });
}

function updateClock() {
  document.getElementById('clock').textContent = new Date().toLocaleTimeString('en-GB', { hour12: false });
}

function swap() {
  [state.from, state.to] = [state.to, state.from];
  fromSelect.value = state.from;
  toSelect.value = state.to;
  state.route = findRoute(state.from, state.to);
  state.pickStage = 0;
  mapNote.textContent = 'Stations swapped.';
  drawMap();
  renderRoute();
  renderDepartures();
}

function init() {
  buildSelects();
  renderLines();
  renderAlerts();
  state.route = findRoute(state.from, state.to);
  drawMap();
  renderRoute();
  renderDepartures();
  updateClock();
  setInterval(updateClock, 1000);
  fromSelect.addEventListener('change', () => {
    state.from = fromSelect.value;
    state.pickStage = 0;
    state.route = findRoute(state.from, state.to);
    drawMap(); renderRoute(); renderDepartures();
  });
  toSelect.addEventListener('change', () => {
    state.to = toSelect.value;
    state.pickStage = 0;
    state.route = findRoute(state.from, state.to);
    drawMap(); renderRoute(); renderDepartures();
  });
  document.getElementById('plan').addEventListener('click', () => {
    state.route = findRoute(state.from, state.to);
    renderRoute();
    mapNote.textContent = `Fastest route from ${STATIONS[state.from].name} to ${STATIONS[state.to].name}.`;
  });
  document.getElementById('swap').addEventListener('click', swap);
  document.addEventListener('keydown', (event) => {
    if (event.target.tagName === 'SELECT' || event.target.tagName === 'INPUT') return;
    if (event.key.toLowerCase() === 'r') { state.route = findRoute(state.from, state.to); renderRoute(); }
    if (event.key.toLowerCase() === 's') swap();
  });
  requestAnimationFrame(animateTrains);
}

init();
