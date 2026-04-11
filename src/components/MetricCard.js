import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

export default function MetricCard({ icon, value, label, trend, trendUp }) {
  return (
    <View style={styles.card}>
      <MaterialIcons name={icon} size={20} color={colors.secondary} style={styles.icon} />
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {trend ? (
        <View style={styles.trendRow}>
          <MaterialIcons
            name={trendUp ? 'trending-up' : 'trending-down'}
            size={12}
            color={trendUp ? colors.onTertiaryContainer : colors.error}
          />
          <Text style={[styles.trend, { color: trendUp ? colors.onTertiaryContainer : colors.error }]}>
            {trend}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

MetricCard.propTypes = {
  icon: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  trend: PropTypes.string,
  trendUp: PropTypes.bool,
};

MetricCard.defaultProps = {
  trend: null,
  trendUp: true,
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: 16,
    flex: 1,
  },
  icon: {
    marginBottom: 8,
  },
  value: {
    fontFamily: fonts.manropeBold,
    fontSize: 20,
    color: colors.onSurface,
    marginBottom: 4,
  },
  label: {
    fontFamily: fonts.interRegular,
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 3,
  },
  trend: {
    fontFamily: fonts.interMedium,
    fontSize: 11,
  },
});
