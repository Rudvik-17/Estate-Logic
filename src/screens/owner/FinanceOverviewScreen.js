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

export default function FinanceOverviewScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [transactions, setTransactions] = useState([]);
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setError(null);
    const propRes = await supabase
      .from('properties')
      .select('*')
      .eq('owner_id', user.id)
      .limit(1)
      .single();

    if (propRes.error && propRes.error.code !== 'PGRST116') {
      setError(propRes.error.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const prop = propRes.data;
    setProperty(prop);

    if (prop) {
      const { data, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('property_id', prop.id)
        .order('date', { ascending: false });
      if (txError) { setError(txError.message); setLoading(false); setRefreshing(false); return; }
      setTransactions(data ?? []);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!user) return null;

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const revenue = transactions.filter(t => t.type === 'rent').reduce((s, t) => s + Number(t.amount), 0);
  const expenses = transactions.filter(t => t.type !== 'rent').reduce((s, t) => s + Number(t.amount), 0);
  const netProfit = revenue - expenses;
  const margin = revenue > 0 ? Math.round((netProfit / revenue) * 100) : 0;

  const byCategory = (list, cats) =>
    cats.map(cat => ({
      cat,
      total: list.filter(t => t.category === cat).reduce((s, t) => s + Number(t.amount), 0),
    })).filter(c => c.total > 0);

  const revenueByCat = byCategory(transactions.filter(t => t.type === 'rent'), REVENUE_CATEGORIES);
  const expensesByCat = byCategory(transactions.filter(t => t.type !== 'rent'), EXPENSE_CATEGORIES);

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

  if (!property || transactions.length === 0) {
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
          <Text style={styles.propertyName}>{property.name}</Text>
          <View style={styles.locationRow}>
            <MaterialIcons name="location-on" size={13} color="rgba(255,255,255,0.6)" />
            <Text style={styles.locationText}>{property.city}</Text>
          </View>
        </View>

        {/* Metrics */}
        <View style={styles.metricsSection}>
          <View style={styles.metricsRow}>
            <MetricCard
              icon="trending-up"
              value={fmt(netProfit)}
              label="Net Profit"
              trend={`${margin}% margin`}
              trendUp={netProfit >= 0}
            />
            <View style={{ width: 12 }} />
            <MetricCard
              icon="arrow-downward"
              value={fmt(revenue)}
              label="Revenue"
              trendUp
            />
          </View>
          <View style={[styles.metricsRow, { marginTop: 12 }]}>
            <MetricCard
              icon="arrow-upward"
              value={fmt(expenses)}
              label="Expenses"
              trendUp={false}
            />
            <View style={{ width: 12 }} />
            <MetricCard
              icon="percent"
              value={`${margin}%`}
              label="Profit Margin"
              trendUp={margin >= 50}
            />
          </View>
        </View>

        {/* Revenue sources */}
        <View style={styles.section}>
          <SectionHeader title="Revenue Sources" actionLabel="Full Report" />
          {revenueByCat.length === 0 ? (
            <Text style={styles.noDataText}>No revenue recorded</Text>
          ) : (
            revenueByCat.map(({ cat, total }) => (
              <View key={cat} style={styles.lineItem}>
                <View style={styles.lineItemLeft}>
                  <MaterialIcons name="apartment" size={16} color={colors.onSurfaceVariant} />
                  <Text style={styles.lineItemLabel}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</Text>
                </View>
                <Text style={[styles.lineItemAmount, { color: colors.onTertiaryContainer }]}>{fmt(total)}</Text>
              </View>
            ))
          )}
        </View>

        {/* Expense breakdown */}
        <View style={styles.section}>
          <SectionHeader title="Expense Breakdown" actionLabel="View Ledger" />
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
