import { FinColors } from "@/constants/theme";
import { useSession } from "@/app/_layout";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type FinanceAvatarBadgeProps = {
  label?: string;
  size?: number;
};

function deriveInitials(value: string | null | undefined) {
  const normalized = String(value || "")
    .trim()
    .replace(/\s+/g, " ");

  if (!normalized) return "?";

  const parts = normalized
    .split(" ")
    .filter(Boolean)
    .flatMap((part) => part.split("-").filter(Boolean));

  if (parts.length === 0) return "?";

  const first = parts[0]?.[0] || "";
  const second = parts[1]?.[0] || parts[0]?.[1] || "";
  const initials = `${first}${second}`.toUpperCase();

  return initials || normalized.slice(0, 2).toUpperCase() || "?";
}

export function FinanceAvatarBadge({
  label,
  size = 40,
}: FinanceAvatarBadgeProps) {
  const { user } = useSession();
  const metadata = user?.user_metadata as
    | { name?: string; full_name?: string }
    | null
    | undefined;
  const metadataName = metadata?.name ?? null;
  const metadataFullName = metadata?.full_name ?? null;
  const resolvedLabel = React.useMemo(() => {
    if (label && label.trim()) return label.trim().toUpperCase();

    const displayName = metadataName || metadataFullName || user?.email || null;

    return deriveInitials(displayName);
  }, [label, user?.email, metadataName, metadataFullName]);

  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={styles.avatarText}>{resolvedLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "800",
    color: FinColors.warningText,
  },
});
