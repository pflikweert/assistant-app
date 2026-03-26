import { fetchAdminBootstrap, fetchAdminJson } from "@/services/admin-api";
import {
  getDefaultAiModel,
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
  const model = getDefaultAiModel();
  return listAiUseCases().map((definition) => ({
    use_case: definition.key,
    model,
    agent_mode: definition.defaultAgentMode,
    temperature: definition.defaultTemperature,
    max_tokens: definition.defaultMaxTokens,
    fallback_enabled: definition.fallbackEnabled,
    response_mode: definition.defaultResponseMode,
  }));
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
