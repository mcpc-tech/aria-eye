/**
 * Browser Action Constants
 * 
 * These constants define the available browser actions that correspond
 * to the functions exported from the action.ts service.
 * 
 * Each action maps to a specific browser automation function:
 * - CLICK -> browser_click
 * - TYPE -> browser_type
 * - PRESS_KEY -> browser_press_key
 * - HOVER -> browser_hover
 * - SELECT_OPTION -> browser_select_option
 * - DRAG -> browser_drag
 * - FILE_UPLOAD -> browser_file_upload
 */
export const BROWSER_ACTIONS = {
  CLICK: 'click',
  TYPE: 'type', 
  PRESS_KEY: 'press_key',
  HOVER: 'hover',
  SELECT_OPTION: 'select_option',
  DRAG: 'drag',
  FILE_UPLOAD: 'file_upload'
} as const;

/**
 * Type for browser action values
 */
export type BrowserAction = typeof BROWSER_ACTIONS[keyof typeof BROWSER_ACTIONS];

/**
 * Array of all available browser actions
 */
export const ALL_BROWSER_ACTIONS: BrowserAction[] = Object.values(BROWSER_ACTIONS);
