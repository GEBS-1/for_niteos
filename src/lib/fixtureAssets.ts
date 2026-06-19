import fs from "fs";
import path from "path";
import type { Fixture, FixtureMountType } from "./types";

/** Папка public/fixtures/{fixture.id}/ */
function defaultPathsForId(id: string) {
  const base = `/fixtures/${id}`;
  return {
    front: `${base}/front.png`,
    side: `${base}/side.png`,
    top: `${base}/top.png`,
  };
}

const FIXTURE_PNG_FALLBACK: Record<string, { front: string; side: string; top?: string }> = {
  "magistral-v3-ai-70": defaultPathsForId("magistral-v3-ai-70"),
  "magistral-v3": defaultPathsForId("magistral-v3-ai-70"),
  "nt-park-step": defaultPathsForId("nt-park-step"),
  "nt-rainbow-24": defaultPathsForId("nt-rainbow-24"),
  "x-ray": defaultPathsForId("x-ray"),
  "nt-slim": defaultPathsForId("nt-slim"),
  "nt-horizon": defaultPathsForId("nt-horizon"),
  "nt-contour": defaultPathsForId("nt-contour"),
  "nt-slim-contour-mini": defaultPathsForId("nt-slim-contour-mini"),
  "nt-uno": defaultPathsForId("nt-uno"),
  "nt-uno-line": defaultPathsForId("nt-uno-line"),
  "nt-liga-window": defaultPathsForId("nt-liga-window"),
  "nt-lace": defaultPathsForId("nt-lace"),
};

/** Старые плоские пути → новая структура по id */
const LEGACY_ALIASES: Record<string, string> = {
  "/fixtures/magistral.png": "/fixtures/magistral-v3-ai-70/side.png",
  "/fixtures/magistral-front.png": "/fixtures/magistral-v3-ai-70/front.png",
  "/fixtures/magistral-side.png": "/fixtures/magistral-v3-ai-70/side.png",
  "/fixtures/magistral-top.png": "/fixtures/magistral-v3-ai-70/top.png",
  "/fixtures/nt-park-step.png": "/fixtures/nt-park-step/front.png",
  "/fixtures/nt-park.png": "/fixtures/nt-park-step/front.png",
};

export type FixtureImageRole = "front" | "side" | "top" | "default";

export function getFixturePublicPath(fixture: Fixture, role: FixtureImageRole = "default"): string {
  const front = fixture.frontImage ?? fixture.image;
  const side = fixture.sideImage ?? fixture.imageSide;
  const top = fixture.imageTop;
  if (role === "side" && side) return side;
  if (role === "top" && top) return top;
  if (role === "front" && front) return front;
  const fb = FIXTURE_PNG_FALLBACK[fixture.id];
  if (role === "side") return side ?? fb?.side ?? front ?? `/fixtures/${fixture.id}/side.png`;
  if (role === "top") return top ?? fb?.top ?? front ?? `/fixtures/${fixture.id}/top.png`;
  return front ?? fb?.front ?? `/fixtures/${fixture.id}/front.png`;
}

export function getFixtureImagePath(fixture: Fixture, role: FixtureImageRole = "default"): string {
  const rel = getFixturePublicPath(fixture, role);
  const aliased = LEGACY_ALIASES[rel] ?? rel;
  const normalized = aliased.replace(/^\//, "");
  const full = path.join(process.cwd(), "public", normalized);
  if (fs.existsSync(full)) return full;

  const fb = FIXTURE_PNG_FALLBACK[fixture.id];
  if (fb) {
    const key = role === "side" ? "side" : role === "top" ? "top" : "front";
    const fbPath = fb[key as keyof typeof fb];
    if (fbPath) {
      const fbFull = path.join(process.cwd(), "public", fbPath.replace(/^\//, ""));
      if (fs.existsSync(fbFull)) return fbFull;
    }
  }
  return full;
}

/** На фасаде линейный — светодиодная грань (side); опора — фронт */
export function resolvePlacementImageRole(
  fixture: Fixture,
  mountType: FixtureMountType
): FixtureImageRole {
  if (mountType === "linear" || fixture.category === "linear_facade") {
    return "side";
  }
  if (fixture.imageSide) return "side";
  return "front";
}
