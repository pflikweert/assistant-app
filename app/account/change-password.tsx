import { Redirect } from "expo-router";
import React from "react";

export default function LegacyChangePasswordRedirect() {
  return <Redirect href="/settings/security/password" />;
}
