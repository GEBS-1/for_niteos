import type { LightingType, PlacementScheme } from "./types";

export function renderLightingOverlay(
  imageDataUrl: string,
  placement: PlacementScheme,
  lightingType: LightingType
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }

      ctx.drawImage(img, 0, 0);

      const scale = Math.max(img.width, img.height) / 1000;
      const lineWidth = 4 * scale;
      const pointRadius = 10 * scale;

      ctx.save();
      ctx.globalCompositeOperation = "screen";

      for (const line of placement.lines ?? []) {
        ctx.beginPath();
        ctx.moveTo(line.x1, line.y1);
        ctx.lineTo(line.x2, line.y2);
        const grad = ctx.createLinearGradient(line.x1, line.y1, line.x2, line.y2);
        grad.addColorStop(0, "rgba(0, 220, 255, 0.3)");
        grad.addColorStop(0.5, "rgba(0, 255, 255, 0.95)");
        grad.addColorStop(1, "rgba(0, 220, 255, 0.3)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = lineWidth;
        ctx.shadowColor = "#00ffff";
        ctx.shadowBlur = 24 * scale;
        ctx.stroke();
      }

      for (const fp of placement.fixtures ?? []) {
        const px = fp.x * img.width;
        const py = fp.y * img.height;
        const glowR = pointRadius * 4 * ((fp.scale ?? 0.1) / 0.1);
        const gradient = ctx.createRadialGradient(px, py, 0, px, py, glowR);
        gradient.addColorStop(0, "rgba(255, 200, 120, 0.95)");
        gradient.addColorStop(0.4, "rgba(255, 160, 60, 0.4)");
        gradient.addColorStop(1, "rgba(255, 120, 40, 0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(px, py, glowR, 0, Math.PI * 2);
        ctx.fill();
        const hw = pointRadius * 1.2 * (fp.scale ?? 0.1);
        const hh = pointRadius * 0.4 * (fp.scale ?? 0.1);
        ctx.fillStyle = "rgba(255, 230, 180, 0.9)";
        ctx.fillRect(px - hw, py - hh, hw * 2, hh * 2);
      }

      for (const p of placement.points ?? []) {
        const glowR = pointRadius * 4;
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
        gradient.addColorStop(0, "rgba(100, 255, 255, 1)");
        gradient.addColorStop(0.25, "rgba(0, 220, 255, 0.75)");
        gradient.addColorStop(0.6, "rgba(0, 150, 255, 0.25)");
        gradient.addColorStop(1, "rgba(0, 80, 255, 0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(200, 255, 255, 0.95)";
        ctx.strokeStyle = "#00d4ff";
        ctx.lineWidth = 2 * scale;
        const hw = pointRadius * 0.9;
        const hh = pointRadius * 0.5;
        ctx.fillRect(p.x - hw, p.y - hh, hw * 2, hh * 2);
        ctx.strokeRect(p.x - hw, p.y - hh, hw * 2, hh * 2);
      }

      if (lightingType === "заливная") {
        const marginX = img.width * 0.08;
        const marginY = img.height * 0.1;
        const grad = ctx.createLinearGradient(0, img.height * 0.55, 0, img.height);
        grad.addColorStop(0, "rgba(0, 120, 255, 0)");
        grad.addColorStop(1, "rgba(0, 200, 255, 0.28)");
        ctx.fillStyle = grad;
        ctx.fillRect(marginX, marginY, img.width - marginX * 2, img.height - marginY);
      }

      ctx.restore();

      ctx.font = `bold ${Math.round(16 * scale)}px system-ui, sans-serif`;
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 3 * scale;
      ctx.fillStyle = "#00ffff";
      for (const z of placement.zoneLabels ?? []) {
        ctx.strokeText(z.label, z.x, z.y);
        ctx.fillText(z.label, z.x, z.y);
      }

      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageDataUrl;
  });
}
