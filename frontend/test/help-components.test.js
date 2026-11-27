import test from 'node:test';
import assert from 'node:assert/strict';

import { FakeEvent, installDom } from './helpers/dom.js';

const document = installDom();
const { NdiTooltip, NdiInlineHelp } = await import('../src/help-components.js');
const { getActiveLocale, setActiveLocale } = await import('../src/help-content.js');

function mount(tag, attributes = {}) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  document.body.appendChild(node);
  return node;
}

function tooltip(attributes = {}) {
  return mount('ndi-tooltip', { term: 'apr', ...attributes });
}

function inlineHelp(attributes = {}) {
  return mount('ndi-inline-help', { term: 'healthFactor', ...attributes });
}

test('custom elements register and upgrade to the exported classes', () => {
  assert.equal(customElements.get('ndi-tooltip'), NdiTooltip);
  assert.equal(customElements.get('ndi-inline-help'), NdiInlineHelp);
});

test('tooltip has an accessible, labelled trigger and a described tooltip panel', () => {
  const tip = tooltip();
  const { _trigger: trigger, _panel: panel } = tip;

  assert.equal(trigger.tagName, 'BUTTON');
  assert.equal(trigger.getAttribute('type'), 'button');
  assert.equal(trigger.getAttribute('aria-label'), 'What is APR?');
  assert.equal(trigger.getAttribute('aria-describedby'), panel.id);
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(panel.getAttribute('role'), 'tooltip');
  assert.equal(panel.hidden, true);
  assert.match(tip._summary.textContent, /yearly interest rate/i);
  tip.remove();
});

test('tooltip opens on hover/focus and closes on Escape, blur or outside click', () => {
  const tip = tooltip();
  const { _trigger: trigger, _panel: panel } = tip;

  tip.dispatchEvent(new FakeEvent('mouseenter'));
  assert.equal(tip.isOpen, true);
  assert.equal(panel.hidden, false);
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');

  trigger.focus(); // keyboard user reaches the trigger; focus stays there
  trigger.dispatchEvent(new FakeEvent('keydown', { key: 'Escape' }));
  assert.equal(tip.isOpen, false);
  assert.equal(panel.hidden, true);
  assert.equal(document.activeElement, trigger);
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');

  document.activeElement = document.body; // simulate tabbing away before returning
  trigger.focus();
  assert.equal(tip.isOpen, true);

  trigger.dispatchEvent(new FakeEvent('focusout', { relatedTarget: document.body }));
  assert.equal(tip.isOpen, false);

  trigger.dispatchEvent(new FakeEvent('click'));
  assert.equal(tip.isOpen, true);
  document.dispatchEvent(new FakeEvent('pointerdown', { target: document.body }));
  assert.equal(tip.isOpen, false);
  tip.remove();
});

test('tooltip copy follows the locale attribute and unknown terms fail closed', () => {
  const tip = tooltip();
  tip.setAttribute('locale', 'es');
  assert.equal(tip._trigger.getAttribute('aria-label'), '¿Qué es APR?');
  assert.match(tip._summary.textContent, /tasa de interés anual/i);

  const customLabel = tooltip({ label: 'Need help?' });
  assert.equal(customLabel._trigger.getAttribute('aria-label'), 'Need help?');

  const unknown = tooltip({ term: 'noSuchConcept' });
  assert.equal(unknown.hidden, true);
  assert.equal(unknown.isOpen, false);
  tip.remove();
  customLabel.remove();
  unknown.remove();
});

test('inline help discloses the longer explanation progressively', () => {
  const help = inlineHelp();
  const { _toggle: toggle, _details: details } = help;

  assert.equal(toggle.tagName, 'BUTTON');
  assert.equal(toggle.getAttribute('type'), 'button');
  assert.equal(toggle.getAttribute('aria-controls'), details.id);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(toggle.textContent, 'Learn more');
  assert.equal(details.hidden, true);
  assert.equal(details.getAttribute('role'), 'region');
  assert.equal(details.getAttribute('aria-labelledby'), help._term.id);
  assert.match(help._summary.textContent, /how safe your loan is/i);

  toggle.dispatchEvent(new FakeEvent('click'));
  assert.equal(help.isExpanded, true);
  assert.equal(details.hidden, false);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(toggle.textContent, 'Show less');
  assert.match(help._body.textContent, /Above 1/);

  toggle.dispatchEvent(new FakeEvent('click'));
  assert.equal(help.isExpanded, false);
  assert.equal(details.hidden, true);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  help.remove();
});

test('inline help stays expanded when the locale changes and uses localised copy', () => {
  const help = inlineHelp();
  help._toggle.dispatchEvent(new FakeEvent('click'));
  help.setAttribute('locale', 'fr');

  assert.equal(help.isExpanded, true);
  assert.equal(help._toggle.textContent, 'Réduire');
  assert.equal(help._term.textContent, 'Facteur de santé');
  assert.match(help._body.textContent, /Au-dessus de 1/);

  const unknown = inlineHelp({ term: 'missing' });
  assert.equal(unknown.hidden, true);
  assert.equal(unknown.isExpanded, false);
  help.remove();
  unknown.remove();
});

test('inline help defaults to the active locale set on the content module', () => {
  const original = getActiveLocale();
  try {
    setActiveLocale('es');
    const help = inlineHelp();
    assert.equal(help._toggle.textContent, 'Más información');
    assert.equal(help._term.textContent, 'Factor de salud');
    help.remove();
  } finally {
    setActiveLocale(original);
  }
});
