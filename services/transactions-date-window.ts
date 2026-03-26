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

      const searchTokens = normalizeSearch(searchQuery).split(" ").filter(Boolean);
      if (searchTokens.length) {
        const tokenFilters = searchTokens.map(
          (token) => `or(details.ilike.%${token}%,counterparty.ilike.%${token}%)`,
        );
        const searchFilter =
          tokenFilters.length === 1 ? tokenFilters[0] : `and(${tokenFilters.join(",")})`;
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

