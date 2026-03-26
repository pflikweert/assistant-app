import { describe, expect, it } from "vitest";

import { resolveImportSource } from "./import-source";

describe("resolveImportSource", () => {
  it("detects pdf files from the file name", () => {
    expect(
      resolveImportSource({
        fileName: "rabobank-export.PDF",
        textContent: "Datum;Bedrag",
      }),
    ).toBe("pdf");
  });

  it("detects pdf files from the base64 payload", () => {
    expect(
      resolveImportSource({
        base64Content: "JVBERi0xLjQKJcfs...",
      }),
    ).toBe("pdf");
  });

  it("detects csv files from the file name", () => {
    expect(
      resolveImportSource({
        fileName: "mutaties.csv",
        textContent: "%PDF-1.4",
      }),
    ).toBe("csv");
  });

  it("detects csv files from a readable csv header", () => {
    expect(
      resolveImportSource({
        textContent: "Datum;Bedrag;Omschrijving-1",
      }),
    ).toBe("csv");
  });

  it("falls back to csv when the file type is unclear", () => {
    expect(resolveImportSource({ textContent: "onbekend" })).toBe("csv");
  });
});
