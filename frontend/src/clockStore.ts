import { clockTransition, initialClockState, type ClockAction } from './clockRules';
let state = initialClockState;
const listeners = new Set<() => void>();
export const clockStore = {
  getSnapshot: () => state,
  subscribe: (callback: () => void) => { listeners.add(callback); return () => { listeners.delete(callback); }; },
  dispatch: (action: ClockAction) => { const next = clockTransition(state, action); if (next !== state) { state = next; listeners.forEach(callback => callback()); } },
};
