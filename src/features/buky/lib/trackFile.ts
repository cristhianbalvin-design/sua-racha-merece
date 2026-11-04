/**
 * Lee el archivo de recorrido que guarda buky-close-session:
 * gzip de { format: "seq,fixTime,receivedAt,lat,lon,accuracy,simulated", readings: [[...], ...] }.
 * Si el navegador ya lo entregó descomprimido, lo lee directo.
 */
export async function parseTrackFile(blob: Pick<Blob, "arrayBuffer">): Promise<{ lat: number; lon: number; t: number; acc: number }[]> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let text: string;
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    if (typeof DecompressionStream === "undefined") throw new Error("gzip_unsupported");
    const stream = new Response(bytes).body!.pipeThrough(new DecompressionStream("gzip"));
    text = await new Response(stream).text();
  } else {
    text = new TextDecoder().decode(bytes);
  }
  return parseTrackJson(JSON.parse(text));
}

export function parseTrackJson(json: { readings?: unknown[] }): { lat: number; lon: number; t: number; acc: number }[] {
  const out: { lat: number; lon: number; t: number; acc: number }[] = [];
  for (const r of json.readings ?? []) {
    if (!Array.isArray(r) || r.length < 6) continue;
    const [, fixTime, , lat, lon, acc] = r as number[];
    if (Number.isFinite(lat) && Number.isFinite(lon)) out.push({ lat, lon, t: fixTime, acc });
  }
  return out.sort((a, b) => a.t - b.t);
}
