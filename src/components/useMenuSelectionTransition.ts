import { useEffect, useRef } from 'react';
import { MenuSelectionTransition } from './MenuSelectionTransition';

export function useMenuSelectionTransition(): MenuSelectionTransition {
  const transition = useRef<MenuSelectionTransition | null>(null);
  if (!transition.current) transition.current = new MenuSelectionTransition();
  const current = transition.current;
  useEffect(() => (): void => current.cancel(), [current]);
  return current;
}
