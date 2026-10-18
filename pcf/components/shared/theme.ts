// Fusion Sky theme for both components. Fluent UI v9 reads colours, borders and fonts
// from CSS variables set by a FluentProvider. The PCF test harness has no provider, so
// each component brings its own, built from the brand primary (Deep lagoon #0B5F7E).
import { BrandVariants, Theme, createLightTheme } from "@fluentui/react-components";

const PRIMARY = [0x0b, 0x5f, 0x7e];
const hex = (rgb: number[]): string => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
const mix = (a: number[], b: number[], t: number): number[] => a.map((c, i) => c + (b[i] - c) * t);

// 16 shades from near-black to near-white, with the brand primary at shade 80.
function ramp(): BrandVariants {
  const dark = [0x02, 0x10, 0x16];
  const light = [0xed, 0xf7, 0xfb];
  const shades = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160] as const;
  const out: Record<number, string> = {};
  for (const s of shades) {
    out[s] = s <= 80 ? hex(mix(dark, PRIMARY, (s - 10) / 70)) : hex(mix(PRIMARY, light, (s - 80) / 80));
  }
  return out as unknown as BrandVariants;
}

export const fusionTheme: Theme = {
  ...createLightTheme(ramp()),
  fontFamilyBase: "'Segoe UI', 'Segoe UI Web (West European)', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', sans-serif",
};
