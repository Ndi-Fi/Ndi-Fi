import assert from 'node:assert/strict';
import test from 'node:test';

import { FakeEvent, installDom } from '../../test/helpers/dom.js';

const document = installDom();
const { NdiOnboardingTour, NdiHint, setOnboarding, getOnboarding } = await import('./ndi-onboarding.js');
const { createOnboarding, TOUR_STATUS } = await import('./onboarding-model.js');

function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
}

function fresh(context = {}) {
  const controller = createOnboarding({ storage: memoryStorage(), context });
  setOnboarding(controller);
  return controller;
}

function mountTour(attrs = {}) {
  const tour = document.createElement('ndi-onboarding-tour');
  for (const [k, v] of Object.entries(attrs)) tour.setAttribute(k, v === true ? '' : v);
  document.body.appendChild(tour);
  return tour;
}

const q = (node, cls) => node.shadowRoot.querySelector(`.${cls}`);
const panel = (tour) => q(tour, 'ndi-tour');
const isHidden = (node) => node.hasAttribute('hidden');
const buttons = (tour) => {
  const footer = q(tour, 'ndi-tour__footer');
  const [skip, nav] = footer.children;
  const [back, next] = nav.children;
  return { skip, back, next };
};

test('registers both elements', () => {
  assert.equal(customElements.get('ndi-onboarding-tour'), NdiOnboardingTour);
  assert.equal(customElements.get('ndi-hint'), NdiHint);
});

test('getOnboarding returns a shared controller', () => {
  setOnboarding(null);
  assert.equal(getOnboarding(), getOnboarding());
});

test('autostart opens the tour for a first-time visitor', () => {
  const controller = fresh();
  const tour = mountTour({ autostart: true });
  assert.equal(isHidden(panel(tour)), false);
  assert.equal(panel(tour).getAttribute('role'), 'dialog');
  assert.equal(q(tour, 'ndi-tour__title').textContent, 'Welcome to Ndi-Fi');
  assert.equal(q(tour, 'ndi-tour__progress').textContent, 'Step 1 of 6');
  assert.equal(document.activeElement, q(tour, 'ndi-tour__title'), 'focus moves to the step heading');
  assert.equal(controller.state.status, TOUR_STATUS.ACTIVE);
  tour.remove();
});

test('without autostart, or for a returning user, the tour stays closed', () => {
  fresh();
  const manual = mountTour();
  assert.equal(isHidden(panel(manual)), true);
  manual.remove();

  const done = fresh();
  done.complete();
  const returning = mountTour({ autostart: true });
  assert.equal(isHidden(panel(returning)), true);
  returning.remove();
});

test('Next/Back navigate, Back is hidden on the first step, last step says Finish', () => {
  fresh({ walletConnected: true });
  const tour = mountTour({ autostart: true, 'wallet-connected': true });
  const { back, next, skip } = buttons(tour);
  assert.equal(isHidden(back), true);
  next.click();
  assert.equal(q(tour, 'ndi-tour__title').textContent, 'Earn by depositing');
  assert.equal(isHidden(back), false);
  back.click();
  assert.equal(q(tour, 'ndi-tour__title').textContent, 'Welcome to Ndi-Fi');

  tour.controller.acknowledgeRisk();
  for (let i = 0; i < 4; i++) next.click();
  assert.equal(next.textContent, 'Finish');
  assert.equal(isHidden(skip), true, 'no Skip on the final step');
  next.click();
  assert.equal(isHidden(panel(tour)), true);
  assert.equal(tour.controller.state.status, TOUR_STATUS.COMPLETED);
  tour.remove();
});

test('the risk step shows education points and gates Next behind the checkbox', () => {
  fresh({ walletConnected: true });
  const tour = mountTour({ autostart: true, 'wallet-connected': true });
  const { next } = buttons(tour);
  next.click(); // deposit
  next.click(); // borrow-risk
  assert.equal(q(tour, 'ndi-tour__title').textContent, 'Borrowing has real risk');
  assert.equal(q(tour, 'ndi-tour__points').children.length, 4);
  assert.equal(isHidden(q(tour, 'ndi-tour__ack')), false);
  assert.equal(next.hasAttribute('disabled'), true);
  assert.equal(next.getAttribute('aria-disabled'), 'true');

  const box = q(tour, 'ndi-tour__ack').children[0];
  box.checked = true;
  box.dispatchEvent(new FakeEvent('change'));
  assert.equal(next.hasAttribute('disabled'), false);
  next.click();
  assert.equal(q(tour, 'ndi-tour__title').textContent, 'Stake to earn NDI');
  tour.remove();
});

