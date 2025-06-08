import sharp from "sharp";
import { ProcessedElement } from "../types";

export async function visualizeMarkedElements(
  elements: ProcessedElement[],
  inputImagePath: string,
  outputImagePath: string,
  { limit }: { limit?: number } = {}
): Promise<void> {
  try {
    let image = sharp(inputImagePath);

    const metadata = await image.metadata();
    const imageWidth = metadata.width || 0;
    const imageHeight = metadata.height || 0;

    if (!imageWidth || !imageHeight) {
      throw new Error("Could not determine image dimensions");
    }

    const compositeOperations = [];
    const processedIndices = new Set();

    let limitCount = 1;
    for (const [index, element] of elements.entries()) {
      if (limit && limitCount > limit) {
        break;
      }

      const box = element.boundingBox;

      // Skip elements without valid bounding box
      if (
        !box ||
        !box.width ||
        !box.height ||
        box.width <= 0 ||
        box.height <= 0
      ) {
        if (!processedIndices.has(`invalid-${index}`)) {
          processedIndices.add(`invalid-${index}`);
        }
        continue;
      }

      // Ensure integer values for width and height (minimum 1px)
      let width = Math.max(1, Math.round(box.width));
      let height = Math.max(1, Math.round(box.height));
      let x = Math.round(box.x);
      let y = Math.round(box.y);

      // Ensure the overlay stays within image boundaries
      if (x < 0) {
        width += x; // Reduce width by the amount x is negative
        x = 0;
      }
      if (y < 0) {
        height += y; // Reduce height by the amount y is negative
        y = 0;
      }

      // Adjust width/height if they extend beyond image boundaries
      if (x + width > imageWidth) {
        width = imageWidth - x;
      }
      if (y + height > imageHeight) {
        height = imageHeight - y;
      }

      // Skip if dimensions became invalid after adjustments
      if (width <= 0 || height <= 0) {
        if (!processedIndices.has(`outside-${index}`)) {
          processedIndices.add(`outside-${index}`);
        }
        continue;
      }

      // Replace the solid overlay with a border-only rectangle
      compositeOperations.push({
        input: Buffer.from(
          `<svg width="${width}" height="${height}">
            <rect x="0" y="0" width="${width - 1}" height="${height - 1}" 
              fill="rgba(255,0,0,0.2)" stroke="red" stroke-width="2" />
          </svg>`
        ),
        top: y,
        left: x,
      });

      // Add text label
      compositeOperations.push({
        input: {
          text: {
            text: `${limitCount}`,
            font: "sans-serif",
            fontSize: 24,
            rgba: true,
          },
        },
        top: y,
        left: x,
      });

      limitCount++;
    }

    if (compositeOperations.length > 0) {
      image = image.composite(compositeOperations as any);
      await image.toFile(outputImagePath);
      console.log(`Marked image saved to ${outputImagePath}`);
    } else {
      console.log("No valid elements to mark on the image");
      await image.toFile(outputImagePath);
    }
  } catch (error) {
    console.error("Error processing image:", error);
  }
}
