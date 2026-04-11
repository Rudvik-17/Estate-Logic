import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import ScreenHeader from '../../components/ScreenHeader';

const APP_VERSION = '1.0.0';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, role, clearRole } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const email = user?.email ?? '';
  // Derive initials from the email local-part (e.g. "arjun.sharma@..." → "AS")
  const initials = email
    .split('@')[0]
    .split(/[._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0].toUpperCase())
    .join('') || '?';

  const roleLabel = role === 'owner' ? 'Owner' : 'Tenant';
  const roleVariantColor = role === 'owner' ? colors.primary : colors.secondary;

  const handleSwitchRole = () => {
    Alert.alert(
      'Switch Role',
      'This will take you back to the role selection screen. Your current data is not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: () => {
            // Clearing role in AuthContext causes RootNavigator to render
            // RoleSelectionScreen without touching the database.
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
            // onAuthStateChange fires → AuthContext clears user + role
            // → RootNavigator shows LoginScreen automatically
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Profile" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + identity */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
          <Text style={styles.emailText}>{email}</Text>
          <View style={[styles.roleBadge, { backgroundColor: roleVariantColor + '18' }]}>
            <Text style={[styles.roleText, { color: roleVariantColor }]}>{roleLabel}</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsSection}>
          <TouchableOpacity style={styles.actionRow} onPress={handleSwitchRole}>
            <View style={[styles.actionIconBg, { backgroundColor: colors.surfaceContainerLow }]}>
              <Text style={styles.actionIcon}>⇄</Text>
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionLabel}>Switch Role</Text>
              <Text style={styles.actionSub}>Change between Owner and Tenant</Text>
            </View>
            <Text style={styles.actionChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Sign out */}
        <View style={styles.signOutSection}>
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={handleSignOut}
            disabled={signingOut}
          >
            <Text style={styles.signOutText}>
              {signingOut ? 'Signing out…' : 'Sign Out'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Version */}
        <Text style={styles.versionText}>Estate Logic v{APP_VERSION}</Text>
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
    paddingTop: 8,
  },

  avatarSection: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarInitials: {
    fontFamily: fonts.manropeBold,
    fontSize: 32,
    color: colors.onPrimary,
  },
  emailText: {
    fontFamily: fonts.interMedium,
    fontSize: 16,
    color: colors.onSurface,
    marginBottom: 10,
  },
  roleBadge: {
    borderRadius: 9999,
    paddingVertical: 4,
    paddingHorizontal: 14,
  },
  roleText: {
    fontFamily: fonts.interSemiBold,
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  actionsSection: {
    marginHorizontal: 16,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  actionIconBg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 18,
    color: colors.onSurface,
  },
  actionInfo: {
    flex: 1,
  },
  actionLabel: {
    fontFamily: fonts.interSemiBold,
    fontSize: 15,
    color: colors.onSurface,
    marginBottom: 2,
  },
  actionSub: {
    fontFamily: fonts.interRegular,
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  actionChevron: {
    fontSize: 22,
    color: colors.outline,
    lineHeight: 26,
  },

  signOutSection: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  signOutBtn: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  signOutText: {
    fontFamily: fonts.interSemiBold,
    fontSize: 15,
    color: colors.error,
  },

  versionText: {
    fontFamily: fonts.interRegular,
    fontSize: 12,
    color: colors.outline,
    textAlign: 'center',
  },
});
