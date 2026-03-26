type DropEventLike = {
  clientX?: number;
  clientY?: number;
  dataTransfer?: {
    files?: {
      length?: number;
      [index: number]: File | undefined;
      item?: (index: number) => File | null;
    };
    items?: ArrayLike<{
      kind?: string;
      getAsFile?: () => File | null;
    }>;
  } | null;
} | null | undefined;

type RectLike = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

type DropTargetLike = {
  getBoundingClientRect: () => RectLike;
} | null;

export function extractDroppedFile(event: DropEventLike): File | null {
  const dataTransfer = event?.dataTransfer;
  if (!dataTransfer) return null;

  const files = dataTransfer.files;
  if (files) {
    const firstFromIndex = files[0] ?? null;
    if (firstFromIndex) return firstFromIndex;
    if (typeof files.item === "function") {
      const firstFromItem = files.item(0);
      if (firstFromItem) return firstFromItem;
    }
  }

  const items = dataTransfer.items;
  if (!items || items.length <= 0) return null;
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item || item.kind !== "file" || typeof item.getAsFile !== "function") {
      continue;
    }
    const file = item.getAsFile();
    if (file) return file;
  }

  return null;
}

export function isDropInsideUploadCard(
  event: Pick<NonNullable<DropEventLike>, "clientX" | "clientY"> | null | undefined,
  cardElement: DropTargetLike,
): boolean {
  if (!event || !cardElement) return false;
  const { clientX, clientY } = event;
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;

  const rect = cardElement.getBoundingClientRect();
  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  );
}

export function eventHasDraggedFiles(event: DropEventLike): boolean {
  const types = event?.dataTransfer?.types;
  if (!types) return false;
  try {
    return Array.from(types as ArrayLike<string>).includes("Files");
  } catch {
    return false;
  }
}
