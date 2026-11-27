const assert = require('assert');

const hungry = {
  hunger: 95, thirst: 90, mood: 15, energy: 70, clean: 12,
  updatedAt: Date.now(),
};
global.localStorage = {
  getItem: () => JSON.stringify(hungry),
  setItem: () => {},
  removeItem: () => {},
};

const m = require('./_petcare_bundle.cjs');

const healthy = { hunger: 18, thirst: 14, mood: 82, energy: 90, clean: 88, updatedAt: Date.now() };
const needs = (over) => m.petCareNeeds({ ...healthy, ...over });

assert.strictEqual(needs({}).length, 0, 'a healthy pet has no needs');

let n = needs({ hunger: 60 });
assert.strictEqual(n.length, 1);
assert.strictEqual(n[0].action, 'feed');
assert.strictEqual(n[0].urgent, false, 'hunger 60 is a warning, not urgent');

n = needs({ hunger: 90 });
assert.strictEqual(n[0].urgent, true, 'hunger 90 is urgent');

n = needs({ hunger: 60, thirst: 90 });
assert.strictEqual(n[0].action, 'drink', 'urgent thirst outranks mild hunger');
assert.strictEqual(n.length, 2);

n = needs({ clean: 20 });
assert.strictEqual(n[0].action, 'bath');
assert.strictEqual(n[0].urgent, true, 'clean 20 is urgent');

n = needs({ mood: 30 });
assert.strictEqual(n[0].action, 'play');
assert.strictEqual(n[0].urgent, false);

n = needs({ hunger: 95, thirst: 95, clean: 10, mood: 10 });
assert.strictEqual(n.length, 4, 'all four needs reported');
assert.ok(n.every((x) => x.urgent), 'all four are urgent');
assert.ok(n.every((x) => x.actionLabel && x.text && x.icon), 'every need has actionable copy');

assert.strictEqual(m.petCareWarning({ ...healthy }), null);
assert.strictEqual(typeof m.petCareWarning({ ...healthy, hunger: 95 }), 'string');

const res = m.applyPetCareAction('feed');
assert.ok(res.state.hunger < hungry.hunger, 'feeding reduces hunger');
assert.ok(typeof res.feedback === 'string' && res.feedback.length > 0);

console.log('petCare needs + reminders: ALL CHECKS PASSED');
