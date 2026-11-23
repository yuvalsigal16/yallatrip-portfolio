// Unit tests for the sign-in rules. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emailError, isAuthOnlyPage, isProtectedPath, parseLogin, parseNewPassword, parseOnboarding, parseYesNo,
  parseSignup, passwordError, safeNextPath,
} from '../src/lib/auth/rules';
import { authErrorMessage, callbackErrorMessage, GENERIC_ERROR } from '../src/lib/auth/errors';

// ---------- protected pages ----------
test('trip, onboarding and profile pages are protected', () => {
  for (const p of ['/trips', '/trips/abc', '/onboarding', '/profile']) assert.ok(isProtectedPath(p), p);
  for (const p of ['/', '/login', '/signup', '/tripsomething', '/auth/callback', '/reset-password']) {
    assert.ok(!isProtectedPath(p), p);
  }
});
test('login pages are for visitors only', () => {
  assert.ok(isAuthOnlyPage('/login'));
  assert.ok(isAuthOnlyPage('/forgot-password'));
  assert.ok(!isAuthOnlyPage('/reset-password'));
});

// ---------- open-redirect protection ----------
test('"next" stays on this site', () => {
  assert.equal(safeNextPath('/trips/123?day=2'), '/trips/123?day=2');
  assert.equal(safeNextPath('/profile'), '/profile');
});
test('"next" pointing elsewhere falls back to /trips', () => {
  for (const bad of ['https://evil.com', '//evil.com', '/\\evil.com', 'evil.com', '/x\nSet-Cookie:a', '', null, 42, '/login']) {
    assert.equal(safeNextPath(bad), '/', String(bad));
  }
  assert.equal(safeNextPath('/%0d%0a'), '/%0d%0a'); // encoded stays inert
  assert.equal(safeNextPath('/' + 'a'.repeat(600)), '/');
});

// ---------- fields ----------
test('email validation', () => {
  assert.equal(emailError('dana@example.com'), null);
  assert.equal(emailError('  dana@example.co.il '), null);
  assert.ok(emailError(''));
  assert.ok(emailError('dana@'));
  assert.ok(emailError('dana example.com'));
});
test('password rules: 8+ characters, letters and digits', () => {
  assert.equal(passwordError('rome2026'), null);
  assert.equal(passwordError('רומא2026'), null);
  assert.ok(passwordError('short1'));
  assert.ok(passwordError('onlyletters'));
  assert.ok(passwordError('12345678'));
  assert.ok(passwordError('a1' + 'x'.repeat(80)));
});

// ---------- forms ----------
test('login form: email is normalised', () => {
  const r = parseLogin({ email: ' Dana@Example.com ', password: 'x' });
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.value.email, 'dana@example.com');
  assert.ok(!parseLogin({ email: 'dana@example.com', password: '' }).ok);
});
test('sign-up form: every field is checked, passwords must match', () => {
  const good = { name: 'דנה', email: 'dana@example.com', password: 'rome2026', confirm: 'rome2026' };
  assert.ok(parseSignup(good).ok);
  const r = parseSignup({ ...good, confirm: 'rome2027' });
  assert.ok(!r.ok);
  if (!r.ok) assert.ok(r.fieldErrors.confirm);
  const r2 = parseSignup({ name: '', email: 'x', password: '1', confirm: '1' });
  assert.ok(!r2.ok);
  if (!r2.ok) assert.deepEqual(Object.keys(r2.fieldErrors).sort(), ['email', 'name', 'password']);
});
test('new password form', () => {
  assert.ok(parseNewPassword({ password: 'paris2026', confirm: 'paris2026' }).ok);
  assert.ok(!parseNewPassword({ password: 'paris2026', confirm: 'paris' }).ok);
  assert.ok(!parseNewPassword({ password: 'paris', confirm: 'paris' }).ok);
});
test('onboarding keeps only known answers', () => {
  const a = parseOnboarding(['food', 'hacking', 'food', 'culture'], 'medium', ['walk', 'rocket']);
  assert.deepEqual(a, { travelStyles: ['food', 'culture'], budget: 'medium', transport: ['walk'] });
  assert.equal(parseOnboarding([], 'millionaire', []).budget, null);
});

// ---------- error messages ----------
test('Supabase errors become Hebrew messages', () => {
  assert.equal(authErrorMessage({ code: 'invalid_credentials' }), 'האימייל או הסיסמה לא נכונים');
  assert.match(authErrorMessage({ code: 'email_not_confirmed' }), /לאשר את האימייל/);
  assert.match(authErrorMessage({ status: 429 }), /יותר מדי/);
  assert.equal(authErrorMessage({ code: 'something_new' }), GENERIC_ERROR);
  assert.equal(authErrorMessage(null), GENERIC_ERROR);
  assert.equal(callbackErrorMessage(null), null);
  assert.match(callbackErrorMessage('google')!, /Google/);
});

test('yes/no answers (keeps Shabbat, keeps kosher): only "yes" and "no" count', () => {
  assert.equal(parseYesNo('yes'), true);
  assert.equal(parseYesNo('no'), false);
  assert.equal(parseYesNo(null), null);
  assert.equal(parseYesNo('maybe'), null);
});
