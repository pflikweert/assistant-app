import { AppIcon } from '@/components/ui/app-icon';
import {
  ICON_SYMBOL_MAPPING,
  type IconSymbolName,
} from '@/components/ui/icon-symbol-map';
import { SymbolWeight } from 'expo-symbols';
import { StyleProp, TextStyle } from 'react-native';

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight = 'regular',
}: {
  name: IconSymbolName;
  size?: number;
  color: string;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return (
    <AppIcon
      name={ICON_SYMBOL_MAPPING[name]}
      size={size}
      color={color}
      variant="outlined"
      style={style}
    />
  );
}
