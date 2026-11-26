import { describe, expect, it } from "vitest";
import { appendUniquePage, groupByMonth, pageSlice } from "./listPage";

describe("growing list presentation", () => {
  const rows = [
    { id: "new", day: "2027-01-02" },
    { id: "old", day: "2026-12-31" },
    { id: "same", day: "2027-01-01" },
  ];

  it("groups civil dates by month while preserving input order", () => {
    expect(Object.keys(groupByMonth(rows, (row) => row.day)).sort()).toEqual(["2026-12", "2027-01"]);
    expect(groupByMonth(rows, (row) => row.day)["2027-01"].map((row) => row.id)).toEqual(["new", "same"]);
  });

  it("reveals more rows without duplicating a page boundary", () => {
    expect(pageSlice(rows, 2).map((row) => row.id)).toEqual(["new", "old"]);
    expect(appendUniquePage(rows.slice(0, 2), rows.slice(1), 2).map((row) => row.id)).toEqual(["new", "old", "same"]);
    expect(appendUniquePage(rows, rows.slice(0, 1), 0)).toEqual(rows.slice(0, 1));
  });
});