test('the wallet step offers Connect wallet and emits an event; connecting removes the step', () => {
  fresh();
  const tour = mountTour({ autostart: true });
  buttons(tour).next.click();
  const cta = q(tour, 'ndi-tour__cta');
  assert.equal(isHidden(cta), false);
  assert.equal(cta.textContent, 'Connect wallet');
  let fired = 0;
  tour.addEventListener('ndi-onboarding-connect-wallet', () => fired++);
  cta.click();
  assert.equal(fired, 1);

  tour.setAttribute('wallet-connected', '');
  assert.equal(q(tour, 'ndi-tour__title').textContent, 'Earn by depositing');
  assert.equal(q(tour, 'ndi-tour__progress').textContent, 'Step 2 of 5');
  tour.remove();
});

test('the step target is spotlighted and released', () => {
  fresh({ walletConnected: true });
  const target = document.createElement('a');
  target.setAttribute('data-tour', 'deposit');
  document.body.appendChild(target);
  const tour = mountTour({ autostart: true, 'wallet-connected': true });
  buttons(tour).next.click();
  assert.equal(target.hasAttribute('data-ndi-tour-target'), true);
  buttons(tour).back.click();
  assert.equal(target.hasAttribute('data-ndi-tour-target'), false);
  tour.remove();
  target.remove();
});

test('Skip, the close button and Escape all end the tour', () => {
  for (const how of ['skip', 'close', 'escape']) {
    fresh();
    const tour = mountTour({ autostart: true });
    if (how === 'skip') buttons(tour).skip.click();
    if (how === 'close') q(tour, 'ndi-tour__close').click();
    if (how === 'escape') panel(tour).dispatchEvent(new FakeEvent('keydown', { key: 'Escape' }));
    assert.equal(isHidden(panel(tour)), true, how);
    assert.equal(tour.controller.state.status, TOUR_STATUS.SKIPPED, how);
    tour.remove();
  }
});

test('a [data-ndi-tour-replay] control replays the tour', () => {
  const controller = fresh();
  controller.complete();
  const tour = mountTour();
  const replay = document.createElement('button');
  replay.setAttribute('data-ndi-tour-replay', '');
  document.body.appendChild(replay);
  replay.click();
  assert.equal(isHidden(panel(tour)), false);
  assert.equal(q(tour, 'ndi-tour__title').textContent, 'Welcome to Ndi-Fi');

  buttons(tour).skip.click();
  assert.equal(document.activeElement, replay, 'focus returns to the replay control');
  tour.remove();
  replay.remove();
});

test('emits ndi-onboarding-change with status and step', () => {
  fresh();
  const tour = document.createElement('ndi-onboarding-tour');
  const seen = [];
  tour.addEventListener('ndi-onboarding-change', (e) => seen.push(e.detail));
  document.body.appendChild(tour);
  tour.start();
  tour.skip();
  assert.deepEqual(seen.map((d) => [d.reason, d.status, d.stepId]), [
    ['start', 'active', 'welcome'],
    ['skip', 'skipped', null],
  ]);
  tour.remove();
});

test('<ndi-hint> shows once and remembers dismissal across elements', () => {
  const controller = fresh();
  controller.skip();
  const hint = document.createElement('ndi-hint');
  hint.setAttribute('hint-id', 'borrow-health-factor');
  document.body.appendChild(hint);
  const box = q(hint, 'ndi-hint');
  assert.equal(isHidden(box), false);
  assert.equal(q(hint, 'ndi-hint__title').textContent, 'Keep a safety buffer');
  assert.equal(box.getAttribute('aria-label'), 'Keep a safety buffer');

  const dismissed = [];
  hint.addEventListener('ndi-hint-dismiss', (e) => dismissed.push(e.detail.id));
  q(hint, 'ndi-hint__dismiss').click();
  assert.equal(isHidden(box), true);
  assert.equal(hint.hasAttribute('hidden'), true);
  assert.deepEqual(dismissed, ['borrow-health-factor']);

  const again = document.createElement('ndi-hint');
  again.setAttribute('hint-id', 'borrow-health-factor');
  document.body.appendChild(again);
  assert.equal(isHidden(q(again, 'ndi-hint')), true);
  hint.remove();
  again.remove();
});

test('<ndi-hint> hides while the tour runs and for unknown ids', () => {
  const controller = fresh();
  const hint = document.createElement('ndi-hint');
  hint.setAttribute('hint-id', 'deposit-shares');
  document.body.appendChild(hint);
  controller.start();
  assert.equal(isHidden(q(hint, 'ndi-hint')), true);
  controller.skip();
  assert.equal(isHidden(q(hint, 'ndi-hint')), false);
  hint.setAttribute('hint-id', 'nope');
  assert.equal(isHidden(q(hint, 'ndi-hint')), true);
  hint.remove();
});
