import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import PrimaryButton from '../../components/PrimaryButton';

const ROLES = [
  {
    key: 'owner',
    icon: 'domain',
    title: 'I am an Owner',
    description: 'Access high-level portfolio summaries, track rental yields, and manage properties.',
    features: ['Real-time yield tracking', 'Tax & financial reporting'],
    buttonLabel: 'Enter as Owner',
  },
  {
    key: 'tenant',
    icon: 'home',
    title: 'I am a Tenant',
    description: 'Manage monthly payments, request seamless repairs, and access your documents.',
    features: ['Automated rent payments', '24/7 maintenance portal'],
    buttonLabel: 'Enter as Tenant',
  },
];

export default function RoleSelectionScreen() {
  const insets = useSafeAreaInsets();
  const { user, refetchRole } = useAuth();
  const [loading, setLoading] = useState(null); // 'owner' | 'tenant' | null
  const [error, setError] = useState(null);

  const handleSelect = async (roleKey) => {
    setError(null);
    setLoading(roleKey);
    console.log('[RoleSelection] upsert start — user:', user?.id, 'role:', roleKey);

    const { error: upsertError } = await supabase
      .from('users')
      .upsert({ id: user.id, role: roleKey }, { onConflict: 'id' });

    if (upsertError) {
      console.log('[RoleSelection] upsert error:', upsertError.message, upsertError.code);
      setLoading(null);
      setError('Could not save your role: ' + upsertError.message);
      return;
    }

    console.log('[RoleSelection] upsert succeeded, refetching role...');
    // Call refetchRole directly — more reliable than hoping refreshSession()
    // triggers an onAuthStateChange event in time.
    await refetchRole();
    console.log('[RoleSelection] refetchRole complete');
    setLoading(null);
    // RootNavigator will re-render automatically once role changes in AuthContext
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Dark header */}
      <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.logoText}>ESTATE LOGIC</Text>
        <Text style={styles.headerTitle}>Choose your journey.</Text>
        <Text style={styles.headerSubtitle}>
          Select your primary perspective to personalise your dashboard.
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {ROLES.map((role) => (
          <View key={role.key} style={styles.card}>
            <View style={styles.cardIconRow}>
              <View style={styles.iconCircle}>
                <MaterialIcons name={role.icon} size={28} color={colors.primary} />
              </View>
            </View>
            <Text style={styles.cardTitle}>{role.title}</Text>
            <Text style={styles.cardDesc}>{role.description}</Text>

            <View style={styles.featureList}>
              {role.features.map((f) => (
                <View key={f} style={styles.featureRow}>
                  <MaterialIcons name="check-circle" size={16} color={colors.tertiaryFixedDim} />
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>

            <PrimaryButton
              label={role.buttonLabel}
              onPress={() => handleSelect(role.key)}
              loading={loading === role.key}
              disabled={loading !== null && loading !== role.key}
            />
          </View>
        ))}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => setError(null)}>
              <Text style={styles.retryText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <Text style={styles.footerNote}>
          Need to manage both? You can switch roles within your account settings later.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },

  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingBottom: 32,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  logoText: {
    fontFamily: fonts.manropeBold,
    fontSize: 12,
    letterSpacing: 3,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 16,
  },
  headerTitle: {
    fontFamily: fonts.manropeBold,
    fontSize: 30,
    color: colors.onPrimary,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontFamily: fonts.interRegular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 20,
  },

  // flex: 1 ensures ScrollView fills the space below the header
  // so it can actually scroll rather than collapsing to zero height.
  scrollView: {
    flex: 1,
  },
  scroll: {
    padding: 20,
    gap: 16,
    paddingBottom: 32,
  },

  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: 20,
  },
  cardIconRow: {
    marginBottom: 14,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: fonts.manropeBold,
    fontSize: 20,
    color: colors.onSurface,
    marginBottom: 6,
  },
  cardDesc: {
    fontFamily: fonts.interRegular,
    fontSize: 14,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
    marginBottom: 16,
  },
  featureList: {
    gap: 8,
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontFamily: fonts.interMedium,
    fontSize: 13,
    color: colors.onSurface,
  },

  errorBox: {
    backgroundColor: colors.errorContainer,
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    fontFamily: fonts.interRegular,
    fontSize: 13,
    color: colors.error,
    flex: 1,
  },
  retryText: {
    fontFamily: fonts.interSemiBold,
    fontSize: 13,
    color: colors.error,
    marginLeft: 12,
  },

  footerNote: {
    fontFamily: fonts.interRegular,
    fontSize: 12,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
});
