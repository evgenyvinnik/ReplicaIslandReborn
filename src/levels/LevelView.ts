import type { CameraSystem } from '../engine/CameraSystem';
import type { GameObjectManager } from '../entities/GameObjectManager';
import type { LevelSystem } from './LevelSystemNew';
import { assetPath } from '../utils/helpers';

/** Apply the same camera rules on first load, transitions, and retries. */
export function focusLevelCamera(level: LevelSystem, manager: GameObjectManager, camera: CameraSystem, viewportHeight: number): void {
  camera.reset();
  camera.setBounds({ minX: 0, minY: 0, maxX: level.getLevelWidth(), maxY: level.getLevelHeight() });
  const player = manager.getPlayer();
  if (player) {
    camera.setTarget(player);
    camera.setPosition(player.getCenteredPositionX(), player.getCenteredPositionY());
  } else {
    const npc = manager.getActiveObjects().find(object => object.type === 'npc');
    if (npc) {
      camera.setNPCTarget(npc);
      camera.setPosition(npc.getCenteredPositionX(), level.getLevelHeight() - viewportHeight / 2);
    }
  }
}

/** An old or failed image request must never leave another level's backdrop visible. */
export class LevelBackgroundLoader {
  private version = 0;
  private disposed = false;

  constructor(private readonly publish: (image: HTMLImageElement | null) => void) {}

  load(name: string | undefined): void {
    if (this.disposed) return;
    const version = ++this.version;
    this.publish(null);
    if (!name) return;
    const image = new Image();
    image.onload = (): void => {
      if (!this.disposed && version === this.version) this.publish(image);
    };
    image.onerror = (): void => {
      if (!this.disposed && version === this.version) this.publish(null);
    };
    image.src = assetPath(`/assets/sprites/${name}.png`);
  }

  dispose(): void {
    this.disposed = true;
    this.version++;
  }
}
