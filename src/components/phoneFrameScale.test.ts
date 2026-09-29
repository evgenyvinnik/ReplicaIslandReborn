import { expect, test } from 'bun:test';
import { fitPhoneFrame } from './phoneFrameScale';

test('a desktop viewport keeps the original phone size', () => {
  expect(fitPhoneFrame(1200, 700, 671, 400)).toBe(1);
});

test('a portrait phone fits the full game screen instead of cropping its controls', () => {
  expect(fitPhoneFrame(344, 784, 480, 320)).toBeCloseTo(344 / 480);
});

test('a short landscape viewport fits by height', () => {
  expect(fitPhoneFrame(784, 280, 480, 320)).toBeCloseTo(280 / 320);
});

test('unmeasured and invalid dimensions do not hide the game', () => {
  expect(fitPhoneFrame(0, 784, 480, 320)).toBe(1);
  expect(fitPhoneFrame(344, 784, Number.NaN, 320)).toBe(1);
});
