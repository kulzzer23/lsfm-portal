import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseKey } from './config.js';

// ─── Supabase ─────────────────────────────────────────────
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Auth ─────────────────────────────────────────────────
const ADMIN_PASSWORD = 'kulzz'; // Change this!
const SESSION_KEY = 'lsfm_lottery_admin';

// ─── State ────────────────────────────────────────────────
let participants = {
  grandFinal: [],   // [{name, tickets, color}]
  basicLeague: []
};

let results = {
  winner1: null,  // grand final 1st
  winner2: null,  // grand final 2nd
  winner3: null   // basic league 3rd
};

// Current wheel phase: 'grandFinal1' | 'grandFinal2' | 'basicLeague'
let currentPhase = 'grandFinal1';
let isSpinning = false;
let currentRotation = 0; // cumulative rotation in degrees

// Canvas
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('wheelCanvas'));
const ctx = canvas ? canvas.getContext('2d') : null;

// Colour palette for wheel sectors
const PALETTE = [
  '#ff0050','#ff6b35','#ffd700','#00d9ff','#a855f7',
  '#22c55e','#f97316','#06b6d4','#ec4899','#84cc16',
  '#8b5cf6','#14b8a6','#f59e0b','#3b82f6','#ef4444',
  '#10b981','#6366f1','#f43f5e','#0ea5e9','#d946ef'
];

// ─── Initialise ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Check session
  if (sessionStorage.getItem(SESSION_KEY) === 'true') {
    showPanel();
  }

  // Login form
  document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const pw = document.getElementById('passwordInput').value;
    if (pw === ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, 'true');
      showPanel();
    } else {
      const err = document.getElementById('loginError');
      err.style.display = 'block';
      document.getElementById('passwordInput').value = '';
      document.getElementById('passwordInput').classList.add('shake');
      setTimeout(() => document.getElementById('passwordInput').classList.remove('shake'), 400);
    }
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem(SESSION_KEY);
    location.reload();
  });

  // Slug input live preview
  const slugInput = document.getElementById('slugInput');
  if (slugInput) {
    slugInput.addEventListener('input', () => {
      document.getElementById('slugPreview').textContent = '/lottery-results/' + (slugInput.value || '...');
    });
  }

  // Enter key on add participant inputs
  ['gfName','gfTickets'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); addParticipant('grandFinal'); }
    });
  });
  ['blName','blTickets'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); addParticipant('basicLeague'); }
    });
  });
});

function showPanel() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('adminPanel').style.display = 'block';
  drawWheelPlaceholder();
}

// ─── Participant Management ───────────────────────────────
window.addParticipant = function(league) {
  const nameId = league === 'grandFinal' ? 'gfName' : 'blName';
  const ticketsId = league === 'grandFinal' ? 'gfTickets' : 'blTickets';
  const nameEl = document.getElementById(nameId);
  const ticketsEl = document.getElementById(ticketsId);

  const name = nameEl.value.trim();
  const tickets = parseInt(ticketsEl.value) || 1;

  if (!name) { nameEl.focus(); return; }

  const existing = participants[league];
  const color = PALETTE[existing.length % PALETTE.length];
  existing.push({ name, tickets, color });

  nameEl.value = '';
  ticketsEl.value = '1';
  nameEl.focus();

  renderParticipantList(league);
};

function removeParticipant(league, index) {
  participants[league].splice(index, 1);
  // Re-assign colours
  participants[league].forEach((p, i) => { p.color = PALETTE[i % PALETTE.length]; });
  renderParticipantList(league);
}

function renderParticipantList(league) {
  const listId = league === 'grandFinal' ? 'grandFinalList' : 'basicLeagueList';
  const container = document.getElementById(listId);
  const list = participants[league];

  if (list.length === 0) {
    container.innerHTML = '<p style="color:var(--dim);font-size:.85rem;text-align:center;padding:.5rem 0;">Нет участников</p>';
    return;
  }

  container.innerHTML = list.map((p, i) => `
    <div class="participant-item">
      <div class="participant-color" style="background:${p.color}"></div>
      <span class="participant-name">${escHtml(p.name)}</span>
      <span class="participant-tickets">${p.tickets} 🎟</span>
      <button class="participant-remove" onclick="removeParticipant('${league}', ${i})" title="Удалить">✕</button>
    </div>
  `).join('');
}

