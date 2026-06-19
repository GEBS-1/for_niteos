import sharp from "sharp";

/** Удаление студийного белого фона у PNG товара */
export async function knockOutStudioBackground(input: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = data;
  const w = info.width;
  const h = info.height;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];
    if (a === 0) continue;
    const lum = (r + g + b) / 3;
    const spread = Math.max(r, g, b) - Math.min(r, g, b);

    const px = (i / 4) % w;
    const py = Math.floor(i / 4 / w);
    const edgeDist = Math.min(px, py, w - 1 - px, h - 1 - py);
    const nearEdge = edgeDist <= 3;

    if (lum >= 218 && spread <= 35) {
      pixels[i + 3] = 0;
    } else if (nearEdge && lum >= 190 && spread <= 45) {
      pixels[i + 3] = 0;
    } else if (lum >= 200 && spread <= 20) {
      pixels[i + 3] = Math.min(a, Math.round(a * 0.25));
    }
  }

  return sharp(pixels, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

export async function loadProductPng(
  filePath: string,
  targetW: number,
  rotation = 0
): Promise<{ buffer: Buffer; width: number; height: number }> {
  let buf = await sharp(filePath).trim({ threshold: 20 }).ensureAlpha().toBuffer();
  buf = await knockOutStudioBackground(buf);
  const meta = await sharp(buf).metadata();
  let w = meta.width ?? 100;
  let h = meta.height ?? 40;

  if (h > w * 1.25) {
    buf = await sharp(buf)
      .rotate(-90, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();
    const m = await sharp(buf).metadata();
    w = m.width ?? w;
    h = m.height ?? h;
  }

  const targetH = Math.max(8, Math.round(h * (targetW / w)));
  let pipeline = sharp(buf).resize(targetW, targetH, { fit: "inside" }).ensureAlpha();
  if (rotation !== 0) {
    pipeline = pipeline.rotate(rotation, {
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }
  const finalBuf = await pipeline.png().toBuffer();
  const finalMeta = await sharp(finalBuf).metadata();
  return {
    buffer: finalBuf,
    width: finalMeta.width ?? targetW,
    height: finalMeta.height ?? targetH,
  };
}
