import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { fonts } from '../../theme/typography';
import ScreenHeader from '../../components/ScreenHeader';
import { RateLimitedButton } from '../../components/RateLimitedButton';

export default function MenuScreen({ navigation }) {
  const { colors, theme, toggleTheme } = useTheme();
  const styles = getStyles(colors);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [tenantProfile, setTenantProfile] = useState(null);
  const [ownerInfo, setOwnerInfo] = useState(null);
  const [lease, setLease] = useState(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      try {
        const { data: tenantRows, error: tErr } = await supabase
          .from('tenants')
          .select('*, properties(name, address, city)')
          .eq('user_id', user.id)
          .limit(1);

        if (tErr) throw tErr;

        const tenantData = tenantRows?.[0] ?? null;
        setTenantProfile(tenantData);

        if (tenantData) {
          // Fetch lease
          const { data: leaseRows } = await supabase
            .from('leases')
            .select('*')
            .eq('tenant_id', tenantData.id)
            .eq('status', 'active')
            .limit(1);
          setLease(leaseRows?.[0] ?? null);

          // Fetch owner details
          if (tenantData.owner_id) {
            const { data: ownerRows } = await supabase
              .from('users')
              .select('full_name, email, phone')
              .eq('id', tenantData.owner_id)
              .limit(1);
            setOwnerInfo(ownerRows?.[0] ?? null);
          }
        }
      } catch (err) {
        console.error('Error loading menu details:', err.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user?.id]);

  const handleMyApartment = () => {
    if (!tenantProfile) {
      Alert.alert('My Apartment', 'No apartment details available.');
      return;
    }
    Alert.alert(
      'My Apartment',
      `Property: ${tenantProfile.properties?.name || 'N/A'}\nUnit: ${tenantProfile.unit_number || 'N/A'}\nAddress: ${tenantProfile.properties?.address || 'N/A'}`
    );
  };

  const handleContactProperty = () => {
    if (!ownerInfo) {
      Alert.alert('Contact Property', 'Property contact information is not available.');
      return;
    }
    Alert.alert(
      `Contact ${ownerInfo.full_name || 'Property'}`,
      `Phone: ${ownerInfo.phone || 'Not provided'}\nEmail: ${ownerInfo.email || 'Not provided'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        ownerInfo.phone ? { text: 'Call', onPress: () => Linking.openURL(`tel:${ownerInfo.phone}`) } : null,
        ownerInfo.email ? { text: 'Email', onPress: () => Linking.openURL(`mailto:${ownerInfo.email}`) } : null,
      ].filter(Boolean)
    );
  };

  const handleLeaseOptions = () => {
    if (lease) {
      navigation.navigate('Dashboard', {
        screen: 'RentalAgreement',
        params: { leaseId: lease.id }
      });
    } else {
      Alert.alert('Lease Options', 'No active lease agreement found.');
    }
  };

  const handleFeedback = () => {
    Alert.alert(
      'App Feedback',
      'How has your experience been with the app?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Excellent', onPress: () => Alert.alert('Thank You', 'Thank you for your positive rating!') },
        { text: 'Leave Review', onPress: () => Alert.alert('Thank You', 'Your feedback has been successfully logged.') }
      ]
    );
  };

  const handleSettings = () => {
    Alert.alert(
      'Settings',
      'Settings panel is mock in this version.',
      [{ text: 'OK' }]
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
      id: 'community',
      label: 'Community',
      icon: 'apartment',
      action: () => navigation.navigate('Community'),
    },
    {
      id: 'payments',
      label: 'Payments',
      icon: 'credit-card',
      action: () => navigation.navigate('Payments'),
    },
    {
      id: 'apartment',
      label: 'My Apartment',
      icon: 'door-front',
      action: handleMyApartment,
    },
    {
      id: 'contact',
      label: 'Contact Property',
      icon: 'smartphone',
      action: handleContactProperty,
    },
    {
      id: 'lease',
      label: 'Lease Options',
      icon: 'history-edu',
      action: handleLeaseOptions,
    },
    {
      id: 'feedback',
      label: 'Provide App Feedback',
      icon: 'thumb-up-off-alt',
      action: handleFeedback,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: 'settings',
      action: handleSettings,
    },
    {
      id: 'theme',
      label: `Theme: ${theme === 'dark' ? 'Dark' : 'Light'}`,
      icon: theme === 'dark' ? 'dark-mode' : 'light-mode',
      action: toggleTheme,
    },
  ];

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Menu"
        showBack
        onBack={() => navigation.navigate('Dashboard')}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { flexGrow: 1, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile / Unit Header */}
        <View style={styles.profileHeader}>
          <Text style={styles.propertyName}>
            {tenantProfile?.properties?.name || 'My Community'}
          </Text>
          <Text style={styles.unitDetails}>
            {tenantProfile?.unit_number ? `Unit ${tenantProfile.unit_number}` : 'No Unit Linked'}
          </Text>
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

        {/* Spacer to push logout to the bottom */}
        <View style={styles.spacer} />

        {/* Logout button at the very bottom */}
        <View style={styles.logoutSection}>
          <RateLimitedButton
            style={styles.menuRow}
            onPress={handleSignOut}
            disabled={signingOut}
            activeOpacity={0.7}
          >
            <MaterialIcons name="logout" size={22} color={colors.error} />
            <Text style={[styles.menuLabel, { color: colors.error }]}>
              {signingOut ? 'Logging out…' : 'Logout'}
            </Text>
          </RateLimitedButton>
        </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
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
  propertyName: {
    fontFamily: fonts.manropeBold,
    fontSize: 18,
    color: colors.onSurface,
  },
  unitDetails: {
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
  logoutSection: {
    marginTop: 24,
  },
});
