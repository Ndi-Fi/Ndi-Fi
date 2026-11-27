/**
 * mobile-components.js — issue #148
 *
 * Lightweight vanilla-JS helpers for mobile-first interactive patterns:
 *   - openBottomSheet(el)  / closeBottomSheet(el)
 *   - initBottomSheet(el)  — wires up backdrop + close-button listeners
 *
 * No framework or build step required.
 */

/**
 * Open a bottom-sheet (or centred modal on tablet+).
 *
 * @param {HTMLElement} sheet - Element with class `ndi-bottom-sheet`
 */
export function openBottomSheet(sheet) {
  if (!sheet) return;
  sheet.removeAttribute('hidden');
  // Allow the browser one frame to register the element before animating
  requestAnimationFrame(() => {
    sheet.classList.add('is-open');
    document.body.classList.add('ndi-scroll-lock');
    // Move focus into the panel for accessibility
    const panel = sheet.querySelector('.ndi-bottom-sheet__panel');
    if (panel) {
      panel.setAttribute('tabindex', '-1');
      panel.focus({ preventScroll: true });
    }
  });
}

/**
 * Close a bottom-sheet and restore scroll.
 *
 * @param {HTMLElement} sheet
 */
export function closeBottomSheet(sheet) {
  if (!sheet) return;
  sheet.classList.remove('is-open');
  document.body.classList.remove('ndi-scroll-lock');
  // Wait for the CSS transition to finish before hiding the element
  const panel = sheet.querySelector('.ndi-bottom-sheet__panel');
  const duration = parseFloat(getComputedStyle(panel || sheet).transitionDuration) * 1000 || 280;
  setTimeout(() => {
    if (!sheet.classList.contains('is-open')) {
      sheet.setAttribute('hidden', '');
    }
  }, duration);
}

/**
 * Wire up a bottom-sheet element.
 * - Closes on backdrop click
 * - Closes on the `.ndi-bottom-sheet__close` button click
 * - Closes on Escape key while open
 *
 * @param {HTMLElement} sheet
 * @returns {{ open: () => void, close: () => void }} control handle
 */
export function initBottomSheet(sheet) {
  if (!sheet) return { open: () => {}, close: () => {} };

  const backdrop = sheet.querySelector('.ndi-bottom-sheet__backdrop');
  const closeBtn = sheet.querySelector('.ndi-bottom-sheet__close');

  if (backdrop) {
    backdrop.addEventListener('click', () => closeBottomSheet(sheet));
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', () => closeBottomSheet(sheet));
  }

  // Escape key
  function onKeyDown(e) {
    if (e.key === 'Escape' && sheet.classList.contains('is-open')) {
      closeBottomSheet(sheet);
    }
  }
  document.addEventListener('keydown', onKeyDown);

  return {
    open: () => openBottomSheet(sheet),
    close: () => closeBottomSheet(sheet),
    destroy: () => document.removeEventListener('keydown', onKeyDown),
  };
}