window.removeParticipant = removeParticipant;

// ─── Navigation ───────────────────────────────────────────
window.proceedToSpin = function() {
  if (participants.grandFinal.length < 2) {
    alert('Добавьте минимум 2 участника в Гранд-Финал!');
    return;
  }
  if (participants.basicLeague.length < 1) {
    alert('Добавьте минимум 1 участника в Базовую Лигу!');
    return;
  }
  showStep('stepSpin');
  switchPhase('grandFinal1');
};

window.goBack = function() { showStep('stepSetup'); };
window.backToSpin = function() { showStep('stepSpin'); };

function showStep(id) {
  ['stepSetup','stepSpin','stepSave'].forEach(s => {
    const el = document.getElementById(s);
    if (el) el.style.display = 'none';
  });
  const target = document.getElementById(id);
  if (target) target.style.display = 'block';
}

// ─── Phase Switching ──────────────────────────────────────
window.switchPhase = function(phase) {
  currentPhase = phase;
  currentRotation = 0;
  isSpinning = false;

  // Update tab states
  const tabs = { grandFinal1: 'tabGF', grandFinal2: 'tabGF2', basicLeague: 'tabBL' };
  Object.entries(tabs).forEach(([p, tabId]) => {
    const tab = document.getElementById(tabId);
    if (!tab) return;
    tab.classList.toggle('active', p === phase);
    // Mark done
    if (p === 'grandFinal1' && results.winner1) tab.classList.add('done');
    if (p === 'grandFinal2' && results.winner2) tab.classList.add('done');
    if (p === 'basicLeague' && results.winner3) tab.classList.add('done');
  });

  // Title
  const titles = {
    grandFinal1: '👑 Гранд-Финал — 1-е место',
    grandFinal2: '🥈 Гранд-Финал — 2-е место',
    basicLeague: '🏅 Базовая Лига — 3-е место'
  };
  document.getElementById('currentPhaseTitle').textContent = titles[phase];

  // Get participants for this phase
  const phaseParticipants = getPhaseParticipants(phase);

  // Draw wheel
  drawWheel(phaseParticipants, 0);

  // Legend
  renderLegend(phaseParticipants);

  // Spin btn state
  const spinBtn = document.getElementById('spinBtn');
  const alreadyDone =
    (phase === 'grandFinal1' && results.winner1) ||
    (phase === 'grandFinal2' && results.winner2) ||
    (phase === 'basicLeague' && results.winner3);
  spinBtn.disabled = alreadyDone;
  spinBtn.textContent = alreadyDone ? '✅ Уже разыгран' : '🎰 Запустить!';

  // Show current result if exists
  const resEl = document.getElementById('currentResult');
  if (alreadyDone) {
    const w = phase === 'grandFinal1' ? results.winner1 : phase === 'grandFinal2' ? results.winner2 : results.winner3;
    resEl.textContent = '🏆 Победитель: ' + w.name;
    resEl.style.display = 'block';
  } else {
    resEl.style.display = 'none';
  }

  updateResultsSummary();
};

function getPhaseParticipants(phase) {
  if (phase === 'grandFinal1') return [...participants.grandFinal];
  if (phase === 'grandFinal2') {
    // Exclude the 1st place winner
    return participants.grandFinal.filter(p => !results.winner1 || p.name !== results.winner1.name);
  }
  return [...participants.basicLeague];
}

