/**
 * catalogo.js — IMPERSILVATECH
 * Ponte entre o design CONFETI e o Cloudflare Worker API
 * Substitui o catalogo.js antigo (que lia de ficheiros JSON no GitHub)
 */

const _API = 'https://impersilvatech-api.3miliosilva.workers.dev';

// ─── Cache local (evita pedidos repetidos) ───────────────────────────────────
const _CACHE_KEY_LOJA   = 'ist_loja';
const _CACHE_KEY_CATS   = 'ist_cats';
const _CACHE_KEY_PRODS  = 'ist_prods';
const _CACHE_TTL        = 5 * 60 * 1000; // 5 minutos

function _cacheGet(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > _CACHE_TTL) { localStorage.removeItem(key); return null; }
    return data;
  } catch(e) { return null; }
}

function _cacheSet(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch(e) {}
}

// ─── Dados em memória (preenchidos pelo init) ─────────────────────────────────
let _lojaData   = null;
let _catsData   = [];
let _prodsData  = [];
let _loaded     = false;

// LOJA_DEFAULT — necessário para a verificação no HTML do CONFETI
// Definido como proxy — fica disponível imediatamente
var LOJA_DEFAULT = {
  nome: '', whatsapp: '', pedidoPersActivo: false,
  simbolo: 'Kz', corPrimaria: '#ff6b9d'
};

// ─── Mapeamento: Worker → CONFETI ─────────────────────────────────────────────

function _mapLoja(l) {
  return {
    nome:            l.nome || 'Loja',
    descricao:       l.descricao || '',
    whatsapp:        l.whatsapp || '',
    email:           l.email || '',
    telefone:        l.telefone || '',
    morada:          l.morada || '',
    cidade:          l.cidade || '',
    provincia:       l.provincia || '',
    facebook:        l.facebook || '',
    instagram:       l.instagram || '',
    tiktok:          l.tiktok || '',
    youtube:         l.youtube || '',
    logo:            l.logo_url || '',
    sobre:           l.sobre || '',
    horarios: {
      seg: l.horario_seg || '',
      ter: l.horario_ter || '',
      qua: l.horario_qua || '',
      qui: l.horario_qui || '',
      sex: l.horario_sex || '',
      sab: l.horario_sab || '',
      dom: l.horario_dom || '',
    },
    entrega_ativa:   !!l.entrega_ativa,
    entrega_preco:   l.entrega_preco || 0,
    entrega_gratis:  l.entrega_gratis_a || 0,
    entrega_prazo:   l.entrega_prazo || '',
    entrega_zonas:   l.entrega_zonas || '',
    simbolo:         l.simbolo_moeda || 'Kz',
    moeda:           l.moeda || 'AOA',
    corPrimaria:     l.cor_primaria || '#ff6b9d',
    notif_whatsapp:  !!l.notif_whatsapp,
    callmebot_key:   l.callmebot_apikey || '',
    pedidoPersActivo: false, // feature opcional — activar manualmente
    politica:        l.politica || '',
    termos:          l.termos || '',
  };
}

function _mapCat(c) {
  return {
    id:    c.id,       // usamos o id numérico do Worker
    slug:  c.slug,
    label: c.nome,
    emoji: c.icone || '🏷️',
  };
}

