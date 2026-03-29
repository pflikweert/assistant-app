import { fetchAdminBootstrap, fetchAdminJson } from "@/services/admin-api";
import {
  buildDefaultAiRouteSettings,
  listAiUseCases,
  type AiRouteSetting,
  type AiUseCase,
} from "@/services/ai-use-cases";

export type AiRouteSettingsBootstrap = {
  routeSettings: AiRouteSetting[];
};

export type UpdateAiRouteSettingInput = Partial<
  Pick<
    AiRouteSetting,
    "model" | "agent_mode" | "temperature" | "max_tokens" | "fallback_enabled" | "response_mode"
  >
> & {
  use_case: AiUseCase;
};

function buildFallbackRouteSettings(): AiRouteSetting[] {
  return buildDefaultAiRouteSettings();
}

export async function listAiRouteSettings() {
  try {
    const bootstrap = await fetchAdminBootstrap<AiRouteSettingsBootstrap>();
    return bootstrap.routeSettings.length
      ? bootstrap.routeSettings
      : buildFallbackRouteSettings();
  } catch (error) {
    console.warn("[ai-route-settings] bootstrap load failed", error);
    return buildFallbackRouteSettings();
  }
}

export async function updateAiRouteSetting(input: UpdateAiRouteSettingInput) {
  return fetchAdminJson<{ routeSetting: AiRouteSetting }>("/api/admin", {
    method: "PATCH",
    body: JSON.stringify({
      resource: "route-settings",
      ...input,
    }),
  });
}
