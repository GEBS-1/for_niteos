export async function loadImageFromDataUrl(
  dataUrl: string,
  file?: File
): Promise<{ dataUrl: string; width: number; height: number; file: File }> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Не удалось загрузить изображение"));
    el.src = dataUrl;
  });

  let f = file;
  if (!f) {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    f = new File([blob], "pasted-image.png", {
      type: blob.type || "image/png",
    });
  }

  return {
    dataUrl,
    width: img.naturalWidth,
    height: img.naturalHeight,
    file: f,
  };
}

export async function loadImageFromFile(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return loadImageFromDataUrl(dataUrl, file);
}

export async function loadImageFromBlob(blob: Blob): Promise<{
  dataUrl: string;
  width: number;
  height: number;
  file: File;
}> {
  const type = blob.type.startsWith("image/") ? blob.type : "image/png";
  const file = new File([blob], "pasted-image.png", { type });
  return loadImageFromFile(file);
}
