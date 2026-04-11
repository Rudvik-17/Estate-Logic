import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

export default function ScreenHeader({ title, showBack, onBack, showBell, onBell }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.left}>
        {showBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <MaterialIcons name="arrow-back" size={22} color={colors.onPrimary} />
          </TouchableOpacity>
        ) : (
          <Text style={styles.logo}>ESTATE LOGIC</Text>
        )}
      </View>
      {title ? <Text style={styles.title}>{title}</Text> : <View style={styles.spacer} />}
      <View style={styles.right}>
        {showBell ? (
          <TouchableOpacity onPress={onBell} style={styles.bellBtn} activeOpacity={0.7}>
            <MaterialIcons name="notifications-none" size={22} color={colors.onPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>
    </View>
  );
}

ScreenHeader.propTypes = {
  title: PropTypes.string,
  showBack: PropTypes.bool,
  onBack: PropTypes.func,
  showBell: PropTypes.bool,
  onBell: PropTypes.func,
};

ScreenHeader.defaultProps = {
  title: null,
  showBack: false,
  onBack: null,
  showBell: false,
  onBell: null,
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  left: {
    flex: 1,
    alignItems: 'flex-start',
  },
  right: {
    flex: 1,
    alignItems: 'flex-end',
  },
  logo: {
    fontFamily: fonts.manropeBold,
    fontSize: 14,
    letterSpacing: 2,
    color: colors.onPrimary,
  },
  title: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 17,
    color: colors.onPrimary,
    flex: 2,
    textAlign: 'center',
  },
  spacer: {
    flex: 2,
  },
  backBtn: {
    padding: 4,
  },
  bellBtn: {
    padding: 4,
  },
});
