// Typography tokens
// Headlines: Manrope — geometric, wide stance, conveys stability
// Body/Labels: Inter — hyper-legible for financial detail
// Fallback: if expo-font hasn't loaded within 3s, fontFamily is omitted → system default

export const fonts = {
  manropeRegular: 'Manrope_400Regular',
  manropeMedium: 'Manrope_500Medium',
  manropeSemiBold: 'Manrope_600SemiBold',
  manropeBold: 'Manrope_700Bold',
  interRegular: 'Inter_400Regular',
  interMedium: 'Inter_500Medium',
  interSemiBold: 'Inter_600SemiBold',
};

// Typography scale
// display-lg: high-impact portfolio summaries
// headline-sm: property titles
// label-sm: metadata (all-caps, tracked)
export const textStyles = {
  displayLg: {
    fontFamily: fonts.manropeBold,
    fontSize: 56,
    lineHeight: 64,
    letterSpacing: -0.5,
  },
  headlineLg: {
    fontFamily: fonts.manropeBold,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.25,
  },
  headlineMd: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 28,
    lineHeight: 36,
  },
  headlineSm: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 24,
    lineHeight: 32,
  },
  titleLg: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 20,
    lineHeight: 28,
  },
  titleMd: {
    fontFamily: fonts.manropeMedium,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.1,
  },
  titleSm: {
    fontFamily: fonts.manropeMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  bodyLg: {
    fontFamily: fonts.interRegular,
    fontSize: 16,
    lineHeight: 24,
  },
  bodyMd: {
    fontFamily: fonts.interRegular,
    fontSize: 14,
    lineHeight: 20,
  },
  bodySm: {
    fontFamily: fonts.interRegular,
    fontSize: 12,
    lineHeight: 16,
  },
  labelLg: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  labelMd: {
    fontFamily: fonts.interMedium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.5,
  },
  labelSm: {
    fontFamily: fonts.interSemiBold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: 'uppercase', // "blueprint" metadata feel
  },
};
