import { describe, expect, it } from "vitest";

import {
  eventHasDraggedFiles,
  extractDroppedFile,
  isDropInsideUploadCard,
} from "@/services/import/import-web-drop";

describe("import-web-drop", () => {
  it("pakt eerst het eerste bestand uit dataTransfer.files", () => {
    const file = { name: "maart.csv" } as File;
    const event = {
      dataTransfer: {
        files: {
          0: file,
          length: 1,
          item: () => file,
        },
      },
    };

    expect(extractDroppedFile(event)).toBe(file);
  });

  it("valt terug op dataTransfer.items als files leeg is", () => {
    const file = { name: "maart.pdf" } as File;
    const event = {
      dataTransfer: {
        files: {
          length: 0,
          item: () => null,
        },
        items: [
          {
            kind: "string",
            getAsFile: () => null,
          },
          {
            kind: "file",
            getAsFile: () => file,
          },
        ],
      },
    };

    expect(extractDroppedFile(event)).toBe(file);
  });

  it("geeft null terug als er geen bruikbaar bestand in drop-event zit", () => {
    expect(extractDroppedFile({ dataTransfer: null })).toBeNull();
    expect(extractDroppedFile({ dataTransfer: { files: { length: 0 } } })).toBeNull();
  });

  it("bepaalt of drop binnen uploadkaart valt", () => {
    const card = {
      getBoundingClientRect: () => ({
        left: 100,
        right: 300,
        top: 200,
        bottom: 420,
      }),
    };

    expect(isDropInsideUploadCard({ clientX: 120, clientY: 240 }, card)).toBe(true);
    expect(isDropInsideUploadCard({ clientX: 20, clientY: 240 }, card)).toBe(false);
    expect(isDropInsideUploadCard({ clientX: 120, clientY: 120 }, card)).toBe(false);
  });

  it("detecteert file-drag op basis van dataTransfer types", () => {
    expect(
      eventHasDraggedFiles({
        dataTransfer: {
          types: ["Files", "text/plain"] as any,
        },
      } as any),
    ).toBe(true);

    expect(
      eventHasDraggedFiles({
        dataTransfer: {
          types: ["text/plain"] as any,
        },
      } as any),
    ).toBe(false);
  });
});
