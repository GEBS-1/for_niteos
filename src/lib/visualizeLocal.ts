import fs from "fs";
import sharp from "sharp";
import type { DisplayOptions } from "./displayOptions";
import { DEFAULT_DISPLAY_OPTIONS, getFixtureWidthBounds } from "./displayOptions";
import {
  getFixtureImagePath,
  resolvePlacementImageRole,
} from "./fixtureAssets";
import { buildRibbonComposites, ribbonGlowSvg } from "./ribbonRender";
import type { PipelineLogger } from "./pipelineLog";
import type {
  Fixture,
  FixtureMountType,
  FixturePlacement,
  LocalRenderReport,
  PlacementScheme,
} from "./types";

function glowSvgOverlay(
  width: number,
  height: number,
  placements: FixturePlacement[],
  intensity: number
): string {
  const spots = placements
    .map((p) => {
      const cx = p.x * width;
      const cy = p.y * height;
      const r = Math.max(40, (p.widthPx ?? 40) * (intensity > 1 ? 2.5 : 1.8));
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#warmGlow)" opacity="${0.45 * intensity}"/>`;
    })
    .join("");

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="warmGlow">
        <stop offset="0%" stop-color="rgba(255,200,120,0.9)"/>
        <stop offset="45%" stop-color="rgba(255,160,60,0.35)"/>
        <stop offset="100%" stop-color="rgba(255,120,40,0)"/>
      </radialGradient>
      <linearGradient id="vignette" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(5,15,40,0.12)"/>
        <stop offset="100%" stop-color="rgba(5,15,40,0.5)"/>
      </linearGradient>
      <linearGradient id="uplight" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stop-color="rgba(255,180,80,0.28)"/>
        <stop offset="55%" stop-color="rgba(255,200,120,0.06)"/>
        <stop offset="100%" stop-color="rgba(255,200,120,0)"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#vignette)"/>
    <rect x="${width * 0.06}" y="${height * 0.08}" width="${width * 0.88}" height="${height * 0.88}" fill="url(#uplight)" opacity="0.65"/>
    ${spots}
  </svg>`;
}

function placementMarkersSvg(
  width: number,
  height: number,
  placements: FixturePlacement[],
  mountLines: PlacementScheme["mountLines"],
  demo: boolean
): string {
  const strokeW = demo ? 3 : 2;
  const lineEls = (mountLines ?? [])
    .map(
      (ml) =>
        `<line x1="${ml.x1 * width}" y1="${ml.y1 * height}" x2="${ml.x2 * width}" y2="${ml.y2 * height}" stroke="rgba(0,255,200,0.45)" stroke-width="${strokeW}" stroke-dasharray="8 6"/>`
    )
    .join("");

  const markers = placements
    .map((p, i) => {
      const cx = p.x * width;
      const cy = p.y * height;
      const w = Math.max(demo ? 72 : 24, p.widthPx ?? 40);
      const h = Math.max(demo ? 20 : 10, p.heightPx ?? 14);
      return `<g>
        <rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" fill="${demo ? "rgba(255,200,80,0.25)" : "none"}" stroke="rgba(255,200,80,0.95)" stroke-width="${strokeW}" rx="3"/>
        <text x="${cx}" y="${cy + (demo ? 5 : 4)}" text-anchor="middle" font-size="${demo ? 13 : 10}" fill="rgba(255,230,180,0.95)" font-family="sans-serif">${i + 1}</text>
      </g>`;
    })
    .join("");

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${lineEls}${markers}</svg>`;
}

function clampTargetWidth(
  requested: number,
  imageWidth: number,
  display: DisplayOptions
): number {
  const bounds = getFixtureWidthBounds(display.scale, imageWidth);
  const scaled = Math.round(requested);
  const floor = bounds.floorPct > 0 ? Math.round(imageWidth * bounds.floorPct) : 0;
  return Math.max(bounds.min, Math.min(bounds.max, Math.max(scaled, floor)));
}

