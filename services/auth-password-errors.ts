const passwordErrorMessages: {
  pattern: RegExp;
  message: string;
}[] = [{
  pattern: /new password should be different from the old password/i,
  message: "Kies een ander wachtwoord dan je huidige wachtwoord.",
}];

function getErrorText(error: unknown) {
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object") return "";

  const record = error as Record<string, unknown>;
  return [
    record.message,
    record.error_description,
    record.code,
    record.name,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .trim();
}

export function getPasswordUpdateErrorMessage(
  error: unknown,
  fallback = "Wachtwoord wijzigen mislukt.",
) {
  const text = getErrorText(error);
  const match = passwordErrorMessages.find(({ pattern }) => pattern.test(text));
  return match?.message ?? fallback;
}
