import { SortConstants } from '../engine/SortConstants';

/** Original GameObjectFactory spawn priorities, shared by level and runtime spawns. */
const SUBTYPE_PRIORITIES: Readonly<Record<string, number>> = {
  wanda: SortConstants.NPC, kyle: SortConstants.NPC, kabocha: SortConstants.NPC,
  evil_kabocha: SortConstants.NPC, rokudou: SortConstants.NPC,
  kyle_dead: SortConstants.GENERAL_OBJECT, andou_dead: SortConstants.GENERAL_OBJECT,
  turret: SortConstants.GENERAL_OBJECT, ghost: SortConstants.PROJECTILE,
};
const TYPE_PRIORITIES: Readonly<Record<string, number>> = {
  player: SortConstants.PLAYER, enemy: SortConstants.GENERAL_ENEMY, npc: SortConstants.NPC,
  projectile: SortConstants.PROJECTILE, ghost: SortConstants.PROJECTILE,
  door: SortConstants.FOREGROUND_OBJECT, cannon: SortConstants.FOREGROUND_OBJECT,
  coin: SortConstants.GENERAL_OBJECT, ruby: SortConstants.GENERAL_OBJECT,
  pearl: SortConstants.GENERAL_OBJECT, diary: SortConstants.GENERAL_OBJECT,
  breakable_block: SortConstants.GENERAL_OBJECT, hint_sign: SortConstants.GENERAL_OBJECT,
  button: SortConstants.GENERAL_OBJECT, spawner: SortConstants.GENERAL_OBJECT,
  terminal: SortConstants.GENERAL_OBJECT, decoration: SortConstants.GENERAL_OBJECT,
  effect: SortConstants.EFFECT,
};

export function drawPriorityFor(obj: { type: string; subType: string }): number {
  return SUBTYPE_PRIORITIES[obj.subType] ?? TYPE_PRIORITIES[obj.type] ?? SortConstants.FOREGROUND;
}