// ─── Wheel Drawing ────────────────────────────────────────
function drawWheel(list, rotationDeg) {
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  const cx = W / 2;
  const cy = H / 2;
  const R = (W / 2) - 8;

  ctx.clearRect(0, 0, W, H);

  if (!list || list.length === 0) {
    // Empty state
    ctx.fillStyle = '#1a1a28';
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#606078';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Нет участников', cx, cy);
    return;
  }

  const totalTickets = list.reduce((s, p) => s + p.tickets, 0);
  const rotRad = (rotationDeg * Math.PI) / 180;

  // Draw outer glow ring
  const gradient = ctx.createRadialGradient(cx, cy, R - 10, cx, cy, R + 4);
  gradient.addColorStop(0, 'rgba(255,0,80,0)');
  gradient.addColorStop(1, 'rgba(255,0,80,0.15)');
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(cx, cy, R + 2, 0, Math.PI * 2);
  ctx.stroke();

  // Draw sectors
  let startAngle = rotRad - Math.PI / 2; // start from top

  list.forEach((p, idx) => {
    const fraction = p.tickets / totalTickets;
    const sweepAngle = fraction * Math.PI * 2;
    const endAngle = startAngle + sweepAngle;

    // Fill sector
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = p.color;
    ctx.fill();

    // Sector border
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label — only if sector is wide enough
    if (fraction > 0.04) {
      const midAngle = startAngle + sweepAngle / 2;
      const labelR = R * (fraction > 0.15 ? 0.68 : 0.78);
      const lx = cx + labelR * Math.cos(midAngle);
      const ly = cy + labelR * Math.sin(midAngle);

      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(midAngle + Math.PI / 2);

      const fontSize = Math.max(10, Math.min(15, fraction > 0.15 ? 14 : 11));
      ctx.font = `bold ${fontSize}px Inter, sans-serif`;
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;

      // Truncate long names
      const maxChars = fraction > 0.12 ? 14 : 9;
      const label = p.name.length > maxChars ? p.name.slice(0, maxChars - 1) + '…' : p.name;
      ctx.fillText(label, 0, 0);

      // Ticket badge
      if (fraction > 0.08) {
        ctx.font = `bold 9px Inter, sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText(`🎟 ${p.tickets}`, 0, fontSize + 3);
      }

      ctx.restore();
    }

    startAngle = endAngle;
  });

  // Outer ring border
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Decorative tick marks at sector boundaries
  startAngle = rotRad - Math.PI / 2;
  list.forEach(p => {
    const fraction = p.tickets / totalTickets;
    const sweepAngle = fraction * Math.PI * 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(startAngle);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(R - 16, 0);
    ctx.lineTo(R, 0);
    ctx.stroke();
    ctx.restore();
    startAngle += sweepAngle;
  });
}

function drawWheelPlaceholder() {
  drawWheel([], 0);
}

// ─── Legend ───────────────────────────────────────────────
function renderLegend(list) {
  const container = document.getElementById('participantsLegend');
  if (!list || list.length === 0) {
    container.innerHTML = '<p style="color:var(--dim);font-size:.82rem;">Нет участников</p>';
    return;
  }
  const total = list.reduce((s, p) => s + p.tickets, 0);
  container.innerHTML = list.map(p => {
    const pct = ((p.tickets / total) * 100).toFixed(1);
    return `
      <div class="legend-item">
        <div class="legend-dot" style="background:${p.color}"></div>
        <span class="legend-name">${escHtml(p.name)}</span>
        <span class="legend-tickets">${p.tickets}🎟</span>
        <span class="legend-pct">${pct}%</span>
      </div>
    `;
  }).join('');
}

// ─── Spin Logic ───────────────────────────────────────────
window.spinWheel = function() {
  if (isSpinning) return;

  const phaseParticipants = getPhaseParticipants(currentPhase);
  if (!phaseParticipants.length) return;

  isSpinning = true;
  document.getElementById('spinBtn').disabled = true;
  canvas.classList.add('spinning');

  // Determine winner mathematically BEFORE animation
  const winner = pickWeightedWinner(phaseParticipants);

  // Compute the target angle so the wheel stops with the winner's sector
  // under the pointer (top = -90deg = 270deg from 0)
  const totalTickets = phaseParticipants.reduce((s, p) => s + p.tickets, 0);

  // Find winner sector start/end in [0, 360)
  let accAngle = 0;
  let winnerStart = 0;
  let winnerSweep = 0;
  for (const p of phaseParticipants) {
    const sweep = (p.tickets / totalTickets) * 360;
    if (p === winner) {
      winnerStart = accAngle;
      winnerSweep = sweep;
      break;
    }
    accAngle += sweep;
  }

  // Pick a random angle inside the winner's sector
  const targetInSector = winnerStart + winnerSweep * (0.15 + Math.random() * 0.7);

  // The pointer is at top (270 degrees in standard coords, or -90).
  // We need: (currentRotation + extraSpin) mod 360 points at targetInSector.
  // So extra = (270 - targetInSector - currentRotation) mod 360
  // Plus multiple full spins for dramatic effect
  const BASE_SPINS = 5 + Math.floor(Math.random() * 4); // 5-8 full spins
  let delta = ((270 - targetInSector - (currentRotation % 360)) % 360 + 360) % 360;
  const totalDelta = BASE_SPINS * 360 + delta;

  animateSpin(totalDelta, winner, phaseParticipants);
};

function pickWeightedWinner(list) {
  const total = list.reduce((s, p) => s + p.tickets, 0);
  let rand = Math.random() * total;
  for (const p of list) {
    rand -= p.tickets;
    if (rand <= 0) return p;
  }
  return list[list.length - 1];
}

function animateSpin(totalDelta, winner, phaseParticipants) {
  const DURATION = 7000; // 7 seconds — heavy, dramatic
  const startTime = performance.now();
  const startRotation = currentRotation;

  // cubic-bezier: fast start, very slow end (easeOutExpo feel)
  function easeOut(t) {
    return 1 - Math.pow(1 - t, 4); // quartic ease-out
  }

  function frame(now) {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / DURATION, 1);
    const easedT = easeOut(t);

    currentRotation = startRotation + totalDelta * easedT;

    // Redraw
    drawWheel(phaseParticipants, currentRotation);

    // Pointer wobble near end
    if (t > 0.85) {
      const wobble = Math.sin(elapsed * 0.08) * (1 - t) * 6;
      document.querySelector('.wheel-pointer').style.transform = `translateX(-50%) rotate(${wobble}deg)`;
    }

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      // Done
      currentRotation = startRotation + totalDelta;
      drawWheel(phaseParticipants, currentRotation);
      document.querySelector('.wheel-pointer').style.transform = 'translateX(-50%)';
      canvas.classList.remove('spinning');
      isSpinning = false;

      onSpinComplete(winner);
    }
  }

  requestAnimationFrame(frame);
}

function onSpinComplete(winner) {
  // Store result
  if (currentPhase === 'grandFinal1') results.winner1 = winner;
  else if (currentPhase === 'grandFinal2') results.winner2 = winner;
  else results.winner3 = winner;

  // Show result banner
  const resEl = document.getElementById('currentResult');
  resEl.textContent = '🏆 Победитель: ' + winner.name;
  resEl.style.display = 'block';

  // Update summary
  updateResultsSummary();

  // Mark tab done
  const tabMap = { grandFinal1: 'tabGF', grandFinal2: 'tabGF2', basicLeague: 'tabBL' };
  const tab = document.getElementById(tabMap[currentPhase]);
  if (tab) { tab.classList.remove('active'); tab.classList.add('done'); }

  // Show winner modal with confetti
  setTimeout(() => showWinnerModal(winner), 300);
}

// ─── Winner Modal ─────────────────────────────────────────
function showWinnerModal(winner) {
  const placeLabels = {
    grandFinal1: '🥇 1-е место — Гранд-Финал',
    grandFinal2: '🥈 2-е место — Гранд-Финал',
    basicLeague: '🥉 3-е место — Базовая Лига'
  };

  document.getElementById('winnerPlaceLabel').textContent = placeLabels[currentPhase];
  document.getElementById('winnerNameDisplay').textContent = winner.name;

  const totalTickets = getPhaseParticipants(currentPhase).reduce((s, p) => s + p.tickets, 0) + winner.tickets;
  const pct = ((winner.tickets / (totalTickets)) * 100).toFixed(1);
  document.getElementById('winnerTicketsInfo').textContent = `${winner.tickets} билет(ов) · шанс был ${pct}%`;

  const modal = document.getElementById('winnerModal');
  modal.style.display = 'flex';

  // Confetti burst
  launchConfetti();
}

window.closeWinnerModal = function() {
  document.getElementById('winnerModal').style.display = 'none';
  document.getElementById('spinBtn').disabled = true;
  document.getElementById('spinBtn').textContent = '✅ Уже разыгран';
};

function launchConfetti() {
  if (typeof confetti === 'undefined') return;

  const colors = ['#ffd700', '#ff0050', '#00d9ff', '#a855f7', '#ffffff'];

  // Big burst
  confetti({
    particleCount: 120,
    spread: 80,
    origin: { y: 0.5 },
    colors,
    startVelocity: 45,
    gravity: 0.8,
    scalar: 1.2
  });

  // Side cannons
  setTimeout(() => {
    confetti({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0, y: 0.6 }, colors });
    confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1, y: 0.6 }, colors });
  }, 250);

  // Slow fall
  setTimeout(() => {
    confetti({ particleCount: 40, spread: 100, origin: { y: 0.2 }, gravity: 0.4, scalar: 0.8, colors });
  }, 600);
}

// ─── Results Summary ──────────────────────────────────────
function updateResultsSummary() {
  const summary = document.getElementById('resultsSummary');
  const hasAny = results.winner1 || results.winner2 || results.winner3;
  summary.style.display = hasAny ? 'flex' : 'none';

  if (results.winner1) {
    document.getElementById('res1').style.display = 'flex';
    document.getElementById('winner1Name').textContent = results.winner1.name;
  }
  if (results.winner2) {
    document.getElementById('res2').style.display = 'flex';
    document.getElementById('winner2Name').textContent = results.winner2.name;
  }
  if (results.winner3) {
    document.getElementById('res3').style.display = 'flex';
    document.getElementById('winner3Name').textContent = results.winner3.name;
  }

  const allDone = results.winner1 && results.winner2 && results.winner3;
  document.getElementById('saveBtn').style.display = allDone ? 'block' : 'none';
}

// ─── Save Step ────────────────────────────────────────────
window.proceedToSave = function() {
  if (!results.winner1 || !results.winner2 || !results.winner3) {
    alert('Завершите все три розыгрыша!');
    return;
  }

  showStep('stepSave');

  const title = document.getElementById('weekTitle').value || 'Розыгрыш';
  document.getElementById('saveTitlePreview').textContent = title;
  document.getElementById('saveWinner1').textContent = results.winner1.name;
  document.getElementById('saveWinner2').textContent = results.winner2.name;
  document.getElementById('saveWinner3').textContent = results.winner3.name;

  generateSlug();
};

window.generateSlug = function() {
  const title = document.getElementById('weekTitle').value || 'draw';
  const slug = slugify(title) + '-' + Date.now().toString(36);
  document.getElementById('slugInput').value = slug;
  document.getElementById('slugPreview').textContent = '/lottery-results/' + slug;
};

function slugify(str) {
  const map = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z',
    'и':'i','й':'j','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r',
    'с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch',
    'ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'
  };
  return str.toLowerCase()
    .split('')
    .map(c => map[c] || c)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

window.saveResults = async function() {
  const slug = document.getElementById('slugInput').value.trim();
  if (!slug) { alert('Введите slug!'); return; }

  const title = document.getElementById('weekTitle').value || 'Розыгрыш';

  const btn = document.getElementById('finalSaveBtn');
  const statusEl = document.getElementById('saveStatus');

  btn.disabled = true;
  btn.textContent = '⏳ Сохраняем...';
  statusEl.className = 'save-status loading';
  statusEl.textContent = '⏳ Отправляем данные в базу...';
  statusEl.style.display = 'block';

  try {
    const { error } = await supabase.from('lottery_draws').insert({
      week_title: title,
      grand_final_winner_1: results.winner1.name,
      grand_final_winner_2: results.winner2.name,
      basic_league_winner: results.winner3.name,
      participants_data: {
        grandFinal: participants.grandFinal.map(p => ({ name: p.name, tickets: p.tickets })),
        basicLeague: participants.basicLeague.map(p => ({ name: p.name, tickets: p.tickets }))
      },
      slug
    });

    if (error) throw error;

    statusEl.className = 'save-status success';
    statusEl.textContent = '✅ Розыгрыш успешно сохранён!';
    btn.textContent = '✅ Сохранено';

    // Show share link
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/lottery-results.html?slug=${encodeURIComponent(slug)}`;
    document.getElementById('savedLink').href = link;
    document.getElementById('savedLinkBlock').style.display = 'flex';

    // Confetti
    launchConfetti();

  } catch (err) {
    statusEl.className = 'save-status error';
    statusEl.textContent = '❌ Ошибка: ' + (err.message || 'Не удалось сохранить');
    btn.disabled = false;
    btn.textContent = '💾 Попробовать снова';
  }
};

// ─── Utilities ────────────────────────────────────────────
function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
