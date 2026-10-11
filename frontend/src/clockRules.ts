export interface ClockState { source: 'auto' | 'manual' | null; dismissed: boolean }
export type ClockAction = { type: 'environment'; landscape: boolean; eligible: boolean } | { type: 'manual' } | { type: 'close'; landscape: boolean };
export const initialClockState: ClockState = { source: null, dismissed: false };
export function clockTransition(state: ClockState, action: ClockAction): ClockState {
  let next = state;
  if (action.type === 'manual') next = { ...state, source: 'manual' };
  if (action.type === 'close') next = { source: null, dismissed: state.dismissed || (state.source === 'auto' && action.landscape) };
  if (action.type === 'environment') {
    next = { ...state, dismissed: action.landscape ? state.dismissed : false };
    if ((!action.landscape || !action.eligible) && next.source === 'auto') next.source = null;
    if (action.landscape && action.eligible && !next.dismissed && !next.source) next.source = 'auto';
  }
  return next.source === state.source && next.dismissed === state.dismissed ? state : next;
}
export function clockEligible(page: string, reader: boolean, running: boolean, rotate: boolean, anyPage: boolean) {
  return rotate && !reader && page !== 'reader' && page !== 'chat' && (page === 'pomodoro' || (anyPage && running));
}
