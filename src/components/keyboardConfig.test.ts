import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { keyboardConfigReducer as reduce, closedKeyboardConfig } from './keyboardConfig';
import { DEFAULT_KEY_BINDINGS } from '../stores/useGameStore';

test('keyboard preferences stage edits and expose Save and Cancel instead of persisting each capture', () => {
  const source = readFileSync(new URL('./OptionsMenu.tsx', import.meta.url), 'utf8');
  expect(source.includes('setKeyBinding(keyBindingMode')).toBe(false);
  expect(source.includes('resetKeyBindings()')).toBe(false);
  expect(source.includes('preference_key_config_dialog_cancel')).toBe(true);
  expect(source.includes("setSetting('keyBindings', keyboardConfig.draft)")).toBe(true);
  expect(source.match(/setSetting\('keyBindings'/g)?.length).toBe(1);
  expect(source.includes("closest('[inert]')")).toBe(true);
  expect(source.includes("window.addEventListener('keydown', handleKeyDown, true)")).toBe(true);
});

test('editing a draft preserves saved bindings, and Cancel/reopen discards unsaved edits', () => {
  const saved = { ...DEFAULT_KEY_BINDINGS, left: ['KeyF'], jump: ['KeyQ', 'Space'] };
  let state = reduce(closedKeyboardConfig, { type: 'open', bindings: saved });
  expect(state.draft).toEqual(saved);
  expect(state.draft?.jump).not.toBe(saved.jump);
  state = reduce(state, { type: 'select', action: 'left' });
  state = reduce(state, { type: 'key', code: 'KeyH' });
  expect(state.draft?.left).toEqual(['KeyH']);
  expect(state.listening).toBeNull();
  expect(saved.left).toEqual(['KeyF']);
  state = reduce(state, { type: 'close' });
  expect(state.draft).toBeNull();
  state = reduce(state, { type: 'open', bindings: saved });
  expect(state.draft?.left).toEqual(['KeyF']);
  expect(state.draft?.jump).toEqual(['KeyQ', 'Space']);
});

test('Reset stages independent defaults and closing never changes the supplied save', () => {
  const saved = { ...DEFAULT_KEY_BINDINGS, attack: ['KeyE'] };
  let state = reduce(closedKeyboardConfig, { type: 'open', bindings: saved });
  state = reduce(state, { type: 'select', action: 'attack' });
  state = reduce(state, { type: 'reset' });
  expect(state.draft).toEqual(DEFAULT_KEY_BINDINGS);
  expect(state.draft?.attack).not.toBe(DEFAULT_KEY_BINDINGS.attack);
  expect(state.listening).toBeNull();
  state = reduce(state, { type: 'key', code: 'Escape' });
  expect(state).toEqual(closedKeyboardConfig);
  expect(saved.attack).toEqual(['KeyE']);
});

test('Escape first cancels capture, then the dialog; repeats and empty codes never bind', () => {
  let state = reduce(closedKeyboardConfig, { type: 'open', bindings: DEFAULT_KEY_BINDINGS });
  state = reduce(state, { type: 'select', action: 'jump' });
  const waiting = state;
  state = reduce(state, { type: 'key', code: 'Enter', repeat: true });
  expect(state).toBe(waiting);
  state = reduce(state, { type: 'key', code: '' });
  expect(state).toBe(waiting);
  state = reduce(state, { type: 'key', code: 'Escape' });
  expect(state.listening).toBeNull();
  expect(state.draft).toEqual(DEFAULT_KEY_BINDINGS);
  state = reduce(state, { type: 'key', code: 'Escape', repeat: true });
  expect(state.draft).not.toBeNull();
  state = reduce(state, { type: 'key', code: 'Escape' });
  expect(state).toEqual(closedKeyboardConfig);
  expect(reduce(state, { type: 'key', code: 'KeyZ' })).toBe(state);
});
