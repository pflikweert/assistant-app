export const AI_MODEL_OPTIONS = [
  {
    id: "gpt-5.4",
    label: "GPT-5.4",
    description: "Sterkste algemene model voor brede taken en zwaardere redenering.",
  },
  {
    id: "gpt-5.4-mini",
    label: "GPT-5.4 mini",
    description: "Sneller en goedkoper voor veel AI-routes met nog steeds sterke kwaliteit.",
  },
  {
    id: "gpt-5.4-nano",
    label: "GPT-5.4 nano",
    description: "Snelste en goedkoopste optie voor eenvoudige, hoge-volume taken.",
  },
] as const;

export type AiModelId = (typeof AI_MODEL_OPTIONS)[number]["id"];

export const DEFAULT_AI_MODEL_ID: AiModelId = "gpt-5.4-nano";

export function getAiAppEnv() {
  return process.env as Record<string, string | undefined>;
}

export function getConfiguredAiModelOverride() {
  const appEnv = getAiAppEnv();
  const configuredModel = String(appEnv.OPENAI_MODEL || "").trim();

  return configuredModel || null;
}

export function listAiModelOptions() {
  return [...AI_MODEL_OPTIONS];
}

export function isKnownAiModelId(value: string | null | undefined): value is AiModelId {
  return AI_MODEL_OPTIONS.some((option) => option.id === value);
}

export function getDefaultAiModel() {
  return getConfiguredAiModelOverride() || DEFAULT_AI_MODEL_ID;
}
