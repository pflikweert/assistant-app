import type { Href } from "expo-router";
import { Redirect } from "expo-router";

export default function LegacyLoginRoute() {
  return <Redirect href={"/auth/login" as Href} />;
}
