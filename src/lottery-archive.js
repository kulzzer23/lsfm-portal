import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseKey } from './config.js';

const supabase = createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const { data, error } = await supabase
      .from('lottery_draws')
      .select('id, week_title, grand_final_winner_1, grand_final_winner_2, basic_league_winner, participants_data, slug, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      show('emptyState');
      return;
    }

    renderArchive(data);
    show('archiveContent');
  } catch (e) {
    console.error(e);
    show('errorState');
  }
});

function show(id) {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById(id).style.display = id === 'archiveContent' ? 'block' : 'flex';
}

function renderArchive(draws) {
  const countEl = document.getElementById('drawCount');
  countEl.textContent = `Всего розыгрышей: ${draws.length}`;

  const grid = document.getElementById('drawsList');
  grid.innerHTML = draws.map(draw => {
    const date = new Date(draw.created_at);
    const dateStr = date.toLocaleDateString('ru-RU', {
      day: '2-digit', month: 'long', year: 'numeric'
    });

    const pd = draw.participants_data || {};
    const gfCount = (pd.grandFinal || []).length;
    const blCount = (pd.basicLeague || []).length;
    const totalCount = gfCount + blCount;
    const countStr = totalCount > 0 ? `${totalCount} участник${pluralRu(totalCount)}` : '';

    const link = `https://kulzzer23.github.io/lsfm-portal/lottery-results.html?slug=${encodeURIComponent(draw.slug)}`;

    return `
      <a href="${link}" class="draw-card">
        <div class="card-top">
          <div class="card-week">${escHtml(draw.week_title)}</div>
          <div class="card-date">📅 ${dateStr}</div>
        </div>
        <div class="card-winners">
          <div class="winner-row">
            <span class="place-badge">🥇</span>
            <span class="winner-label label-gold">1-е место</span>
            <span class="winner-name">${escHtml(draw.grand_final_winner_1 || '—')}</span>
          </div>
          <div class="winner-row">
            <span class="place-badge">🥈</span>
            <span class="winner-label label-silver">2-е место</span>
            <span class="winner-name">${escHtml(draw.grand_final_winner_2 || '—')}</span>
          </div>
          <div class="winner-row">
            <span class="place-badge">🥉</span>
            <span class="winner-label label-bronze">3-е место</span>
            <span class="winner-name">${escHtml(draw.basic_league_winner || '—')}</span>
          </div>
        </div>
        <div class="card-footer">
          <span class="card-view-link">Смотреть результаты →</span>
          ${countStr ? `<span class="card-participants-count">👥 ${countStr}</span>` : ''}
        </div>
      </a>
    `;
  }).join('');
}

function pluralRu(n) {
  const abs = Math.abs(n) % 100;
  const mod10 = abs % 10;
  if (abs > 10 && abs < 20) return 'ов';
  if (mod10 === 1) return '';
  if (mod10 >= 2 && mod10 <= 4) return 'а';
  return 'ов';
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