function _mapProd(p, cats) {
  let feats = [];
  try { if (p.features) feats = JSON.parse(p.features); } catch(e) {}
  let specs = [];
  try { if (p.specs) specs = JSON.parse(p.specs); } catch(e) {}
  let imgsExtra = [];
  try { if (p.imagens_extra) imgsExtra = JSON.parse(p.imagens_extra); } catch(e) {}

  const pct = (p.preco_original && p.preco_original > p.preco_base)
    ? Math.round((1 - p.preco_base / p.preco_original) * 100) : 0;
  const isNew = p.criado_em && (Date.now() - new Date(p.criado_em).getTime()) < 7*24*60*60*1000;

  let etiqueta = '';
  if (pct > 0)       etiqueta = 'promo';
  else if (p.destaque) etiqueta = 'destaque';
  else if (isNew)    etiqueta = 'novo';

  return {
    id:          p.id,
    nome:        p.nome,
    nome_en:     p.nome_en || '',
    descricao:   p.descricao || '',
    categoria:   p.categoria_id, // id numérico — igual ao da categoria
    preco:       p.preco_base || 0,
    preco_orig:  p.preco_original || 0,
    emoji:       '🛍️',
    imagem:      p.imagem_url || '',
    imagens:     imgsExtra,
    disponivel:  p.disponivel !== 0,
    etiqueta,
    destaques:   feats,   // array de strings — "✓ Personalização total"
    specs,                 // array de {k, v}
    stock:       p.stock ?? -1,
  };
}

// ─── Carregamento assíncrono ───────────────────────────────────────────────────

async function _fetchLoja() {
  const cached = _cacheGet(_CACHE_KEY_LOJA);
  if (cached) return cached;
  const r = await fetch(`${_API}/api/loja`);
  const d = await r.json();
  if (d.erro) return null;
  const mapped = _mapLoja(d);
  _cacheSet(_CACHE_KEY_LOJA, mapped);
  return mapped;
}

async function _fetchCats() {
  const cached = _cacheGet(_CACHE_KEY_CATS);
  if (cached) return cached;
  const r = await fetch(`${_API}/api/categorias`);
  const d = await r.json();
  const mapped = d.map(_mapCat);
  _cacheSet(_CACHE_KEY_CATS, mapped);
  return mapped;
}

async function _fetchProds(cats) {
  const cached = _cacheGet(_CACHE_KEY_PRODS);
  if (cached) return cached;
  const r = await fetch(`${_API}/api/produtos`);
  const d = await r.json();
  const mapped = d.map(p => _mapProd(p, cats));
  _cacheSet(_CACHE_KEY_PRODS, mapped);
  return mapped;
}

// ─── Funções públicas síncronas (usadas pelo HTML do CONFETI) ─────────────────
// Retornam os dados em memória. Devem ser chamadas APÓS initCatalogo() resolver.

function getLoja()      { return _lojaData || LOJA_DEFAULT; }
function getCategorias(){ return _catsData; }
function getProdutos()  { return _prodsData; }

// ─── Init assíncrono ──────────────────────────────────────────────────────────
// Cada página deve chamar: await initCatalogo();

async function initCatalogo() {
  if (_loaded) return;
  try {
    const [loja, cats] = await Promise.all([_fetchLoja(), _fetchCats()]);
    _lojaData  = loja || LOJA_DEFAULT;
    _catsData  = cats || [];
    _prodsData = await _fetchProds(_catsData);
    // Actualizar LOJA_DEFAULT para a verificação no HTML original
    Object.assign(LOJA_DEFAULT, _lojaData);
    // Aplicar cor primária dinamicamente
    if (_lojaData.corPrimaria) {
      document.documentElement.style.setProperty('--pink', _lojaData.corPrimaria);
    }
    _loaded = true;
  } catch(e) {
    console.warn('initCatalogo error:', e);
  }
}

// ─── Forçar refresh (pull-to-refresh / botão actualizar) ─────────────────────
async function refreshCatalogo() {
  localStorage.removeItem(_CACHE_KEY_LOJA);
  localStorage.removeItem(_CACHE_KEY_CATS);
  localStorage.removeItem(_CACHE_KEY_PRODS);
  _loaded = false;
  await initCatalogo();
}

// ─── Carrinho ─────────────────────────────────────────────────────────────────
// Compatível com o formato original do CONFETI

function getCarrinho() {
  try { return JSON.parse(localStorage.getItem('cf_carrinho') || '[]'); } catch(e) { return []; }
}

function salvarCarrinho(c) {
  localStorage.setItem('cf_carrinho', JSON.stringify(c));
}

