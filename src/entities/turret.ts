import { createEnemyAnimations } from '../data/enemyAnimations';
import { drawPriorityFor } from '../data/objectDrawPriority';
import type { RenderSystem } from '../engine/RenderSystem';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { ActionType, Team } from '../types';
import type { GameObject } from './GameObject';
import type { GameObjectType } from './GameObjectFactory';
import { createEnemyCollisionProfile, selectEnemyAttackVolumes } from './enemyCollisionProfiles';
import { attachPossessedCollisionResponse } from './enemyPhysics';
import { AttackAtDistanceComponent } from './components/AttackAtDistanceComponent';
import { ChangeComponentsComponent } from './components/ChangeComponentsComponent';
import { DynamicCollisionComponent } from './components/DynamicCollisionComponent';
import { EnemyAnimation } from './components/EnemyAnimationComponent';
import { GenericAnimationComponent } from './components/GenericAnimationComponent';
import { GhostComponent } from './components/GhostComponent';
import { HitReactionComponent } from './components/HitReactionComponent';
import { LaunchProjectileComponent } from './components/LaunchProjectileComponent';
import { SpriteComponent } from './components/SpriteComponent';

/** The placed and runtime turret share Android's stationary firing/possession setup. */
export function configureTurret(
  obj: GameObject,
  activationRadius: number,
  bulletType: GameObjectType,
  renderSystem?: RenderSystem | null
): void {
  obj.type = 'enemy';
  obj.subType = 'turret';
  obj.width = obj.height = 64;
  obj.life = obj.maxLife = 1;
  obj.activationRadius = activationRadius;
  obj.destroyOnDeactivation = false;
  obj.team = Team.ENEMY;

  const attack = new AttackAtDistanceComponent({
    attackDistance: 300,
    attackDelay: 0,
    attackLength: 1,
    requireFacing: true,
  });
  obj.addComponent(attack);
  obj.addComponent(new LaunchProjectileComponent({
    objectTypeToSpawn: bulletType,
    offsetX: 54,
    offsetY: 13,
    velocityX: 300,
    // Android's -300 in Y-up becomes +300 in Canvas Y-down.
    velocityY: 300,
    requiredAction: ActionType.ATTACK,
    projectilesInSet: 1,
    delayBetweenSets: 0.3,
    setsPerActivation: -1,
    shootSound: 'sound_gun',
  }));

  const profile = createEnemyCollisionProfile('turret')!;
  const collision = new DynamicCollisionComponent();
  const reaction = new HitReactionComponent({ invincibleAfterHitTime: 0.5, pauseOnAttack: true });
  reaction.setSoundPlayer(sound => sSystemRegistry.soundSystem?.playSfx(sound));
  collision.setHitReactionComponent(reaction);
  collision.setCollisionVolumes(selectEnemyAttackVolumes(profile, obj.getCurrentAction()), profile.vulnerability);
  obj.addComponent(collision);
  obj.addComponent(reaction);

  const sprite = new SpriteComponent();
  if (renderSystem) sprite.setRenderSystem(renderSystem);
  sprite.setPriority(drawPriorityFor(obj));
  sprite.setCollisionComponent(collision);
  for (const [index, animation] of createEnemyAnimations('turret')!) {
    sprite.addAnimationAtIndex(index, animation);
  }
  sprite.playAnimation(EnemyAnimation.IDLE);
  obj.addComponent(sprite);
  const animation = new GenericAnimationComponent();
  animation.setSprite(sprite);
  obj.addComponent(animation);

  // POSSESS swaps automatic fire for the player's action-controlled fire.
  const swap = new ChangeComponentsComponent();
  swap.setPingPongBehavior(true);
  swap.addSwapOutComponent(attack);
  swap.addSwapInComponent(new GhostComponent({
    movementSpeed: 0,
    jumpImpulse: 0,
    acceleration: 0,
    useOrientationSensor: false,
    delayOnRelease: 1.5,
    killOnRelease: false,
    targetAction: ActionType.IDLE,
    lifeTime: 0,
    changeActionOnButton: true,
    buttonPressedAction: ActionType.ATTACK,
    ambientSound: 'sound_possession',
  }));
  attachPossessedCollisionResponse(obj, swap);
  reaction.setPossessionComponent(swap);
  obj.addComponent(swap);
}
