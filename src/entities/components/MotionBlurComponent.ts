/**
 * Motion Blur Component - draws a fading trail behind a fast-moving object.
 * Ported from: Original/src/com/replica/replicaisland/MotionBlurComponent.java
 *
 * Samples what its target sprite is drawing every STEP_DELAY seconds and keeps
 * the last STEP_COUNT samples in a ring buffer. Each frame it redraws all of
 * them behind the object, oldest faintest, at a priority just under the
 * target's so the trail never covers the object itself.
 *
 * The original reads the DrawableBitmap off a RenderComponent; here the
 * equivalent is the target SpriteComponent's current frame.
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase } from '../../types';
import type { GameObject } from '../GameObject';
import { Vector2 } from '../../utils/Vector2';
import { SpriteComponent } from './SpriteComponent';
import { sSystemRegistry } from '../../engine/SystemRegistry';

/** Original: STEP_COUNT, STEP_DELAY, OPACITY_STEP. */
const STEP_COUNT = 4;
const STEP_DELAY = 0.1;
const OPACITY_STEP = 1.0 / (STEP_COUNT + 1);

interface BlurRecord {
  position: Vector2;
  sprite: string | null;
  frame: number;
  offsetX: number;
  offsetY: number;
  priority: number;
  facingLeft: boolean;
}

export class MotionBlurComponent extends GameComponent {
  private history: BlurRecord[];
  private currentStep: number = 0;
  private timeSinceLastStep: number = 0;
  private stepDelay: number = STEP_DELAY;
  private enabled: boolean = true;
  private target: SpriteComponent | null = null;

  constructor() {
    super();
    this.phase = ComponentPhase.PRE_DRAW;

    this.history = [];
    for (let i = 0; i < STEP_COUNT; i++) {
      this.history.push({
        position: new Vector2(0, 0),
        sprite: null,
        frame: 0,
        offsetX: 0,
        offsetY: 0,
        priority: 0,
        facingLeft: false,
      });
    }
  }

  reset(): void {
    this.clearHistory();
    this.stepDelay = STEP_DELAY;
    this.target = null;
    this.enabled = true;
  }

  /**
   * The sprite this trail shadows. Original: setTarget(RenderComponent).
   * Left unset, the component shadows the object's own sprite.
   */
  setTarget(target: SpriteComponent): void {
    this.target = target;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.clearHistory();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setStepDelay(delay: number): void {
    this.stepDelay = Math.max(0.01, delay);
  }

  update(deltaTime: number, parent: GameObject): void {
    if (!this.enabled) return;

    const target = this.target ?? parent.getComponent(SpriteComponent);
    if (!target) return;
    this.target = target;

    const renderSystem = sSystemRegistry.renderSystem;
    if (!renderSystem) return;

    // Sample the target's current frame into the ring buffer.
    this.timeSinceLastStep += deltaTime;
    if (this.timeSinceLastStep >= this.stepDelay) {
      const draw = target.getCurrentDraw();
      if (draw) {
        const record = this.history[this.currentStep];
        record.position.set(parent.getPosition().x, parent.getPosition().y);
        record.sprite = draw.sprite;
        record.frame = draw.frame;
        record.offsetX = draw.offsetX;
        record.offsetY = draw.offsetY;
        record.priority = draw.priority;
        record.facingLeft = parent.facingDirection.x < 0;
        this.currentStep = (this.currentStep + 1) % STEP_COUNT;
        this.timeSinceLastStep = 0;
      }
    }

    // Redraw the whole trail, newest first so it fades away behind the object.
    const startStep = this.currentStep > 0 ? this.currentStep - 1 : STEP_COUNT - 1;
    for (let i = 0; i < STEP_COUNT; i++) {
      const record = this.history[(startStep - i + STEP_COUNT) % STEP_COUNT];
      if (!record.sprite || !renderSystem.hasSprite(record.sprite)) continue;
      renderSystem.drawSprite(
        record.sprite,
        record.position.x + record.offsetX,
        record.position.y + record.offsetY,
        record.frame,
        record.priority - (i + 1),
        (STEP_COUNT - i) * OPACITY_STEP,
        record.facingLeft ? -1 : 1,
        1
      );
    }
  }

  /** Clear the trail, so a teleport or respawn does not smear across the level. */
  clearHistory(): void {
    for (const record of this.history) {
      record.position.set(0, 0);
      record.sprite = null;
      record.frame = 0;
      record.offsetX = 0;
      record.offsetY = 0;
      record.priority = 0;
      record.facingLeft = false;
    }
    this.currentStep = 0;
    this.timeSinceLastStep = 0;
  }
}
