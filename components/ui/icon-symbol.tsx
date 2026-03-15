import { AppIcon } from "@/components/ui/app-icon";
import {
  ICON_SYMBOL_MAPPING,
  type IconSymbolName,
} from "@/components/ui/icon-symbol-map";
import { SymbolWeight } from "expo-symbols";
import {
    OpaqueColorValue,
    StyleSheet,
    type StyleProp,
    type TextStyle,
} from "react-native";
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return (
    <AppIcon
      color={color}
      size={size}
      name={ICON_SYMBOL_MAPPING[name]}
      variant="outlined"
      style={StyleSheet.flatten(style)}
    />
  );
}
