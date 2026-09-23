import { expect, test } from 'bun:test';
import { GameFlowEvent, GameFlowEventType } from './GameFlowEvent';

test('an event posted by a listener waits until the next game-flow update', () => {
  const flow = new GameFlowEvent();
  const received: number[] = [];
  flow.addListener((event, index) => {
    expect(event).toBe(GameFlowEventType.SHOW_DIALOG_CHARACTER1);
    received.push(index);
    if (index < 2) flow.post(event, index + 1);
  });
  flow.post(GameFlowEventType.SHOW_DIALOG_CHARACTER1, 0);

  flow.update();
  expect(received).toEqual([0]);
  expect(flow.hasPendingEvents()).toBe(true);
  flow.update();
  expect(received).toEqual([0, 1]);
  expect(flow.hasPendingEvents()).toBe(true);
  flow.update();
  expect(received).toEqual([0, 1, 2]);
  expect(flow.hasPendingEvents()).toBe(false);
});

test('reset during dispatch cancels the rest of the current batch', () => {
  const flow = new GameFlowEvent();
  const received: number[] = [];
  flow.addListener((_event, index) => {
    received.push(index);
    if (index === 0) flow.reset();
  });
  flow.post(GameFlowEventType.SHOW_DIALOG_CHARACTER1, 0);
  flow.post(GameFlowEventType.SHOW_DIALOG_CHARACTER1, 1);
  flow.update();
  expect(received).toEqual([0]);
  expect(flow.hasPendingEvents()).toBe(false);
});
