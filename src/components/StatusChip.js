import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

const VARIANT_STYLES = {
  active: {
    bg: 'rgba(104, 219, 169, 0.12)',
    text: colors.onTertiaryContainer, // '#39b282'
  },
  pending: {
    bg: colors.secondaryContainer,
    text: colors.onSecondaryContainer,
  },
  urgent: {
    bg: colors.errorContainer,
    text: colors.error,
  },
};

export default function StatusChip({ label, variant }) {
  const style = VARIANT_STYLES[variant] || VARIANT_STYLES.pending;
  return (
    <View style={[styles.chip, { backgroundColor: style.bg }]}>
      <Text style={[styles.label, { color: style.text }]}>{label}</Text>
    </View>
  );
}

StatusChip.propTypes = {
  label: PropTypes.string.isRequired,
  variant: PropTypes.oneOf(['active', 'pending', 'urgent']),
};

StatusChip.defaultProps = {
  variant: 'pending',
};

const styles = StyleSheet.create({
  chip: {
    borderRadius: 9999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: fonts.interSemiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
