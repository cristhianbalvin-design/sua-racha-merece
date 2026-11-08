/**
 * Foto de perfil: el teléfono la recorta en cuadrado (centro) y la reduce a `size` px en JPEG antes
 * de subirla. Así entra cualquier foto de la cámara (antes, las grandes superaban el límite del bucket).
 */
export async function squareAvatar(file: File, size = 512, quality = 0.86): Promise<File> {
  const bmp = await loadBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const sx = Math.round((bmp.width - side) / 2);
  const sy = Math.round((bmp.height - side) / 2);
  const out = Math.min(size, side);
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, sx, sy, side, side, 0, 0, out, out);
  if ("close" in bmp && typeof bmp.close === "function") bmp.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
  if (!blob) throw new Error("encode_failed");
  return new File([blob], "avatar.jpg", { type: "image/jpeg" });
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      // Respeta la orientación EXIF de las fotos del teléfono
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* algunos formatos: se intenta con <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
