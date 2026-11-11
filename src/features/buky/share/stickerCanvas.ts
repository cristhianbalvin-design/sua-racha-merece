import faceUrl from "../assets/share/buky.png";
import logoUrl from "../assets/share/logo.png";
import fontUrl from "../assets/share/barlow-800-latin.woff2";
import fontExtUrl from "../assets/share/barlow-800-latin-ext.woff2";
import { bukysLabel, fitRoute, stickerLayout, type Point, type ShareFormat } from "./stickerLayout";

export type StickerData = {
  date: string | number;
  city: string;
  bukys: number;
  total: number;
  shape: Point[];
  distance: number | null;
  duration: number | null;
  speed: number | null;
};
export type StickerColor = "lime" | "white" | "black";
const colors = { lime: "#39ff14", white: "#ffffff", black: "#000000" };
let fonts: Promise<unknown> | undefined;
function loadFonts() {
  return (fonts ??= Promise.all(
    [fontUrl, fontExtUrl].map(async (url) => {
      const font = new FontFace("Sticker Barlow", `url(${url})`, { style: "italic", weight: "800" });
      document.fonts.add(await font.load());
    }),
  ));
}
function image(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
function tinted(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  color: string,
  box: { x: number; y: number; width: number; height: number },
) {
  const layer = document.createElement("canvas");
  layer.width = img.naturalWidth;
  layer.height = img.naturalHeight;
  const c = layer.getContext("2d")!;
  c.drawImage(img, 0, 0);
  c.globalCompositeOperation = "source-in";
  c.fillStyle = color;
  c.fillRect(0, 0, layer.width, layer.height);
  ctx.drawImage(layer, box.x, box.y, box.width, box.height);
}
export async function drawSticker(canvas: HTMLCanvasElement, data: StickerData, format: ShareFormat, color: StickerColor) {
  const [face, logo] = await Promise.all([image(faceUrl), image(logoUrl), loadFonts()]);
  const layout = stickerLayout(format);
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Story: fondo negro; con la tinta "Preto", fondo claro entero (como el sticker de referencia) en vez de un panel.
  const lightStory = format === "story" && color === "black";
  if (format === "story") {
    ctx.fillStyle = lightStory ? "#e8e8e3" : "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.save();
  ctx.translate(layout.sticker.x, layout.sticker.y);
  ctx.scale(3, 3);
  const ink = colors[color];
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  tinted(ctx, face, ink, layout.face);
  tinted(ctx, logo, ink, layout.logo);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(144, 180);
  ctx.lineTo(160, 180);
  ctx.moveTo(200, 180);
  ctx.lineTo(216, 180);
  ctx.moveTo(180, 141);
  ctx.lineTo(180, 157);
  ctx.moveTo(180, 203);
  ctx.lineTo(180, 219);
  ctx.stroke();
  ctx.textBaseline = "alphabetic";
  ctx.font = 'italic 800 11px "Sticker Barlow"';
  ctx.fillText(bukysLabel(data.date), 202, 99, 120);
  ctx.fillText("TOTAL", 202, 211);
  ctx.textAlign = "right";
  ctx.fillText(data.city.toLocaleUpperCase("pt-BR"), 158, 211, 135);
  ctx.textAlign = "left";
  ctx.font = 'italic 800 76px "Sticker Barlow"';
  ctx.fillText(String(data.bukys), 202, 166, 125);
  ctx.fillText(String(data.total), 202, 280, 125);
  const route = fitRoute(data.shape, layout.route);
  if (route.length) {
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    route.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    for (const p of [route[0], route[route.length - 1]]) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  if (format === "story") {
    const pace = data.speed && data.speed > 0 ? Math.round(3600 / data.speed) : null;
    const duration =
      data.duration == null
        ? "—"
        : `${Math.floor(data.duration / 3600) ? `${Math.floor(data.duration / 3600)}:` : ""}${String(Math.floor((data.duration % 3600) / 60)).padStart(2, "0")}:${String(Math.floor(data.duration % 60)).padStart(2, "0")}`;
    ctx.textAlign = "center";
    ctx.fillStyle = lightStory ? "#000" : "#fff";
    [
      [
        "DISTÂNCIA",
        data.distance == null ? "—" : `${(data.distance / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km`,
      ],
      ["RITMO", pace == null ? "—" : `${Math.floor(pace / 60)}:${String(pace % 60).padStart(2, "0")} /km`],
      ["TEMPO", duration],
    ].forEach(([label, value], i) => {
      const x = 210 + i * 330;
      ctx.font = 'italic 800 32px "Sticker Barlow"';
      ctx.fillText(label, x, 1530);
      ctx.font = 'italic 800 64px "Sticker Barlow"';
      ctx.fillText(value, x, 1610, 300);
    });
    ctx.font = 'italic 800 40px "Sticker Barlow"';
    ctx.fillText("3buk.com", 540, 1790);
  }
}
export function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Não foi possível gerar a imagem"))), "image/png"),
  );
}
