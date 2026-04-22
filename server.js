
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const CACHE_FILE = path.join(DATA_DIR, 'cache.json');
const PUBLIC_DIR = path.join(ROOT, 'public');

const GAMES = {
  maismilionaria: { name: '+Milionária', color: '#7c3aed', picks: 6, max: 50, extra: 'trevos' },
  megasena: { name: 'Mega-Sena', color: '#00c853', picks: 6, max: 60 },
  lotofacil: { name: 'Lotofácil', color: '#a855f7', picks: 15, max: 25 },
  quina: { name: 'Quina', color: '#2563eb', picks: 5, max: 80 },
  lotomania: { name: 'Lotomania', color: '#ff9800', picks: 50, max: 100 },
  timemania: { name: 'Timemania', color: '#00bcd4', picks: 10, max: 80, extra: 'time' },
  duplasena: { name: 'Dupla Sena', color: '#ef4444', picks: 6, max: 50, extra: 'duplo' },
  federal: { name: 'Federal', color: '#f59e0b', special: 'federal' },
  loteca: { name: 'Loteca', color: '#22c55e', special: 'loteca' },
  diadesorte: { name: 'Dia de Sorte', color: '#fb7185', picks: 7, max: 31, extra: 'mes' },
  supersete: { name: 'Super Sete', color: '#8b5cf6', special: 'supersete' }
};

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const TEAMS = ['Corinthians','Palmeiras','São Paulo','Santos','Flamengo','Vasco','Botafogo','Fluminense','Cruzeiro','Atlético-MG','Grêmio','Internacional','Bahia','Fortaleza','Ceará','Sport'];

function readJson(file){ return JSON.parse(fs.readFileSync(file, 'utf-8')); }
function writeJson(file, data){ fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8'); }
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')){
  return { salt, hash: crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex') };
}
function ensureFiles(){
  if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, {recursive:true});
  if(!fs.existsSync(DB_FILE)){
    const hp = hashPassword('admin123');
    writeJson(DB_FILE, {
      config: {
        brandName: 'Palpite VIP 3D',
        subtitle: 'Gerador de palpites premium para vender acesso online',
        whatsappLink: 'https://wa.me/5511999999999',
        telegramLink: 'https://t.me/seu_link',
        accentText: 'Escolha o jogo, gere 5 palpites e venda acesso VIP.',
        heroBadge: 'WEB APP PREMIUM'
      },
      users: [{
        id: crypto.randomUUID(), name: 'Administrador', email: 'admin@palpitevip.com',
        passwordHash: hp.hash, passwordSalt: hp.salt, role: 'admin', active: true,
        createdAt: new Date().toISOString(), activatedAt: new Date().toISOString()
      }],
      accessCodes: [], savedBets: [], sessions: []
    });
  }
  if(!fs.existsSync(CACHE_FILE)) writeJson(CACHE_FILE, {updatedAt:null, results:{}});
}
ensureFiles();

