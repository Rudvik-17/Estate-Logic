import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  FlatList,
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
import PrimaryButton from '../../components/PrimaryButton';

const METHOD_LABELS = {
  gpay: 'Google Pay',
  phonepe: 'PhonePe',
  paytm: 'Paytm',
};

const statusVariant = (status) =>
  status === 'paid' ? 'active' : status === 'overdue' ? 'urgent' : 'pending';

export default function PaymentHistoryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [payments, setPayments] = useState([]);
  const [pendingPayment, setPendingPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setError(null);

    // Step 1: resolve tenant_id for this user
    const { data: tenantRows, error: tenantError } = await supabase
      .from('tenants')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);

    console.log('Tenant lookup:', tenantRows, tenantError);

    if (tenantError) {
      setError(tenantError.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const tenantId = tenantRows?.[0]?.id ?? null;
    if (!tenantId) {
      setPayments([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    // Step 2: fetch all payments for this tenant directly by tenant_id
    const { data: paymentsData, error: paymentsError } = await supabase
      .from('payments')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('due_date', { ascending: false });

    console.log('Payments query:', paymentsData, paymentsError);

    if (paymentsError) {
      setError(paymentsError.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const all = paymentsData ?? [];
    setPayments(all);
    setPendingPayment(
      all.find(p => p.status === 'pending' || p.status === 'overdue') ?? null
    );
    setLoading(false);
    setRefreshing(false);
  }, [user?.id]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  if (!user) return null;

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const totalPaid = payments
    .filter(p => p.status === 'paid')
    .reduce((s, p) => s + Number(p.amount), 0);
  const pendingCount = payments.filter(
    p => p.status === 'pending' || p.status === 'overdue'
  ).length;

  const formatDate = (d) =>
    d
      ? new Date(d).toLocaleDateString('en-IN', {
          day: 'numeric', month: 'short', year: 'numeric',
        })
      : '—';

  const renderPayment = ({ item }) => (
    <View style={styles.paymentRow}>
      <View style={styles.paymentIconBg}>
        <MaterialIcons
          name={item.status === 'paid' ? 'check-circle' : 'schedule'}
          size={18}
          color={item.status === 'paid' ? colors.tertiaryFixedDim : colors.onSurfaceVariant}
        />
      </View>
      <View style={styles.paymentInfo}>
        <Text style={styles.paymentAmount}>
          ₹{Number(item.amount).toLocaleString('en-IN')}
        </Text>
        <Text style={styles.paymentMeta}>
          Due {formatDate(item.due_date)}
          {item.paid_at ? ` · Paid ${formatDate(item.paid_at)}` : ''}
        </Text>
        {item.payment_method ? (
          <Text style={styles.paymentMethod}>
            {METHOD_LABELS[item.payment_method] ?? item.payment_method}
          </Text>
        ) : null}
      </View>
      <StatusChip label={item.status} variant={statusVariant(item.status)} />
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
      <ScreenHeader title="Payment History" showBell />
      <FlatList
        data={payments}
        keyExtractor={item => item.id}
        renderItem={renderPayment}
        contentContainerStyle={{ paddingBottom: insets.bottom + (pendingPayment ? 100 : 24) }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View style={styles.metricsRow}>
            <MetricCard
              icon="payments"
              value={`₹${totalPaid.toLocaleString('en-IN')}`}
              label="Total Paid"
              trendUp
            />
            <View style={{ width: 12 }} />
            <MetricCard
              icon="schedule"
              value={String(pendingCount)}
              label="Pending"
              trendUp={pendingCount === 0}
            />
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="receipt-long" size={40} color={colors.outline} />
            <Text style={styles.emptyTitle}>No payment history yet</Text>
            <Text style={styles.emptySubtitle}>
              Your payment records will appear here once rent is due.
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      {pendingPayment ? (
        <View style={[styles.payNowBar, { paddingBottom: insets.bottom + 12 }]}>
          <PrimaryButton
            label={`Pay Now — ₹${Number(pendingPayment.amount).toLocaleString('en-IN')}`}
            onPress={() => navigation.navigate('RentPayment')}
            icon="arrow-forward"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, padding: 24,
  },

  metricsRow: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: colors.surfaceContainerLow,
    marginBottom: 8,
  },

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
  paymentIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentInfo: { flex: 1 },
  paymentAmount: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 15,
    color: colors.onSurface,
    marginBottom: 2,
  },
  paymentMeta: {
    fontFamily: fonts.interRegular,
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginBottom: 2,
  },
  paymentMethod: {
    fontFamily: fonts.interRegular,
    fontSize: 11,
    color: colors.outline,
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

  payNowBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },

  errorTitle: { fontFamily: fonts.manropeSemiBold, fontSize: 18, color: colors.onSurface, marginTop: 12, marginBottom: 6 },
  errorMsg: { fontFamily: fonts.interRegular, fontSize: 13, color: colors.onSurfaceVariant, textAlign: 'center', marginBottom: 20 },
  retryBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 28 },
  retryText: { fontFamily: fonts.interSemiBold, fontSize: 14, color: colors.onPrimary },
});
