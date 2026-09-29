import { expect, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PhoneFrame } from './PhoneFrame';

function render(showPauseControl: boolean, isPaused: boolean): string {
  return renderToStaticMarkup(React.createElement(PhoneFrame, {
    gameWidth: 480,
    gameHeight: 320,
    showPauseControl,
    isPaused,
    onPause: () => undefined,
    onBack: () => undefined,
    children: React.createElement('canvas'),
  }));
}

test('mobile gameplay exposes Pause, then Resume and a menu escape', () => {
  const playing = render(true, false);
  expect(playing).toContain('aria-label="Pause game"');
  expect(playing).not.toContain('aria-label="Return to main menu"');

  const paused = render(true, true);
  expect(paused).toContain('aria-label="Resume game"');
  expect(paused).toContain('aria-label="Return to main menu"');

  const menu = render(false, false);
  expect(menu).not.toContain('class="mobile-game-actions"');
});
