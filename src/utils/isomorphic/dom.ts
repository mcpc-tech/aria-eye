import { EyeEvalProps, EyeProps } from "eye";

export const genArgsByPlatform = <P>(platform: EyeProps["platform"]) => {
  if (platform.name === "native") {
    return {
      evaluate: (f, arg) => Promise.resolve(f(arg)),
      evaluateHandle: (f, arg) => Promise.resolve(f(arg)),
    } as EyeEvalProps;
  }
  if (platform.name === "playwright") {
    return {
      evaluate: (...args) => platform.page.evaluate(...args),
      evaluateHandle: (...args) => platform.page.evaluateHandle(...args),
    } as EyeEvalProps;
  }
  if (platform.name === "puppeteer") {
    return {
      evaluate: (...args) => platform.page.evaluate(...args),
      evaluateHandle: (...args) => platform.page.evaluateHandle(...args),
    } as EyeEvalProps;
  }
  throw new Error(`Unsupported platform: ${platform}`);
};

export const parseA11yRef = (memory: string) => {
  // Template: A ${name ?? "N/A"} ${role ?? "N/A"}, ${text ?? "N/A"} [selector=${ref ?? "N/A"}]
  const selectorMatch = memory.match(/\[selector=([^\]]+)\]/);

  if (selectorMatch && selectorMatch[1] !== "N/A") {
    return selectorMatch[1];
  }

  return null;
};

export const a11yRefSelect = async (
  { evaluate, evaluateHandle }: EyeEvalProps,
  ref: string,
  highlight = true
) => {
  const handle = await evaluateHandle((ref) => {
    const element = window._a11y._lastAriaSnapshot?.elements?.get(ref);
    console.log("Selecting element by ref:", ref, element);
    return element;
  }, ref);

  const isNull = await handle.evaluate((obj) => obj == null);

  if (isNull) {
    await handle.dispose();
    return null;
  }

  if (highlight) {
    await highlightElement({ evaluate }, handle, ref);
  }

  return handle;
};

export const highlightElement = async (
  { evaluate }: EyeEvalProps,
  elementHandle: any,
  ref: string
) => {
  // Instead of passing the elementHandle into the page context, just pass the ref.
  await evaluate(
    (ref) => {
      // Look up the element by ref inside the page context.
      const element =
        window._a11y?._lastAriaSnapshot?.elements?.get(ref)
      if (!element) return;

      // Remove existing overlay and container if they exist
      const existingOverlay = document.getElementById("a11y-highlight-overlay");
      const existingContainer = document.getElementById(
        "a11y-highlight-container"
      );

      if (existingOverlay) {
        existingOverlay.remove();
      }
      if (existingContainer) {
        existingContainer.remove();
      }

      // Create semi-transparent overlay covering the entire viewport
      const overlay = document.createElement("div");
      overlay.id = "a11y-highlight-overlay";
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0,0,0,0.25);
        z-index: 9998;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.25s;
      `;

      // Create highlight container for the target element
      const highlightContainer = document.createElement("div");
      highlightContainer.id = "a11y-highlight-container";

      // Get element's bounding rectangle relative to viewport
      const rect = element.getBoundingClientRect();

      // Get current scroll position
      const scrollLeft =
        window.pageXOffset || document.documentElement.scrollLeft;
      const scrollTop =
        window.pageYOffset || document.documentElement.scrollTop;

      // Calculate element's absolute position relative to document
      const elementLeft = rect.left + scrollLeft;
      const elementTop = rect.top + scrollTop;

      // Position highlight container exactly around the element
      highlightContainer.style.cssText = `
        position: absolute;
        left: ${elementLeft}px;
        top: ${elementTop}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
        z-index: 9999;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.25s;
      `;

      // Create the visual highlight border with glow effect
      const highlightBorder = document.createElement("div");
      highlightBorder.style.cssText = `
        width: 100%;
        height: 100%;
        border: 3px solid #ff3366;
        border-radius: 8px;
        box-shadow: 0 0 16px 4px #ff3366aa;
        background: transparent;
      `;

      // Create label to identify the highlighted element
      const label = document.createElement("div");
      label.style.cssText = `
        position: absolute;
        top: -28px;
        left: 0;
        background: #ff3366;
        color: #fff;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 13px;
        font-family: inherit;
        white-space: nowrap;
        box-shadow: 0 2px 8px #ff336688;
        letter-spacing: 0.5px;
      `;
      label.textContent = `[ref=${ref}]`;

      // Assemble the highlight components
      highlightContainer.appendChild(highlightBorder);
      highlightContainer.appendChild(label);
      document.body.appendChild(overlay);
      document.body.appendChild(highlightContainer);

      // Fade in the highlight elements
      requestAnimationFrame(() => {
        overlay.style.opacity = "1";
        highlightContainer.style.opacity = "1";
      });

      // Auto-remove highlight after 1 second with fade out
      setTimeout(() => {
        overlay.style.opacity = "0";
        highlightContainer.style.opacity = "0";

        // Remove elements after fade out transition completes
        setTimeout(() => {
          if (overlay.parentNode) {
            overlay.remove();
          }
          if (highlightContainer.parentNode) {
            highlightContainer.remove();
          }
        }, 300);
      }, 1000);
    },
    ref
  );
};
