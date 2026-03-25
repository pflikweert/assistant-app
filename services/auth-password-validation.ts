type PasswordValidationOptions = {
  minLength?: number;
  requireLetter?: boolean;
  requireDigit?: boolean;
};

type PasswordFeedback = {
  passwordValid: boolean;
  confirmValid: boolean;
  passwordsMatch: boolean;
  passwordHint: string | null;
  confirmHint: string | null;
  requirementsText: string;
};

function getMinLength(options: PasswordValidationOptions) {
  return options.minLength ?? 8;
}

function getRequirementParts(options: PasswordValidationOptions) {
  const minLength = getMinLength(options);
  const parts = [`minimaal ${minLength} tekens`];
  if (options.requireLetter ?? true) parts.push("1 letter");
  if (options.requireDigit ?? true) parts.push("1 cijfer");
  return parts;
}

export function getPasswordRequirementsText(
  options: PasswordValidationOptions = {},
) {
  const parts = getRequirementParts(options);
  if (parts.length === 1) {
    return `Gebruik ${parts[0]}.`;
  }

  if (parts.length === 2) {
    return `Gebruik ${parts[0]} en minstens ${parts[1]}.`;
  }

  return `Gebruik ${parts[0]} en minstens ${parts.slice(1).join(" en ")}.`;
}

export function getPasswordFeedback(
  password: string,
  confirm: string,
  options: PasswordValidationOptions = {},
): PasswordFeedback {
  const minLength = getMinLength(options);
  const requireLetter = options.requireLetter ?? true;
  const requireDigit = options.requireDigit ?? true;

  const trimmedPassword = password.trim();
  const trimmedConfirm = confirm.trim();
  const hasLetter = /[A-Za-z]/.test(password);
  const hasDigit = /\d/.test(password);

  const passwordValid =
    trimmedPassword.length >= minLength &&
    (!requireLetter || hasLetter) &&
    (!requireDigit || hasDigit);
  const confirmValid = trimmedConfirm.length >= minLength;
  const passwordsMatch = password === confirm;

  let passwordHint: string | null = null;
  if (!trimmedPassword.length) {
    passwordHint = getPasswordRequirementsText(options);
  } else if (trimmedPassword.length < minLength) {
    const remaining = minLength - trimmedPassword.length;
    passwordHint = `Nog ${remaining} teken${remaining === 1 ? "" : "s"} nodig.`;
  } else if (requireLetter && !hasLetter) {
    passwordHint = "Voeg minstens 1 letter toe.";
  } else if (requireDigit && !hasDigit) {
    passwordHint = "Voeg minstens 1 cijfer toe.";
  }

  const confirmHint =
    trimmedConfirm.length > 0 && !passwordsMatch
      ? "Wachtwoorden komen nog niet overeen."
      : null;

  return {
    passwordValid,
    confirmValid,
    passwordsMatch,
    passwordHint,
    confirmHint,
    requirementsText: getPasswordRequirementsText(options),
  };
}
