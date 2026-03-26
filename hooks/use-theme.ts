import { FinColors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useMemo } from "react";

type ThemeMode = "light" | "dark";

type AppTheme = {
  mode: ThemeMode;
  colors: {
    canvas: string;
    surface: string;
    overlay: string;
    text: string;
    textMuted: string;
    borderSubtle: string;
    brandPrimary: string;
    brandAccent: string;
    brandHighlight: string;
    success: string;
    warning: string;
    error: string;
  };
  radii: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  space: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    "2xl": number;
  };
  motion: {
    duration: {
      fast: number;
      medium: number;
      slow: number;
      ambient: number;
    };
    easing: {
      standard: [number, number, number, number];
      emphasized: [number, number, number, number];
    };
  };
};

const LIGHT_THEME: Omit<AppTheme, "mode"> = {
  colors: {
    canvas: FinColors.bgBase,
    surface: FinColors.bgCard,
    overlay: "rgba(17,17,17,0.12)",
    text: FinColors.textPrimary,
    textMuted: FinColors.textMuted,
    borderSubtle: FinColors.borderSubtle,
    brandPrimary: FinColors.green,
    brandAccent: FinColors.yellow,
    brandHighlight: "#fff5cc",
    success: FinColors.green,
    warning: FinColors.warningText,
    error: FinColors.red,
  },
  radii: {
    sm: 8,
    md: 12,
    lg: 18,
    xl: 26,
  },
  space: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    "2xl": 32,
  },
  motion: {
    duration: {
      fast: 180,
      medium: 320,
      slow: 1200,
      ambient: 2600,
    },
    easing: {
      // Calm default easing for premium, steady motion.
      standard: [0.22, 0.0, 0.36, 1.0],
      emphasized: [0.2, 0.0, 0.0, 1.0],
    },
  },
};

const DARK_THEME: Omit<AppTheme, "mode"> = {
  ...LIGHT_THEME,
  colors: {
    canvas: "#111111",
    surface: "#1a1a1a",
    overlay: "rgba(0,0,0,0.44)",
    text: "#f4f1ea",
    textMuted: "#bbb4ab",
    borderSubtle: "rgba(255,255,255,0.12)",
    brandPrimary: "#8fd6ad",
    brandAccent: FinColors.yellow,
    brandHighlight: "#574514",
    success: "#8fd6ad",
    warning: FinColors.yellow,
    error: "#f49c8f",
  },
};

export function useTheme(): AppTheme {
  const mode: ThemeMode = useColorScheme() === "dark" ? "dark" : "light";

  return useMemo(
    () => ({
      mode,
      ...(mode === "dark" ? DARK_THEME : LIGHT_THEME),
    }),
    [mode],
  );
}
