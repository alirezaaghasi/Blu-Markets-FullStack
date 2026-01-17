// @ts-check
/**
 * UI Slice - Handles UI state transitions
 *
 * Actions handled:
 * - RESET: Reset to initial state
 * - SET_TAB: Switch active tab
 * - SET_STRESS_MODE: Toggle stress mode
 * - DISMISS_LAST_ACTION: Clear last action notification
 * - SHOW_RESET_CONFIRM: Show reset confirmation modal
 * - HIDE_RESET_CONFIRM: Hide reset confirmation modal
 */

import { initialState } from '../initialState';

/** @type {string[]} */
export const UI_ACTIONS = [
  'RESET',
  'SET_TAB',
  'SET_STRESS_MODE',
  'DISMISS_LAST_ACTION',
  'SHOW_RESET_CONFIRM',
  'HIDE_RESET_CONFIRM',
];

/**
 * UI slice reducer
 * @param {import('../../types').AppState} state
 * @param {{ type: string, [key: string]: any }} action
 * @returns {import('../../types').AppState}
 */
export function uiReducer(state, action) {
  switch (action.type) {
    case 'RESET':
      return initialState();

    case 'SHOW_RESET_CONFIRM':
      return { ...state, showResetConfirm: true };

    case 'HIDE_RESET_CONFIRM':
      return { ...state, showResetConfirm: false };

    case 'SET_TAB':
      return { ...state, tab: action.tab };

    case 'SET_STRESS_MODE':
      return { ...state, stressMode: Boolean(action.payload?.on) };

    case 'DISMISS_LAST_ACTION':
      return { ...state, lastAction: null };

    default:
      return state;
  }
}
