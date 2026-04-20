import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import ScreenHeader from '../../components/ScreenHeader';
import StatusChip from '../../components/StatusChip';

export default function PropertyDetailScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { property: initialProperty } = route.params;

  const [property, setProperty] = useState(initialProperty);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setError(null);

    const [propRes, tenantRes] = await Promise.all([
      supabase
        .from('properties')
        .select('*')
        .eq('id', initialProperty.id)
        .eq('owner_id', user.id)
        .limit(1),
      supabase
        .from('tenants')
        .select('id, full_name, unit_number, status, email, leases(monthly_rent, status, start_date, end_date)')
        .eq('property_id', initialProperty.id)
        .order('created_at', { ascending: false }),
    ]);

    if (propRes.error) { setError(propRes.error.message); setLoading(false); return; }
    if (tenantRes.error) { setError(tenantRes.error.message); setLoading(false); return; }

    if (propRes.data?.[0]) setProperty(propRes.data[0]);
    setTenants(tenantRes.data ?? []);
    setLoading(false);
  }, [user?.id, initialProperty.id]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  if (!user) return null;

  const activeTenants = tenants.filter(t => t.status === 'active');
  const occupied = activeTenants.length;
  const vacant = Math.max(0, property.total_units - occupied);
  const monthlyRevenue = activeTenants.reduce((sum, t) => {
    const activeLease = t.leases?.find(l => l.status === 'active');
    return sum + (activeLease ? Number(activeLease.monthly_rent) : 0);
  }, 0);

  const handleDeleteProperty = () => {
    if (activeTenants.length > 0) {
      Alert.alert(
        'Cannot Delete Property',
        `Cannot delete property with active tenants. Remove all ${activeTenants.length} tenant${activeTenants.length > 1 ? 's' : ''} first.`,
      );
      return;
    }
    Alert.alert(
      'Delete Property',
      `This will permanently remove "${property.name}" and all associated data. This cannot be undone. Are you sure?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: confirmDelete },
      ],
    );
  };

  const confirmDelete = async () => {
    setDeleting(true);
    const { error: delErr } = await supabase
      .from('properties')
      .delete()
      .eq('id', property.id)
      .eq('owner_id', user.id);
    setDeleting(false);
    if (delErr) {
      Alert.alert('Error', delErr.message);
      return;
    }
    navigation.goBack();
  };

  const chipVariant = status =>
    status === 'active' ? 'active' : status === 'pending' ? 'pending' : 'urgent';

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <MaterialIcons name="error-outline" size={40} color={colors.error} />
        <Text style={styles.errorTitle}>Unable to load property</Text>
        <Text style={styles.errorMsg}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchData}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Property Details" showBack onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIconBg}>
            <MaterialIcons name="apartment" size={32} color={colors.onPrimary} />
          </View>
          <Text style={styles.heroName}>{property.name}</Text>
          <View style={styles.heroLocationRow}>
            <MaterialIcons name="location-on" size={13} color="rgba(255,255,255,0.6)" />
            <Text style={styles.heroLocation}>{property.address}, {property.city}</Text>
          </View>
        </View>

        {/* Stats strip */}
        <View style={styles.statsStrip}>
          <StatCell label="Total Units" value={String(property.total_units)} />
          <View style={styles.statDivider} />
          <StatCell label="Occupied" value={String(occupied)} accent />
          <View style={styles.statDivider} />
          <StatCell label="Vacant" value={String(vacant)} />
        </View>

        {/* Revenue card */}
        <View style={styles.revenueCard}>
          <View style={styles.revenueRow}>
            <View style={styles.revenueIconBg}>
              <MaterialIcons name="payments" size={20} color={colors.primary} />
            </View>
            <View style={styles.revenueInfo}>
              <Text style={styles.revenueLabel}>MONTHLY REVENUE</Text>
              <Text style={styles.revenueValue}>
                ₹{monthlyRevenue.toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
          <View style={styles.revenueRow}>
            <View style={styles.revenueIconBg}>
              <MaterialIcons name="trending-up" size={20} color={colors.primary} />
            </View>
            <View style={styles.revenueInfo}>
              <Text style={styles.revenueLabel}>AVG RENT PER UNIT</Text>
              <Text style={styles.revenueValue}>
                ₹{Number(property.avg_rent).toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
        </View>

        {/* Tenants */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Residents <Text style={styles.sectionCount}>({tenants.length})</Text>
          </Text>

          {tenants.length === 0 ? (
            <View style={styles.emptyTenants}>
              <MaterialIcons name="groups" size={32} color={colors.outlineVariant} />
              <Text style={styles.emptyTenantsText}>No residents added yet</Text>
            </View>
          ) : (
            tenants.map(t => {
              const activeLease = t.leases?.find(l => l.status === 'active');
              return (
                <TouchableOpacity
                  key={t.id}
                  style={styles.tenantRow}
                  onPress={() => navigation.navigate('TenantDetail', { tenant: { ...t, properties: property } })}
                  activeOpacity={0.8}
                >
                  <View style={styles.tenantAvatar}>
                    <Text style={styles.tenantAvatarText}>{t.full_name[0]}</Text>
                  </View>
                  <View style={styles.tenantInfo}>
                    <Text style={styles.tenantName}>{t.full_name}</Text>
                    <Text style={styles.tenantMeta}>Unit {t.unit_number}</Text>
                    {activeLease ? (
                      <Text style={styles.tenantRent}>
                        ₹{Number(activeLease.monthly_rent).toLocaleString('en-IN')}/mo
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.tenantRight}>
                    <StatusChip label={t.status} variant={chipVariant(t.status)} />
                    <MaterialIcons name="chevron-right" size={16} color={colors.outline} style={{ marginTop: 4 }} />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => navigation.navigate('EditProperty', { property })}
          >
            <MaterialIcons name="edit" size={18} color={colors.primary} />
            <Text style={styles.editBtnText}>Edit Property</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={handleDeleteProperty}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <>
                <MaterialIcons name="delete-outline" size={18} color={colors.error} />
                <Text style={styles.deleteBtnText}>Delete Property</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function StatCell({ label, value, accent }) {
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statValue, accent && styles.statValueAccent]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, padding: 24,
  },

  hero: {
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  heroIconBg: {
    width: 68,
    height: 68,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroName: {
    fontFamily: fonts.manropeBold,
    fontSize: 22,
    color: colors.onPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  heroLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  heroLocation: {
    fontFamily: fonts.interRegular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    flexShrink: 1,
  },

  statsStrip: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainerLowest,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.surfaceContainerLow,
    marginVertical: 12,
  },
  statValue: {
    fontFamily: fonts.manropeBold,
    fontSize: 24,
    color: colors.onSurface,
    marginBottom: 3,
  },
  statValueAccent: {
    color: colors.primary,
  },
  statLabel: {
    fontFamily: fonts.interRegular,
    fontSize: 11,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  revenueCard: {
    backgroundColor: colors.surfaceContainerLowest,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 12,
    padding: 16,
    gap: 14,
  },
  revenueRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  revenueIconBg: {
    width: 38,
    height: 38,
    borderRadius: 9,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revenueInfo: { flex: 1 },
  revenueLabel: {
    fontFamily: fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  revenueValue: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 17,
    color: colors.onSurface,
  },

  section: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionTitle: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 16,
    color: colors.onSurface,
    marginBottom: 12,
  },
  sectionCount: {
    fontFamily: fonts.interRegular,
    color: colors.onSurfaceVariant,
  },

  emptyTenants: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 8,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 12,
  },
  emptyTenantsText: {
    fontFamily: fonts.interRegular,
    fontSize: 14,
    color: colors.onSurfaceVariant,
  },

  tenantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  tenantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tenantAvatarText: {
    fontFamily: fonts.manropeBold,
    fontSize: 16,
    color: colors.onPrimary,
  },
  tenantInfo: { flex: 1 },
  tenantName: {
    fontFamily: fonts.interSemiBold,
    fontSize: 14,
    color: colors.onSurface,
    marginBottom: 2,
  },
  tenantMeta: {
    fontFamily: fonts.interRegular,
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginBottom: 1,
  },
  tenantRent: {
    fontFamily: fonts.interMedium,
    fontSize: 12,
    color: colors.onTertiaryContainer,
  },
  tenantRight: { alignItems: 'flex-end' },

  actions: {
    marginHorizontal: 16,
    marginTop: 20,
    gap: 10,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 10,
    paddingVertical: 16,
  },
  editBtnText: {
    fontFamily: fonts.interSemiBold,
    fontSize: 15,
    color: colors.primary,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.errorContainer,
    borderRadius: 10,
    paddingVertical: 16,
  },
  deleteBtnText: {
    fontFamily: fonts.interSemiBold,
    fontSize: 15,
    color: colors.error,
  },

  errorTitle: {
    fontFamily: fonts.manropeSemiBold, fontSize: 18,
    color: colors.onSurface, marginTop: 12, marginBottom: 6,
  },
  errorMsg: {
    fontFamily: fonts.interRegular, fontSize: 13,
    color: colors.onSurfaceVariant, textAlign: 'center', marginBottom: 20,
  },
  retryBtn: {
    backgroundColor: colors.primary, borderRadius: 8,
    paddingVertical: 10, paddingHorizontal: 28,
  },
  retryText: { fontFamily: fonts.interSemiBold, fontSize: 14, color: colors.onPrimary },
});
