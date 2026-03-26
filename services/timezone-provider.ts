import { RequestCache } from "./request-cache";
import { recordPerfMetric } from "./perf-metrics";

const TIMEZONE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const timezoneCache = new RequestCache();

type SupportedValuesIntl = typeof Intl & {
  supportedValuesOf?: (type: "timeZone") => string[];
};

export async function listTimezones(): Promise<string[]> {
  const startedAt = Date.now();
  const result = await timezoneCache.run(
    "timezones:all",
    TIMEZONE_CACHE_TTL_MS,
    async () => {
      const intlWithSupport = Intl as SupportedValuesIntl;
      if (typeof intlWithSupport.supportedValuesOf === "function") {
        return intlWithSupport.supportedValuesOf("timeZone");
      }
      return ["Europe/Amsterdam", "Europe/Brussels", "Europe/Berlin", "UTC"];
    },
  );

  recordPerfMetric("timezones.list", {
    durationMs: Date.now() - startedAt,
    cacheHit: result.cacheHit,
  });

  return result.value;
}
