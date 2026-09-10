import { expect, test } from 'bun:test';
import process from 'node:process';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AndroidRecentsScreen } from './AndroidRecentsScreen';

test('Recents artwork resolves beneath the deployment base, including GitHub project pages', () => {
  const previous = process.env.BASE_URL;
  try {
    for (const base of ['/', '/ReplicaIslandReborn/']) {
      process.env.BASE_URL = base;
      const html = renderToStaticMarkup(React.createElement(AndroidRecentsScreen, { onResume: () => undefined }));
      for (const name of ['title_background.png', 'title.png', 'icon.png']) {
        expect(html.includes(`${base}assets/sprites/${name}`)).toBe(true);
      }
      if (base !== '/') expect(html.includes('url(/assets/')).toBe(false);
    }
  } finally {
    if (previous === undefined) delete process.env.BASE_URL;
    else process.env.BASE_URL = previous;
  }
});
