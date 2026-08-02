import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseKey } from './config.js';

const supabase = createClient(supabaseUrl, supabaseKey);

const PALETTE = [
  '#ff0050','#ff6b35','#ffd700','#00d9ff','#a855f7',
  '#22c55e','#f97316','#06b6d4','#ec4899','#84cc16',
  '#8b5cf6','#14b8a6','#f59e0b','#3b82f6','#ef4444',
  '#10b981','#6366f1','#f43f5e','#0ea5e9','#d946ef'
];

// ─── Boot ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const slug = getSlug();
  if (!slug) { showError(); return; }

  try {
    const draw = await fetchDraw(slug);
    if (!draw) { showError(); return; }
    renderResults(draw);
  } catch (e) {
    console.error(e);
    showError();
  }
});

// ─── URL helper ────────────────────────────────────────────
function getSlug() {
  const params = new URLSearchParams(window.location.search);
  return params.get('slug') || window.location.hash.replace('#', '') || null;
}

// ─── Supabase ──────────────────────────────────────────────
async function fetchDraw(slug) {
  const { data, error } = await supabase
    .from('lottery_draws')
    .select('*')
    .eq('slug', slug)
    .single();
  if (error || !data) return null;
  return data;
}

// ─── Render ────────────────────────────────────────────────
function renderResults(draw) {
  document.title = `${draw.week_title} — LSFM Лотерея`;

  // Hero
  document.getElementById('drawTitle').textContent = draw.week_title;
  const date = new Date(draw.created_at);
  document.getElementById('drawDate').textContent =
    'Дата розыгрыша: ' + date.toLocaleDateString('ru-RU', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

  // Podium winners
  document.getElementById('winner1').textContent = draw.grand_final_winner_1 || '—';
  document.getElementById('winner2').textContent = draw.grand_final_winner_2 || '—';
  document.getElementById('winner3').textContent = draw.basic_league_winner || '—';

  const pd = draw.participants_data || {};

  // Grand Final participants
  const gfList = pd.grandFinal || [];
  const gfTotal = gfList.reduce((s, p) => s + (p.tickets || 1), 0);
  const gfContainer = document.getElementById('gfParticipants');

  if (gfList.length === 0) {
    gfContainer.innerHTML = '<p style="color:var(--muted);font-size:.85rem;">Нет данных</p>';
  } else {
    gfContainer.innerHTML = gfList.map((p, i) => {
      const color = PALETTE[i % PALETTE.length];
      const pct = gfTotal > 0 ? ((p.tickets / gfTotal) * 100).toFixed(1) : '0';
      const isW1 = p.name === draw.grand_final_winner_1;
      const isW2 = p.name === draw.grand_final_winner_2;
      const winTag = isW1
        ? '<span class="ld-winner-tag winner-tag-gold">🥇 1-е</span>'
        : isW2
          ? '<span class="ld-winner-tag winner-tag-silver">🥈 2-е</span>'
          : '';
      return `
        <div class="ld-item ${isW1 || isW2 ? 'winner-row' : ''}">
          <div class="ld-dot" style="background:${color}"></div>
          <span class="ld-name">${escHtml(p.name)}</span>
          <span class="ld-tickets">${p.tickets || 1}🎟</span>
          <span style="color:var(--muted);font-size:.75rem;">${pct}%</span>
          ${winTag}
        </div>`;
    }).join('');
  }

  // Basic League participants
  const blList = pd.basicLeague || [];
  const blTotal = blList.reduce((s, p) => s + (p.tickets || 1), 0);
  const blContainer = document.getElementById('blParticipants');

  if (blList.length === 0) {
    blContainer.innerHTML = '<p style="color:var(--muted);font-size:.85rem;">Нет данных</p>';
  } else {
    blContainer.innerHTML = blList.map((p, i) => {
      const color = PALETTE[i % PALETTE.length];
      const pct = blTotal > 0 ? ((p.tickets / blTotal) * 100).toFixed(1) : '0';
      const isW = p.name === draw.basic_league_winner;
      const winTag = isW ? '<span class="ld-winner-tag winner-tag-bronze">🥉 3-е</span>' : '';
      return `
        <div class="ld-item ${isW ? 'winner-row' : ''}">
          <div class="ld-dot" style="background:${color}"></div>
          <span class="ld-name">${escHtml(p.name)}</span>
          <span class="ld-tickets">${p.tickets || 1}🎟</span>
          <span style="color:var(--muted);font-size:.75rem;">${pct}%</span>
          ${winTag}
        </div>`;
    }).join('');
  }

  // Update meta description
  const desc = `Результаты розыгрыша LSFM: ${draw.week_title}. 🥇 ${draw.grand_final_winner_1}, 🥈 ${draw.grand_final_winner_2}, 🥉 ${draw.basic_league_winner}`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', desc);

  // Show
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('resultsContent').style.display = 'block';
}

function showError() {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('errorState').style.display = 'flex';
}

// ─── Copy link ─────────────────────────────────────────────
window.copyLink = function() {
  const url = window.location.href;
  const btn = document.getElementById('copyBtn');

  navigator.clipboard.writeText(url).then(() => {
    btn.textContent = '✅ Скопировано!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Копировать ссылку'; btn.classList.remove('copied'); }, 2500);
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    btn.textContent = '✅ Скопировано!';
    setTimeout(() => { btn.textContent = 'Копировать ссылку'; }, 2500);
  });
};

// ─── Utils ─────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
