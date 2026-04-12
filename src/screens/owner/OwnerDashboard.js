import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import MetricCard from '../../components/MetricCard';
import SectionHeader from '../../components/SectionHeader';
import ScreenHeader from '../../components/ScreenHeader';
import PrimaryButton from '../../components/PrimaryButton';

export default function OwnerDashboard({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [properties, setProperties] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setError(null);
    setLoading(true);

    // Fetch properties first to get IDs for subsequent queries
    const propsRes = await supabase
      .from('properties')
      .select('*, leases(id, status, end_date)')
      .eq('owner_id', user.id);

    if (propsRes.error) {
      setError(propsRes.error.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const props = propsRes.data ?? [];
    const propertyIds = props.map(p => p.id);
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    const [txRes, paymentsRes, issuesRes] = await Promise.all([
      propertyIds.length > 0
        ? supabase
            .from('transactions')
            .select('*, properties(name)')
            .in('property_id', propertyIds)
            .order('date', { ascending: false })
            .limit(10)
        : Promise.resolve({ data: [], error: null }),
      // Bug 1 fix: query payments via tenants join — payments has no owner_id column
      supabase
        .from('payments')
        .select('amount, tenants!inner(owner_id)')
        .eq('tenants.owner_id', user.id)
        .eq('status', 'paid')
        .gte('paid_at', startOfMonth),
      propertyIds.length > 0
        ? supabase
            .from('maintenance_requests')
            .select('id, priority')
            .in('property_id', propertyIds)
            .in('status', ['open', 'in_progress'])
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (txRes.error || paymentsRes.error || issuesRes.error) {
      setError((txRes.error || paymentsRes.error || issuesRes.error).message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const txs = txRes.data ?? [];
    const totalUnits = props.reduce((s, p) => s + p.total_units, 0);
    const activeLeases = props.flatMap(p => p.leases).filter(l => l.status === 'active').length;
    const mtdCollected = (paymentsRes.data ?? []).reduce((s, p) => s + Number(p.amount), 0);
    const activeIssuesData = issuesRes.data ?? [];
    const activeIssues = activeIssuesData.length;
    const urgentIssues = activeIssuesData.filter(i => i.priority === 'high').length;

    const now = new Date();
    const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiringLeases = props
      .flatMap(p => p.leases)
      .filter(l => l.status === 'active' && new Date(l.end_date) <= thirtyDaysOut).length;

    setProperties(props);
    setTransactions(txs);
    setMetrics({ totalUnits, activeLeases, mtdCollected, expiringLeases, activeIssues, urgentIssues });
    setLoading(false);
    setRefreshing(false);
  }, [user?.id]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  if (!user) return null;

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const formatCrore = (n) => {
    if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1)} Cr`;
    if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)} L`;
    return `₹${n.toLocaleString('en-IN')}`;
  };

  const totalPortfolioValue = properties.reduce(
    (s, p) => s + p.avg_rent * p.total_units * 12, 0
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
        <Text style={styles.errorTitle}>Unable to load dashboard</Text>
        <Text style={styles.errorMsg}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchData}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Empty state — shown instead of metrics/transactions when no properties ────
  if (properties.length === 0) {
    return (
      <View style={styles.container}>
        <ScreenHeader showBell />
        <ScrollView
          contentContainerStyle={styles.emptyScrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          <View style={styles.emptyHero}>
            <View style={styles.emptyIconCircle}>
              <MaterialIcons name="domain-add" size={48} color={colors.onPrimary} />
            </View>
            <Text style={styles.emptyTitle}>No properties yet</Text>
            <Text style={styles.emptySubtitle}>
              Add your first property to get started
            </Text>
            <View style={styles.emptyBtnWrapper}>
              <PrimaryButton
                label="Add Your First Property"
                onPress={() => navigation.navigate('AddProperty')}
                icon="add"
              />
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Dashboard with data ───────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <ScreenHeader showBell />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Hero summary */}
        <View style={styles.heroSection}>
          <Text style={styles.heroLabel}>MY PROPERTIES</Text>
          <Text style={styles.heroValue}>{formatCrore(totalPortfolioValue)}</Text>
          <Text style={styles.heroSubtitle}>
            {properties.length} {properties.length === 1 ? 'property' : 'properties'} · Managed portfolio
          </Text>
        </View>

        {/* Metrics grid */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricsRow}>
            <MetricCard
              icon="domain"
              value={`${metrics?.activeLeases ?? 0} of ${metrics?.totalUnits ?? 0} units`}
              label="Occupied Units"
            />
            <View style={styles.metricGap} />
            <MetricCard
              icon="payments"
              value={formatCrore(metrics?.mtdCollected ?? 0)}
              label="Collected (MTD)"
            />
          </View>
          <View style={[styles.metricsRow, { marginTop: 12 }]}>
            <MetricCard
              icon="report-problem"
              value={String(metrics?.activeIssues ?? 0).padStart(2, '0')}
              label="Active Issues"
              trend={metrics?.urgentIssues > 0 ? `${metrics.urgentIssues} urgent` : undefined}
              trendUp={false}
            />
            <View style={styles.metricGap} />
            <MetricCard
              icon="event"
              value={String(metrics?.expiringLeases ?? 0).padStart(2, '0')}
              label="Expiring (30d)"
            />
          </View>
        </View>

        {/* Featured property */}
        {properties[0] ? (
          <View style={styles.section}>
            <SectionHeader title="Top Performer" actionLabel="View all" />
            <View style={styles.propertyCard}>
              <View style={styles.propertyCardInner}>
                <View style={styles.propertyIconBg}>
                  <MaterialIcons name="apartment" size={28} color={colors.onPrimary} />
                </View>
                <View style={styles.propertyInfo}>
                  <Text style={styles.propertyName}>{properties[0].name}</Text>
                  <View style={styles.propertyMeta}>
                    <MaterialIcons name="location-on" size={13} color={colors.onSurfaceVariant} />
                    <Text style={styles.propertyMetaText}>{properties[0].city}</Text>
                  </View>
                  <Text style={styles.propertyDetail}>
                    {properties[0].total_units} Units · Avg ₹{Number(properties[0].avg_rent).toLocaleString('en-IN')}/mo
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {/* Recent transactions */}
        <View style={styles.section}>
          <SectionHeader title="Recent Transactions" actionLabel="View ledger" />
          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="receipt-long" size={32} color={colors.outline} />
              <Text style={styles.emptyText}>No transactions yet</Text>
            </View>
          ) : (
            transactions.map((tx) => (
              <View key={tx.id} style={styles.txRow}>
                <View style={styles.txIconBg}>
                  <MaterialIcons
                    name={tx.type === 'rent' ? 'arrow-downward' : 'arrow-upward'}
                    size={16}
                    color={tx.type === 'rent' ? colors.onTertiaryContainer : colors.error}
                  />
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txDesc} numberOfLines={1}>{tx.description}</Text>
                  <Text style={styles.txDate}>
                    {new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
                <Text style={[
                  styles.txAmount,
                  { color: tx.type === 'rent' ? colors.onTertiaryContainer : colors.error }
                ]}>
                  {tx.type === 'rent' ? '+' : '-'}₹{Number(tx.amount).toLocaleString('en-IN')}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* FAB — Add Property */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 16 }]}
        onPress={() => navigation.navigate('AddProperty')}
        activeOpacity={0.85}
      >
        <MaterialIcons name="add" size={26} color={colors.onPrimary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    padding: 24,
  },

  heroSection: {
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 28,
  },
  heroLabel: {
    fontFamily: fonts.interSemiBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.55)',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  heroValue: {
    fontFamily: fonts.manropeBold,
    fontSize: 38,
    color: colors.onPrimary,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontFamily: fonts.interRegular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
  },

  metricsGrid: {
    padding: 16,
    backgroundColor: colors.surfaceContainerLow,
  },
  metricsRow: {
    flexDirection: 'row',
  },
  metricGap: { width: 12 },

  section: {
    padding: 20,
  },

  propertyCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: 16,
  },
  propertyCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  propertyIconBg: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  propertyInfo: { flex: 1 },
  propertyName: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 16,
    color: colors.onSurface,
    marginBottom: 3,
  },
  propertyMeta: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 4 },
  propertyMetaText: {
    fontFamily: fonts.interRegular,
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  propertyDetail: {
    fontFamily: fonts.interMedium,
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },

  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 0,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  txIconBg: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txInfo: { flex: 1 },
  txDesc: {
    fontFamily: fonts.interMedium,
    fontSize: 13,
    color: colors.onSurface,
    marginBottom: 2,
  },
  txDate: {
    fontFamily: fonts.interRegular,
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  txAmount: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 14,
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontFamily: fonts.interRegular,
    fontSize: 14,
    color: colors.onSurfaceVariant,
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
    letterSpacing: 0.5,
  },

  // ── Empty state ───────────────────────────────────────────────────────────────
  emptyScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 32,
  },
  emptyHero: {
    alignItems: 'center',
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontFamily: fonts.manropeBold,
    fontSize: 22,
    color: colors.onSurface,
    marginBottom: 10,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: fonts.interRegular,
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  emptyBtnWrapper: {
    width: '100%',
  },

  // ── FAB ───────────────────────────────────────────────────────────────────────
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
});
