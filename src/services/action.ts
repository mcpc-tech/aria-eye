import { EyeEvalProps } from "../eye";

/**
 * Page Interaction Actions
 * These actions simulate direct user input on web page elements, such as clicking buttons, typing in forms, and dragging items. 🖱️
 */

/**
 * Click an element on the page
 */
export const browser_click = async (
  { evaluate }: EyeEvalProps,
  element: string,
  ref: string
) => {
  return await evaluate(
    (args) => {
      if (!args) return false;
      const { element, ref } = args;
      const targetElement = window._a11y?._getElementByRef(ref);
      if (!targetElement) {
        throw new Error(`Element with ref "${ref}" not found`);
      }
      console.log(`Clicking element: ${element} [ref=${ref}]`);
      targetElement.click();
      return true;
    },
    { element, ref } as any
  );
};

/**
 * Type text into an element
 */
export const browser_type = async (
  { evaluate }: EyeEvalProps,
  element: string,
  ref: string,
  text: string,
  slowly?: boolean,
  submit?: boolean
) => {
  return await evaluate(
    (args) => {
      if (!args) return false;
      const { element, ref, text, slowly, submit } = args;
      const targetElement = window._a11y?._getElementByRef(ref);
      if (!targetElement) {
        throw new Error(`Element with ref "${ref}" not found`);
      }
      console.log(`Typing "${text}" into element: ${element} [ref=${ref}]`);
      
      // Focus the element first
      targetElement.focus();
      
      if (slowly) {
        // Type one character at a time (simplified - no actual async in evaluate)
        targetElement.value = text;
        targetElement.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        // Fill entire text at once
        targetElement.value = text;
        targetElement.dispatchEvent(new Event('input', { bubbles: true }));
      }
      
      // Trigger change event
      targetElement.dispatchEvent(new Event('change', { bubbles: true }));
      
      if (submit) {
        // Press Enter to submit
        targetElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        targetElement.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
      }
      
      return true;
    },
    { element, ref, text, slowly, submit } as any
  );
};

/**
 * Press a key on the keyboard
 */
export const browser_press_key = async (
  { evaluate }: EyeEvalProps,
  key: string
) => {
  return await evaluate(
    (args) => {
      if (!args) return false;
      const { key } = args;
      console.log(`Pressing key: ${key}`);
      const activeElement = document.activeElement || document.body;
      
      // Create keyboard events
      const keydownEvent = new KeyboardEvent('keydown', { 
        key, 
        bubbles: true, 
        cancelable: true 
      });
      const keyupEvent = new KeyboardEvent('keyup', { 
        key, 
        bubbles: true, 
        cancelable: true 
      });
      
      activeElement.dispatchEvent(keydownEvent);
      activeElement.dispatchEvent(keyupEvent);
      
      return true;
    },
    { key } as any
  );
};

/**
 * Hover over an element
 */
export const browser_hover = async (
  { evaluate }: EyeEvalProps,
  element: string,
  ref: string
) => {
  return await evaluate(
    (args) => {
      if (!args) return false;
      const { element, ref } = args;
      const targetElement = window._a11y?._getElementByRef(ref);
      if (!targetElement) {
        throw new Error(`Element with ref "${ref}" not found`);
      }
      console.log(`Hovering over element: ${element} [ref=${ref}]`);
      
      // Create and dispatch mouse events for hover
      const mouseenterEvent = new MouseEvent('mouseenter', { bubbles: true });
      const mouseoverEvent = new MouseEvent('mouseover', { bubbles: true });
      
      targetElement.dispatchEvent(mouseenterEvent);
      targetElement.dispatchEvent(mouseoverEvent);
      
      return true;
    },
    { element, ref } as any
  );
};

/**
 * Select an option in a dropdown
 */
