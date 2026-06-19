import { knockOutStudioBackground } from "@/core/render/prepareAsset";
import fs from "fs";
import sharp from "sharp";
import type { DisplayOptions } from "./displayOptions";
import { DEFAULT_DISPLAY_OPTIONS, getFixtureWidthBounds } from "./displayOptions";
import {
  getFixtureImagePath,
  resolvePlacementImageRole,
} from "./fixtureAssets";
import { buildRibbonComposites, ribbonGlowSvg } from "./ribbonRender";
import { getFixturePlacementProfile, type GlowMode } from "./fixturePlacementProfile";
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

  return glowSvgBase(width, height, spots);
}

/** Широкая заливка прожектора — крупные мягкие эллипсы с перекрытием */
function wideWashGlowSvg(
  width: number,
  height: number,
  placements: FixturePlacement[],
  intensity: number
): string {
  const spots = placements
    .map((p) => {
      const cx = p.x * width;
      const cy = p.y * height;
      const rx = Math.max(90, (p.widthPx ?? 60) * 3.2 * intensity);
      const ry = Math.max(70, (p.heightPx ?? 40) * 5 * intensity);
      return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#warmGlow)" opacity="${0.32 * intensity}"/>`;
    })
    .join("");
  return glowSvgBase(width, height, spots);
}

