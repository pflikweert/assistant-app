import createIconSet from "@expo/vector-icons/createIconSet";
import type MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React from "react";

const MATERIAL_GLYPH_MAP = require("@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialIcons.json");

export const MATERIAL_ICON_FONT_MAP = {
  GoogleMaterialIconsFilled: require("../../assets/fonts/material-icons/MaterialIcons-Regular.ttf"),
  GoogleMaterialIconsOutlined: require("../../assets/fonts/material-icons/MaterialIconsOutlined-Regular.otf"),
  GoogleMaterialIconsRound: require("../../assets/fonts/material-icons/MaterialIconsRound-Regular.otf"),
  GoogleMaterialIconsSharp: require("../../assets/fonts/material-icons/MaterialIconsSharp-Regular.otf"),
  GoogleMaterialIconsTwoTone: require("../../assets/fonts/material-icons/MaterialIconsTwoTone-Regular.otf"),
} as const;

const FilledMaterialIcon = createIconSet(
  MATERIAL_GLYPH_MAP,
  "GoogleMaterialIconsFilled",
  MATERIAL_ICON_FONT_MAP.GoogleMaterialIconsFilled,
);
const OutlinedMaterialIcon = createIconSet(
  MATERIAL_GLYPH_MAP,
  "GoogleMaterialIconsOutlined",
  MATERIAL_ICON_FONT_MAP.GoogleMaterialIconsOutlined,
);
const RoundMaterialIcon = createIconSet(
  MATERIAL_GLYPH_MAP,
  "GoogleMaterialIconsRound",
  MATERIAL_ICON_FONT_MAP.GoogleMaterialIconsRound,
);
const SharpMaterialIcon = createIconSet(
  MATERIAL_GLYPH_MAP,
  "GoogleMaterialIconsSharp",
  MATERIAL_ICON_FONT_MAP.GoogleMaterialIconsSharp,
);
const TwoToneMaterialIcon = createIconSet(
  MATERIAL_GLYPH_MAP,
  "GoogleMaterialIconsTwoTone",
  MATERIAL_ICON_FONT_MAP.GoogleMaterialIconsTwoTone,
);

const ICON_VARIANTS = {
  filled: FilledMaterialIcon,
  outlined: OutlinedMaterialIcon,
  round: RoundMaterialIcon,
  sharp: SharpMaterialIcon,
  twoTone: TwoToneMaterialIcon,
} as const;

export type AppIconName = React.ComponentProps<typeof MaterialIcons>["name"];
export type AppIconVariant = keyof typeof ICON_VARIANTS;
export type AppIconProps = Omit<
  React.ComponentProps<typeof RoundMaterialIcon>,
  "name"
> & {
  name: AppIconName;
  variant?: AppIconVariant;
};

export const AppIcon = React.forwardRef<
  React.ElementRef<typeof RoundMaterialIcon>,
  AppIconProps
>(function AppIcon(
  { variant = "round", ...props },
  ref,
) {
  const Component = ICON_VARIANTS[variant] || RoundMaterialIcon;
  return <Component ref={ref} {...props} />;
});

