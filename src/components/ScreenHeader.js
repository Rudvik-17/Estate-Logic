import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import PropTypes from 'prop-types';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { fonts } from '../theme/typography';

export default function ScreenHeader({ title, showBack, onBack, showBell, onBell, hideLogo, showProfile, onProfile }) {
  const { colors } = useTheme();
  const { profile, role } = useAuth();
  const styles = getStyles(colors);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const handleProfilePress = () => {
    if (onProfile) {
      onProfile();
    } else {
      navigation.navigate('EditProfile');
    }
  };

  const getInitials = () => {
    if (profile?.full_name) {
      return profile.full_name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(n => n[0].toUpperCase())
        .join('');
    }
    return 'P';
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.left}>
        {showBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <MaterialIcons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        ) : hideLogo ? (
          <View style={{ width: 40 }} />
        ) : (
          <Text style={styles.logo}>TENURA</Text>
        )}
      </View>
      {title ? <Text style={styles.title}>{title}</Text> : <View style={styles.spacer} />}
      <View style={styles.right}>
        {showProfile && role === 'owner' ? (
          <TouchableOpacity onPress={handleProfilePress} style={styles.profileBtn} activeOpacity={0.8}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{getInitials()}</Text>
              </View>
            )}
          </TouchableOpacity>
        ) : showBell ? (
          <TouchableOpacity onPress={onBell} style={styles.bellBtn} activeOpacity={0.7}>
            <MaterialIcons name="notifications-none" size={22} color="#FFFFFF" />
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
  hideLogo: PropTypes.bool,
  showProfile: PropTypes.bool,
  onProfile: PropTypes.func,
};

ScreenHeader.defaultProps = {
  title: null,
  showBack: false,
  onBack: null,
  showBell: false,
  onBell: null,
  hideLogo: false,
  showProfile: false,
  onProfile: null,
};

const getStyles = (colors) => StyleSheet.create({
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
    color: '#FFFFFF',
  },
  title: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 17,
    color: '#FFFFFF',
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
  profileBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primaryContainer,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    // Glowing border shadow
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.manropeBold,
    fontSize: 12,
    color: colors.onPrimaryContainer,
  },
});
