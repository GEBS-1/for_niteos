import type { BuildingDimensions, NormalizedBox, ScaleAnchor, ScaleInfo } from "./types";



export function resolveScaleAnchor(dimensions: BuildingDimensions): ScaleAnchor | null {

  if (dimensions.heightM != null && dimensions.heightM > 0) return "height";

  if (dimensions.widthM != null && dimensions.widthM > 0) return "width";

  if (dimensions.lengthM != null && dimensions.lengthM > 0) return "length";

  return null;

}



export function getUserMetersForAnchor(

  anchor: ScaleAnchor,

  dimensions: BuildingDimensions

): number {

  switch (anchor) {

    case "height":

      return dimensions.heightM!;

    case "width":

      return dimensions.widthM!;

    case "length":

      return dimensions.lengthM!;

  }

}



function facadePxExtent(

  anchor: ScaleAnchor,

  box: NormalizedBox,

  imageWidth: number,

  imageHeight: number

): number {

  switch (anchor) {

    case "height":

      return box.height * imageHeight;

    case "width":

    case "length":

      return box.width * imageWidth;

  }

}



/** pxPerMeter = размер фасада в пикселях / размер в метрах от пользователя */

export function computePxPerMeter(

  dimensions: BuildingDimensions,

  facadeBox: NormalizedBox,

  imageWidth: number,

  imageHeight: number

): ScaleInfo {

  const anchor = resolveScaleAnchor(dimensions);

  if (!anchor) {

    throw new Error("Укажите хотя бы один размер здания в метрах");

  }

  const userMeters = getUserMetersForAnchor(anchor, dimensions);

  const extent = facadePxExtent(anchor, facadeBox, imageWidth, imageHeight);

  const pixelsPerMeter = extent / userMeters;

  return {

    pixelsPerMeter,

    anchor,

    userMeters,

    facadePxExtent: Math.round(extent * 10) / 10,

  };

}



/** Оценка реальных размеров фасада по масштабу и bbox */

export function estimateFacadeMeters(

  facadeBox: NormalizedBox,

  imageWidth: number,

  imageHeight: number,

  pxPerMeter: number

): { widthM: number; heightM: number } {

  const widthM = (facadeBox.width * imageWidth) / pxPerMeter;

  const heightM = (facadeBox.height * imageHeight) / pxPerMeter;

  return {

    widthM: Math.round(widthM * 10) / 10,

    heightM: Math.round(heightM * 10) / 10,

  };

}

