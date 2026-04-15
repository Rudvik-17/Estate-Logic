import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import ScreenHeader from '../../components/ScreenHeader';
import SectionHeader from '../../components/SectionHeader';
import StatusChip from '../../components/StatusChip';
import MetricCard from '../../components/MetricCard';
import PrimaryButton from '../../components/PrimaryButton';

export default function ResidentDataScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [tenants, setTenants] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTenants = useCallback(async () => {
    if (!user) return;
    setError(null);
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('tenants')
      .select('*, properties(name, city), leases(id, status, start_date, end_date, monthly_rent)')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });
    if (fetchError) { setError(fetchError.message); setLoading(false); return; }
    setTenants(data ?? []);
    setFiltered(data ?? []);
    setLoading(false);
  }, [user?.id]);

  useFocusEffect(useCallback(() => { fetchTenants(); }, [fetchTenants]));

  useEffect(() => {
    const q = query.toLowerCase();
    setFiltered(
      q
        ? tenants.filter(
            t =>
              t.full_name.toLowerCase().includes(q) ||
              t.unit_number.toLowerCase().includes(q) ||
              t.email?.toLowerCase().includes(q)
          )
        : tenants
    );
  }, [query, tenants]);

  if (!user) return null;

  const active = tenants.filter(t => t.status === 'active').length;
  const pending = tenants.filter(t => t.status === 'pending').length;

  const chipVariant = (status) =>
    status === 'active' ? 'active' : status === 'pending' ? 'pending' : 'urgent';

  const renderTenant = ({ item }) => (
    <TouchableOpacity
      style={styles.tenantRow}
      onPress={() => navigation.navigate('TenantDetail', { tenant: item })}
      activeOpacity={0.8}
    >
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarInitial}>{item.full_name[0]}</Text>
      </View>
      <View style={styles.tenantInfo}>
        <Text style={styles.tenantName}>{item.full_name}</Text>
        <Text style={styles.tenantMeta}>
          Unit {item.unit_number} · {item.properties?.name}
        </Text>
        {item.email ? (
          <Text style={styles.tenantEmail} numberOfLines={1}>{item.email}</Text>
        ) : null}
      </View>
      <View style={styles.tenantRight}>
        <StatusChip
          label={item.status}
          variant={chipVariant(item.status)}
        />
        <MaterialIcons name="chevron-right" size={16} color={colors.outline} style={{ marginTop: 4 }} />
      </View>
    </TouchableOpacity>
  );

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
        <Text style={styles.errorTitle}>Unable to load residents</Text>
        <Text style={styles.errorMsg}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchTenants}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Residents" showBell />

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderTenant}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        ListHeaderComponent={
          <>
            {/* Metrics */}
            <View style={styles.metricsRow}>
              <MetricCard icon="groups" value={String(tenants.length)} label="Total Residents" />
              <View style={{ width: 12 }} />
              <MetricCard icon="check-circle" value={String(active)} label="Active" trend={`${pending} pending`} trendUp={pending === 0} />
            </View>

            {/* Search + Add */}
            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <MaterialIcons name="search" size={18} color={colors.outline} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search residents..."
                  placeholderTextColor={colors.outline}
                />
              </View>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => navigation.navigate('TenantOnboarding')}
              >
                <MaterialIcons name="person-add" size={20} color={colors.onPrimary} />
              </TouchableOpacity>
            </View>

            <SectionHeader
              title="All Residents"
              actionLabel="Add Resident"
              onAction={() => navigation.navigate('TenantOnboarding')}
            />
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="groups" size={40} color={colors.outline} />
            <Text style={styles.emptyTitle}>No residents added yet</Text>
            <Text style={styles.emptySubtitle}>Add your first resident to get started.</Text>
            <View style={{ marginTop: 20 }}>
              <PrimaryButton
                label="Add your first resident"
                onPress={() => navigation.navigate('TenantOnboarding')}
                icon="person-add"
              />
            </View>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    padding: 24,
  },

  metricsRow: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: colors.surfaceContainerLow,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.interRegular,
    fontSize: 14,
    color: colors.onSurface,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tenantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLowest,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: fonts.manropeBold,
    fontSize: 18,
    color: colors.onPrimary,
  },
  tenantInfo: { flex: 1 },
  tenantName: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 15,
    color: colors.onSurface,
    marginBottom: 2,
  },
  tenantMeta: {
    fontFamily: fonts.interRegular,
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginBottom: 2,
  },
  tenantEmail: {
    fontFamily: fonts.interRegular,
    fontSize: 11,
    color: colors.outline,
  },
  tenantRight: { alignItems: 'flex-end' },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 18,
    color: colors.onSurface,
    marginTop: 8,
  },
  emptySubtitle: {
    fontFamily: fonts.interRegular,
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },

  errorTitle: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 18,
    color: colors.onSurface,
    marginTop: 12,
    marginBottom: 6,
  },
  errorMsg: {
    fontFamily: fonts.interRegular,
    fontSize: 13,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 28,
  },
  retryText: {
    fontFamily: fonts.interSemiBold,
    fontSize: 14,
    color: colors.onPrimary,
  },
});
