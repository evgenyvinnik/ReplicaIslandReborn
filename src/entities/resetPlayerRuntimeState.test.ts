import { describe, expect, test } from 'bun:test';
import { HitType, Team } from '../types';
import { AABoxCollisionVolume } from '../engine/collision/AABoxCollisionVolume';
import { DynamicCollisionComponent } from './components/DynamicCollisionComponent';
import { PlayerComponent, PlayerState } from './components/PlayerComponent';
import { GameObject } from './GameObject';
import { resetPlayerRuntimeState } from './resetPlayerRuntimeState';

describe('resetPlayerRuntimeState', () => {
  test('clears transient movement without stripping the configured player hitbox', () => {
    const player = new GameObject();
    player.type = 'player';
    player.width = 32;
    player.height = 48;
    player.team = Team.PLAYER;
    player.setVelocity(100, -200);

    const playerComponent = new PlayerComponent();
    playerComponent.levelWon = true;
    player.addComponent(playerComponent);

    const collision = new DynamicCollisionComponent();
    collision.setCollisionVolumes(
      [new AABoxCollisionVolume(0, 0, 32, 16, HitType.DEPRESS)],
      [new AABoxCollisionVolume(0, 0, 32, 48, HitType.HIT)],
    );
    player.addComponent(collision);

    resetPlayerRuntimeState(player);

    expect(player.width).toBe(32);
    expect(player.height).toBe(48);
    expect(player.team).toBe(Team.PLAYER);
    expect(player.getVelocity().x).toBe(0);
    expect(player.getVelocity().y).toBe(0);
    expect(playerComponent.levelWon).toBe(false);
    expect(collision.getAttackVolumes()).toHaveLength(1);
    expect(collision.getVulnerabilityVolumes()).toHaveLength(1);

    playerComponent.ghostActive = true;
    playerComponent.deactivateGhost(0.5);
    expect(playerComponent.ghostActive).toBe(false);
    expect(playerComponent.currentState).toBe(PlayerState.POST_GHOST_DELAY);
  });

  test('refills hit points so a retry does not respawn dead', () => {
    const player = new GameObject();
    player.maxLife = 3;
    player.life = 0;

    resetPlayerRuntimeState(player);

    // Hit points drive the HUD's lives counter now.
    expect(player.life).toBe(3);
  });
});
