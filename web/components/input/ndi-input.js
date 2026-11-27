import { createInputConfig, isErrorState, formatDecimalInput } from './input-config.js';

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

let instanceCount = 0;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ENTITIES[char]);
}

/**
 * The <ndi-input> element is an accessible, single-line text / number input
 * field with label, helper text, error messaging, an optional suffix label
 * (e.g. a token symbol), and an optional MAX button for DeFi amount inputs.
 *
 * @fires ndi:input   - Whenever the user types (detail: { value: string })
 * @fires ndi:change  - Whenever the input value is committed (detail: { value: string })
 * @fires ndi:max     - Whenever the MAX button is activated
 *
 * @example
 * <ndi-input
 *   label="Amount"
 *   type="number"
 *   placeholder="0.00"
 *   suffix="ETH"
 *   max-decimals="6"
 *   show-max
 *   helper="Enter the amount to deposit"
 * ></ndi-input>
 */
export class NdiInput extends HTMLElement {
  static get observedAttributes() {
    return [
      'type',
      'label',
      'helper',
      'error',
      'suffix',
      'placeholder',
      'value',
      'disabled',
      'readonly',
      'name',
      'max-decimals',
      'show-max',
    ];
  }

  /** @type {string} */
  #instanceId = `ndi-input-${++instanceCount}`;

  constructor() {
    super();

    const root = this.attachShadow({ mode: 'open' });

    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = new URL('./ndi-input.css', import.meta.url).href;

    const content = document.createElement('div');
    content.setAttribute('data-input-root', '');

    root.append(stylesheet, content);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  connectedCallback() {
    this.#render();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (this.isConnected) this.#render();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Get or set the current input value.
   * @type {string}
   */
  get value() {
    return this.#inputEl?.value ?? this.getAttribute('value') ?? '';
  }

  set value(val) {
    const control = this.#inputEl;
    if (control) {
      control.value = String(val ?? '');
    } else {
      // Shadow root not yet built — persist to attribute so #render picks it up.
      this.setAttribute('value', String(val ?? ''));
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  get #inputEl() {
    return this.shadowRoot?.querySelector('.ndi-input__control') ?? null;
  }

  #buildConfig() {
    return createInputConfig({
      type: this.getAttribute('type'),
      label: this.getAttribute('label'),
      helper: this.getAttribute('helper'),
      error: this.getAttribute('error'),
      suffix: this.getAttribute('suffix'),
      placeholder: this.getAttribute('placeholder'),
      maxDecimals: this.getAttribute('max-decimals'),
      showMax: this.hasAttribute('show-max'),
    });
  }

  #render() {
    const root = this.shadowRoot?.querySelector('[data-input-root]');
    if (!root) return;

    const config = this.#buildConfig();
    const id = this.#instanceId;
    const controlId = `${id}-control`;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;

    const hasError = isErrorState(config);
    const isDisabled = this.hasAttribute('disabled');
    const isReadonly = this.hasAttribute('readonly');
    const name = this.getAttribute('name') ?? '';

    // Preserve current value across re-renders caused by attribute changes.
    const currentValue = this.#inputEl?.value ?? this.getAttribute('value') ?? '';

    // aria-describedby: wire to error when present, otherwise to helper.
    const describedBy = hasError ? errorId : config.helper ? helperId : '';

    // For number inputs we keep the native type as "text" and validate
    // manually so we can control decimal formatting precisely.
    // inputmode="decimal" shows a decimal keyboard on mobile.
    const isNumeric = config.type === 'number';
    const nativeType = isNumeric ? 'text' : config.type;
    const inputMode = isNumeric ? 'decimal' : '';

    // Build class list for the wrapper div.
    const wrapperClasses = [
      'ndi-input__wrapper',
      hasError ? 'ndi-input__wrapper--error' : '',
      isDisabled ? 'ndi-input__wrapper--disabled' : '',
    ]
      .filter(Boolean)
      .join(' ');

    root.innerHTML = `
      <div class="ndi-input__field">
        <label
          class="ndi-input__label"
          for="${escapeHtml(controlId)}"
        >${escapeHtml(config.label)}</label>

        <div class="${escapeHtml(wrapperClasses)}">
          <input
            class="ndi-input__control"
            id="${escapeHtml(controlId)}"
            type="${escapeHtml(nativeType)}"
            ${inputMode ? `inputmode="${escapeHtml(inputMode)}"` : ''}
            ${config.placeholder ? `placeholder="${escapeHtml(config.placeholder)}"` : ''}
            ${name ? `name="${escapeHtml(name)}"` : ''}
            ${describedBy ? `aria-describedby="${escapeHtml(describedBy)}"` : ''}
            ${hasError ? 'aria-invalid="true"' : ''}
            ${isDisabled ? 'disabled' : ''}
            ${isReadonly ? 'readonly' : ''}
            value="${escapeHtml(currentValue)}"
            autocomplete="off"
            spellcheck="false"
          />

          ${config.suffix ? `<span class="ndi-input__suffix" aria-hidden="true">${escapeHtml(config.suffix)}</span>` : ''}

          ${
            config.showMax
              ? `<button
                  class="ndi-input__max-btn"
                  type="button"
                  aria-label="Set maximum value"
                  ${isDisabled ? 'disabled' : ''}
                >MAX</button>`
              : ''
          }
        </div>

        ${
          config.helper
            ? `<p class="ndi-input__helper" id="${escapeHtml(helperId)}">${escapeHtml(config.helper)}</p>`
            : ''
        }

        <p
          class="ndi-input__error"
          id="${escapeHtml(errorId)}"
          role="alert"
          aria-live="polite"
        >${escapeHtml(config.error)}</p>
      </div>`;

    this.#bindEvents(config, isNumeric);
  }

  #bindEvents(config, isNumeric) {
    const control = this.#inputEl;
    if (!control) return;

    control.addEventListener('input', () => {
      let val = control.value;

      if (isNumeric) {
        val = formatDecimalInput(val, config.maxDecimals);
        // Only rewrite the value when sanitised form differs, to avoid
        // moving the cursor unnecessarily on valid input.
        if (val !== control.value) {
          const pos = control.selectionStart ?? val.length;
          control.value = val;
          // Restore cursor position after programmatic change.
          try {
            control.setSelectionRange(pos, pos);
          } catch {
            // Some input types don't support setSelectionRange; ignore.
          }
        }
      }

      this.dispatchEvent(
        new CustomEvent('ndi:input', {
          bubbles: true,
          composed: true,
          detail: { value: val },
        }),
      );
    });

    control.addEventListener('change', () => {
      this.dispatchEvent(
        new CustomEvent('ndi:change', {
          bubbles: true,
          composed: true,
          detail: { value: control.value },
        }),
      );
    });

    const maxBtn = this.shadowRoot?.querySelector('.ndi-input__max-btn');
    if (maxBtn) {
      maxBtn.addEventListener('click', () => {
        this.dispatchEvent(
          new CustomEvent('ndi:max', {
            bubbles: true,
            composed: true,
          }),
        );
      });
    }
  }
}

if (!customElements.get('ndi-input')) {
  customElements.define('ndi-input', NdiInput);
}

export { NdiInput };
export default NdiInput;
