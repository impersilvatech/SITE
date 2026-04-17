/**
 * catalogo.js v6 — IMPERSILVATECH
 * Ponte entre design CONFETI e Cloudflare Worker API
 * Substitui catalogo.js antigo (que lia de JSON no GitHub)
 */

'use strict';

const _API = 'https://impersilvatech-api.3miliosilva.workers.dev';
const _TTL = 5 * 60 * 1000; // cache 5 min

// ── Dados em memória ──────────────────────────────────────────────────────────
var LOJA_DEFAULT = { nome: 'Loja', whatsapp: '', simbolo: 'Kz', pedidoPersActivo: false };
var _lojaData = null, _catsData = [], _prodsData = [], _ready = false;

// ── Cache localStorage ────────────────────────────────────────────────────────
function _cGet(k) {
  try { var r = JSON.parse(localStorage.getItem(k)); if (!r) return null; if (Date.now() - r.ts > _TTL) { localStorage.removeItem(k); return null; } return r.d; } catch(e) { return null; }
}
function _cSet(k, d) {
  try { localStorage.setItem(k, JSON.stringify({ d, ts: Date.now() })); } catch(e) {}
}

// ── Mappers ───────────────────────────────────────────────────────────────────
function _mapLoja(l) {
  var m = {
    nome: l.nome || 'Loja', descricao: l.descricao || '', slogan: l.slogan || '',
    whatsapp: l.whatsapp || '', email: l.email || '', telefone: l.telefone || '',
    morada: l.morada || '', cidade: l.cidade || '', provincia: l.provincia || '',
    logo: l.logo_url || '', sobre: l.sobre || '',
    facebook: l.facebook || '', instagram: l.instagram || '',
    tiktok: l.tiktok || '', youtube: l.youtube || '',
    entrega_ativa: !!l.entrega_ativa, entrega_preco: l.entrega_preco || 0,
    entrega_gratis: l.entrega_gratis_a || 0, entrega_prazo: l.entrega_prazo || '',
    entrega_zonas: l.entrega_zonas || '', simbolo: l.simbolo_moeda || 'Kz',
    corPrimaria: l.cor_primaria || '#ff6b9d', corSecundaria: l.cor_secundaria || '#b14ae8',
    notif_whatsapp: !!l.notif_whatsapp, pedidoPersActivo: false,
    politica: l.politica || '', termos: l.termos || '',
    horarios: {
      seg: l.horario_seg || '', ter: l.horario_ter || '', qua: l.horario_qua || '',
      qui: l.horario_qui || '', sex: l.horario_sex || '', sab: l.horario_sab || '', dom: l.horario_dom || ''
    }
  };
  return m;
}

function _mapCat(c) {
  return { id: c.id, slug: c.slug, label: c.nome, emoji: c.icone || '🏷️' };
}

function _mapProd(p) {
  var feats = []; try { if (p.features) feats = JSON.parse(p.features); } catch(e) {}
  var specs = {}; try { if (p.specs) { var sa = JSON.parse(p.specs); sa.forEach(function(s) { specs[s.k] = s.v; }); } } catch(e) {}
  var galeria = []; try { if (p.imagens_extra) galeria = JSON.parse(p.imagens_extra); } catch(e) {}
  var pct = (p.preco_original && p.preco_original > p.preco_base) ? Math.round((1 - p.preco_base / p.preco_original) * 100) : 0;
  var isNew = p.criado_em && (Date.now() - new Date(p.criado_em).getTime()) < 7 * 24 * 60 * 60 * 1000;
  var etiqueta = pct > 0 ? 'promo' : p.destaque ? 'destaque' : isNew ? 'novo' : '';
  return {
    id: p.id, nome: p.nome, descricao: p.descricao || '',
    categoria: p.categoria_id, preco: p.preco_base || 0,
    preco_orig: p.preco_original || 0, emoji: '🛍️',
    imagem: p.imagem_url || '', galeria: galeria,
    disponivel: p.disponivel !== 0, etiqueta: etiqueta,
    destaques: feats, specs: specs, stock: p.stock !== undefined ? p.stock : -1,
    variacoes: (p.variacoes || []).map(function(v) {
      return { id: v.id, nome: v.nome, preco_extra: v.preco_extra || 0, disponivel: v.disponivel !== 0 };
    })
  };
}

// ── Fetch ──────────────────────────────────────────────────────────────────────
async function _fetchLoja() {
  var c = _cGet('ist_loja'); if (c) return c;
  var r = await fetch(_API + '/api/loja'); var d = await r.json();
  if (d.erro) return null;
  var m = _mapLoja(d); _cSet('ist_loja', m); return m;
}
async function _fetchCats() {
  var c = _cGet('ist_cats'); if (c) return c;
  var r = await fetch(_API + '/api/categorias'); var d = await r.json();
  var m = d.map(_mapCat); _cSet('ist_cats', m); return m;
}
async function _fetchProds() {
  var c = _cGet('ist_prods'); if (c) return c;
  var r = await fetch(_API + '/api/produtos'); var d = await r.json();
  var m = d.map(_mapProd); _cSet('ist_prods', m); return m;
}

// ── API pública (síncrona — usar após initCatalogo()) ─────────────────────────
function getLoja()       { return _lojaData || LOJA_DEFAULT; }
function getCategorias() { return _catsData; }
function getProdutos()   { return _prodsData; }

