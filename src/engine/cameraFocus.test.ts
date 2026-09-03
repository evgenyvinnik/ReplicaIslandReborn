/**
 * Camera focus handover between levels.
 *
 * `setTarget()` is deliberately ignored while the camera is in NPC focus mode,
 * so a cutscene NPC keeps the camera until its script hands it back. The trap
 * is that a cutscene level has no player to hand it back *to*: NPCComponent
 * only calls releaseNPCFocus() when there is a player, so on a level like
 * level_0_1_sewer the flag is still set when the level ends.
 *
 * If that survives into the next level, every `setTarget(player)` is silently
 * swallowed and the camera stays pointed at whatever object now sits in the
 * old NPC's slot - the player walks off-screen and the objects around him are
 * deactivated by distance. The level-load path resets the camera to prevent it.
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CameraSystem } from './CameraSystem';
import { GameObject } from '../entities/GameObject';

function objectAt(x: number, y: number, type: string): GameObject {
  const object = new GameObject();
  object.type = type;
  object.setPosition(x, y);
  object.width = 32;
  object.height = 32;
  return object;
}

describe('camera focus', () => {
  test('an NPC in focus keeps the camera away from the player', () => {
    const camera = new CameraSystem(480, 320);
    const npc = objectAt(1000, 100, 'npc');
    const player = objectAt(100, 100, 'player');

    camera.setNPCTarget(npc);
    expect(camera.isNPCFocusMode()).toBe(true);

    // This is the deliberate no-op that makes cutscenes work.
    camera.setTarget(player);
    expect(camera.getTarget()).toBe(npc);
  });

  test('releasing focus hands the camera back', () => {
    const camera = new CameraSystem(480, 320);
    const npc = objectAt(1000, 100, 'npc');
    const player = objectAt(100, 100, 'player');

    camera.setNPCTarget(npc);
    camera.releaseNPCFocus(player);

    expect(camera.isNPCFocusMode()).toBe(false);
    expect(camera.getTarget()).toBe(player);
  });

  test('reset clears NPC focus so the next level can aim the camera', () => {
    const camera = new CameraSystem(480, 320);
    // A cutscene level takes focus and never releases it - there is no player.
    camera.setNPCTarget(objectAt(1000, 100, 'npc'));
    expect(camera.isNPCFocusMode()).toBe(true);

    // What the level-load path does before aiming at the new level.
    camera.reset();
    expect(camera.isNPCFocusMode()).toBe(false);
    expect(camera.getNPCTarget()).toBeNull();

    const player = objectAt(100, 100, 'player');
    camera.setTarget(player);
    expect(camera.getTarget()).toBe(player);
  });

  test('a stale focus would otherwise capture the next level\'s objects', () => {
    // The failure this guards against: the camera holds an object from the
    // previous level, and whatever occupies that slot next keeps the camera.
    const camera = new CameraSystem(480, 320);
    const cutsceneNpc = objectAt(1730, 100, 'npc');
    camera.setNPCTarget(cutsceneNpc);

    // Next level loads; the object is recycled as something else entirely.
    cutsceneNpc.type = 'button';
    cutsceneNpc.subType = 'red';

    const player = objectAt(96, 464, 'player');
    camera.setTarget(player);
    // Without a reset the camera is still following a button.
    expect((camera.getTarget() as GameObject).type).toBe('button');

    camera.reset();
    camera.setTarget(player);
    expect(camera.getTarget()).toBe(player);
  });

  test('every level-load path clears the camera before aiming it', () => {
    // Game.tsx sets the camera up in several places - initial load, two level
    // transitions, a respawn - and each one calls setBounds() and then aims at
    // the new player. Any of them that forgets to clear first inherits a
    // cutscene NPC's focus and silently ignores its own setTarget(), which is
    // how this shipped broken. Four of the five sites had no reset at all.
    const source = readFileSync(
      join(import.meta.dir, '../components/Game.tsx'),
      'utf8'
    );
    const lines = source.split('\n');
    const missing: number[] = [];
    lines.forEach((line, index) => {
      if (!line.includes('cameraSystem.setBounds({')) return;
      // The reset must appear in the few lines immediately before it.
      const preceding = lines.slice(Math.max(0, index - 8), index).join('\n');
      if (!preceding.includes('cameraSystem.reset()')) missing.push(index + 1);
    });
    expect(missing, `camera setup without a reset at Game.tsx line(s) ${missing.join(', ')}`)
      .toEqual([]);
    // Guard against the check silently matching nothing if the code moves.
    const sites = lines.filter((l) => l.includes('cameraSystem.setBounds({')).length;
    expect(sites).toBeGreaterThanOrEqual(4);
  });
});
