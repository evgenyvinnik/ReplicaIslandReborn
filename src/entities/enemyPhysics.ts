import type { GameObject } from './GameObject';
import type { ChangeComponentsComponent } from './components/ChangeComponentsComponent';
import { CollisionResponseComponent } from './components/CollisionResponseComponent';

// Original spawnEnemy* SimplePhysics: Brobot/Onion override the default 0.1.
// Story actors explicitly use zero; flyers have no SimplePhysics component.
const ENEMY_BOUNCINESS: Readonly<Record<string, number>> = {
  brobot: 0.4,
  onion: 0.2,
  snailbomb: 0.1,
  mudman: 0.1,
  skeleton: 0.1,
  pink_namazu: 0.1,
};

export function attachEnemyCollisionResponse(object: GameObject): void {
  const bounce = ENEMY_BOUNCINESS[object.subType];
  if (bounce !== undefined) object.addComponent(new CollisionResponseComponent(bounce));
}

export function attachPossessedCollisionResponse(object: GameObject, swap: ChangeComponentsComponent): void {
  // Android's Brobot ghostSwap replaces its normal physics with a zero-bounce
  // instance. Leave turret physics and the free orb's 0.6 response untouched.
  if (object.subType !== 'brobot') return;
  const normal = object.getComponent(
    CollisionResponseComponent as unknown as new (...args: unknown[]) => CollisionResponseComponent
  );
  if (!normal) return;
  swap.addSwapOutComponent(normal);
  swap.addSwapInComponent(new CollisionResponseComponent(0));
}