// ── Init assíncrono ───────────────────────────────────────────────────────────
async function initCatalogo() {
  if (_ready) return;
  try {
    var results = await Promise.all([_fetchLoja(), _fetchCats(), _fetchProds()]);
    _lojaData = results[0] || LOJA_DEFAULT;
    _catsData = results[1] || [];
    _prodsData = results[2] || [];
    Object.assign(LOJA_DEFAULT, _lojaData);
    // Aplicar cores da loja imediatamente
    if (_lojaData.corPrimaria) {
      document.documentElement.style.setProperty('--pink', _lojaData.corPrimaria);
    }
    if (_lojaData.corSecundaria) {
      document.documentElement.style.setProperty('--purple', _lojaData.corSecundaria);
    }
    _ready = true;
  } catch(e) {
    console.warn('[catalogo.js] Erro ao carregar:', e);
  }
}

async function refreshCatalogo() {
  ['ist_loja','ist_cats','ist_prods'].forEach(function(k) { localStorage.removeItem(k); });
  _ready = false;
  await initCatalogo();
}

// ── Carrinho ──────────────────────────────────────────────────────────────────
function getCarrinho()     { try { return JSON.parse(localStorage.getItem('cf_carrinho') || '[]'); } catch(e) { return []; } }
function salvarCarrinho(c) { localStorage.setItem('cf_carrinho', JSON.stringify(c)); }
function limparCarrinho()  { localStorage.removeItem('cf_carrinho'); }

// ── Wishlist ──────────────────────────────────────────────────────────────────
function getWishlist()      { try { return JSON.parse(localStorage.getItem('cf_wl') || '[]'); } catch(e) { return []; } }
function isWishlisted(id)   { return getWishlist().indexOf(id) >= 0; }
function toggleWishlist(id) {
  var wl = getWishlist(), idx = wl.indexOf(id);
  if (idx >= 0) { wl.splice(idx, 1); localStorage.setItem('cf_wl', JSON.stringify(wl)); return false; }
  else { wl.push(id); localStorage.setItem('cf_wl', JSON.stringify(wl)); return true; }
}

// ── Auth ──────────────────────────────────────────────────────────────────────
async function loginCliente(email, password) {
  var r = await fetch(_API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email, password: password }) });
  var d = await r.json(); if (d.erro) throw new Error(d.erro);
  localStorage.setItem('cf_token', d.token);
  localStorage.setItem('cf_cliente', JSON.stringify({ nome: d.nome, email: d.email }));
  return d;
}
async function registarCliente(nome, email, telefone, password) {
  var r = await fetch(_API + '/api/auth/registar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: nome, email: email, telefone: telefone, password: password }) });
  var d = await r.json(); if (d.erro) throw new Error(d.erro); return d;
}
async function logoutCliente() {
  var token = localStorage.getItem('cf_token');
  if (token) { try { await fetch(_API + '/api/auth/logout', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } }); } catch(e) {} }
  localStorage.removeItem('cf_token'); localStorage.removeItem('cf_cliente');
}
function getCliente() { try { return JSON.parse(localStorage.getItem('cf_cliente') || 'null'); } catch(e) { return null; } }
function getToken()   { return localStorage.getItem('cf_token') || ''; }

// ── Encomendas ────────────────────────────────────────────────────────────────
async function criarEncomenda(dados) {
  var token = getToken();
  var headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  var r = await fetch(_API + '/api/encomendas', { method: 'POST', headers: headers, body: JSON.stringify(dados) });
  var d = await r.json(); if (d.erro) throw new Error(d.erro); return d;
}
async function getMinhasEncomendas() {
  var token = getToken(); if (!token) return [];
  var r = await fetch(_API + '/api/encomendas', { headers: { 'Authorization': 'Bearer ' + token } });
  var d = await r.json(); if (!Array.isArray(d)) return []; return d;
}
async function getDetalheEncomenda(ref) {
  var token = getToken();
  var headers = {}; if (token) headers['Authorization'] = 'Bearer ' + token;
  var r = await fetch(_API + '/api/encomendas/' + ref, { headers: headers });
  var d = await r.json(); if (d.erro) throw new Error(d.erro); return d;
}
async function getProdutoById(id) {
  var r = await fetch(_API + '/api/produtos/' + id);
  var d = await r.json(); if (d.erro) return null;
  return _mapProd(d);
}

// ── Utilitários ───────────────────────────────────────────────────────────────
function kz(valor) {
  if (valor === undefined || valor === null) return '—';
  var sym = getLoja().simbolo || 'Kz';
  return sym + ' ' + Number(valor).toLocaleString('pt');
}

function initTheme() {
  var t = localStorage.getItem('tema') || 'dark';
  document.documentElement.setAttribute('data-theme', t);
}

function _syncThemeIcons() {
  var t = document.documentElement.getAttribute('data-theme') || 'dark';
  var ico = t === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  document.querySelectorAll('[data-theme-ico]').forEach(function(el) { el.className = ico; });
}

function toggleTheme() {
  var t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('tema', t);
  _syncThemeIcons();
}

function applyThemeColors() {
  // Placeholder — cores aplicadas via CSS vars no initCatalogo
}

// Garantir que LOJA_DEFAULT está definido para verificação do HTML original
if (typeof window !== 'undefined') window.LOJA_DEFAULT = LOJA_DEFAULT;
