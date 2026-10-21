import { filterSections, parseLegendaryIndex, parseSections, safeExternalUrl, shouldRetryStatus } from './markdown.js';

const byId = (id) => document.getElementById(id);
const state = {
  config: null,
  categories: [],
  activeCategory: null,
  currentSections: [],
  allSections: [],
  legendarySearchSections: null,
  docCache: new Map(),
  searchSequence: 0,
  partialFailures: 0,
};

function setText(id, value) {
  byId(id).textContent = value ?? '';
}

function showLoading(message) {
  byId('loading-state').hidden = false;
  byId('loading-state').querySelector('p').textContent = message;
  byId('error-state').hidden = true;
  byId('empty-state').hidden = true;
  byId('results').replaceChildren();
}

function hideLoading() {
  byId('loading-state').hidden = true;
}

function showError(error) {
  hideLoading();
  byId('error-state').hidden = false;
  byId('empty-state').hidden = true;
  byId('results').replaceChildren();
  setText('error-message', error?.message || 'A fonte do GitHub está indisponível. Tente novamente.');
  setText('source-state', 'Fonte indisponível');
  byId('live-indicator').classList.add('offline');
}

function clearError() {
  byId('error-state').hidden = true;
  byId('live-indicator').classList.remove('offline');
}

function safeLink(url, label, className = '') {
  const href = safeExternalUrl(url);
  if (!href) return null;
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.textContent = label;
  if (className) anchor.className = className;
  return anchor;
}

function updateSourceLinks() {
  const repoUrl = `https://github.com/${state.config.repo}`;
  const historyUrl = `${repoUrl}/commits/${encodeURIComponent(state.config.branch)}`;
  byId('source-link').href = repoUrl;
  byId('history-link').href = historyUrl;
  const homepage = byId('homepage-link');
  if (state.config.homepage) {
    homepage.href = state.config.homepage;
    homepage.hidden = false;
  }
}

function applyConfig() {
  document.body.dataset.theme = state.config.theme;
  document.title = `${state.config.title} · Catálogo OSINT`;
  setText('app-title', state.config.title);
  setText('app-subtitle', state.config.subtitle);
  setText('brand-kicker', state.config.kicker);
  setText('content-kicker', `${state.config.repo} · ${state.config.branch}`);
  setText('license-note', state.config.licenseNote);
  byId('brand-icon').src = state.config.icon;
  byId('brand-icon').alt = '';
  byId('search-input').placeholder = state.config.searchPlaceholder;
  updateSourceLinks();
}

