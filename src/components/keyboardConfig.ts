import { DEFAULT_KEY_BINDINGS, type KeyBindings } from '../stores/useGameStore';

export interface KeyboardConfigState {
  draft: KeyBindings | null;
  listening: keyof KeyBindings | null;
}
export const closedKeyboardConfig: KeyboardConfigState = { draft: null, listening: null };
type KeyboardConfigAction =
  | { type: 'open'; bindings: KeyBindings }
  | { type: 'select'; action: keyof KeyBindings }
  | { type: 'key'; code: string; repeat?: boolean }
  | { type: 'reset' | 'close' };

function copyBindings(bindings: KeyBindings): KeyBindings {
  const copy = { ...bindings };
  for (const action of Object.keys(bindings) as (keyof KeyBindings)[]) copy[action] = [...bindings[action]];
  return copy;
}

/** Android's keyboard dialog only persists a draft on positive confirmation.
 * This reducer never writes the store; Options owns the explicit Save action. */
export function keyboardConfigReducer(state: KeyboardConfigState, action: KeyboardConfigAction): KeyboardConfigState {
  if (action.type === 'open') return { draft: copyBindings(action.bindings), listening: null };
  if (action.type === 'close') return closedKeyboardConfig;
  if (!state.draft) return state;
  switch (action.type) {
    case 'select': return { ...state, listening: state.listening === action.action ? null : action.action };
    case 'reset': return { draft: copyBindings(DEFAULT_KEY_BINDINGS), listening: null };
    case 'key':
      if (action.repeat || !action.code) return state;
      if (action.code === 'Escape') return state.listening ? { ...state, listening: null } : closedKeyboardConfig;
      if (!state.listening) return state;
      return { draft: { ...state.draft, [state.listening]: [action.code] }, listening: null };
  }
}