/** Узкий акцентный луч */
function tightSpotGlowSvg(
  width: number,
  height: number,
  placements: FixturePlacement[],
  intensity: number
): string {
  const spots = placements
    .map((p) => {
      const cx = p.x * width;
      const cy = p.y * height;
      const r = Math.max(22, (p.widthPx ?? 30) * 0.9);
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#warmGlow)" opacity="${0.55 * intensity}"/>
        <circle cx="${cx}" cy="${cy}" r="${r * 2.2}" fill="url(#warmGlow)" opacity="${0.18 * intensity}"/>`;
    })
    .join("");
  return glowSvgBase(width, height, spots, false);
}

/** Мягкая подсветка оконных проёмов */
function windowSoftGlowSvg(
  width: number,
  height: number,
  placements: FixturePlacement[],
  intensity: number
): string {
  const spots = placements
    .map((p) => {
      const cx = p.x * width;
      const cy = p.y * height;
      const rw = Math.max(36, (p.widthPx ?? 40) * 1.1);
      const rh = Math.max(10, (p.heightPx ?? 12) * 0.8);
      return `<rect x="${cx - rw / 2}" y="${cy - rh / 2}" width="${rw}" height="${rh}" rx="3"
        fill="url(#warmGlow)" opacity="${0.38 * intensity}"/>`;
    })
    .join("");
  return glowSvgBase(width, height, spots, false);
}

/** Заливка фасада от опор на земле */
function poleUplightGlowSvg(
  width: number,
  height: number,
  placements: FixturePlacement[],
  facadeBox: PlacementScheme["facadeBox"],
  intensity: number
): string {
  const fb = facadeBox;
  const fx = fb.x * width;
  const fy = fb.y * height;
  const fw = fb.width * width;
  const fh = fb.height * height;
  const uplight = `<rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" fill="url(#uplight)" opacity="${0.55 * intensity}"/>`;
  const poleSpots = placements
    .map((p) => {
      const cx = p.x * width;
      const cy = p.y * height;
      const r = Math.max(30, (p.widthPx ?? 36) * 1.2);
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#warmGlow)" opacity="${0.5 * intensity}"/>`;
    })
    .join("");
  return glowSvgBase(width, height, uplight + poleSpots, true);
}

function glowSvgBase(
  width: number,
  height: number,
  inner: string,
  withUplight = true
): string {
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="warmGlow">
        <stop offset="0%" stop-color="rgba(255,200,120,0.72)"/>
        <stop offset="45%" stop-color="rgba(255,160,60,0.24)"/>
        <stop offset="100%" stop-color="rgba(255,120,40,0)"/>
      </radialGradient>
      <linearGradient id="vignette" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(5,15,40,0.1)"/>
        <stop offset="100%" stop-color="rgba(5,15,40,0.38)"/>
      </linearGradient>
      <linearGradient id="uplight" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stop-color="rgba(255,180,80,0.18)"/>
        <stop offset="55%" stop-color="rgba(255,200,120,0.04)"/>
        <stop offset="100%" stop-color="rgba(255,200,120,0)"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#vignette)"/>
    ${withUplight ? `<rect x="${width * 0.06}" y="${height * 0.08}" width="${width * 0.88}" height="${height * 0.88}" fill="url(#uplight)" opacity="0.42"/>` : ""}
    ${inner}
  </svg>`;
}

function buildGlowSvg(
  glowMode: GlowMode,
  width: number,
  height: number,
  placement: PlacementScheme,
  intensity: number
): string {
  const { fixtures, mountLines, facadeBox } = placement;
  switch (glowMode) {
    case "ribbon":
    case "contour_ribbon":
      return ribbonGlowSvg(width, height, mountLines ?? [], intensity);
    case "wide_wash":
      return wideWashGlowSvg(width, height, fixtures, intensity);
    case "tight_spot":
      return tightSpotGlowSvg(width, height, fixtures, intensity);
    case "window_soft":
      return windowSoftGlowSvg(width, height, fixtures, intensity);
    case "pole_uplight":
      return poleUplightGlowSvg(width, height, fixtures, facadeBox, intensity);
    default:
      return glowSvgOverlay(width, height, fixtures, intensity);
  }
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
  let buf = await sharp(fixturePath).trim({ threshold: 24 }).ensureAlpha().toBuffer();
  buf = await knockOutStudioBackground(buf);
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

  const eveningBase = display.eveningBase !== false
    ? await sharp(imageBuffer)
        .modulate({ brightness: 0.58, saturation: 0.82 })
        .linear(1.02, -16)
        .tint({ r: 28, g: 40, b: 78 })
        .toBuffer()
    : imageBuffer;

  const role = resolvePlacementImageRole(fixture, fixture.mountType ?? "facade");
  const fixturePath = getFixtureImagePath(fixture, role);
  const fixtureFileExists = fs.existsSync(fixturePath);
  let fixtureSourceSize: { w: number; h: number } | undefined;
  if (!fixtureFileExists) {
    logWarn("fixture-png-missing", { fixturePath, role });
    throw new Error(
      `PNG светильника не найден: ${fixturePath}. Запустите: npm run sync:fixtures`
    );
  }
  const fm = await sharp(fixturePath).metadata();
  fixtureSourceSize = { w: fm.width ?? 0, h: fm.height ?? 0 };
  logInfo("fixture-png", { fixturePath, role, ...fixtureSourceSize });

  const report: LocalRenderReport = {
    imageWidth: width,
    imageHeight: height,
    fixturePath,
    fixtureFileExists,
    fixtureSourceSize,
    placementsTotal: placement.fixtures.length,
    pngComposited: 0,
    pngSkipped: 0,
    markerComposited: 0,
    skipReasons: [],
    compositeSamples: [],
    displayMode: display.scale,
  };

  const composites: { input: Buffer; top: number; left: number }[] = [];
  const profile = getFixturePlacementProfile(fixture);
  const hasMountLines = (placement.mountLines?.length ?? 0) > 0;
  const useRibbonBodies =
    display.showBodies && profile.useRibbonBodies && hasMountLines;
  const useRibbonGlow =
    display.showGlow &&
    profile.useRibbonGlow &&
    hasMountLines &&
    (profile.glowMode === "ribbon" || profile.glowMode === "contour_ribbon");

  if (useRibbonBodies && fixtureFileExists) {
    try {
      const moduleW = clampTargetWidth(
        Math.round((placement.fixtures[0]?.widthPx ?? Math.round(width * 0.08)) * (isDemo ? 1.6 : 1)),
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
        display,
        profile.placementMode === "contour_perimeter"
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
  if (display.showGlow) {
    const glowIntensity = isDemo ? 0.9 : 1.05;
    const glowSvg = useRibbonGlow
      ? ribbonGlowSvg(width, height, placement.mountLines!, glowIntensity)
      : buildGlowSvg(profile.glowMode, width, height, placement, glowIntensity);
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
