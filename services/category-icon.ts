import type { CategoryRecord } from "@/types/categorization";

type CategorizedRow = {
  category_id_auto?: string | null;
  category_id_user?: string | null;
};

function normalizeIconToken(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function includesAnyToken(haystack: string, needles: string[]) {
  return needles.some((needle) => haystack.includes(normalizeIconToken(needle)));
}

function buildCategoryTrail(
  row: CategorizedRow,
  categoryById: Map<string, CategoryRecord>,
) {
  const categoryId = row.category_id_user || row.category_id_auto || null;
  if (!categoryId) return [] as CategoryRecord[];

  const trail: CategoryRecord[] = [];
  const visited = new Set<string>();
  let current = categoryById.get(categoryId) || null;

  while (current && !visited.has(current.id)) {
    trail.push(current);
    visited.add(current.id);
    current = current.parent_id ? categoryById.get(current.parent_id) || null : null;
  }

  return trail;
}

export function resolveTransactionCategoryIconName(
  row: CategorizedRow,
  categoryById: Map<string, CategoryRecord>,
) {
  const trail = buildCategoryTrail(row, categoryById);
  if (!trail.length) return "help-outline";

  const trailTokens = trail.flatMap((category) => [
    normalizeIconToken(category.key),
    normalizeIconToken(category.name),
    normalizeIconToken(category.budget_group || ""),
  ]);
  const haystack = trailTokens.join(" ");

  if (includesAnyToken(haystack, ["salary", "salaris"])) return "work";
  if (
    includesAnyToken(haystack, [
      "child budget",
      "kindgebonden budget",
      "children allowance",
      "zakgeld",
      "kleedgeld",
    ])
  ) {
    return "child-care";
  }
  if (includesAnyToken(haystack, ["tax refund", "belasting", "wegenbelasting"])) {
    return "receipt-long";
  }
  if (includesAnyToken(haystack, ["work reimbursements", "declaraties"])) {
    return "assignment-returned";
  }
  if (includesAnyToken(haystack, ["sales", "verkoop"])) return "sell";

  if (includesAnyToken(haystack, ["mortgage", "hypotheek", "housing"])) return "home";
  if (includesAnyToken(haystack, ["energy", "energie", "utility"])) return "bolt";
  if (includesAnyToken(haystack, ["water"])) return "water-drop";
  if (includesAnyToken(haystack, ["central heating", "cv", "heating"])) {
    return "thermostat";
  }

  if (
    includesAnyToken(haystack, [
      "health insurance",
      "zorgverzekering",
      "insurance health",
      "autoverzekering",
      "insurance",
    ])
  ) {
    return "verified-user";
  }
  if (includesAnyToken(haystack, ["therapy", "psychotherapy", "therapie"])) {
    return "psychology";
  }
  if (
    includesAnyToken(haystack, [
      "medication",
      "pharmacy",
      "drogist",
      "apotheek",
      "drugstore",
    ])
  ) {
    return "local-pharmacy";
  }
  if (includesAnyToken(haystack, ["personal care", "persoonlijke verzorging"])) {
    return "content-cut";
  }

  if (includesAnyToken(haystack, ["fuel", "brandstof", "gas station", "tankstation"])) {
    return "local-gas-station";
  }
  if (includesAnyToken(haystack, ["parking", "parkeren"])) return "local-parking";
  if (includesAnyToken(haystack, ["maintenance", "garage", "onderhoud"])) {
    return "build";
  }
  if (includesAnyToken(haystack, ["auto transport", "car", "auto"])) {
    return "directions-car";
  }
  if (includesAnyToken(haystack, ["transport", "travel"])) return "directions-transit";

  if (
    includesAnyToken(haystack, [
      "supermarket",
      "groceries",
      "boodschappen",
      "food",
    ])
  ) {
    return "shopping-basket";
  }
  if (includesAnyToken(haystack, ["household", "huishoudelijke artikelen"])) {
    return "home";
  }

  if (includesAnyToken(haystack, ["smoking", "sigaretten", "tabak", "roken"])) {
    return "smoking-rooms";
  }

  if (includesAnyToken(haystack, ["netflix"])) return "live-tv";
  if (includesAnyToken(haystack, ["spotify"])) return "music-note";
  if (includesAnyToken(haystack, ["google services"])) return "cloud";
  if (includesAnyToken(haystack, ["playstation", "sony"])) return "sports-esports";
  if (includesAnyToken(haystack, ["apps", "software"])) return "apps";
  if (includesAnyToken(haystack, ["bank fees", "bankkosten"])) {
    return "account-balance";
  }
  if (includesAnyToken(haystack, ["subscription", "abonnement"])) {
    return "subscriptions";
  }

  if (includesAnyToken(haystack, ["school", "schoolkosten", "education"])) {
    return "school";
  }
  if (includesAnyToken(haystack, ["activities", "activiteiten"])) {
    return "sports-soccer";
  }

  if (includesAnyToken(haystack, ["dining out", "uit eten", "restaurant"])) {
    return "restaurant";
  }
  if (includesAnyToken(haystack, ["clothing", "kleding"])) return "checkroom";
  if (includesAnyToken(haystack, ["hobby"])) return "interests";
  if (includesAnyToken(haystack, ["gifts", "cadeaus"])) return "card-giftcard";
  if (includesAnyToken(haystack, ["tickets", "events", "evenementen"])) {
    return "confirmation-number";
  }
  if (includesAnyToken(haystack, ["leisure", "vrije tijd", "entertainment"])) {
    return "celebration";
  }

  if (includesAnyToken(haystack, ["electronics", "elektronica"])) return "devices";
  if (includesAnyToken(haystack, ["furniture", "meubels", "wonen"])) return "weekend";
  if (includesAnyToken(haystack, ["shopping", "retail", "webshops"])) {
    return "shopping-bag";
  }

  if (includesAnyToken(haystack, ["memberships", "contributies", "verenigingen"])) {
    return "groups";
  }
  if (
    includesAnyToken(haystack, [
      "donations",
      "donatie",
      "goede doelen",
      "religious",
      "kerk",
      "geloofsgemeenschap",
    ])
  ) {
    return "volunteer-activism";
  }

  if (includesAnyToken(haystack, ["crypto"])) return "currency-bitcoin";
  if (includesAnyToken(haystack, ["investments", "beleggingen"])) return "show-chart";
  if (includesAnyToken(haystack, ["savings", "sparen", "investeren"])) {
    return "savings";
  }

  if (
    includesAnyToken(haystack, [
      "payment platforms",
      "betaalplatformen",
      "marktplaatsen",
      "other",
      "onbekend",
    ])
  ) {
    return "payments";
  }

  if (includesAnyToken(haystack, ["income", "inkomen"])) return "trending-up";
  if (includesAnyToken(haystack, ["care", "zorg", "health"])) return "medical-services";

  return "payments";
}
