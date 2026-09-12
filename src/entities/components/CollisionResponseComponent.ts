import { GameComponent } from '../GameComponent';
import { ComponentPhase } from '../../types';

/**
 * Swappable restitution from Android's SimplePhysicsComponent. MovementComponent
 * owns impulses and collision response in this port; this component supplies its
 * material without replacing movement or duplicating the physics integration.
 */
export class CollisionResponseComponent extends GameComponent {
  constructor(public readonly bounciness: number = 0.1) {
    super(ComponentPhase.PHYSICS);
  }

  update(): void {}
  reset(): void {}
}
