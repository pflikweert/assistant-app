import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireCurrentUserIdMock,
  fromMock,
  responseQueue,
  upsertQueue,
} = vi.hoisted(() => {
  const responseQueue: { data: unknown; error: unknown }[] = [];
  const upsertQueue: { error: unknown }[] = [];

  const fromMock = vi.fn(() => {
    const query: any = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      maybeSingle: vi.fn(() => Promise.resolve(responseQueue.shift() || { data: null, error: null })),
      upsert: vi.fn(() => Promise.resolve(upsertQueue.shift() || { error: null })),
    };
    return query;
  });

  return {
    requireCurrentUserIdMock: vi.fn(),
    fromMock,
    responseQueue,
    upsertQueue,
  };
});

vi.mock("@/services/current-user", () => ({
  requireCurrentUserId: requireCurrentUserIdMock,
}));

vi.mock("@/services/supabase", () => ({
  supabase: {
    from: fromMock,
  },
}));

let loadMoneyViewScopePreference: typeof import("./finance-scope-preference").loadMoneyViewScopePreference;
let upsertMoneyViewScopePreference: typeof import("./finance-scope-preference").upsertMoneyViewScopePreference;

describe("finance-scope-preference", () => {
  beforeEach(async () => {
    vi.resetModules();
    ({ loadMoneyViewScopePreference, upsertMoneyViewScopePreference } = await import(
      "./finance-scope-preference"
    ));
    requireCurrentUserIdMock.mockReset();
    requireCurrentUserIdMock.mockResolvedValue("user-1");
    fromMock.mockClear();
    responseQueue.length = 0;
    upsertQueue.length = 0;
  });

  it("houdt scopekeuze in sessie vast als preferencetabel ontbreekt", async () => {
    upsertQueue.push({
      error: { code: "42P01", message: "relation does not exist" },
    });
    await upsertMoneyViewScopePreference("shared", "user-1");

    responseQueue.push({
      data: null,
      error: { code: "42P01", message: "relation does not exist" },
    });

    const loaded = await loadMoneyViewScopePreference("user-1");
    expect(loaded.scopeView).toBe("shared");
  });

  it("gebruikt persisted voorkeur als die beschikbaar is", async () => {
    responseQueue.push({
      data: { money_view_scope: "household", updated_at: "2026-03-27T10:00:00.000Z" },
      error: null,
    });

    const loaded = await loadMoneyViewScopePreference("user-1");
    expect(loaded.scopeView).toBe("household");
    expect(loaded.updatedAt).toBe("2026-03-27T10:00:00.000Z");
  });
});
