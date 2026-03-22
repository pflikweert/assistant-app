import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { FinColors } from "@/constants/theme";

export default function ModalScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Voorbeeldmodal</Text>
        <Text style={styles.title}>This is a modal</Text>
        <Text style={styles.subtitle}>
          Deze pagina gebruikt nu dezelfde rustige visuele taal als de rest van
          de app.
        </Text>
        <Link href="/" dismissTo style={styles.link}>
          <Text style={styles.linkText}>Terug naar home</Text>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: FinColors.bgBase,
  },
  card: {
    borderRadius: 28,
    backgroundColor: FinColors.bgCard,
    padding: 24,
    gap: 14,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  eyebrow: {
    color: "#8A7300",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  title: {
    color: FinColors.textPrimary,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "800",
  },
  subtitle: {
    color: FinColors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  link: {
    alignSelf: "flex-start",
    marginTop: 4,
    borderRadius: 999,
    backgroundColor: FinColors.yellow,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  linkText: {
    color: FinColors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
});
