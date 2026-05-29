import sharp from 'sharp';

type OcrCropBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type EpaperOcrPreprocessResult = {
  dataUrl: string;
  width: number;
  height: number;
};

const OCR_MAX_WIDTH = 2400;
const OCR_UPSCALE_FACTOR = 2.5;

function calculateOcrWidth(cropWidth: number) {
  return Math.max(1, Math.min(OCR_MAX_WIDTH, Math.round(cropWidth * OCR_UPSCALE_FACTOR)));
}

export async function buildEpaperCropOcrImageSource(
  pageImageBuffer: Buffer,
  crop: OcrCropBox
): Promise<EpaperOcrPreprocessResult> {
  const targetWidth = calculateOcrWidth(crop.width);
  const output = await sharp(pageImageBuffer)
    .extract({
      left: crop.left,
      top: crop.top,
      width: crop.width,
      height: crop.height,
    })
    .resize({
      width: targetWidth,
      withoutEnlargement: false,
    })
    .grayscale()
    .normalize()
    .sharpen()
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true });

  return {
    dataUrl: `data:image/png;base64,${output.data.toString('base64')}`,
    width: output.info.width,
    height: output.info.height,
  };
}
