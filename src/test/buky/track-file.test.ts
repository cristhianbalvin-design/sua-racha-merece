import { describe, expect, it } from "vitest";
import { gzipSync } from "node:zlib";
import { parseTrackFile, parseTrackJson } from "@/features/buky/lib/trackFile";

const sample = { session_id: "s", format: "seq,fixTime,receivedAt,lat,lon,accuracy,simulated", readings: [[1, 2000, 2001, -22.91, -43.11, 8, 0], [0, 1000, 1001, -22.9, -43.1, 6, 0], ["x"]] };

describe("archivo de recorrido", () => {
  it("ordena por tiempo y descarta filas inválidas", () => {
    expect(parseTrackJson(sample)).toEqual([
      { lat: -22.9, lon: -43.1, t: 1000, acc: 6 },
      { lat: -22.91, lon: -43.11, t: 2000, acc: 8 },
    ]);
  });
  it("lee el .json.gz y también el JSON sin comprimir", async () => {
    const file = (b: Uint8Array) => ({ arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer });
    expect(await parseTrackFile(file(gzipSync(JSON.stringify(sample))))).toHaveLength(2);
    expect(await parseTrackFile(file(new TextEncoder().encode(JSON.stringify(sample))))).toHaveLength(2);
  });
});
