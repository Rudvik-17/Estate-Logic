import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
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
  const { user, clearRole } = useAuth();

  const [loading, setLoading] = useState(true);
  const [ownerName, setOwnerName] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    async function loadOwnerName() {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        setOwnerName(data?.full_name || 'Property Owner');
      } catch (err) {
        console.error('Error loading owner name:', err.message);
        setOwnerName('Property Owner');
      } finally {
        setLoading(false);
      }
    }
    loadOwnerName();
  }, [user?.id]);

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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const menuItems = [
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
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <Text style={styles.ownerName}>{ownerName}</Text>
          <Text style={styles.ownerEmail}>{user?.email || 'owner@estatelogic.com'}</Text>
          <View style={styles.divider} />
        </View>

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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    gap: 4,
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
  },
  bottomSection: {
    marginTop: 24,
    gap: 8,
  },
});