function db(){ return readJson(DB_FILE); }
function saveDb(data){ writeJson(DB_FILE, data); }
function cache(){ return readJson(CACHE_FILE); }
function saveCache(data){ writeJson(CACHE_FILE, data); }
function send(res, status, data, type='application/json; charset=utf-8'){
  const body = typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': type,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  });
  res.end(body);
}
function parseBody(req){
  return new Promise((resolve, reject)=>{
    let raw = '';
    req.on('data', c=> raw += c.toString('utf-8'));
    req.on('end', ()=>{
      if(!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new Error('JSON inválido.')); }
    });
  });
}
function cleanEmail(email){ return String(email||'').trim().toLowerCase(); }
function publicUser(user){ return {id:user.id, name:user.name, email:user.email, role:user.role, active:user.active, createdAt:user.createdAt, activatedAt:user.activatedAt||null}; }
function verifyPassword(password, salt, hash){ return hashPassword(password, salt).hash === hash; }
function createSession(user){
  const data = db();
  const token = crypto.randomBytes(32).toString('hex');
  data.sessions.push({token, userId:user.id, expiresAt:new Date(Date.now()+15*24*60*60*1000).toISOString()});
  saveDb(data);
  return token;
}
function currentUser(req){
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if(!token) return null;
  const data = db();
  const s = data.sessions.find(x => x.token === token && new Date(x.expiresAt) > new Date());
  if(!s) return null;
  return data.users.find(u => u.id === s.userId) || null;
}
function requireAuth(req, res){
  const user = currentUser(req);
  if(!user){ send(res, 401, {error:'Faça login.'}); return null; }
  return user;
}
function requireAdmin(req, res){
  const user = requireAuth(req, res);
  if(!user) return null;
  if(user.role !== 'admin'){ send(res, 403, {error:'Área restrita ao ADM.'}); return null; }
  return user;
}
function randomCode(length=8){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for(let i=0;i<length;i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}
function uniqueNumbers(count, max){
  const s = new Set();
  while(s.size < count) s.add(Math.floor(Math.random()*max)+1);
  return [...s].sort((a,b)=>a-b).map(n=>String(n).padStart(2,'0'));
}
function generatePicks(slug, amount=5){
  const g = GAMES[slug];
  const list = [];
  for(let i=0;i<amount;i++){
    if(g.special === 'federal'){
      list.push({label:`Bilhetes #${i+1}`, tickets:Array.from({length:5}, ()=>String(Math.floor(Math.random()*100000)).padStart(5,'0'))});
      continue;
    }
    if(g.special === 'loteca'){
      const opts = ['1','X','2'];
      list.push({label:`Cartela #${i+1}`, matches:Array.from({length:14}, (_,k)=>({jogo:k+1, palpite:opts[Math.floor(Math.random()*3)]}))});
      continue;
    }
    if(g.special === 'supersete'){
      list.push({label:`Palpite #${i+1}`, columns:Array.from({length:7}, ()=>Math.floor(Math.random()*10))});
      continue;
    }
    const item = {label:`Palpite #${i+1}`, numbers:uniqueNumbers(g.picks, g.max)};
    if(g.extra === 'trevos') item.trevos = uniqueNumbers(2, 6).map(x=>String(Number(x)));
    if(g.extra === 'time') item.timeDoCoracao = TEAMS[Math.floor(Math.random()*TEAMS.length)];
    if(g.extra === 'mes') item.mesDaSorte = MONTHS[Math.floor(Math.random()*MONTHS.length)];
    if(g.extra === 'duplo') item.secondDraw = uniqueNumbers(g.picks, g.max);
    list.push(item);
  }
  return list;
}
async function fetchJson(url){
  const c = new AbortController();
  const t = setTimeout(()=>c.abort(), 12000);
  try {
    const r = await fetch(url, { signal:c.signal, headers:{'accept':'application/json, text/plain, */*', 'user-agent':'Mozilla/5.0 PalpiteVIP'} });
    if(!r.ok) throw new Error('HTTP '+r.status);
    let txt = await r.text();
    if(txt.charCodeAt(0) === 65279) txt = txt.slice(1);
    return JSON.parse(txt);
  } finally { clearTimeout(t); }
}
function parseBRDate(v){
  if(!v) return null;
  if(/^\d{2}\/\d{2}\/\d{4}$/.test(v)){
    const [d,m,y] = v.split('/');
    return new Date(`${y}-${m}-${d}T12:00:00-03:00`);
  }
  const dt = new Date(v);
  return Number.isNaN(dt.getTime()) ? null : dt;
}
function normalize(slug, raw){
  return {
    slug,
    name: GAMES[slug].name,
    color: GAMES[slug].color,
    contest: raw.numero || raw.numeroDoConcurso || null,
    contestDate: raw.dataApuracao || raw.dataPorExtenso || null,
    nextContestDate: raw.dataProximoConcurso || raw.dataProximoSorteio || null,
    nextPrize: raw.valorEstimadoProximoConcurso || null,
    numbers: raw.listaDezenas || [],
    special: {
      secondDraw: raw.listaDezenasSegundoSorteio || null,
      trevos: raw.trevosSorteados || raw.listaTrevos || null,
      month: raw.mesSorte || null,
      time: raw.nomeTimeCoracaoMesSorte || raw.nomeTimeCoracao || null
    }
  };
}
async function getResults(force=false){
  const c = cache();
  if(!force && c.updatedAt && (Date.now()-new Date(c.updatedAt).getTime()) < 10*60*1000 && Object.keys(c.results).length) return c.results;
  const out = {};
  for(const slug of Object.keys(GAMES)){
    try { out[slug] = normalize(slug, await fetchJson(`https://servicebus2.caixa.gov.br/portaldeloterias/api/${slug}`)); }
    catch(e){
      out[slug] = c.results[slug] || {slug, name:GAMES[slug].name, color:GAMES[slug].color, error:true, message:'Resultado indisponível agora.'};
      if(out[slug]) out[slug].stale = true;
    }
  }
  saveCache({updatedAt:new Date().toISOString(), results:out});
  return out;
}
function weekList(results){
  const now = new Date(); const end = new Date(); end.setDate(end.getDate()+7);
  return Object.values(results).filter(x=>x.nextContestDate).map(x=>({...x, nextObj:parseBRDate(x.nextContestDate)}))
  .filter(x=>x.nextObj && x.nextObj <= end && x.nextObj >= new Date(now.getTime()-24*60*60*1000))
  .sort((a,b)=>a.nextObj-b.nextObj)
  .map(x=>({slug:x.slug, name:x.name, color:x.color, nextContestDate:x.nextContestDate, contest:x.contest, nextPrize:x.nextPrize}));
}
function serveFile(res, filepath){
  fs.readFile(filepath, (err, data)=>{
    if(err) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
    const ext = path.extname(filepath).toLowerCase();
    const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8'};
    send(res, 200, data, types[ext] || 'application/octet-stream');
  });
}

const server = http.createServer(async (req, res)=>{
  if(req.method === 'OPTIONS') return send(res, 204, '');
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;

  try{
    if(req.method === 'GET' && p === '/api/health') return send(res, 200, {ok:true, online:true, now:new Date().toISOString()});
    if(req.method === 'GET' && p === '/api/public-config') return send(res, 200, db().config);

    if(req.method === 'POST' && p === '/api/auth/register'){
      const body = await parseBody(req);
      if(!body.name || !body.email || !body.password) return send(res, 400, {error:'Nome, e-mail e senha são obrigatórios.'});
      const email = cleanEmail(body.email); const data = db();
      if(data.users.some(u=>u.email===email)) return send(res, 409, {error:'Esse e-mail já está cadastrado.'});
      if(String(body.password).length < 6) return send(res, 400, {error:'A senha precisa ter pelo menos 6 caracteres.'});
      const hp = hashPassword(body.password);
      const user = {id:crypto.randomUUID(), name:String(body.name).trim(), email, passwordHash:hp.hash, passwordSalt:hp.salt, role:'user', active:false, createdAt:new Date().toISOString(), activatedAt:null};
      data.users.push(user); saveDb(data);
      return send(res, 201, {message:'Conta criada. Agora ative com um código VIP.', token:createSession(user), user:publicUser(user)});
    }
    if(req.method === 'POST' && p === '/api/auth/login'){
      const body = await parseBody(req); const data = db();
      const user = data.users.find(u=>u.email===cleanEmail(body.email));
      if(!user) return send(res, 404, {error:'Conta não encontrada.'});
      if(!verifyPassword(body.password, user.passwordSalt, user.passwordHash)) return send(res, 401, {error:'Senha incorreta.'});
      return send(res, 200, {message:user.active?'Login realizado com sucesso.':'Conta encontrada. Falta ativar com código VIP.', token:createSession(user), user:publicUser(user)});
    }
    if(req.method === 'GET' && p === '/api/me'){
      const user = requireAuth(req, res); if(!user) return;
      return send(res, 200, {user:publicUser(user)});
    }
    if(req.method === 'POST' && p === '/api/auth/activate'){
      const user = requireAuth(req, res); if(!user) return;
      const body = await parseBody(req); const code = String(body.code||'').trim().toUpperCase();
      const data = db(); const found = data.accessCodes.find(c=>c.code.toUpperCase()===code);
      if(!found) return send(res, 404, {error:'Código VIP não encontrado.'});
      if(found.usedBy && found.usedBy !== user.id) return send(res, 409, {error:'Esse código já foi usado por outra conta.'});
      if(found.expiresAt && new Date(found.expiresAt) < new Date()) return send(res, 400, {error:'Esse código expirou.'});
      found.usedBy = user.id; found.usedAt = new Date().toISOString();
      const fresh = data.users.find(u=>u.id===user.id); fresh.active = true; fresh.activatedAt = new Date().toISOString();
      saveDb(data);
      return send(res, 200, {message:'Acesso VIP liberado.', token:createSession(fresh), user:publicUser(fresh)});
    }

    if(req.method === 'GET' && p === '/api/lotteries'){
      const results = await getResults(false); const c = cache();
      return send(res, 200, {updatedAt:c.updatedAt, results:Object.values(results), week:weekList(results)});
    }
    const detail = p.match(/^\/api\/lotteries\/([a-z0-9]+)$/);
    if(req.method === 'GET' && detail){
      const slug = detail[1]; if(!GAMES[slug]) return send(res, 404, {error:'Jogo não encontrado.'});
      const results = await getResults(false); return send(res, 200, results[slug] || {});
    }
    const gen = p.match(/^\/api\/lotteries\/([a-z0-9]+)\/generate$/);
    if(req.method === 'POST' && gen){
      const user = requireAuth(req, res); if(!user) return;
      if(!user.active && user.role !== 'admin') return send(res, 403, {error:'Ative sua conta VIP antes de gerar palpites.'});
      return send(res, 200, {slug:gen[1], suggestions:generatePicks(gen[1], 5)});
    }

    if(req.method === 'GET' && p === '/api/saved-bets'){
      const user = requireAuth(req, res); if(!user) return;
      const list = db().savedBets.filter(x=>x.userId===user.id).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
      return send(res, 200, list);
    }
    if(req.method === 'POST' && p === '/api/saved-bets'){
      const user = requireAuth(req, res); if(!user) return;
      if(!user.active && user.role !== 'admin') return send(res, 403, {error:'Ative sua conta VIP antes de salvar palpites.'});
      const body = await parseBody(req); const data = db();
      const item = {id:crypto.randomUUID(), userId:user.id, slug:body.slug, title:body.title||body.slug, payload:body.payload||[], createdAt:new Date().toISOString()};
      data.savedBets.push(item); saveDb(data); return send(res, 201, item);
    }
    const delSave = p.match(/^\/api\/saved-bets\/([a-f0-9-]+)$/);
    if(req.method === 'DELETE' && delSave){
      const user = requireAuth(req, res); if(!user) return;
      const data = db(); const idx = data.savedBets.findIndex(x=>x.id===delSave[1] && x.userId===user.id);
      if(idx === -1) return send(res, 404, {error:'Palpite não encontrado.'});
      data.savedBets.splice(idx,1); saveDb(data); return send(res, 200, {ok:true});
    }

    if(req.method === 'GET' && p === '/api/admin/stats'){
      const user = requireAdmin(req, res); if(!user) return;
      const data = db();
      return send(res, 200, {users:data.users.length, activeUsers:data.users.filter(x=>x.active).length, pendingUsers:data.users.filter(x=>!x.active).length, totalCodes:data.accessCodes.length, usedCodes:data.accessCodes.filter(x=>x.usedBy).length, savedBets:data.savedBets.length});
    }
    if(req.method === 'GET' && p === '/api/admin/codes'){
      const user = requireAdmin(req, res); if(!user) return;
      const data = db(); const um = new Map(data.users.map(u=>[u.id,u.email]));
      return send(res, 200, data.accessCodes.slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map(c=>({...c, usedByEmail:c.usedBy ? um.get(c.usedBy)||null : null})));
    }
    if(req.method === 'POST' && p === '/api/admin/codes'){
      const user = requireAdmin(req, res); if(!user) return;
      const body = await parseBody(req); const qty = Math.min(Math.max(Number(body.quantity||1),1),100);
      const prefix = String(body.prefix||'VIP').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
      const days = Number(body.expiresInDays||0); const data = db(); const created = [];
      for(let i=0;i<qty;i++) created.push({id:crypto.randomUUID(), code:`${prefix}-${randomCode(8)}`, createdAt:new Date().toISOString(), expiresAt:days>0?new Date(Date.now()+days*24*60*60*1000).toISOString():null, usedBy:null, usedAt:null});
      data.accessCodes.unshift(...created); saveDb(data); return send(res, 201, created);
    }
    const delCode = p.match(/^\/api\/admin\/codes\/([a-f0-9-]+)$/);
    if(req.method === 'DELETE' && delCode){
      const user = requireAdmin(req, res); if(!user) return;
      const data = db(); const idx = data.accessCodes.findIndex(x=>x.id===delCode[1]);
      if(idx === -1) return send(res, 404, {error:'Código não encontrado.'});
      data.accessCodes.splice(idx,1); saveDb(data); return send(res, 200, {ok:true});
    }
    if(req.method === 'PUT' && p === '/api/admin/config'){
      const user = requireAdmin(req, res); if(!user) return;
      const body = await parseBody(req); const data = db();
      data.config.brandName = body.brandName || data.config.brandName;
      data.config.subtitle = body.subtitle || data.config.subtitle;
      data.config.accentText = body.accentText || data.config.accentText;
      data.config.whatsappLink = body.whatsappLink || data.config.whatsappLink;
      data.config.telegramLink = body.telegramLink || data.config.telegramLink;
      saveDb(data); return send(res, 200, data.config);
    }
    if(req.method === 'POST' && p === '/api/admin/refresh-results'){
      const user = requireAdmin(req, res); if(!user) return;
      const results = await getResults(true); return send(res, 200, {ok:true, updatedAt:cache().updatedAt, total:Object.keys(results).length});
    }

    if(p === '/' || p.startsWith('/styles.css') || p.startsWith('/app.js')) return serveFile(res, path.join(PUBLIC_DIR, p === '/' ? 'index.html' : p.slice(1)));
    return serveFile(res, path.join(PUBLIC_DIR, 'index.html'));
  } catch(err){
    return send(res, 500, {error: err.message || 'Erro interno.'});
  }
});
server.listen(PORT, ()=>console.log(`Rodando em http://localhost:${PORT}`));