async function loadFixtureRaster(
  fixturePath: string,
  targetW: number,
  rotation: number,
  mountType: FixtureMountType
): Promise<{ buffer: Buffer; meta: { w: number; h: number } }> {
  let buf = await sharp(fixturePath).trim({ threshold: 12 }).ensureAlpha().toBuffer();
  const meta0 = await sharp(buf).metadata();
  let w = meta0.width ?? 100;
  let h = meta0.height ?? 40;

  // Поворачиваем только вертикальные исходники; side.png уже горизонтальный
  if (mountType === "linear" && h > w * 1.25) {
    buf = await sharp(buf)
      .rotate(-90, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();
    const m = await sharp(buf).metadata();
    w = m.width ?? w;
    h = m.height ?? h;
  }

  const targetH = Math.max(8, Math.round(h * (targetW / w)));
  let out = sharp(buf).resize(targetW, targetH, { fit: "inside" }).ensureAlpha();
  if (rotation !== 0) {
    out = out.rotate(rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
  }
  const finalBuf = await out.png().toBuffer();
  const finalMeta = await sharp(finalBuf).metadata();
  return {
    buffer: finalBuf,
    meta: { w: finalMeta.width ?? targetW, h: finalMeta.height ?? targetH },
  };
}

export async function renderLocalVisualization(
  imageBuffer: Buffer,
  placement: PlacementScheme,
  fixture: Fixture,
  log?: PipelineLogger,
  display: DisplayOptions = DEFAULT_DISPLAY_OPTIONS
): Promise<{ dataUrl: string; report: LocalRenderReport }> {
  const logger = log?.child("local-render") ?? null;
  const logInfo = (msg: string, data?: Record<string, unknown>) =>
    logger?.log("render", msg, data, "info");
  const logWarn = (msg: string, data?: Record<string, unknown>) =>
    logger?.log("render", msg, data, "warn");

  const meta = await sharp(imageBuffer).metadata();
  const width = meta.width ?? 1200;
  const height = meta.height ?? 800;
  const isDemo = display.scale === "demo";

  logInfo("start", {
    imageWidth: width,
    imageHeight: height,
    placements: placement.fixtures.length,
    display,
    fixtureId: fixture.id,
  });

  const eveningBase = await sharp(imageBuffer)
    .modulate({ brightness: 0.48, saturation: 0.92 })
    .linear(1.08, -22)
    .tint({ r: 30, g: 45, b: 90 })
    .toBuffer();

  const role = resolvePlacementImageRole(fixture, fixture.mountType ?? "facade");
  const fixturePath = getFixtureImagePath(fixture, role);
  const fixtureFileExists = fs.existsSync(fixturePath);
  let fixtureSourceSize: { w: number; h: number } | undefined;
  if (fixtureFileExists) {
    const fm = await sharp(fixturePath).metadata();
    fixtureSourceSize = { w: fm.width ?? 0, h: fm.height ?? 0 };
    logInfo("fixture-png", { fixturePath, role, ...fixtureSourceSize });
  } else {
    logWarn("fixture-png-missing", { fixturePath, role });
  }

  const report: LocalRenderReport = {
    imageWidth: width,
    imageHeight: height,
    fixturePath,
    fixtureFileExists,
    fixtureSourceSize,
    placementsTotal: placement.fixtures.length,
    pngComposited: 0,
    pngSkipped: 0,
    markerComposited: display.showMarkers ? 1 : 0,
    skipReasons: [],
    compositeSamples: [],
    displayMode: display.scale,
  };

  const composites: { input: Buffer; top: number; left: number }[] = [];
  const isLinearFixture =
    fixture.category === "linear_facade" || fixture.mountType === "linear";
  const hasMountLines = (placement.mountLines?.length ?? 0) > 0;
  const useRibbonBodies = display.showBodies && isLinearFixture && hasMountLines;
  const useRibbonGlow = display.showGlow && isLinearFixture && hasMountLines;

  if (useRibbonBodies && fixtureFileExists) {
    try {
      const moduleW = clampTargetWidth(
        placement.fixtures[0]?.widthPx ?? Math.round(width * 0.08),
        width,
        display
      );
      const { buffer: modBuf, meta: modMeta } = await loadFixtureRaster(
        fixturePath,
        moduleW,
        0,
        "linear"
      );
      const ribbonTiles = await buildRibbonComposites(
        placement.mountLines!,
        modBuf,
        modMeta.w,
        modMeta.h,
        width,
        height,
        "linear",
        display
      );
      composites.push(...ribbonTiles);
      report.pngComposited = ribbonTiles.length;
      logInfo("ribbon-composite", { tiles: ribbonTiles.length, lines: placement.mountLines!.length });
    } catch (err) {
      logWarn("ribbon-failed", { error: err instanceof Error ? err.message : String(err) });
    }
  } else if (display.showBodies) {
    for (let i = 0; i < placement.fixtures.length; i++) {
      const fp = placement.fixtures[i];
      const requestedW = fp.widthPx
        ? Math.round(fp.widthPx * (isDemo ? 1.8 : 1))
        : Math.round(width * (fp.scale ?? 0.1));
      const targetW = clampTargetWidth(requestedW, width, display);

      if (!fixtureFileExists) {
        report.pngSkipped++;
        report.skipReasons.push(`#${i}: file missing`);
        continue;
      }

      try {
        const { buffer: raster, meta: rMeta } = await loadFixtureRaster(
          fixturePath,
          targetW,
          fp.mountType === "linear" || fp.rotation === 0 ? 0 : fp.rotation,
          fp.mountType
        );
        const rw = rMeta.w;
        const rh = rMeta.h;
        const isPole = fp.mountType === "pole";
        const left = Math.round(fp.x * width - rw / 2);
        const top = isPole
          ? Math.round(fp.y * height - rh)
          : Math.round(fp.y * height - rh / 2);
        const clampedLeft = Math.max(0, Math.min(width - rw, left));
        const clampedTop = Math.max(0, Math.min(height - rh, top));

        composites.push({ input: raster, left: clampedLeft, top: clampedTop });
        report.pngComposited++;
        if (report.compositeSamples.length < 5) {
          report.compositeSamples.push({
            index: i,
            x: fp.x,
            y: fp.y,
            targetW,
            left: clampedLeft,
            top: clampedTop,
            rw,
            rh,
          });
        }
      } catch (err) {
        report.pngSkipped++;
        const msg = err instanceof Error ? err.message : String(err);
        report.skipReasons.push(`#${i}: ${msg}`);
        logWarn("fixture-layer-failed", { index: i, error: msg });
      }
    }
  }

  logInfo("png-composite-summary", {
    pngComposited: report.pngComposited,
    pngSkipped: report.pngSkipped,
    display,
  });

  const overlayLayers: {
    input: Buffer;
    top: number;
    left: number;
    blend?: "over" | "screen";
  }[] = [];
  if (display.showMarkers) {
    overlayLayers.push({
      input: Buffer.from(
        placementMarkersSvg(
          width,
          height,
          placement.fixtures,
          placement.mountLines,
          isDemo
        )
      ),
      top: 0,
      left: 0,
    });
  }
  if (display.showGlow) {
    const glowIntensity = isDemo ? 1.0 : 1.35;
    const glowSvg = useRibbonGlow
      ? ribbonGlowSvg(width, height, placement.mountLines!, glowIntensity)
      : glowSvgOverlay(width, height, placement.fixtures, glowIntensity);
    const glowRaster = await sharp(Buffer.from(glowSvg), { density: 144 })
      .resize(width, height)
      .png()
      .toBuffer();
    overlayLayers.push({
      input: glowRaster,
      top: 0,
      left: 0,
      blend: "screen",
    });
  }

  let pipeline = sharp(eveningBase);
  if (composites.length > 0) {
    pipeline = pipeline.composite(composites);
  }
  if (overlayLayers.length > 0) {
    pipeline = pipeline.composite(
      overlayLayers.map((layer) => ({
        input: layer.input,
        top: layer.top,
        left: layer.left,
        blend: layer.blend ?? "over",
      }))
    );
  }
  const composed = await pipeline.jpeg({ quality: 92 }).toBuffer();

  logInfo("done", { outputBytes: composed.length, pngComposited: report.pngComposited });

  return {
    dataUrl: `data:image/jpeg;base64,${composed.toString("base64")}`,
    report,
  };
}

export function dataUrlToBuffer(dataUrl: string): Buffer {
  const match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
  if (!match) throw new Error("Некорректный формат изображения");
  return Buffer.from(match[1], "base64");
}
