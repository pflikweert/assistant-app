function getErrorText(error: unknown) {
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object") return "";

  const record = error as Record<string, unknown>;
  return [record.message, record.error_description, record.code, record.name]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .trim();
}

const authMessageRules: {
  pattern: RegExp;
  message: string;
}[] = [
  {
    pattern: /invalid login credentials/i,
    message: "Onjuiste inloggegevens.",
  },
];

const authRegistrationMessageRules: {
  pattern: RegExp;
  message: string;
}[] = [
  {
    pattern: /email already registered/i,
    message: "Dit e-mailadres is al in gebruik.",
  },
  {
    pattern: /user already registered/i,
    message: "Dit e-mailadres is al in gebruik.",
  },
  {
    pattern: /invalid email/i,
    message: "Voer een geldig e-mailadres in.",
  },
];

export function getAuthSignInErrorMessage(
  error: unknown,
  fallback = "Inloggen mislukt.",
) {
  const text = getErrorText(error);
  const match = authMessageRules.find(({ pattern }) => pattern.test(text));
  return match?.message ?? fallback;
}

export function getAuthRegistrationErrorMessage(
  error: unknown,
  fallback = "Registratie mislukt.",
) {
  const text = getErrorText(error);
  const match = authRegistrationMessageRules.find(({ pattern }) =>
    pattern.test(text),
  );
  return match?.message ?? fallback;
}
