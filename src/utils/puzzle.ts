import sharp from "sharp";
import { Page } from "puppeteer";
import * as fs from "fs/promises";
import * as path from "path";
import { EvaluateFunc, ScreenshotFunc } from "../services/patch-a11y";

/**
 * Options for the puzzle element cropping and concatenation
 */
interface PuzzleOptions {
  /** Array of CSS selectors for elements to be captured */
  elementSelectors: string[];
  /** Directory path where the output image will be saved */
  outputDir: string;
  /** Border options (optional) */
  border?: {
    width: number;
    color: string;
  };
  /** Normalize height of all elements (optional) */
  normalizeHeight?: boolean;
  /** Target height for all elements if normalizeHeight is true (optional) */
  targetHeight?: number;
}

/**
 * Captures screenshots of specified elements on a page and concatenates them horizontally
 * @param page - Puppeteer page object
 * @param options - Configuration options for the operation
 */
export async function cropAndConcatElements(
  shot: (selector: string) => Promise<string>,
  evaluate: EvaluateFunc,
  options: PuzzleOptions
) {
  try {
    const fullPageBase64 = await shot("html");
    const fullPageImage = sharp(Buffer.from(fullPageBase64, "base64"));
    await fs.mkdir(options.outputDir, { recursive: true });

    // First pass: capture all elements and determine max height if needed
    const capturedElements: {
      buffer: Buffer;
      width: number;
      height: number;
      aspectRatio: number;
    }[] = [];

    // Default border settings
    const borderWidth = options.border?.width || 5;
    const borderColor = options.border?.color || "#000000";

    let naturalMaxHeight = 0;

    for (const selector of options.elementSelectors) {
      const boundingBox = await evaluate(async (selector) => {
        const { x, y, width, height } = document
          .querySelector(selector)
          .getBoundingClientRect();
        return { x, y, width, height };
      }, selector);
      if (boundingBox) {
        const { x, y, width, height } = boundingBox;

        // Crop the element from the full page screenshot
        const croppedBuffer = await fullPageImage
          .clone()
          .extract({
            left: Math.round(x),
            top: Math.round(y),
            width: Math.round(width),
            height: Math.round(height),
          })
          .toBuffer();

        // Get dimensions of the cropped image
        const metadata = await sharp(croppedBuffer).metadata();
        const croppedWidth = metadata.width || 0;
        const croppedHeight = metadata.height || 0;
        const aspectRatio = croppedWidth / croppedHeight;

        capturedElements.push({
          buffer: croppedBuffer,
          width: croppedWidth,
          height: croppedHeight,
          aspectRatio,
        });

        naturalMaxHeight = Math.max(naturalMaxHeight, croppedHeight);
        console.log(`Element "${selector}" has been cropped`);
      } else {
        console.warn(
          `Unable to get bounding box for element with selector "${selector}".`
        );
      }
    }

    if (capturedElements.length === 0) {
      console.warn("No elements were cropped.");
      return [fullPageBase64];
    }

    // Determine target height for normalization
    const targetHeight = options.normalizeHeight
      ? options.targetHeight || naturalMaxHeight
      : naturalMaxHeight;

    // Second pass: resize elements if needed, add borders, and prepare for composition
    const imagesToConcat: { input: Buffer; left: number; top: number }[] = [];
    let offsetX = 0;

    for (const element of capturedElements) {
      let resizedBuffer = element.buffer;
      let finalWidth = element.width;
      let finalHeight = element.height;

      // If normalizing height, resize proportionally
      if (options.normalizeHeight && element.height !== targetHeight) {
        // Calculate new width based on aspect ratio
        const newWidth = Math.round(targetHeight * element.aspectRatio);

        resizedBuffer = await sharp(element.buffer)
          .resize({
            height: targetHeight,
            width: newWidth,
            fit: "fill", // Maintain aspect ratio
          })
          .toBuffer();

        finalWidth = newWidth;
        finalHeight = targetHeight;
      }

      // Now add border to the resized element
      const borderedBuffer = await sharp(resizedBuffer)
        .extend({
          top: borderWidth,
          bottom: borderWidth,
          left: borderWidth,
          right: borderWidth,
          background: borderColor,
        })
        .toBuffer();

      // Get dimensions of the bordered image
      const borderedMetadata = await sharp(borderedBuffer).metadata();
      const borderedWidth = borderedMetadata.width || 0;

      imagesToConcat.push({
        input: borderedBuffer,
        left: offsetX,
        top: 0,
      });

      offsetX += borderedWidth + 20;
    }

    // Calculate final height (target height + borders)
    const finalHeight = targetHeight + borderWidth * 2;

    const outputFilePath = path.join(
      options.outputDir,
      "combined_elements.png"
    );

    const png = sharp({
      create: {
        width: offsetX,
        height: finalHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite(imagesToConcat)
      .png();

    await png.toFile(outputFilePath);
    const puzzledBase64 = (await png.toBuffer()).toString("base64");

    console.log(
      `Element cropping and horizontal concatenation completed! Saved to: ${outputFilePath}`
    );

    return [fullPageBase64, puzzledBase64];
  } catch (error) {
    console.error(
      "Error occurred while cropping and concatenating elements:",
      error
    );
  }
}
