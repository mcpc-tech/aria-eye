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
  highlight = true,
  duration = 3000
) => {
  const handle = await evaluateHandle((ref) => {
    return window._a11y._lastAriaSnapshot?.elements?.get(ref);
  }, ref);

  const isNull = await handle.evaluate((obj) => obj == null);

  if (isNull) {
    await handle.dispose();
    return null;
  }

  if (highlight) {
    await highlightElement({ evaluate }, handle, duration);
  }

  return handle;
};
export const highlightElement = async (
  { evaluate }: EyeEvalProps,
  elementHandle: any,
  duration: number
) => {
  await evaluate(
    ({ elementHandle, duration }) => {
      if (!elementHandle) return;

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

      const overlay = document.createElement("div");
      overlay.id = "a11y-highlight-overlay";
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 9998;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s ease;
      `;

      const highlightContainer = document.createElement("div");
      highlightContainer.id = "a11y-highlight-container";
      highlightContainer.style.cssText = `
        position: fixed;
        z-index: 9999;
        pointer-events: none;
        opacity: 0;
        transition: all 0.3s ease;
      `;

      const rect = elementHandle.getBoundingClientRect();
      const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;

      highlightContainer.style.left = `${rect.left + scrollX - 8}px`;
      highlightContainer.style.top = `${rect.top + scrollY - 8}px`;
      highlightContainer.style.width = `${rect.width + 8}px`;
      highlightContainer.style.height = `${rect.height + 8}px`;

      const highlightBorder = document.createElement("div");
      highlightBorder.style.cssText = `
        width: 100%;
        height: 100%;
        border: 3px solid #ff6b6b;
        border-radius: 4px;
        box-shadow: 
          0 0 0 1px rgba(255, 255, 255, 0.8),
          0 0 20px rgba(255, 107, 107, 0.6),
          inset 0 0 20px rgba(255, 107, 107, 0.1);
        animation: a11yPulse 1.5s ease-in-out infinite alternate;
      `;

      const label = document.createElement("div");
      label.style.cssText = `
        position: absolute;
        top: -30px;
        left: 0;
        background: #ff6b6b;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      `;
      label.textContent = "A11Y Element";

      if (!document.getElementById("a11y-highlight-styles")) {
        const style = document.createElement("style");
        style.id = "a11y-highlight-styles";
        style.textContent = `
          @keyframes a11yPulse {
            0% { 
              box-shadow: 
                0 0 0 1px rgba(255, 255, 255, 0.8),
                0 0 20px rgba(255, 107, 107, 0.6),
                inset 0 0 20px rgba(255, 107, 107, 0.1);
            }
            100% { 
              box-shadow: 
                0 0 0 1px rgba(255, 255, 255, 0.8),
                0 0 30px rgba(255, 107, 107, 0.8),
                inset 0 0 30px rgba(255, 107, 107, 0.2);
            }
          }
        `;
        document.head.appendChild(style);
      }

      highlightContainer.appendChild(highlightBorder);
      highlightContainer.appendChild(label);
      document.body.appendChild(overlay);
      document.body.appendChild(highlightContainer);

      requestAnimationFrame(() => {
        overlay.style.opacity = "1";
        highlightContainer.style.opacity = "1";
      });

      setTimeout(() => {
        overlay.style.opacity = "0";
        highlightContainer.style.opacity = "0";

        setTimeout(() => {
          if (overlay.parentNode) {
            overlay.remove();
          }
          if (highlightContainer.parentNode) {
            highlightContainer.remove();
          }
        }, 300);
      }, duration);
    },
    { elementHandle, duration }
  );
};
