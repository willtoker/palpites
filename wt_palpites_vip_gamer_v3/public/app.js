
const state = { token: localStorage.getItem('palpite_token') || '', user: null, config: null, lotteries: [], week: [], selectedSlug: 'megasena', generated: [], saved: [], adminCodes: [] };
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

async function api(url, options={}){
  const headers = {'Content-Type':'application/json', ...(options.headers||{})};
  if(state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(url, {...options, headers});
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || 'Erro na requisição.');
  return data;
}
function toast(msg, ok=true){
  const el = $('#toast');
  el.textContent = msg;
  el.style.borderColor = ok ? 'rgba(34,197,94,.45)' : 'rgba(239,68,68,.45)';
  el.classList.add('show');
  clearTimeout(el._t); el._t = setTimeout(()=>el.classList.remove('show'), 2600);
}
function setToken(token){ state.token = token || ''; token ? localStorage.setItem('palpite_token', token) : localStorage.removeItem('palpite_token'); }
function money(v){
  if(v == null || v === '') return '-';
  if(typeof v === 'number') return new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(v);
  const s = String(v); if(s.startsWith('R$')) return s;
  const n = Number(s.replace(/[^\d.,-]/g,'').replace(/\./g,'').replace(',', '.'));
  return Number.isNaN(n) ? s : new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(n);
}
function fmtDate(v){
  if(!v) return '-';
  if(/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return v;
  const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('pt-BR');
}
function currentGame(){ return state.lotteries.find(x=>x.slug===state.selectedSlug) || null; }
function gameColor(slug){ return (state.lotteries.find(x=>x.slug===slug)?.color) || '#22c55e'; }
function ballStyle(slug){ const c = gameColor(slug); return `style="--ballColor:${c};background:radial-gradient(circle at 30% 25%, rgba(255,255,255,.95), ${c} 42%, color-mix(in srgb, ${c} 62%, #000 38%) 100%);box-shadow:0 10px 22px color-mix(in srgb, ${c} 58%, rgba(0,0,0,.85) 42%), inset 0 3px 8px rgba(255,255,255,.35), inset 0 -10px 18px rgba(0,0,0,.28);"`; }
async function playLoginSplash(){ const splash = $('#loginSplash'); if(!splash) return; splash.classList.remove('hidden'); splash.classList.add('show'); await new Promise(r=>setTimeout(r, 5000)); splash.classList.remove('show'); splash.classList.add('hidden'); }
function applyConfig(){
  if(!state.config) return;
  $('#heroBadge').textContent = state.config.heroBadge || 'WEB APP PREMIUM';
  $('#brandTitle').textContent = state.config.brandName || 'WT Palpites Vip';
  $('#sideBrand').textContent = state.config.brandName || 'WT Palpites Vip';
  $('#brandSubtitle').textContent = state.config.subtitle || '';
  $('#accentText').textContent = state.config.accentText || '';
  $('#buyWhats').href = state.config.whatsappLink || '#';
  $('#buyTg').href = state.config.telegramLink || '#';
  $('#insideWhats').href = state.config.whatsappLink || '#';
  $('#insideTg').href = state.config.telegramLink || '#';
  $('#cfgBrandName').value = state.config.brandName || '';
  $('#cfgSubtitle').value = state.config.subtitle || '';
  $('#cfgAccentText').value = state.config.accentText || '';
  $('#cfgWhats').value = state.config.whatsappLink || '';
  $('#cfgTg').value = state.config.telegramLink || '';
}
function renderUser(){
  if(!state.user) return;
  $('#userName').textContent = state.user.name || 'Usuário';
  $('#userEmail').textContent = state.user.email || '';
  $('#userBadge').textContent = state.user.role === 'admin' ? 'Administrador' : (state.user.active ? 'VIP liberado' : 'VIP pendente');
  $('#activationBanner').classList.toggle('hidden', state.user.active || state.user.role === 'admin');
  $('#buyInsideCard').classList.toggle('hidden', state.user.active || state.user.role === 'admin');
  $('.admin-only').classList.toggle('hidden', state.user.role !== 'admin');
}
function showLanding(){ $('#landing').classList.add('active'); $('#dashboard').classList.remove('active'); }
function showDash(){ $('#landing').classList.remove('active'); $('#dashboard').classList.add('active'); }
function switchScreen(id){
  $$('.screen').forEach(x=>x.classList.remove('active'));
  $$('.nav-btn').forEach(x=>x.classList.remove('active'));
  $('#'+id).classList.add('active');
  document.querySelector(`.nav-btn[data-screen="${id}"]`)?.classList.add('active');
}
function resultNums(game){
  if(game.slug === 'federal') return '<div class="meta"><span>Bilhetes e extrações da Federal.</span></div>';
  if(game.slug === 'loteca') return '<div class="meta"><span>Programação e resultados da Loteca.</span></div>';
  let html = `<div class="ball-row">${(game.numbers||[]).map(n=>`<span class="ball" ${ballStyle(game.slug)}>${n}</span>`).join('')}</div>`;
  if(game.special?.secondDraw) html += `<div class="meta"><span>2º sorteio: ${game.special.secondDraw.join(' - ')}</span></div>`;
  if(game.special?.trevos) html += `<div class="meta"><span>Trevos: ${game.special.trevos.join(' • ')}</span></div>`;
  if(game.special?.month) html += `<div class="meta"><span>Mês da sorte: ${game.special.month}</span></div>`;
  if(game.special?.time) html += `<div class="meta"><span>Time: ${game.special.time}</span></div>`;
  return html;
}
function renderGames(){
  $('#gamesBar').innerHTML = state.lotteries.map(g => `
    <button class="game-chip ${state.selectedSlug===g.slug?'active':''}" data-slug="${g.slug}" style="--chipColor:${g.color};background:linear-gradient(145deg, color-mix(in srgb, ${g.color} 86%, #ffffff 14%), color-mix(in srgb, ${g.color} 40%, #07111f 60%))">
      <span>${g.name}</span><small>${fmtDate(g.nextContestDate || g.contestDate)}</small>
    </button>
  `).join('');
  $$('.game-chip').forEach(btn => btn.onclick = ()=>{ state.selectedSlug = btn.dataset.slug; state.generated = []; renderGames(); renderSelected(); renderResults(); });
}

function renderGeneratedCard(item){
  const slug = state.selectedSlug;
  if(item.tickets) return `<div class="bet-card"><h4>${item.label}</h4><div class="ball-row">${item.tickets.map(t=>`<span class="ball ball-ticket" ${ballStyle(slug)}>${t}</span>`).join('')}</div></div>`;
  if(item.matches) return `<div class="bet-card"><h4>${item.label}</h4><div class="ball-row wide-tags">${item.matches.map(m=>`<span class="ball ball-tag" ${ballStyle(slug)}>${m.jogo}:${m.palpite}</span>`).join('')}</div></div>`;
  if(item.columns) return `<div class="bet-card"><h4>${item.label}</h4><div class="ball-row">${item.columns.map(n=>`<span class="ball" ${ballStyle(slug)}>${n}</span>`).join('')}</div></div>`;
  let extra = '';
  if(item.secondDraw) extra += `<div class="meta"><span>2º jogo: ${item.secondDraw.join(' - ')}</span></div>`;
  if(item.trevos) extra += `<div class="meta"><span>Trevos: ${item.trevos.join(' • ')}</span></div>`;
  if(item.mesDaSorte) extra += `<div class="meta"><span>Mês da sorte: ${item.mesDaSorte}</span></div>`;
  if(item.timeDoCoracao) extra += `<div class="meta"><span>Time do coração: ${item.timeDoCoracao}</span></div>`;
  return `<div class="bet-card"><h4>${item.label}</h4><div class="ball-row">${item.numbers.map(n=>`<span class="ball" ${ballStyle(slug)}>${n}</span>`).join('')}</div>${extra}</div>`;
}
function renderSelected(){
  const game = state.lotteries.find(x=>x.slug===state.selectedSlug);
  if(!game) return;
  $('#selectedGameName').textContent = game.name;
  $('#selectedGameHint').textContent = `Próximo concurso: ${fmtDate(game.nextContestDate || game.contestDate)}`;
  const area = $('#generatedArea');
  area.classList.toggle('empty', !state.generated.length);
  area.style.setProperty('--panelColor', game.color);
  area.innerHTML = state.generated.length ? state.generated.map(renderGeneratedCard).join('') : 'Gere seus palpites para começar.';
}
function renderResults(){
  const ordered = [...state.lotteries].sort((a,b)=> (a.slug===state.selectedSlug?-1:b.slug===state.selectedSlug?1:0));
  $('#resultsList').innerHTML = ordered.map(g => `
    <div class="result-card">
      <h4 style="color:${g.color};margin:0 0 10px">${g.name}</h4>
      ${resultNums(g)}
      <div class="meta"><span>Concurso: ${g.contest || '-'}</span><span>Último: ${fmtDate(g.contestDate)}</span><span>Próximo: ${fmtDate(g.nextContestDate)}</span></div>
      <div class="meta"><span>Prêmio estimado: ${money(g.nextPrize)}</span>${g.stale ? '<span>cache</span>' : ''}</div>
    </div>
  `).join('');
}
function renderWeek(){
  $('#weekList').innerHTML = state.week.length ? state.week.map(g => `
    <div class="week-card">
      <h4 style="color:${g.color};margin:0 0 10px">${g.name}</h4>
      <div class="meta"><span>Próximo concurso: ${fmtDate(g.nextContestDate)}</span><span>Concurso atual: ${g.contest || '-'}</span></div>
      <div class="meta"><span>Prêmio estimado: ${money(g.nextPrize)}</span></div>
    </div>
  `).join('') : `<div class="week-card"><div class="meta"><span>Nada encontrado para esta semana no momento.</span></div></div>`;
}
function renderSaved(){
  $('#savedList').innerHTML = state.saved.length ? state.saved.map(item => `
    <div class="saved-card">
      <div class="saved-head">
        <div>
          <h4>${item.title}</h4>
          <div class="meta"><span>${item.slug}</span><span>${fmtDate(item.createdAt)}</span></div>
        </div>
        <button class="btn ghost" data-del-save="${item.id}">Excluir</button>
      </div>
      ${item.payload.map(renderGeneratedCard).join('')}
    </div>
  `).join('') : `<div class="saved-card"><div class="meta"><span>Nenhum palpite salvo ainda.</span></div></div>`;
  $$('[data-del-save]').forEach(btn => btn.onclick = async ()=>{ try{ await api('/api/saved-bets/'+btn.dataset.delSave, {method:'DELETE'}); await loadSaved(); toast('Palpite removido.'); }catch(err){ toast(err.message, false);} });
}
function renderAdminStats(s){
  $('#adminStats').innerHTML = `<div><strong>${s.users}</strong><small>usuários</small></div><div><strong>${s.activeUsers}</strong><small>VIP ativos</small></div><div><strong>${s.pendingUsers}</strong><small>pendentes</small></div><div><strong>${s.usedCodes}</strong><small>códigos usados</small></div>`;
}
function renderAdminCodes(){
  $('#adminCodesList').innerHTML = state.adminCodes.length ? state.adminCodes.map(c => `
    <div class="code-row">
      <div class="code-pill">${c.code}</div>
      <div>${c.usedByEmail || 'Livre'}</div>
      <div>${c.expiresAt ? 'Expira: '+fmtDate(c.expiresAt) : 'Sem prazo'}</div>
      <button class="btn ghost" data-del-code="${c.id}">Excluir</button>
    </div>
  `).join('') : `<div class="code-row"><div>Nenhum código criado.</div></div>`;
  $$('[data-del-code]').forEach(btn => btn.onclick = async ()=>{ try{ await api('/api/admin/codes/'+btn.dataset.delCode, {method:'DELETE'}); await loadAdmin(); toast('Código excluído.'); }catch(err){ toast(err.message, false);} });
}
async function loadConfig(){ state.config = await api('/api/public-config'); applyConfig(); }
async function loadMe(){
  if(!state.token) return false;
  try { const data = await api('/api/me'); state.user = data.user; return true; }
  catch { setToken(''); state.user = null; return false; }
}
async function loadLotteries(){
  const data = await api('/api/lotteries');
  state.lotteries = data.results || []; state.week = data.week || [];
  $('#lastSync').textContent = 'Atualizado: ' + (data.updatedAt ? new Date(data.updatedAt).toLocaleString('pt-BR') : '-');
  if(!state.lotteries.find(g=>g.slug===state.selectedSlug) && state.lotteries[0]) state.selectedSlug = state.lotteries[0].slug;
  renderGames(); renderSelected(); renderResults(); renderWeek();
}
async function loadSaved(){ if(!state.user) return; state.saved = await api('/api/saved-bets'); renderSaved(); }
async function loadAdmin(){ if(!state.user || state.user.role !== 'admin') return; const [stats, codes] = await Promise.all([api('/api/admin/stats'), api('/api/admin/codes')]); renderAdminStats(stats); state.adminCodes = codes; renderAdminCodes(); }
async function afterLogin(){ await playLoginSplash(); showDash(); renderUser(); await loadLotteries(); await loadSaved(); if(state.user.role === 'admin') await loadAdmin(); }
function logout(){ setToken(''); state.user = null; state.generated = []; showLanding(); toast('Você saiu.'); }

function bind(){
  $$('.tab').forEach(btn => btn.onclick = ()=>{ $$('.tab').forEach(x=>x.classList.remove('active')); $$('.panel').forEach(x=>x.classList.remove('active')); btn.classList.add('active'); $('#'+btn.dataset.target).classList.add('active'); });
  $$('.nav-btn').forEach(btn => btn.onclick = ()=>switchScreen(btn.dataset.screen));
  $('#logoutBtn').onclick = logout;

  $('#loginPanel').onsubmit = async e => {
    e.preventDefault();
    try{
      const data = await api('/api/auth/login', {method:'POST', body:JSON.stringify({email:$('#loginEmail').value.trim(), password:$('#loginPassword').value})});
      setToken(data.token); state.user = data.user; await afterLogin(); toast(data.message || 'Bem-vindo.');
    }catch(err){ toast(err.message, false); }
  };
  $('#registerPanel').onsubmit = async e => {
    e.preventDefault();
    try{
      const data = await api('/api/auth/register', {method:'POST', body:JSON.stringify({name:$('#registerName').value.trim(), email:$('#registerEmail').value.trim(), password:$('#registerPassword').value})});
      setToken(data.token); state.user = data.user; await afterLogin(); toast('Conta criada. Agora ative com o código VIP.');
    }catch(err){ toast(err.message, false); }
  };
  $('#activateBtn').onclick = async ()=>{
    try{
      const data = await api('/api/auth/activate', {method:'POST', body:JSON.stringify({code:$('#activateCode').value.trim()})});
      setToken(data.token); state.user = data.user; renderUser(); toast('VIP liberado.');
    }catch(err){ toast(err.message, false); }
  };
  $('#generateBtn').onclick = async ()=>{
    try{
      const data = await api(`/api/lotteries/${state.selectedSlug}/generate`, {method:'POST', body:JSON.stringify({amount:5})});
      state.generated = data.suggestions || []; renderSelected(); switchScreen('homeScreen'); toast('5 palpites gerados.');
    }catch(err){ toast(err.message, false); }
  };
  $('#copyBtn').onclick = async ()=>{
    if(!state.generated.length) return toast('Gere os palpites primeiro.', false);
    const text = state.generated.map(item => {
      if(item.numbers) return `${item.label}: ${item.numbers.join(' - ')}${item.secondDraw ? ' | 2º: '+item.secondDraw.join(' - ') : ''}${item.trevos ? ' | Trevos: '+item.trevos.join(' - ') : ''}${item.mesDaSorte ? ' | Mês: '+item.mesDaSorte : ''}${item.timeDoCoracao ? ' | Time: '+item.timeDoCoracao : ''}`;
      if(item.columns) return `${item.label}: ${item.columns.join(' - ')}`;
      if(item.tickets) return `${item.label}: ${item.tickets.join(' - ')}`;
      if(item.matches) return `${item.label}: ${item.matches.map(m=>`${m.jogo}:${m.palpite}`).join(' | ')}`;
      return item.label;
    }).join('\n');
    await navigator.clipboard.writeText(text); toast('Palpites copiados.');
  };
  $('#saveBtn').onclick = async ()=>{
    if(!state.generated.length) return toast('Gere os palpites primeiro.', false);
    try{
      await api('/api/saved-bets', {method:'POST', body:JSON.stringify({slug:state.selectedSlug, title:`Palpites ${state.lotteries.find(g=>g.slug===state.selectedSlug)?.name || state.selectedSlug}`, payload:state.generated})});
      await loadSaved(); toast('Palpites salvos na sua conta.');
    }catch(err){ toast(err.message, false); }
  };

  $('#createCodesForm').onsubmit = async e => {
    e.preventDefault();
    try{
      const data = await api('/api/admin/codes', {method:'POST', body:JSON.stringify({prefix:$('#codePrefix').value.trim(), quantity:Number($('#codeQuantity').value), expiresInDays:Number($('#codeExpire').value)})});
      $('#newCodesOutput').value = data.map(x=>x.code).join('\n'); await loadAdmin(); toast('Códigos gerados.');
    }catch(err){ toast(err.message, false); }
  };
  $('#configForm').onsubmit = async e => {
    e.preventDefault();
    try{
      state.config = await api('/api/admin/config', {method:'PUT', body:JSON.stringify({brandName:$('#cfgBrandName').value.trim(), subtitle:$('#cfgSubtitle').value.trim(), accentText:$('#cfgAccentText').value.trim(), whatsappLink:$('#cfgWhats').value.trim(), telegramLink:$('#cfgTg').value.trim()})});
      applyConfig(); toast('Configuração salva.');
    }catch(err){ toast(err.message, false); }
  };
  $('#refreshResultsBtn').onclick = async ()=>{
    try{ await api('/api/admin/refresh-results', {method:'POST'}); await loadLotteries(); toast('Resultados atualizados.'); }
    catch(err){ toast(err.message, false); }
  };
}
async function init(){
  bind(); await loadConfig();
  if(await loadMe()) await afterLogin(); else showLanding();
}
init();
