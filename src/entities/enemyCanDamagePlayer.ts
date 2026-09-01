import { ActionType } from '../types';

/** Whether an enemy's current animation exposes an attack volume. */
export function enemyCanDamagePlayer(subType: string, action: ActionType): boolean {
  switch (subType) {
    case 'evil_kabocha':
    case 'rokudou':
    case 'the_source':
    case 'turret':
      return false;
    case 'pink_namazu':
    case 'skeleton':
    case 'mudman':
      return action === ActionType.ATTACK;
    default:
      return true;
  }
}
