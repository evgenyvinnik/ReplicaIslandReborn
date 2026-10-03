import { expect, test } from 'bun:test';
import { file } from 'bun';
import { join } from 'node:path';

const root = join(import.meta.dir, '..');
const siteUrl = 'https://evgenyvinnik.github.io/ReplicaIslandReborn/';
const imageUrl = `${siteUrl}social-preview.png`;

test('the public HTML gives crawlers a canonical URL and complete social cards', async () => {
  const html = await file(join(root, 'index.html')).text();
  const metadata = (attribute: 'name' | 'property', key: string): string | undefined =>
    html.match(new RegExp(`<meta ${attribute}="${key}" content="([^"]+)"`))?.[1];

  expect(html).toContain(`<link rel="canonical" href="${siteUrl}"`);
  expect(html).toContain('<title>Replica Island Reborn — Play the Classic Android Game Online</title>');
  expect(metadata('name', 'description')).toContain('browser port');
  expect(metadata('property', 'og:type')).toBe('website');
  expect(metadata('property', 'og:url')).toBe(siteUrl);
  expect(metadata('property', 'og:image')).toBe(imageUrl);
  expect(metadata('name', 'twitter:card')).toBe('summary_large_image');
  expect(metadata('name', 'twitter:image')).toBe(imageUrl);
  expect(metadata('property', 'og:image:alt')).toBeTruthy();
  expect(metadata('name', 'twitter:image:alt')).toBeTruthy();

  const jsonLd = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/)?.[1];
  expect(jsonLd).toBeTruthy();
  const game = JSON.parse(jsonLd!) as { '@type': string[]; url: string; image: string; offers: { price: string } };
  expect(game['@type']).toEqual(['VideoGame', 'WebApplication']);
  expect(game.url).toBe(siteUrl);
  expect(game.image).toBe(imageUrl);
  expect(game.offers.price).toBe('0');
});

test('the share image and sitemap match the published metadata', async () => {
  const image = file(join(root, 'public/social-preview.png'));
  expect(await image.exists()).toBe(true);
  const bytes = Buffer.from(await image.arrayBuffer());
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  expect(bytes.readUInt32BE(16)).toBe(1734);
  expect(bytes.readUInt32BE(20)).toBe(907);

  const sitemap = await file(join(root, 'public/sitemap.xml')).text();
  expect(sitemap).toContain(`<loc>${siteUrl}</loc>`);
});
