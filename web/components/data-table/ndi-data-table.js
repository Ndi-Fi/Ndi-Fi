import {
  buildPageList,
  buildViewModel,
  DEFAULT_PAGE_SIZE,
  formatCellValue,
  getCellValue,
  normalizePageSize,
  PAGE_SIZE_OPTIONS,
} from './data-table-model.js';
import { getTablePreset } from './data-table-presets.js';

const MOBILE_QUERY = '(max-width: 47.99rem)';
const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

let instanceCount = 0;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ENTITIES[char]);
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asText(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function slug(value) {
  return String(value ?? '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'neutral';
}

function plural(count, singular, pluralForm = `${singular}s`) {
  return count === 1 ? singular : pluralForm;
}

function normalizeSort(value) {
  const source = asObject(value);
  const key = asText(source.key || source.column);
  if (!key) return null;
  return { key, direction: source.direction === 'desc' ? 'desc' : 'asc' };
}

function focusSignature(element) {
  if (!element) return '';
  return [
    element.getAttribute('data-control') || '',
    element.getAttribute('data-action') || '',
    element.getAttribute('data-key') || '',
    element.getAttribute('data-page') || '',
  ].join('|');
}

/**
 * A responsive, accessible data table for positions and account history.
 *
 * On wide screens rows are a semantic `<table>`; below 48rem the same data is
 * rendered as a card list. Sorting, filtering and pagination controls work in
 * both layouts, and empty/loading states are first-class render paths.
 */
export class NdiDataTable extends HTMLElement {
  static get observedAttributes() {
    return ['variant', 'label', 'description', 'page-size', 'loading', 'empty-message'];
  }

  #instanceId = `ndi-data-table-${++instanceCount}`;
  #root;
  #announcer;
  #mediaQuery = null;
  #cleanup = null;
  #announceOnRender = false;
  #lastAnnouncement = '';
  #inline = {};
  #preset = getTablePreset('positions');
  #rows = null;
  #columns = null;
  #label = '';
  #description = '';
  #emptyMessage = '';
  #query = '';
  #filters = {};
  #sort = null;
  #page = 1;
  #pageSize = DEFAULT_PAGE_SIZE;

  constructor() {
    super();

    const root = this.attachShadow({ mode: 'open' });
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = new URL('./ndi-data-table.css', import.meta.url).href;

    const content = document.createElement('div');
    content.setAttribute('data-table-root', '');

    const announcer = document.createElement('div');
    announcer.className = 'ndi-data-table__sr-only';
    announcer.setAttribute('role', 'status');
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('data-announcer', '');

    root.append(stylesheet, content, announcer);
    this.#root = content;
    this.#announcer = announcer;
  }

  connectedCallback() {
    this.#applyConfig();
    this.#bindEvents();
    this.#bindResponsive();
    this.#render();
  }

  disconnectedCallback() {
    this.#cleanup?.();
    this.#cleanup = null;
    this.#mediaQuery = null;
  }

  attributeChangedCallback(name, previous, next) {
    if (!this.isConnected || previous === next) return;

    if (name === 'variant') {
      this.#preset = getTablePreset(asText(next, 'positions'));
      this.#rows = null;
      this.#columns = null;
      this.#applyConfig();
      this.#page = 1;
      this.#query = '';
      this.#filters = {};
      this.#sort = null;
    } else {
      this.#applyConfig();
      if (name === 'page-size') this.#page = 1;
    }

    this.#render();
  }

  /** Replace the data (and optionally the columns) without reloading a preset. */
  setRows(rows, columns) {
    this.#rows = Array.isArray(rows) ? rows : [];
    if (Array.isArray(columns)) this.#columns = columns;
    this.#page = 1;
    this.#announceOnRender = true;
    this.#render();
    this.#emitChange();
  }

  setLoading(loading) {
    if (loading) this.setAttribute('loading', '');
    else this.removeAttribute('loading');
    this.#emitChange();
  }

  getState() {
    return {
      variant: this.getAttribute('variant') || 'positions',
      query: this.#query,
      filters: { ...this.#filters },
      sort: this.#sort ? { ...this.#sort } : null,
      page: this.#page,
      pageSize: this.#pageSize,
    };
  }

  #readInlineConfig() {
    const script = this.querySelector('script[type="application/json"][data-table-config]');
    if (!script) return {};

    try {
      const parsed = JSON.parse(script.textContent || '{}');
      return asObject(parsed);
    } catch (error) {
      console.warn('[ndi-data-table] Ignoring invalid JSON configuration:', error);
      return {};
    }
  }

  #applyConfig() {
    this.#inline = this.#readInlineConfig();
    const inline = this.#inline;
    const preset = this.#preset;

    if (this.#rows === null) {
      this.#rows = Array.isArray(inline.rows) ? inline.rows : preset.rows;
    }
    if (this.#columns === null) {
      this.#columns = Array.isArray(inline.columns) ? inline.columns : preset.columns;
    }

    this.#label = this.getAttribute('label') || asText(inline.label, preset.label);
    this.#description = this.getAttribute('description') || asText(inline.description, preset.description);
    this.#emptyMessage = this.getAttribute('empty-message') || asText(inline.emptyMessage, preset.emptyMessage);

    const requestedSize = this.getAttribute('page-size') ?? inline.pageSize ?? preset.pageSize ?? DEFAULT_PAGE_SIZE;
    this.#pageSize = normalizePageSize(requestedSize);
  }

  #bindEvents() {
    const root = this.#root;
    root.addEventListener('input', this.#onInput);
    root.addEventListener('change', this.#onChange);
    root.addEventListener('click', this.#onClick);
    root.addEventListener('submit', this.#onSubmit);

    this.#cleanup = () => {
      root.removeEventListener('input', this.#onInput);
      root.removeEventListener('change', this.#onChange);
      root.removeEventListener('click', this.#onClick);
      root.removeEventListener('submit', this.#onSubmit);
      if (this.#mediaQuery?.removeEventListener) {
        this.#mediaQuery.removeEventListener('change', this.#onMediaChange);
      } else {
        this.#mediaQuery?.removeListener?.(this.#onMediaChange);
      }
    };
  }

  #bindResponsive() {
    const query = typeof window !== 'undefined' ? window.matchMedia?.(MOBILE_QUERY) ?? null : null;
    this.#mediaQuery = query;
    if (!query) return;

    if (query.addEventListener) query.addEventListener('change', this.#onMediaChange);
    else query.addListener?.(this.#onMediaChange);
  }

  #onMediaChange = () => this.#render();

  #onSubmit = (event) => {
    // The toolbar is a search form, not a navigation form: never reload a page
    // when a user presses Enter in the search field.
    event.preventDefault?.();
  };

  #onInput = (event) => {
    const target = event.target;
    if (!target || target.dataset?.control !== 'query') return;
    this.#query = target.value;
    this.#page = 1;
    this.#announceOnRender = false; // avoid announcing on every keystroke
    this.#render();
    this.#emitChange();
  };

  #onChange = (event) => {
    const target = event.target;
    const control = target?.dataset?.control;
    if (!control) return;

    if (control === 'filter') {
      const key = target.dataset.key;
      const next = { ...this.#filters };
      if (target.value && target.value !== 'all') next[key] = target.value;
      else delete next[key];
      this.#filters = next;
    } else if (control === 'sort-key') {
      const key = target.value;
      this.#sort = key
        ? { key, direction: this.#sort?.key === key ? this.#sort.direction : 'asc' }
        : null;
    } else if (control === 'page-size') {
      this.#pageSize = Number(target.value) || DEFAULT_PAGE_SIZE;
    } else {
      return;
    }

    this.#page = 1;
    this.#announceOnRender = true;
    this.#render();
    this.#emitChange();
  };

  #onClick = (event) => {
    const button = event.target?.closest?.('button[data-action]');
    if (!button || button.disabled || !this.#root.contains(button)) return;
    const action = button.dataset.action;

    if (action === 'sort') {
      const key = button.dataset.key;
      this.#sort = this.#sort?.key === key
        ? { key, direction: this.#sort.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' };
      this.#page = 1;
    } else if (action === 'sort-direction') {
      if (!this.#sort?.key) return;
      this.#sort = { ...this.#sort, direction: this.#sort.direction === 'asc' ? 'desc' : 'asc' };
      this.#page = 1;
    } else if (action === 'page') {
      this.#page = Number(button.dataset.page) || 1;
    } else if (action === 'prev-page') {
      this.#page = Math.max(1, this.#page - 1);
    } else if (action === 'next-page') {
      this.#page += 1;
    } else if (action === 'clear-filters') {
      this.#query = '';
      this.#filters = {};
      this.#page = 1;
    } else {
      return;
    }

    this.#announceOnRender = true;
    this.#render();
    this.#emitChange();
  };

  #emitChange() {
    this.dispatchEvent(new CustomEvent('ndi-table-change', {
      bubbles: true,
      composed: true,
      detail: this.getState(),
    }));
  }

  #isMobile() {
    return Boolean(this.#mediaQuery?.matches);
  }

  #captureFocus() {
    const active = this.ownerDocument?.defaultView
      ? this.shadowRoot?.activeElement
      : null;
    if (!active || !this.#root.contains(active)) return null;

    return {
      signature: focusSignature(active),
      selectionStart: typeof active.selectionStart === 'number' ? active.selectionStart : null,
      selectionEnd: typeof active.selectionEnd === 'number' ? active.selectionEnd : null,
    };
  }

  #restoreFocus(snapshot) {
    if (!snapshot) return;

    let target = [...this.#root.querySelectorAll('[data-control], button[data-action]')]
      .find((element) => focusSignature(element) === snapshot.signature);

    // The focused control may disappear (e.g. "Clear filters" after it is
    // clicked, or header sort buttons when switching to card layout). Move
    // focus to the closest equivalent control rather than dropping it.
    if (!target) {
      const action = snapshot.signature.split('|')[1];
      const fallback = action === 'clear-filters' ? 'query' : action === 'sort' ? 'sort-key' : null;
      if (fallback) target = this.#root.querySelector(`[data-control="${fallback}"]`);
    }
    if (!target) return;

    target.focus({ preventScroll: true });
    if (snapshot.selectionStart !== null && typeof target.setSelectionRange === 'function') {
      target.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd ?? snapshot.selectionStart);
    }
  }

  #announce(model) {
    if (!this.#announceOnRender || !this.#announcer) return;
    this.#announceOnRender = false;

    const message = `Showing ${model.start}–${model.end} of ${model.total} ${plural(model.total, 'row')}. Page ${model.page} of ${model.pageCount}.`;
    if (message === this.#lastAnnouncement) return;
    this.#lastAnnouncement = message;
    this.#announcer.textContent = message;
  }

  #render() {
    const focus = this.#captureFocus();
    const model = buildViewModel({
      columns: this.#columns || [],
      rows: this.#rows || [],
      query: this.#query,
      filters: this.#filters,
      sort: this.#sort,
      page: this.#page,
      pageSize: this.#pageSize,
    });
    const loading = this.hasAttribute('loading');

    this.#root.innerHTML = this.#renderShell(model, loading);
    this.#restoreFocus(focus);
    this.#announce(model);
  }

  #renderShell(model, loading) {
    const id = this.#instanceId;
    const bodyId = `${id}-body`;
    const label = escapeHtml(this.#label);
    const description = escapeHtml(this.#description);
    const body = loading
      ? this.#renderLoading()
      : model.allRows.length === 0
        ? this.#renderEmpty(model, this.#emptyMessage)
        : model.filteredRows.length === 0
          ? this.#renderEmpty(model, 'No rows match the current filters.', true)
          : this.#isMobile()
            ? this.#renderCards(model)
            : this.#renderTable(model);

    return `
      <section class="ndi-data-table" aria-labelledby="${id}-title" aria-busy="${loading}">
        <header class="ndi-data-table__header">
          <div>
            <h2 class="ndi-data-table__title" id="${id}-title">${label}</h2>
            ${description ? `<p class="ndi-data-table__description">${description}</p>` : ''}
          </div>
        </header>

        ${this.#renderToolbar(model, loading, bodyId)}
        <div class="ndi-data-table__body" id="${bodyId}">${body}</div>
        ${this.#renderPagination(model, loading)}
      </section>`;
  }

  #renderToolbar(model, loading, bodyId) {
    const id = this.#instanceId;
    const disabled = loading ? 'disabled' : '';
    const sortKey = this.#sort?.key || '';

    const filters = model.filterGroups
      .filter((group) => group.options.length > 0)
      .map((group) => {
        const options = group.options
          .map((option) => `<option value="${escapeHtml(option.value)}"${this.#filters[group.key] === option.value ? ' selected' : ''}>${escapeHtml(option.label)}</option>`)
          .join('');
        return `
          <div class="ndi-data-table__field">
            <label class="ndi-data-table__label" for="${id}-filter-${escapeHtml(group.key)}">${escapeHtml(group.label)}</label>
            <select id="${id}-filter-${escapeHtml(group.key)}" data-control="filter" data-key="${escapeHtml(group.key)}" aria-controls="${bodyId}" ${disabled}>
              <option value="all">All ${escapeHtml(group.label.toLocaleLowerCase())}</option>
              ${options}
            </select>
          </div>`;
      })
      .join('');

    const sortOptions = model.columns
      .filter((column) => column.sortable)
      .map((column) => `<option value="${escapeHtml(column.key)}"${sortKey === column.key ? ' selected' : ''}>${escapeHtml(column.label)}</option>`)
      .join('');

    const pageSizes = PAGE_SIZE_OPTIONS.includes(model.pageSize)
      ? PAGE_SIZE_OPTIONS
      : [...PAGE_SIZE_OPTIONS, model.pageSize].sort((a, b) => a - b);

    return `
      <form class="ndi-data-table__toolbar" role="search" aria-label="Filter ${escapeHtml(this.#label)}" data-control="toolbar">
        <div class="ndi-data-table__field ndi-data-table__field--search">
          <label class="ndi-data-table__label" for="${id}-query">Filter rows</label>
          <input id="${id}-query" type="search" data-control="query" aria-controls="${bodyId}" placeholder="Search ${escapeHtml(this.#label.toLocaleLowerCase())}" value="${escapeHtml(this.#query)}" ${disabled} />
        </div>

        ${filters}

        <div class="ndi-data-table__field">
          <label class="ndi-data-table__label" for="${id}-sort">Sort by</label>
          <select id="${id}-sort" data-control="sort-key" aria-controls="${bodyId}" ${disabled}>
            <option value="">Default order</option>
            ${sortOptions}
          </select>
        </div>

        <button class="ndi-data-table__direction" type="button" data-action="sort-direction" aria-label="${this.#sort?.direction === 'desc' ? 'Sort ascending' : 'Sort descending'}" title="${this.#sort?.direction === 'desc' ? 'Sort ascending' : 'Sort descending'}" ${sortKey && !loading ? '' : 'disabled'}>
          <span aria-hidden="true">${this.#sort?.direction === 'desc' ? '↓' : '↑'}</span>
        </button>

        <div class="ndi-data-table__field ndi-data-table__field--size">
          <label class="ndi-data-table__label" for="${id}-size">Rows per page</label>
          <select id="${id}-size" data-control="page-size" aria-controls="${bodyId}" ${disabled}>
            ${pageSizes.map((size) => `<option value="${size}"${size === model.pageSize ? ' selected' : ''}>${size}</option>`).join('')}
          </select>
        </div>
      </form>`;
  }

  #renderTable(model) {
    const sortedColumn = this.#sort?.key;
    const head = model.columns
      .map((column) => {
        const ariaSort = column.key === sortedColumn
          ? ` aria-sort="${this.#sort.direction === 'desc' ? 'descending' : 'ascending'}"`
          : '';
        const content = column.sortable
          ? `<button class="ndi-data-table__sort" type="button" data-action="sort" data-key="${escapeHtml(column.key)}" aria-label="Sort by ${escapeHtml(column.label)}${column.key === sortedColumn ? `, currently ${this.#sort.direction === 'desc' ? 'descending' : 'ascending'}` : ''}">
              <span>${escapeHtml(column.label)}</span>
              <span class="ndi-data-table__sort-icon" aria-hidden="true">${column.key === sortedColumn ? (this.#sort.direction === 'desc' ? '↓' : '↑') : '↕'}</span>
            </button>`
          : escapeHtml(column.label);

        return `<th scope="col" class="${column.align === 'end' ? 'ndi-data-table__cell--end' : ''}"${ariaSort}>${content}</th>`;
      })
      .join('');

    const rows = model.rows.map((row) => this.#renderTableRow(row, model)).join('');

    return `
      <div class="ndi-data-table__scroll">
        <table class="ndi-data-table__table">
          <caption class="ndi-data-table__sr-only">${escapeHtml(this.#label)}</caption>
          <thead><tr>${head}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  #renderTableRow(row, model) {
    const cells = model.columns
      .map((column, index) => {
        const content = this.#renderCell(row, column, model.locale);
        if (index === 0) {
          return `<th scope="row" class="${column.align === 'end' ? 'ndi-data-table__cell--end' : ''}">${content}</th>`;
        }
        return `<td class="${column.align === 'end' ? 'ndi-data-table__cell--end' : ''}">${content}</td>`;
      })
      .join('');
    return `<tr>${cells}</tr>`;
  }

  #renderCards(model) {
    const primaryIndex = Math.max(0, model.columns.findIndex((column) => column.primary));
    const primary = model.columns[primaryIndex];

    const cards = model.rows
      .map((row) => {
        const heading = primary
          ? this.#renderCell(row, primary, model.locale)
          : escapeHtml(row.rowId);
        const details = model.columns
          .filter((column) => column !== primary)
          .map((column) => `
            <div class="ndi-data-table__card-row">
              <dt>${escapeHtml(column.label)}</dt>
              <dd>${this.#renderCell(row, column, model.locale)}</dd>
            </div>`)
          .join('');

        return `
          <li class="ndi-data-table__card">
            <h3 class="ndi-data-table__card-title">${heading}</h3>
            <dl class="ndi-data-table__card-list">${details}</dl>
          </li>`;
      })
      .join('');

    return `<ul class="ndi-data-table__cards" role="list" aria-label="${escapeHtml(this.#label)}">${cards}</ul>`;
  }

  #renderCell(row, column, locale) {
    const raw = getCellValue(row, column);
    const value = formatCellValue(raw, column, locale);
    const text = escapeHtml(value);

    if (column.format === 'status') {
      return `<span class="ndi-data-table__badge" data-status="${slug(value)}">${text}</span>`;
    }
    if (column.format === 'mono') {
      return `<span class="ndi-data-table__mono">${text}</span>`;
    }
    return text;
  }

  #renderLoading() {
    const count = this.#isMobile() ? 3 : 5;
    const placeholders = Array.from({ length: count }, () => `
      <span class="ndi-data-table__skeleton-row"><span></span><span></span><span></span></span>`).join('');

    return `
      <div class="ndi-data-table__loading" role="status" aria-live="polite">
        <span class="ndi-data-table__spinner" aria-hidden="true"></span>
        <span>Loading ${escapeHtml(this.#label.toLocaleLowerCase())}…</span>
      </div>
      <div class="ndi-data-table__skeleton" aria-hidden="true">${placeholders}</div>`;
  }

  #renderEmpty(model, message, filtered = false) {
    return `
      <div class="ndi-data-table__empty" role="status">
        <span class="ndi-data-table__empty-icon" aria-hidden="true">∅</span>
        <h3 class="ndi-data-table__empty-title">${filtered ? 'No matching rows' : 'Nothing here yet'}</h3>
        <p class="ndi-data-table__empty-message">${escapeHtml(message)}</p>
        ${filtered || model.hasActiveFilters
          ? '<button class="ndi-data-table__button" type="button" data-action="clear-filters">Clear filters</button>'
          : ''}
      </div>`;
  }

  #renderPagination(model, loading) {
    const id = this.#instanceId;
    const description = `Showing ${model.start}–${model.end} of ${model.total} ${plural(model.total, 'row')}. Page ${model.page} of ${model.pageCount}.`;
    const pages = buildPageList(model.page, model.pageCount)
      .map((page) => {
        if (page === null) return '<li class="ndi-data-table__page-gap" aria-hidden="true">…</li>';
        const current = page === model.page ? ' aria-current="page"' : '';
        return `<li><button class="ndi-data-table__page" type="button" data-action="page" data-page="${page}"${current} ${loading ? 'disabled' : ''} aria-label="Page ${page}">${page}</button></li>`;
      })
      .join('');

    return `
      <footer class="ndi-data-table__pagination">
        <p class="ndi-data-table__summary" id="${id}-summary">${description}</p>
        <nav class="ndi-data-table__pager" aria-label="${escapeHtml(this.#label)} pages">
          <button class="ndi-data-table__button" type="button" data-action="prev-page" aria-label="Previous page"${model.page <= 1 || loading ? ' disabled' : ''}>Previous</button>
          <ul class="ndi-data-table__pages">${pages}</ul>
          <button class="ndi-data-table__button" type="button" data-action="next-page" aria-label="Next page"${model.page >= model.pageCount || loading ? ' disabled' : ''}>Next</button>
        </nav>
      </footer>`;
  }
}

if (!customElements.get('ndi-data-table')) {
  customElements.define('ndi-data-table', NdiDataTable);
}

export default NdiDataTable;
