import { useColorScheme } from 'react-native';
import colors from '@/constants/colors';

type Theme = typeof colors.light;

/**
 * Returns the design tokens for the current color scheme.
 * Falls back to light when no dark key is defined.
 */
export function useColors(): Theme & { radius: number } {
  const scheme = useColorScheme();
  const palette: Theme =
    scheme === 'dark' && 'dark' in colors
      ? (colors.dark as unknown as Theme)
      : colors.light;
  return { ...palette, radius: colors.radius };
}
