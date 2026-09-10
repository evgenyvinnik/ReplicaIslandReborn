import React from 'react';
import type { KeyBindings } from '../stores/useGameStore';

const KEY_LABELS: Record<string, string> = {
  ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
  Escape: 'Esc',
};

function displayKeys(keys: string[]): string {
  return keys.map((code) => KEY_LABELS[code] ?? code.replace(/^(Key|Digit)/, '')).join('/') || 'Unbound';
}

/** Uses committed settings, so a cancelled keyboard draft never changes the help. */
export function KeyboardHint({ bindings }: { bindings: KeyBindings }): React.JSX.Element {
  return (
    <div className="keyboard-hint-below">
      <span>{displayKeys(bindings.left)} left · {displayKeys(bindings.right)} right</span>
      <span>{displayKeys(bindings.jump)} fly</span>
      <span>{displayKeys(bindings.attack)} stomp/orb</span>
      <span>{displayKeys(bindings.pause)} pause</span>
    </div>
  );
}
