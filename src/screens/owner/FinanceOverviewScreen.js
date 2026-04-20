import React, { useState, useEffect, useCallback } from 'react';
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
import ScreenHeader from '../../components/ScreenHeader';
import SectionHeader from '../../components/SectionHeader';
import MetricCard from '../../components/MetricCard';

const EXPENSE_CATEGORIES = ['maintenance', 'staff', 'utilities', 'repair', 'admin', 'other'];
const REVENUE_CATEGORIES = ['residential', 'commercial', 'parking'];

export default function FinanceOverviewScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [transactions, setTransactions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setError(null);
    setLoading(true);

    // Fetch all properties — never use .single() when owner may have multiple
    const { data: propRows, error: propErr } = await supabase
      .from('properties')
      .select('id, name, city')
      .eq('owner_id', user.id)
      .order('name', { ascending: true });

    if (propErr) {
      setError(propErr.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const props = propRows ?? [];
    setProperties(props);
    const propIds = props.map(p => p.id);

    // Fetch transactions (all properties) and payments (via tenants join) in parallel
    const [txRes, paymentsRes] = await Promise.all([
      propIds.length > 0
        ? supabase
            .from('transactions')
            .select('*')
            .in('property_id', propIds)
            .order('date', { ascending: false })
        : { data: [], error: null },
      supabase
        .from('payments')
        .select('*, tenants!inner(owner_id, full_name)')
        .eq('tenants.owner_id', user.id)
        .order('due_date', { ascending: false }),
    ]);

    if (txRes.error) {
      setError(txRes.error.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (paymentsRes.error) {
      setError(paymentsRes.error.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setTransactions(txRes.data ?? []);
    setPayments(paymentsRes.data ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!user) return null;

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const collected = payments.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0);
  const pendingAmount = payments.filter(p => p.status === 'pending' || p.status === 'overdue').reduce((s, p) => s + Number(p.amount), 0);
  const expenses = transactions.filter(t => t.type !== 'rent').reduce((s, t) => s + Number(t.amount), 0);
  const netProfit = collected - expenses;
  const margin = collected > 0 ? Math.round((netProfit / collected) * 100) : 0;

  const byCategory = (list, cats) =>
    cats.map(cat => ({
      cat,
      total: list.filter(t => t.category === cat).reduce((s, t) => s + Number(t.amount), 0),
    })).filter(c => c.total > 0);

  const expensesByCat = byCategory(transactions.filter(t => t.type !== 'rent'), EXPENSE_CATEGORIES);

  // Recent activity: paid payments + transactions, newest first
  const recentPayments = payments
    .filter(p => p.status === 'paid')
    .map(p => ({ ...p, _kind: 'payment', _date: p.paid_at ?? p.due_date }));
  const recentTx = transactions.map(t => ({ ...t, _kind: 'transaction', _date: t.date }));
  const recentActivity = [...recentPayments, ...recentTx]
    .sort((a, b) => new Date(b._date) - new Date(a._date))
    .slice(0, 15);

  const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

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
        <Text style={styles.errorTitle}>Unable to load finances</Text>
        <Text style={styles.errorMsg}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchData}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (properties.length === 0 && payments.length === 0 && transactions.length === 0) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Finance" showBell />
        <View style={styles.centered}>
          <MaterialIcons name="account-balance-wallet" size={48} color={colors.outline} />
          <Text style={styles.emptyTitle}>No financial data yet</Text>
          <Text style={styles.emptySubtitle}>
            Add tenants and record transactions to see your finances.
          </Text>
        </View>
      </View>
    );
  }

  const headerProp = properties[0];

  return (
    <View style={styles.container}>
      <ScreenHeader title="Finance" showBell />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Property header */}
        <View style={styles.propertyHeader}>
          <Text style={styles.propertyName}>
            {properties.length === 1 ? headerProp.name : `${properties.length} Properties`}
          </Text>
          <View style={styles.locationRow}>
            <MaterialIcons name="location-on" size={13} color="rgba(255,255,255,0.6)" />
            <Text style={styles.locationText}>
              {properties.length === 1 ? headerProp.city : properties.map(p => p.city).join(' · ')}
            </Text>
          </View>
        </View>

        {/* Metrics */}
        <View style={styles.metricsSection}>
          <View style={styles.metricsRow}>
            <MetricCard
              icon="payments"
              value={fmt(collected)}
              label="Collected"
              trendUp
            />
            <View style={{ width: 12 }} />
            <MetricCard
              icon="schedule"
              value={fmt(pendingAmount)}
              label="Pending"
              trendUp={pendingAmount === 0}
            />
          </View>
          <View style={[styles.metricsRow, { marginTop: 12 }]}>
            <MetricCard
              icon="trending-up"
              value={fmt(netProfit)}
              label="Net Profit"
              trend={`${margin}% margin`}
              trendUp={netProfit >= 0}
            />
            <View style={{ width: 12 }} />
            <MetricCard
              icon="arrow-upward"
              value={fmt(expenses)}
              label="Expenses"
              trendUp={false}
            />
          </View>
        </View>

        {/* Recent activity */}
        <View style={styles.section}>
          <SectionHeader title="Recent Activity" actionLabel="Rent Collection" onAction={() => navigation.navigate('RentCollection')} />
          {recentActivity.length === 0 ? (
            <Text style={styles.noDataText}>No activity recorded</Text>
          ) : (
            recentActivity.map((item) => {
              const isPayment = item._kind === 'payment';
              const label = isPayment
                ? (item.tenants?.full_name ?? 'Tenant')
                : (item.description ?? item.category ?? item.type);
              const dateStr = new Date(item._date).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
              });
              return (
                <View key={item.id} style={styles.lineItem}>
                  <View style={styles.lineItemLeft}>
                    <MaterialIcons
                      name={isPayment ? 'check-circle' : 'receipt'}
                      size={16}
                      color={isPayment ? colors.tertiaryFixedDim : colors.onSurfaceVariant}
                    />
                    <View>
                      <Text style={styles.lineItemLabel}>{label}</Text>
                      <Text style={styles.lineItemDate}>{dateStr}</Text>
                    </View>
                  </View>
                  <Text style={[styles.lineItemAmount, {
                    color: isPayment ? colors.tertiaryFixedDim : colors.error,
                  }]}>
                    {isPayment ? '+' : '-'}{fmt(item.amount)}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {/* Expense breakdown */}
        <View style={styles.section}>
          <SectionHeader title="Expense Breakdown" />
          {expensesByCat.length === 0 ? (
            <Text style={styles.noDataText}>No expenses recorded</Text>
          ) : (
            expensesByCat.map(({ cat, total }) => (
              <View key={cat} style={styles.lineItem}>
                <View style={styles.lineItemLeft}>
                  <MaterialIcons name="remove-circle-outline" size={16} color={colors.onSurfaceVariant} />
                  <Text style={styles.lineItemLabel}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</Text>
                </View>
                <Text style={[styles.lineItemAmount, { color: colors.error }]}>{fmt(total)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, padding: 24,
  },

  propertyHeader: {
    backgroundColor: colors.primaryContainer,
    padding: 24,
    paddingTop: 16,
  },
  propertyName: {
    fontFamily: fonts.manropeBold,
    fontSize: 22,
    color: colors.onPrimary,
    marginBottom: 4,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  locationText: {
    fontFamily: fonts.interRegular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
  },

  metricsSection: {
    padding: 16,
    backgroundColor: colors.surfaceContainerLow,
  },
  metricsRow: { flexDirection: 'row' },

  section: { padding: 20 },

  lineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  lineItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lineItemLabel: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    color: colors.onSurface,
  },
  lineItemDate: {
    fontFamily: fonts.interRegular,
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginTop: 1,
  },
  lineItemAmount: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 14,
  },
  noDataText: {
    fontFamily: fonts.interRegular,
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    paddingVertical: 20,
  },

  emptyTitle: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 18,
    color: colors.onSurface,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: fonts.interRegular,
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  errorTitle: {
    fontFamily: fonts.manropeSemiBold, fontSize: 18, color: colors.onSurface,
    marginTop: 12, marginBottom: 6,
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
