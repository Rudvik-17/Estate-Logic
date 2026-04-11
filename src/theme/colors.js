// Design token: "The Precision Atelier" color system
// Source: Stitch project 2301448904722460800
// Rule: no 1px borders — use background color shifts for separation
// Rule: tertiaryFixedDim (accent green) for financial/positive signals ONLY

export const colors = Object.freeze({
  // Primary brand
  primary: '#002045',           // Midnight Anchor — nav, dark backgrounds
  primaryContainer: '#1a365d',  // Hero header sections
  primaryFixed: '#d6e3ff',
  primaryFixedDim: '#adc7f7',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#86a0cd',

  // Secondary
  secondary: '#505f76',
  secondaryContainer: '#d0e1fb',
  onSecondary: '#ffffff',
  onSecondaryContainer: '#54647a',

  // Tertiary (financial / positive only)
  tertiary: '#002618',
  tertiaryContainer: '#003e29',
  tertiaryFixedDim: '#68dba9',  // accent green
  onTertiary: '#ffffff',
  onTertiaryContainer: '#39b282',

  // Surface stack (tonal layering — no borders)
  surface: '#f7f9fb',                   // Screen background
  surfaceBright: '#f7f9fb',
  surfaceContainerLow: '#f2f4f6',       // Section backgrounds
  surfaceContainer: '#eceef0',
  surfaceContainerHigh: '#e6e8ea',
  surfaceContainerHighest: '#e0e3e5',   // Input fills (no visible border)
  surfaceContainerLowest: '#ffffff',    // Card fills
  surfaceDim: '#d8dadc',
  surfaceTint: '#455f88',

  // On-surface text
  onSurface: '#191c1e',         // Never pure black
  onSurfaceVariant: '#43474e',
  inverseSurface: '#2d3133',
  inverseOnSurface: '#eff1f3',
  inversePrimary: '#adc7f7',

  // Semantic
  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  onError: '#ffffff',
  onErrorContainer: '#93000a',

  // Outline
  outline: '#74777f',
  outlineVariant: '#c4c6cf',

  // Background
  background: '#f7f9fb',
  onBackground: '#191c1e',
});
