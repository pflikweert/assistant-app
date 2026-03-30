import { requireCurrentUserId } from "@/services/current-user";
import { recordPerfMetric } from "@/services/perf-metrics";
import { RequestCache } from "@/services/request-cache";
import { supabase } from "@/services/supabase";

const WINDOW_CACHE_TTL_MS = 10_000;
const windowCache = new RequestCache();

export type TransactionsDateWindowParams = {
  userId?: string;
  select: string;
  fromDateInclusive?: string;
  toDateExclusive?: string;
  bankAccountId?: string;
  counterparty?: string;
  analysisMainGroup?: "income" | "expense";
  analysisCategory?: string;
  categoryFilterIdCsv?: string;
  searchCategoryIdCsv?: string;
  searchQuery?: string;
  limit: number;
  offset?: number;
  afterDate?: string;
};

type QueryResponseRow = Record<string, unknown>;

export type TransactionsDateWindowResult = {
  rows: QueryResponseRow[];
  totalCount: number | null;
  cacheHit: boolean;
};

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type AmountSearchTerm = {
  amount: number;
  sign: "any" | "plus" | "minus";
};

function parseAmountSearchToken(rawToken: string): number | null {
  let token = String(rawToken || "").trim().replace(/\s+/g, "");
  if (!token) return null;

  let sign = 1;
  if (token.startsWith("+")) {
    token = token.slice(1);
  } else if (token.startsWith("-")) {
    sign = -1;
    token = token.slice(1);
  }

  token = token.replace(/[^\d.,]/g, "");
  if (!token) return null;

  if (token.includes(",") && token.includes(".")) {
    token = token.replace(/\./g, "").replace(",", ".");
  } else if (token.includes(",")) {
    token = token.replace(",", ".");
  }

  const parsed = Number.parseFloat(token);
  if (Number.isNaN(parsed)) return null;
  return sign * parsed;
}

function extractAmountSearchTerms(query: string): AmountSearchTerm[] {
  const matches = String(query || "").match(/[+\-]?\s*\d[\d.,]*/g) || [];
  const terms: AmountSearchTerm[] = [];
  const seen = new Set<string>();

  for (const rawMatch of matches) {
    const compact = rawMatch.replace(/\s+/g, "");
    const parsed = parseAmountSearchToken(compact);
    if (parsed == null) continue;

    const sign: AmountSearchTerm["sign"] =
      compact.startsWith("+") ? "plus" : compact.startsWith("-") ? "minus" : "any";
    const amount = Math.abs(parsed);
    const key = `${sign}:${amount.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    terms.push({ amount, sign });
  }

  return terms;
}

export async function fetchTransactionsDateWindow(
  params: TransactionsDateWindowParams,
): Promise<TransactionsDateWindowResult> {
  const startedAt = Date.now();
  const resolvedUserId = params.userId || (await requireCurrentUserId());
  const offset = Math.max(0, Math.floor(params.offset || 0));
  const limit = Math.max(1, Math.floor(params.limit));
  const searchQuery = String(params.searchQuery || "").trim();
  const cacheKey = JSON.stringify({
    userId: resolvedUserId,
    select: params.select,
    fromDateInclusive: params.fromDateInclusive || null,
    toDateExclusive: params.toDateExclusive || null,
    bankAccountId: params.bankAccountId || null,
    counterparty: params.counterparty || null,
    analysisMainGroup: params.analysisMainGroup || null,
    analysisCategory: params.analysisCategory || null,
    categoryFilterIdCsv: params.categoryFilterIdCsv || null,
    searchCategoryIdCsv: params.searchCategoryIdCsv || null,
    searchQuery,
    limit,
    offset,
    afterDate: params.afterDate || null,
  });

  const result = await windowCache.run(
    `transactions-date-window:${cacheKey}`,
    WINDOW_CACHE_TTL_MS,
    async () => {
      let query = supabase
        .from("transactions")
        .select(params.select, { count: "exact" })
        .eq("user_id", resolvedUserId);

      if (params.bankAccountId) query = query.eq("bank_account_id", params.bankAccountId);
      if (params.counterparty) query = query.eq("counterparty", params.counterparty);
      if (params.analysisMainGroup) {
        query = query.eq("analysis_main_group", params.analysisMainGroup);
      }
      if (params.analysisCategory) {
        query = query.eq("analysis_category", params.analysisCategory);
      }
      if (params.fromDateInclusive) query = query.gte("date", params.fromDateInclusive);
      if (params.toDateExclusive) query = query.lt("date", params.toDateExclusive);
      if (params.afterDate) query = query.lt("date", params.afterDate);
      if (params.categoryFilterIdCsv) {
        query = query.or(
          `category_id_user.in.(${params.categoryFilterIdCsv}),category_id_auto.in.(${params.categoryFilterIdCsv})`,
        );
      }

      const textSearchTokens = normalizeSearch(searchQuery)
        .split(" ")
        .filter((token) => /[a-z]/.test(token));
      const amountSearchTerms = extractAmountSearchTerms(searchQuery);
      const searchClauses: string[] = [];

      if (textSearchTokens.length) {
        const tokenFilters = textSearchTokens.map(
          (token) => `or(details.ilike.%${token}%,counterparty.ilike.%${token}%)`,
        );
        const textSearchClause =
          tokenFilters.length === 1 ? tokenFilters[0] : `and(${tokenFilters.join(",")})`;
        searchClauses.push(textSearchClause);
      }

      if (params.searchCategoryIdCsv) {
        searchClauses.push(
          `or(category_id_user.in.(${params.searchCategoryIdCsv}),category_id_auto.in.(${params.searchCategoryIdCsv}))`,
        );
      }

      if (amountSearchTerms.length) {
        const amountFilters = new Set<string>();
        for (const term of amountSearchTerms) {
          if (term.sign === "plus") {
            amountFilters.add(`amount.eq.${term.amount}`);
          } else if (term.sign === "minus") {
            amountFilters.add(`amount.eq.-${term.amount}`);
          } else {
            amountFilters.add(`amount.eq.${term.amount}`);
            amountFilters.add(`amount.eq.-${term.amount}`);
          }
        }
        if (amountFilters.size) {
          searchClauses.push(`or(${Array.from(amountFilters).join(",")})`);
        }
      }

      if (searchClauses.length) {
        const searchFilter =
          searchClauses.length === 1 ? searchClauses[0] : `or(${searchClauses.join(",")})`;
        query = query.or(searchFilter);
      }

      const response = await query
        .order("date", { ascending: false })
        .order("metadata->>Volgnr", { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error, count } = response as {
        data: QueryResponseRow[] | null;
        error: Error | null;
        count: number | null;
      };
      if (error) throw error;

      return {
        rows: data || [],
        totalCount: count,
        cacheHit: false,
      };
    },
  );

  recordPerfMetric("transactions.date_window", {
    durationMs: Date.now() - startedAt,
    cacheHit: result.cacheHit,
  });

  return {
    rows: result.value.rows,
    totalCount: result.value.totalCount,
    cacheHit: result.cacheHit,
  };
}
