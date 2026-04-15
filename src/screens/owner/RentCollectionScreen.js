import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  FlatList,
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
import MetricCard from '../../components/MetricCard';
import StatusChip from '../../components/StatusChip';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'paid', label: 'Paid' },
  { key: 'pending', label: 'Pending' },
  { key: 'overdue', label: 'Overdue' },
];

const statusVariant = (status) =>
  status === 'paid' ? 'active' : status === 'overdue' ? 'urgent' : 'pending';

export default function RentCollectionScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [payments, setPayments] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('payments')
      .select('*, tenants!inner(owner_id, full_name, unit_number, properties(name))')
      .eq('tenants.owner_id', user.id)
      .order('due_date', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setPayments(data ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [user?.id]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  if (!user) return null;

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const mtdCollected = payments
    .filter(p => p.status === 'paid' && p.paid_at && new Date(p.paid_at) >= startOfMonth)
    .reduce((s, p) => s + Number(p.amount), 0);
  const totalPending = payments
    .filter(p => p.status === 'pending' || p.status === 'overdue')
    .reduce((s, p) => s + Number(p.amount), 0);
  const paidCount = payments.filter(p => p.status === 'paid').length;
  const collectionRate = payments.length > 0
    ? Math.round((paidCount / payments.length) * 100)
    : 0;

  const filtered = filter === 'all' ? payments : payments.filter(p => p.status === filter);

  const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
  const formatDate = (d) =>
    d
      ? new Date(d).toLocaleDateString('en-IN', {
          day: 'numeric', month: 'short', year: 'numeric',
        })
      : '—';

  const renderPayment = ({ item }) => (
    <View style={styles.paymentRow}>
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarInitial}>
          {item.tenants?.full_name?.[0] ?? '?'}
        </Text>
      </View>
      <View style={styles.paymentInfo}>
        <Text style={styles.tenantName}>{item.tenants?.full_name ?? '—'}</Text>
        <Text style={styles.paymentMeta}>
          Unit {item.tenants?.unit_number} · {item.tenants?.properties?.name}
        </Text>
        <Text style={styles.paymentDue}>Due {formatDate(item.due_date)}</Text>
      </View>
      <View style={styles.paymentRight}>
        <Text style={styles.paymentAmount}>{fmt(item.amount)}</Text>
        <StatusChip label={item.status} variant={statusVariant(item.status)} />
      </View>
    </View>
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
        <Text style={styles.errorTitle}>Unable to load payments</Text>
        <Text style={styles.errorMsg}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchData}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Rent Collection" showBell />
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderPayment}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <>
            <View style={styles.metricsGrid}>
              <View style={styles.metricsRow}>
                <MetricCard
                  icon="payments"
                  value={fmt(mtdCollected)}
                  label="Collected MTD"
                  trendUp
                />
                <View style={{ width: 12 }} />
                <MetricCard
                  icon="schedule"
                  value={fmt(totalPending)}
                  label="Pending"
                  trendUp={false}
                />
              </View>
              <View style={[styles.metricsRow, { marginTop: 12 }]}>
                <MetricCard
                  icon="percent"
                  value={`${collectionRate}%`}
                  label="Collection Rate"
                  trendUp={collectionRate >= 80}
                />
                <View style={{ width: 12 }} />
                <MetricCard
                  icon="receipt-long"
                  value={String(payments.length)}
                  label="Total Records"
                />
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScroll}
            >
              {FILTERS.map(f => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
                  onPress={() => setFilter(f.key)}
                >
                  <Text style={[styles.filterLabel, filter === f.key && styles.filterLabelActive]}>
                    {f.label}
                    {' '}
                    ({f.key === 'all'
                      ? payments.length
                      : payments.filter(p => p.status === f.key).length})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="payments" size={40} color={colors.outline} />
            <Text style={styles.emptyTitle}>No payment records yet</Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'all'
                ? 'Payment records will appear here once tenants are billed.'
                : `No ${filter} payments found.`}
            </Text>
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
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, padding: 24,
  },

  metricsGrid: {
    padding: 16,
    backgroundColor: colors.surfaceContainerLow,
  },
  metricsRow: { flexDirection: 'row' },

  filterScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 9999,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  filterChipActive: { backgroundColor: colors.primary },
  filterLabel: {
    fontFamily: fonts.interMedium,
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  filterLabelActive: { color: colors.onPrimary },

  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceContainerLowest,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 14,
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
  paymentInfo: { flex: 1 },
  tenantName: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 14,
    color: colors.onSurface,
    marginBottom: 2,
  },
  paymentMeta: {
    fontFamily: fonts.interRegular,
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginBottom: 2,
  },
  paymentDue: {
    fontFamily: fonts.interRegular,
    fontSize: 11,
    color: colors.outline,
  },
  paymentRight: { alignItems: 'flex-end', gap: 6 },
  paymentAmount: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 14,
    color: colors.onSurface,
  },

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

  errorTitle: { fontFamily: fonts.manropeSemiBold, fontSize: 18, color: colors.onSurface, marginTop: 12, marginBottom: 6 },
  errorMsg: { fontFamily: fonts.interRegular, fontSize: 13, color: colors.onSurfaceVariant, textAlign: 'center', marginBottom: 20 },
  retryBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 28 },
  retryText: { fontFamily: fonts.interSemiBold, fontSize: 14, color: colors.onPrimary },
});
