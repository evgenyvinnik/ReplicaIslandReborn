import { expect, test } from 'bun:test';
import { DOMMenuInput, type DOMMenuHandlers } from './DOMMenuInput';

type Control = globalThis.EventTarget & {
  name: string; tagName: string; disabled: boolean; hidden: boolean; clicks: number; scrolls: number; value: number;
  attributes: Map<string, string>; focus(): void;
};
interface Scope {
  ownerDocument: { activeElement: Control | null };
  controls: Control[];
  dialogs: Scope[];
  inert: boolean;
}

function harness(handlers: DOMMenuHandlers = {}): {
  target: DOMMenuInput; root: Scope; doc: { activeElement: Control | null }; control: (name: string) => Control;
} {
  const doc = { activeElement: null as Control | null };
  class Control extends globalThis.EventTarget {
    tagName = 'BUTTON';
    disabled = false;
    hidden = false;
    clicks = 0;
    scrolls = 0;
    value = 5;
    attributes = new Map<string, string>();
    constructor(public name: string) { super(); }
    getClientRects(): object[] { return this.hidden ? [] : [{}]; }
    getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
    setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
    removeAttribute(name: string): void { this.attributes.delete(name); }
    focus(): void { doc.activeElement = this; }
    scrollIntoView(): void { this.scrolls++; }
    click(): void { this.clicks++; }
    stepUp(amount: number): void { this.value = Math.max(0, Math.min(6, this.value + amount)); }
  }
  class Scope {
    ownerDocument = doc;
    controls: Control[] = [];
    dialogs: Scope[] = [];
    inert = false;
    closest(): Scope | null { return this.inert ? this : null; }
    querySelectorAll(selector: string): Control[] | Scope[] {
      if (selector === '[data-menu-controller-dialog]') return this.dialogs;
      if (selector === '[data-controller-focused]') return [...this.controls, ...this.dialogs.flatMap(dialog => dialog.controls)]
        .filter(control => control.attributes.has('data-controller-focused'));
      return this.controls.filter(control => !control.disabled);
    }
  }
  const root = new Scope();
  const target = new DOMMenuInput(() => root as unknown as globalThis.HTMLElement, () => handlers);
  return { target, root, doc, control: name => new Control(name) };
}
test('DOM controller navigation skips unavailable controls, wraps, scrolls and activates only the selected button', () => {
  const { target, root, doc, control } = harness();
  const [first, disabled, hidden, last] = ['first', 'disabled', 'hidden', 'last'].map(control);
  disabled.disabled = true; hidden.hidden = true;
  root.controls = [first, disabled, hidden, last];
  target.handleMenuCommand('down');
  expect(doc.activeElement).toBe(first);
  target.handleMenuCommand('down');
  expect(doc.activeElement).toBe(last);
  target.handleMenuCommand('confirm');
  expect(last.clicks).toBe(1);
  expect(first.clicks).toBe(0);
  expect(disabled.clicks + hidden.clicks).toBe(0);
  target.handleMenuCommand('right');
  expect(doc.activeElement).toBe(first);
  expect(first.scrolls).toBeGreaterThan(0);
  expect(last.attributes.has('data-controller-focused')).toBe(false);
});

test('modal controls own confirmation and parent actions cannot run behind them', () => {
  let backs = 0;
  const { target, root, control } = harness({ onBack: () => { backs++; } });
  const launch = control('launch');
  root.controls = [launch];
  target.handleMenuCommand('confirm');
  const modal = harness().root;
  const cancel = control('cancel');
  modal.controls = [cancel, control('erase')];
  root.dialogs = [modal];
  target.handleMenuCommand('confirm');
  expect(cancel.clicks).toBe(1);
  expect(launch.clicks).toBe(1);
  expect(modal.controls[1].clicks).toBe(0);
  target.handleMenuCommand('back');
  expect(backs).toBe(1);
  root.inert = true;
  target.handleMenuCommand('confirm');
  target.handleMenuCommand('back');
  expect(cancel.clicks).toBe(1);
  expect(backs).toBe(1);
});

test('sliders adjust within bounds and selection survives replaced React controls', () => {
  const { target, root, doc, control } = harness();
  const slider = control('volume'); slider.tagName = 'INPUT';
  let changes = 0;
  slider.addEventListener('input', () => { changes++; });
  root.controls = [control('back'), slider, control('next')];
  slider.focus();
  target.handleMenuCommand('right');
  target.handleMenuCommand('right');
  expect(slider.value).toBe(6);
  expect(changes).toBe(2);
  target.handleMenuCommand('left');
  expect(slider.value).toBe(5);
  root.controls = [control('back'), control('replacement'), control('next')];
  doc.activeElement = null;
  target.refresh();
  expect(doc.activeElement as Control | null).toBe(root.controls[1]);
  expect(root.controls[1].attributes.has('data-controller-focused')).toBe(true);
  target.handleMenuCommand('down');
  expect(doc.activeElement as Control | null).toBe(root.controls[2]);
  target.reset();
  expect(root.controls[2].attributes.has('data-controller-focused')).toBe(false);
});

test('custom list/difficulty handlers keep their own selection and keyboard-capture prompts ignore controller confirmation', () => {
  const commands: string[] = [];
  const { target, root, control } = harness({ onCommand: command => { commands.push(command); return true; } });
  root.controls = [control('binding')];
  target.handleMenuCommand('confirm'); target.handleMenuCommand('down');
  expect(commands).toEqual(['confirm', 'down']);
  expect(root.controls[0].clicks).toBe(0);
});
