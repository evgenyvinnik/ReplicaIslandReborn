import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { KeyboardHint } from './KeyboardHint';
import { DEFAULT_KEY_BINDINGS } from '../stores/useGameStore';

test('keyboard help renders every saved action binding, including alternate and custom keys', () => {
  const render = (bindings: typeof DEFAULT_KEY_BINDINGS): string =>
    renderToStaticMarkup(React.createElement(KeyboardHint, { bindings }));
  const defaults = render(DEFAULT_KEY_BINDINGS);
  for (const label of ['←/A left', '→/D right', 'Space fly', 'X/Z stomp/orb', 'Esc/P pause']) {
    expect(defaults.includes(label)).toBe(true);
  }
  const custom = render({ ...DEFAULT_KEY_BINDINGS, left: ['KeyF'], right: ['KeyH'],
    jump: ['KeyQ'], attack: ['KeyE', 'Digit1'], pause: [] });
  for (const label of ['F left', 'H right', 'Q fly', 'E/1 stomp/orb', 'Unbound pause']) {
    expect(custom.includes(label)).toBe(true);
  }
  expect(custom.includes('Space fly')).toBe(false);
});

test('phone help subscribes to committed key settings and wraps without widening the game', () => {
  const source = readFileSync(new URL('./PhoneFrame.tsx', import.meta.url), 'utf8');
  expect(source.includes('useGameStore((state) => state.settings.keyBindings)')).toBe(true);
  expect(source.includes('<KeyboardHint bindings={keyBindings} />')).toBe(true);
  expect(source.includes('WASD/Arrows')).toBe(false);
  const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
  const rule = css.match(/\.keyboard-hint-below\s*\{([^}]+)\}/)?.[1] ?? '';
  expect(rule.includes('flex-wrap: wrap')).toBe(true);
  expect(rule.includes('max-width: 600px')).toBe(true);
});