function limparCarrinho() {
  localStorage.removeItem('cf_carrinho');
}

// ─── Wishlist ─────────────────────────────────────────────────────────────────

function getWishlist() {
  try { return JSON.parse(localStorage.getItem('cf_wl') || '[]'); } catch(e) { return []; }
}

function isWishlisted(id) {
  return getWishlist().includes(id);
}

function toggleWishlist(id) {
  let wl = getWishlist();
  const idx = wl.indexOf(id);
  if (idx >= 0) { wl.splice(idx, 1); localStorage.setItem('cf_wl', JSON.stringify(wl)); return false; }
  else { wl.push(id); localStorage.setItem('cf_wl', JSON.stringify(wl)); return true; }
}

// ─── Autenticação (Worker API) ────────────────────────────────────────────────

async function loginCliente(email, password) {
  const r = await fetch(`${_API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const d = await r.json();
  if (d.erro) throw new Error(d.erro);
  localStorage.setItem('cf_token', d.token);
  localStorage.setItem('cf_cliente', JSON.stringify({ nome: d.nome, email: d.email }));
  return d;
}

async function registarCliente(nome, email, telefone, password) {
  const r = await fetch(`${_API}/api/auth/registar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome, email, telefone, password })
  });
  const d = await r.json();
  if (d.erro) throw new Error(d.erro);
  return d;
}

async function logoutCliente() {
  const token = localStorage.getItem('cf_token');
  if (token) {
    try {
      await fetch(`${_API}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch(e) {}
  }
  localStorage.removeItem('cf_token');
  localStorage.removeItem('cf_cliente');
}

function getCliente() {
  try { return JSON.parse(localStorage.getItem('cf_cliente') || 'null'); } catch(e) { return null; }
}

function getToken() {
  return localStorage.getItem('cf_token') || '';
}

// ─── Encomendas (Worker API) ──────────────────────────────────────────────────

async function criarEncomenda(dados) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(`${_API}/api/encomendas`, {
    method: 'POST', headers, body: JSON.stringify(dados)
  });
  const d = await r.json();
  if (d.erro) throw new Error(d.erro);
  return d;
}

async function getMinhasEncomendas() {
  const token = getToken();
  if (!token) return [];
  const r = await fetch(`${_API}/api/encomendas`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const d = await r.json();
  if (d.erro) return [];
  return d;
}

async function getDetalheEncomenda(ref) {
  const token = getToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(`${_API}/api/encomendas/${ref}`, { headers });
  const d = await r.json();
  if (d.erro) throw new Error(d.erro);
  return d;
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

function kz(valor) {
  if (!valor && valor !== 0) return '—';
  const sym = getLoja().simbolo || 'Kz';
  return `${sym} ${Number(valor).toLocaleString('pt')}`;
}

function initTheme() {
  const t = localStorage.getItem('tema') || 'dark';
  document.documentElement.setAttribute('data-theme', t);
}

function _syncThemeIcons() {
  const t = document.documentElement.getAttribute('data-theme') || 'dark';
  document.querySelectorAll('[data-theme-ico]').forEach(el => {
    el.className = t === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  });
  document.querySelectorAll('.theme-ico').forEach(el => {
    el.innerHTML = t === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
  });
}

function toggleTheme() {
  const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('tema', t);
  _syncThemeIcons();
}

function applyThemeColors() {
  // placeholder — cores já aplicadas via CSS vars
}

// ─── Produto individual (Worker API) ─────────────────────────────────────────

async function getProdutoById(id) {
  const r = await fetch(`${_API}/api/produtos/${id}`);
  const d = await r.json();
  if (d.erro) return null;
  const cats = getCategorias();
  const prod = _mapProd(d, cats);
  prod.variacoes = (d.variacoes || []).map(v => ({
    id: v.id,
    nome: v.nome,
    preco_extra: v.preco_extra || 0,
    stock: v.stock ?? -1,
    disponivel: v.disponivel !== 0,
  }));
  return prod;
}
