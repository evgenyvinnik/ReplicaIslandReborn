/** The authored finale and runtime factory must build the same Rokudou boss. */
import { ActionType, HitType, Team } from '../types';
import type { GameObjectType } from './GameObjectFactory';
import type { GameObject } from './GameObject';
import type { CollisionSystem } from '../engine/CollisionSystemNew';
import type { RenderSystem } from '../engine/RenderSystem';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { GameFlowEventType } from '../engine/GameFlowEvent';
import { CutsceneType } from '../data/cutscenes';
import { drawPriorityFor } from '../data/objectDrawPriority';
import { createNpcAnimations } from '../data/npcAnimations';
import { AABoxCollisionVolume } from '../engine/collision/AABoxCollisionVolume';
import { SpriteComponent } from './components/SpriteComponent';
import { NPCComponent } from './components/NPCComponent';
import { NPCAnimation, NPCAnimationComponent } from './components/NPCAnimationComponent';
import { DynamicCollisionComponent } from './components/DynamicCollisionComponent';
import { HitReactionComponent } from './components/HitReactionComponent';
import { ChangeComponentsComponent } from './components/ChangeComponentsComponent';
import { GravityComponent } from './components/GravityComponent';
import { MovementComponent } from './components/MovementComponent';
import { LaunchProjectileComponent } from './components/LaunchProjectileComponent';

const SCREEN_RADIUS = Math.hypot(240, 160);

export function configureRokudou(
  obj: GameObject,
  collisionSystem: CollisionSystem | null,
  renderSystem: RenderSystem | null,
  energyBallType: GameObjectType,
  bulletType: GameObjectType
): void {
  obj.type = 'enemy';
  obj.subType = 'rokudou';
  obj.width = 128;
  obj.height = 128;
  obj.activationRadius = SCREEN_RADIUS * 1.25;
  obj.destroyOnDeactivation = false;
  obj.life = 3;
  obj.maxLife = 3;
  obj.team = Team.ENEMY;
  obj.facingDirection.x = -1;

  const sprite = new SpriteComponent();
  sprite.setSprite('enemy_rokudou_fight_stand');
  if (renderSystem) sprite.setRenderSystem(renderSystem);
  sprite.setPriority(drawPriorityFor(obj));
  const animations = createNpcAnimations('rokudou', obj.width, obj.height);
  if (animations) {
    for (const [index, animation] of animations) sprite.addAnimationAtIndex(index, animation);
    sprite.playAnimation(NPCAnimation.IDLE);
  }
  obj.addComponent(sprite);

  const animator = new NPCAnimationComponent({ flying: true });
  animator.setSprite(sprite);
  const surprised = sSystemRegistry.channelSystem?.registerChannel('SURPRISED');
  if (surprised) {
    animator.setChannel(surprised);
    animator.setChannelTrigger(NPCAnimation.SURPRISED);
  }
  obj.addComponent(animator);

  // The original drives his flight along the arena's hot-spot track and
  // plays the Kabocha ending only after a defeated boss has landed.
  const patrol = new NPCComponent({
    horizontalImpulse: 500,
    slowHorizontalImpulse: 100,
    upImpulse: -100,
    downImpulse: 100,
    acceleration: 400,
    flying: true,
    reactToHits: true,
    pauseOnAttack: false,
    gameEvent: GameFlowEventType.SHOW_ANIMATION,
    gameEventIndex: CutsceneType.KABOCHA_ENDING,
    spawnGameEventOnDeath: true,
  });
  obj.addComponent(patrol);

  const collision = new DynamicCollisionComponent();
  // Android AABox(45, 23, 42, 75) in a 128px Y-up sprite.
  collision.setCollisionVolumes(null, [new AABoxCollisionVolume(45, 30, 42, 75, HitType.HIT)]);
  const reaction = new HitReactionComponent({
    invincibleAfterHitTime: 1,
    onHitSound: 'sound_rokudou_hit',
  });
  reaction.setSoundPlayer(sound => sSystemRegistry.soundSystem?.playSfx(sound));
  collision.setHitReactionComponent(reaction);
  patrol.setHitReactionComponent(reaction);
  obj.addComponent(collision);
  obj.addComponent(reaction);

  const deathSwap = new ChangeComponentsComponent({ swapOnAction: ActionType.DEATH });
  deathSwap.addSwapInComponent(new GravityComponent());
  obj.addComponent(deathSwap);

  // He flies without ordinary gravity. The death swap adds it when needed.
  const movement = new MovementComponent();
  if (collisionSystem) {
    movement.setCollisionSystem(collisionSystem);
    movement.setCollisionBox(45, 75, 45, 30);
  }
  obj.addComponent(movement);

  obj.addComponent(new LaunchProjectileComponent({
    objectTypeToSpawn: energyBallType,
    projectilesInSet: 1,
    setsPerActivation: -1,
    delayBetweenSets: 1.5,
    offsetX: 75,
    offsetY: 42,
    requiredAction: ActionType.ATTACK,
    velocityX: 300,
    velocityY: 300,
    shootSound: 'sound_poing',
  }));
  obj.addComponent(new LaunchProjectileComponent({
    objectTypeToSpawn: bulletType,
    projectilesInSet: 5,
    delayBetweenShots: 0.1,
    setsPerActivation: -1,
    delayBetweenSets: 2.5,
    offsetX: 75,
    offsetY: 42,
    requiredAction: ActionType.ATTACK,
    velocityX: 300,
    velocityY: 300,
    shootSound: 'sound_gun',
  }));
}
