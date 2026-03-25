type EmailFeedback = {
  emailValid: boolean;
  emailHint: string | null;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getEmailFeedback(email: string): EmailFeedback {
  const value = email.trim();
  if (!value) {
    return {
      emailValid: false,
      emailHint: "Vul je e-mailadres in.",
    };
  }

  if (!emailPattern.test(value)) {
    return {
      emailValid: false,
      emailHint: "Voer een geldig e-mailadres in.",
    };
  }

  return {
    emailValid: true,
    emailHint: null,
  };
}