export const browser_select_option = async (
  { evaluate }: EyeEvalProps,
  element: string,
  ref: string,
  values: string[]
) => {
  return await evaluate(
    (args) => {
      if (!args) return false;
      const { element, ref, values } = args;
      const targetElement = window._a11y?._getElementByRef(ref);
      if (!targetElement) {
        throw new Error(`Element with ref "${ref}" not found`);
      }
      console.log(`Selecting options [${values.join(', ')}] in element: ${element} [ref=${ref}]`);
      
      if (targetElement.tagName.toLowerCase() === 'select') {
        const selectElement = targetElement as HTMLSelectElement;
        
        // Clear previous selections if not multiple
        if (!selectElement.multiple) {
          for (let i = 0; i < selectElement.options.length; i++) {
            selectElement.options[i].selected = false;
          }
        }
        
        // Select the specified values
        for (const value of values) {
          for (let i = 0; i < selectElement.options.length; i++) {
            const option = selectElement.options[i];
            if (option.value === value || option.textContent?.trim() === value) {
              option.selected = true;
              break;
            }
          }
        }
        
        // Trigger change event
        selectElement.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        // Handle other types of selection (like role="listbox")
        throw new Error('Element is not a select element');
      }
      
      return true;
    },
    { element, ref, values } as any
  );
};

/**
 * Drag and drop between two elements
 */
export const browser_drag = async (
  { evaluate }: EyeEvalProps,
  startElement: string,
  startRef: string,
  endElement: string,
  endRef: string
) => {
  return await evaluate(
    (args) => {
      if (!args) return false;
      const { startElement, startRef, endElement, endRef } = args;
      const sourceElement = window._a11y?._getElementByRef(startRef);
      const targetElement = window._a11y?._getElementByRef(endRef);
      
      if (!sourceElement) {
        throw new Error(`Source element with ref "${startRef}" not found`);
      }
      if (!targetElement) {
        throw new Error(`Target element with ref "${endRef}" not found`);
      }
      
      console.log(`Dragging from element: ${startElement} [ref=${startRef}] to element: ${endElement} [ref=${endRef}]`);
      
      // Get bounding rectangles for coordinates
      const sourceRect = sourceElement.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();
      
      // Create drag and drop events
      const dragStartEvent = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
        clientX: sourceRect.left + sourceRect.width / 2,
        clientY: sourceRect.top + sourceRect.height / 2
      });
      
      const dragOverEvent = new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        clientX: targetRect.left + targetRect.width / 2,
        clientY: targetRect.top + targetRect.height / 2
      });
      
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        clientX: targetRect.left + targetRect.width / 2,
        clientY: targetRect.top + targetRect.height / 2
      });
      
      const dragEndEvent = new DragEvent('dragend', {
        bubbles: true,
        cancelable: true
      });
      
      // Execute drag and drop sequence
      sourceElement.dispatchEvent(dragStartEvent);
      targetElement.dispatchEvent(dragOverEvent);
      targetElement.dispatchEvent(dropEvent);
      sourceElement.dispatchEvent(dragEndEvent);
      
      return true;
    },
    { startElement, startRef, endElement, endRef } as any
  );
};

/**
 * Upload files to a file input element
 */
export const browser_file_upload = async (
  { evaluate }: EyeEvalProps,
  paths: string[]
) => {
  return await evaluate(
    (args) => {
      if (!args) return false;
      const { paths } = args;
      console.log(`Uploading files: [${paths.join(', ')}]`);
      
      // Find the active file input or use the focused element
      const activeElement = document.activeElement;
      let fileInput: HTMLInputElement | null = null;
      
      if (activeElement && activeElement.tagName.toLowerCase() === 'input' && 
          (activeElement as HTMLInputElement).type === 'file') {
        fileInput = activeElement as HTMLInputElement;
      } else {
        // Find the first file input on the page
        fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      }
      
      if (!fileInput) {
        throw new Error('No file input element found');
      }
      
      // Create File objects from paths (this is simulated since we can't access real files from browser context)
      // In a real implementation, this would need to be handled differently
      const files = paths.map(path => {
        const fileName = path.split('/').pop() || path;
        return new File([''], fileName, { type: 'application/octet-stream' });
      });
      
      // Create FileList from File objects
      const dt = new DataTransfer();
      files.forEach(file => dt.items.add(file));
      fileInput.files = dt.files;
      
      // Trigger change event
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      return true;
    },
    { paths } as any
  );
};