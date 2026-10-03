import { expect, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExtrasMenu } from './ExtrasMenu';

test('the Extras menu uses the original button and locked-overlay art', () => {
  const html = renderToStaticMarkup(React.createElement(ExtrasMenu, {
    onBack: () => undefined,
    onStartLinearMode: () => undefined,
    onGoToLevelSelect: () => undefined,
    onGoToOptions: () => undefined,
  }));

  for (const sprite of ['ui_button_linear_mode', 'ui_button_level_select', 'ui_button_controls']) {
    expect(html).toContain(`/assets/sprites/${sprite}.png`);
  }
  expect(html.match(/src="\/assets\/sprites\/ui_locked\.png"/g)).toHaveLength(2);
  expect(html).not.toContain('🔒');
  expect(html).toContain('aria-label="Linear Mode, locked"');
  expect(html).toContain('aria-label="Level Select, locked"');
  expect(html).toContain('aria-label="Controls"');
});