async function fetchRemoteMarkdown(path) {
  const [owner, repository] = state.config.repo.split('/');
  if (!owner || !repository || path.split('/').some((part) => part === '..')) {
    throw new Error('Caminho inválido para a fonte.');
  }
  const safePath = path.split('/').map((part) => encodeURIComponent(part)).join('/');
  const url = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/${encodeURIComponent(state.config.branch)}/${safePath}`;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
        signal: controller.signal,
        headers: { Accept: 'text/plain' },
      });
      if (response.ok) return await response.text();
      if (attempt === 0 && shouldRetryStatus(response.status)) {
        const retryAfter = Number(response.headers.get('Retry-After'));
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 2500)
          : 450;
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }
      throw new Error(`GitHub respondeu HTTP ${response.status}.`);
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('A fonte demorou demais para responder.');
      if (error instanceof TypeError && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        continue;
      }
      if (error instanceof TypeError) throw new Error('Não foi possível acessar GitHub Raw. Confira a conexão e tente novamente.');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error('A fonte do GitHub continua indisponível após uma nova tentativa.');
}

async function getDocument(path) {
  if (!state.docCache.has(path)) {
    const promise = fetchRemoteMarkdown(path).catch((error) => {
      state.docCache.delete(path);
      throw error;
    });
    state.docCache.set(path, promise);
  }
  return state.docCache.get(path);
}

function renderNavigation(categories, indicateActive = true) {
  const nav = byId('category-list');
  nav.replaceChildren();
  for (const category of categories) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'category-button';
    button.textContent = category.title;
    button.setAttribute('aria-pressed', String(indicateActive && (state.activeCategory === category.path || state.activeCategory === category.title)));
    button.addEventListener('click', () => {
      state.searchSequence += 1;
      byId('search-input').value = '';
      if (state.config.mode === 'legendary') {
        selectLegendaryCategory(category).catch(showError);
      } else {
        state.activeCategory = category.title;
        const selected = state.allSections.filter((section) => section.title === category.title);
        setText('content-heading', category.title);
        setText('content-summary', `${selected.reduce((total, section) => total + section.items.length, 0)} referências desta categoria.`);
        renderNavigation(categories);
        renderResults(selected);
        setText('source-state', `Categoria ${category.title} selecionada · filtro local`);
      }
    });
    nav.append(button);
  }
  setText('category-total', String(categories.length));
}

function descriptionFor(item) {
  const firstLabel = item.links?.[0]?.label;
  if (!firstLabel) return item.text || 'Referência externa';
  const index = item.text.indexOf(firstLabel);
  const rest = index >= 0 ? item.text.slice(index + firstLabel.length) : item.text;
  return rest.replace(/^\s*(?:[-—–:|·]\s*)+/, '').trim() || 'Referência externa';
}

function renderResource(item) {
  const card = document.createElement('article');
  card.className = 'resource-card';

  const primary = item.links?.[0];
  const title = document.createElement('h3');
  if (primary) {
    const link = safeLink(primary.url, primary.label, 'resource-title-link');
    if (link) title.append(link);
    else title.textContent = item.text || primary.label;
  } else {
    title.textContent = (item.text || 'Referência').slice(0, 110);
  }
  card.append(title);

  const description = document.createElement('p');
  description.className = 'resource-description';
  description.textContent = descriptionFor(item);
  card.append(description);

  const links = document.createElement('div');
  links.className = 'resource-links';
  for (const linkData of (item.links || []).slice(primary ? 1 : 0)) {
    const link = safeLink(linkData.url, `Abrir: ${linkData.label} ↗`, 'resource-chip');
    if (link) links.append(link);
  }
  if (links.childElementCount) card.append(links);
  return card;
}

function renderResults(sections) {
  hideLoading();
  clearError();
  const results = byId('results');
  results.replaceChildren();
  const visibleSections = (sections || []).filter((section) => section.items?.length);
  const total = visibleSections.reduce((count, section) => count + section.items.length, 0);
  setText('resource-count', total ? `${total} ${total === 1 ? 'referência' : 'referências'} · ${visibleSections.length} ${visibleSections.length === 1 ? 'seção' : 'seções'}` : '0 referências');
  byId('empty-state').hidden = total > 0;

  for (const section of visibleSections) {
    const wrapper = document.createElement('section');
    wrapper.className = 'resource-section';
    wrapper.setAttribute('aria-label', section.title);

    if (section.category) {
      const kicker = document.createElement('p');
      kicker.className = 'section-kicker';
      kicker.textContent = section.category;
      wrapper.append(kicker);
    }

    const headingRow = document.createElement('div');
    headingRow.className = 'section-heading-row';
    const heading = document.createElement('h2');
    heading.textContent = section.title;
    const count = document.createElement('span');
    count.className = 'count-chip';
    count.textContent = String(section.items.length);
    headingRow.append(heading, count);
    wrapper.append(headingRow);

    const grid = document.createElement('div');
    grid.className = 'resource-grid';
    for (const item of section.items) grid.append(renderResource(item));
    wrapper.append(grid);
    results.append(wrapper);
  }
}

async function selectLegendaryCategory(category) {
  state.activeCategory = category.path;
  renderNavigation(state.categories);
  setText('content-heading', category.title);
  setText('content-summary', 'Referências carregadas diretamente do documento desta categoria.');
  setText('source-state', `Carregando ${category.title}…`);
  showLoading(`Buscando ${category.title} no GitHub…`);
  const markdown = await getDocument(category.path);
  state.currentSections = parseSections(markdown);
  renderResults(state.currentSections);
  setText('source-state', `Categoria ${category.title} carregada · conteúdo apenas em memória`);
}

async function loadAllLegendarySections() {
  if (state.legendarySearchSections) return state.legendarySearchSections;
  const categories = state.categories;
  const results = new Array(categories.length);
  let cursor = 0;
  let completed = 0;
  let failures = 0;
  state.partialFailures = 0;

  async function worker() {
    while (cursor < categories.length) {
      const index = cursor++;
      const category = categories[index];
      try {
        const markdown = await getDocument(category.path);
        results[index] = parseSections(markdown).map((section) => ({ ...section, category: category.title }));
      } catch {
        failures += 1;
        results[index] = [];
      }
      completed += 1;
      setText('source-state', `Indexando categorias… ${completed}/${categories.length}`);
    }
  }

  await Promise.all(Array.from({ length: Math.min(4, categories.length) }, () => worker()));
  state.legendarySearchSections = results.flat();
  state.partialFailures = failures;
  if (failures) setText('source-state', `Busca parcial · ${failures} categoria(s) indisponível(is)`);
  else setText('source-state', 'Busca local pronta · termos não enviados');
  return state.legendarySearchSections;
}

function currentDisplaySections() {
  if (state.config.mode === 'legendary') return state.currentSections;
  if (state.activeCategory) return state.allSections.filter((section) => section.title === state.activeCategory);
  return state.allSections;
}

async function applySearch() {
  const query = byId('search-input').value.trim();
  const sequence = ++state.searchSequence;
  if (!query) {
    renderNavigation(state.categories);
    setText('content-heading', state.activeCategory && state.config.mode === 'legendary'
      ? state.categories.find((category) => category.path === state.activeCategory)?.title || state.config.title
      : state.activeCategory || state.config.title);
    setText('content-summary', 'O filtro roda somente nesta aba; nenhuma busca é enviada a terceiros.');
    renderResults(currentDisplaySections());
    setText('source-state', 'Fonte online · conteúdo apenas em memória');
    return;
  }

  setText('content-heading', 'Resultados do catálogo');
  setText('content-summary', `Filtro local para “${query}”. Nenhum termo é transmitido.`);
  setText('source-state', 'Aplicando filtro local…');
  let searchable = state.allSections;
  if (state.config.mode === 'legendary') {
    showLoading('Preparando busca local nas categorias…');
    searchable = await loadAllLegendarySections();
  }
  if (sequence !== state.searchSequence) return;
  renderNavigation(state.categories, false);
  renderResults(filterSections(searchable, query));
  if (state.partialFailures) setText('source-state', `Busca parcial · ${state.partialFailures} categoria(s) indisponível(is)`);
  else setText('source-state', 'Filtro local · termos não enviados');
}

async function loadConfig() {
  const response = await fetch('/config.json', { cache: 'no-store', credentials: 'omit' });
  if (!response.ok) throw new Error(`Configuração local indisponível (HTTP ${response.status}).`);
  return response.json();
}

async function loadCatalogue() {
  state.docCache.clear();
  state.legendarySearchSections = null;
  state.currentSections = [];
  state.allSections = [];
  state.activeCategory = null;
  state.partialFailures = 0;
  state.searchSequence += 1;
  byId('search-input').value = '';
  setText('source-state', 'Conectando à fonte do GitHub…');
  setText('content-heading', 'Carregando catálogo…');
  showLoading('Buscando o índice do repositório…');

  const readme = await getDocument(state.config.indexFile || 'README.md');
  if (state.config.mode === 'legendary') {
    state.categories = parseLegendaryIndex(readme);
    if (!state.categories.length) throw new Error('O índice não contém documentos de categoria reconhecidos.');
    renderNavigation(state.categories);
    await selectLegendaryCategory(state.categories[0]);
    return;
  }

  state.allSections = parseSections(readme);
  if (!state.allSections.length) throw new Error('Não foram encontradas seções com referências na fonte.');
  state.categories = state.allSections.map((section) => ({ title: section.title, path: section.title }));
  renderNavigation(state.categories);
  setText('content-heading', state.config.title);
  setText('content-summary', `${state.allSections.length} categorias, lidas diretamente do README original.`);
  renderResults(state.allSections);
  setText('source-state', 'Fonte online · conteúdo apenas em memória');
}

async function boot() {
  try {
    state.config = await loadConfig();
    applyConfig();
    await loadCatalogue();
  } catch (error) {
    showError(error);
  }
}

byId('search-form').addEventListener('submit', (event) => event.preventDefault());
let searchTimer;
byId('search-input').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => applySearch().catch(showError), 140);
});
byId('refresh-button').addEventListener('click', () => boot());
byId('retry-button').addEventListener('click', () => boot());
document.addEventListener('keydown', (event) => {
  if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target;
  if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
  event.preventDefault();
  byId('search-input').focus();
});

boot();
