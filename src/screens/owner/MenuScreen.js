import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import ScreenHeader from '../../components/ScreenHeader';
import { RateLimitedButton } from '../../components/RateLimitedButton';

export default function MenuScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, profile, clearRole } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleSettings = () => {
    Alert.alert(
      'App Settings',
      'Settings panel is mock in this version.',
      [{ text: 'OK' }]
    );
  };

  const handleSwitchRole = () => {
    Alert.alert(
      'Switch Role',
      'This will take you back to the role selection screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: () => {
            clearRole();
          },
        },
      ]
    );
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true);
            const { error } = await supabase.auth.signOut();
            setSigningOut(false);
            if (error) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
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
    return user?.email?.substring(0, 2).toUpperCase() || '?';
  };

  const menuItems = [
    {
      id: 'edit_profile',
      label: 'Edit Profile',
      icon: 'person',
      action: () => navigation.navigate('EditProfile'),
    },
    {
      id: 'settings',
      label: 'App Settings',
      icon: 'settings',
      action: handleSettings,
    },
    {
      id: 'community',
      label: 'Community',
      icon: 'business',
      action: () => navigation.navigate('Community'),
    },
    {
      id: 'portfolio',
      label: 'Apartments Owned',
      icon: 'domain',
      action: () => navigation.navigate('Portfolio'),
    },
    {
      id: 'leases',
      label: 'Lease Documents',
      icon: 'history-edu',
      action: () => navigation.navigate('LeaseDocuments'),
    },
  ];

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Menu"
        showBack={false}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { flexGrow: 1, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header - Interactive */}
        <TouchableOpacity
          style={styles.profileHeader}
          onPress={() => navigation.navigate('EditProfile')}
          activeOpacity={0.8}
        >
          <View style={styles.profileCardContent}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>{getInitials()}</Text>
              </View>
            )}
            <View style={styles.profileInfoText}>
              <Text style={styles.ownerName}>{profile?.full_name || 'Property Owner'}</Text>
              <Text style={styles.ownerEmail}>{user?.email || 'owner@estatelogic.com'}</Text>
              {profile?.phone ? (
                <Text style={styles.ownerPhone}>{profile.phone}</Text>
              ) : null}
            </View>
            <MaterialIcons name="chevron-right" size={24} color={colors.outline} />
          </View>
          <View style={styles.divider} />
        </TouchableOpacity>

        {/* Menu Items List */}
        <View style={styles.menuList}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuRow}
              onPress={item.action}
              activeOpacity={0.7}
            >
              <MaterialIcons name={item.icon} size={22} color={colors.outline} />
              <Text style={styles.menuLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Spacer to push options to bottom */}
        <View style={styles.spacer} />

        {/* Switch Role and Logout */}
        <View style={styles.bottomSection}>
          <RateLimitedButton
            style={styles.menuRow}
            onPress={handleSwitchRole}
            activeOpacity={0.7}
          >
            <MaterialIcons name="swap-horiz" size={22} color={colors.primary} />
            <Text style={[styles.menuLabel, { color: colors.primary }]}>Switch Role</Text>
          </RateLimitedButton>

          <RateLimitedButton
            style={styles.menuRow}
            onPress={handleSignOut}
            disabled={signingOut}
            activeOpacity={0.7}
          >
            <MaterialIcons name="logout" size={22} color={colors.error} />
            <Text style={[styles.menuLabel, { color: colors.error }]}>
              {signingOut ? 'Logging out…' : 'Sign Out'}
            </Text>
          </RateLimitedButton>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  profileHeader: {
    paddingVertical: 12,
  },
  profileCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  avatarPlaceholderText: {
    fontFamily: fonts.manropeBold,
    fontSize: 20,
    color: colors.onPrimaryContainer,
  },
  profileInfoText: {
    flex: 1,
    gap: 2,
  },
  ownerName: {
    fontFamily: fonts.manropeBold,
    fontSize: 20,
    color: colors.onSurface,
  },
  ownerEmail: {
    fontFamily: fonts.interRegular,
    fontSize: 14,
    color: colors.onSurfaceVariant,
  },
  ownerPhone: {
    fontFamily: fonts.interRegular,
    fontSize: 12,
    color: colors.outline,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.outlineVariant,
    marginTop: 16,
  },
  menuList: {
    paddingVertical: 8,
    gap: 16,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 16,
  },
  menuLabel: {
    fontFamily: fonts.interMedium,
    fontSize: 16,
    color: colors.onSurfaceVariant,
  },
  spacer: {
    flex: 1,
    minHeight: 40,
  },
  bottomSection: {
    marginTop: 24,
    gap: 8,
  },
});
