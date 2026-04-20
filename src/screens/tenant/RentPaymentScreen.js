import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { showPaymentConfirmed, scheduleRentReminder } from '../../lib/notifications';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import ScreenHeader from '../../components/ScreenHeader';
import StatusChip from '../../components/StatusChip';
import PrimaryButton from '../../components/PrimaryButton';

const UPI_METHODS = [
  { key: 'gpay', label: 'Google Pay', sub: 'Instant settlement via GPay', icon: 'payment' },
  { key: 'phonepe', label: 'PhonePe', sub: 'Pay using PhonePe wallet or UPI', icon: 'smartphone' },
  { key: 'paytm', label: 'Paytm', sub: 'Fast checkout with Paytm Postpaid', icon: 'account-balance-wallet' },
];

export default function RentPaymentScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [tenantId, setTenantId] = useState(null);
  const [lease, setLease] = useState(null);
  const [payment, setPayment] = useState(null);
  const [notSetUp, setNotSetUp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState('gpay');
  const [paying, setPaying] = useState(false);

  const fetchPayment = useCallback(async () => {
    if (!user) return;
    setError(null);
    setNotSetUp(false);

    const { data: tenantRows, error: tErr } = await supabase
      .from('tenants')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);

    if (tErr) {
      setError(tErr.message);
      setLoading(false);
      return;
    }

    const tenantData = tenantRows?.[0] ?? null;
    if (!tenantData) {
      setNotSetUp(true);
      setLoading(false);
      return;
    }
    setTenantId(tenantData.id);

    const dueDate = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

    // Fetch active lease and any pending/overdue payment in parallel
    const [leaseRes, paymentRes] = await Promise.all([
      supabase
        .from('leases')
        .select('id, monthly_rent')
        .eq('tenant_id', tenantData.id)
        .eq('status', 'active')
        .order('end_date', { ascending: false })
        .limit(1),
      supabase
        .from('payments')
        .select('*')
        .eq('tenant_id', tenantData.id)
        .in('status', ['pending', 'overdue'])
        .order('due_date', { ascending: true })
        .limit(1),
    ]);

    if (leaseRes.error) {
      setError(leaseRes.error.message);
      setLoading(false);
      return;
    }
    if (paymentRes.error) {
      setError(paymentRes.error.message);
      setLoading(false);
      return;
    }

    const leaseData = leaseRes.data?.[0] ?? null;
    let paymentData = paymentRes.data?.[0] ?? null;

    // Auto-create a pending row only if no row at all exists for this due_date
    if (!paymentData && leaseData) {
      const { data: existing, error: existingErr } = await supabase
        .from('payments')
        .select('*')
        .eq('tenant_id', tenantData.id)
        .eq('due_date', dueDate)
        .limit(1);

      // If the query itself fails, skip insert to avoid a constraint crash
      if (existingErr) {
        setLease(leaseData);
        setPayment(null);
        setLoading(false);
        return;
      }

      if (existing && existing.length > 0) {
        // Row already exists — use it if still actionable, otherwise nothing due
        const row = existing[0];
        paymentData = (row.status === 'pending' || row.status === 'overdue') ? row : null;
      } else {
        const { data: newPayment, error: insertErr } = await supabase
          .from('payments')
          .insert({
            tenant_id: tenantData.id,
            lease_id: leaseData.id,
            amount: leaseData.monthly_rent,
            due_date: dueDate,
            status: 'pending',
          })
          .select()
          .single();

        if (insertErr) {
          if (insertErr.code === '23505') {
            // Race condition: another screen inserted between our check and this insert.
            // Re-fetch the row that won the race and use it if still actionable.
            const { data: raceRows } = await supabase
              .from('payments')
              .select('*')
              .eq('tenant_id', tenantData.id)
              .eq('due_date', dueDate)
              .limit(1);
            const row = raceRows?.[0] ?? null;
            paymentData = (row?.status === 'pending' || row?.status === 'overdue') ? row : null;
          } else {
            setError(insertErr.message);
            setLoading(false);
            return;
          }
        } else {
          paymentData = newPayment;
        }
      }
    }

    setLease(leaseData);
    setPayment(paymentData);
    setLoading(false);

    if (paymentData?.due_date) {
      scheduleRentReminder({ amount: paymentData.amount, dueDate: paymentData.due_date });
    }
  }, [user?.id]);

  useEffect(() => { fetchPayment(); }, [fetchPayment]);

  if (!user) return null;

  const daysUntilDue = (dueDate) => {
    const diff = new Date(dueDate).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days < 0) return `${Math.abs(days)} days overdue`;
    if (days === 0) return 'Due today';
    return `Due in ${days} day${days === 1 ? '' : 's'}`;
  };

  const handleConfirmPay = async () => {
    if (!payment) return;

    setPaying(true);
    // Simulate UPI processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    const txnId = 'TXN' + Math.floor(Math.random() * 9_000_000_000 + 1_000_000_000);
    const now = new Date().toISOString();

    const { error: dbError } = await supabase
      .from('payments')
      .update({
        status: 'paid',
        paid_at: now,
        payment_method: selectedMethod,
        transaction_id: txnId,
      })
      .eq('id', payment.id);

    setPaying(false);

    if (dbError) {
      setError(dbError.message);
      return;
    }

    showPaymentConfirmed({ amount: payment.amount, method: selectedMethod });

    navigation.navigate('PaymentSuccess', {
      amount: payment.amount,
      method: selectedMethod,
      txnId,
      paidAt: now,
    });
  };

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
        <Text style={styles.errorTitle}>Unable to load payment</Text>
        <Text style={styles.errorMsg}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchPayment}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (notSetUp) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Payments" showBell />
        <View style={styles.centered}>
          <MaterialIcons name="home" size={48} color={colors.outline} />
          <Text style={styles.noDueTitle}>Account not set up</Text>
          <Text style={styles.noDueSubtitle}>
            Contact your property manager to get linked to your unit.
          </Text>
        </View>
      </View>
    );
  }

  if (!payment) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Payments" showBell />
        <View style={styles.centered}>
          <MaterialIcons name="check-circle" size={48} color={colors.tertiaryFixedDim} />
          <Text style={styles.noDueTitle}>No payment due</Text>
          <Text style={styles.noDueSubtitle}>You're all caught up on rent payments.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Payments" showBell />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Amount */}
        <View style={styles.amountSection}>
          <Text style={styles.amountLabel}>TOTAL RENT DUE</Text>
          <Text style={styles.amountValue}>
            ₹{Number(payment?.amount ?? lease?.monthly_rent ?? 0).toLocaleString('en-IN')}
          </Text>
          <Text style={styles.amountCurrency}>Current currency: Indian Rupees (₹)</Text>
          {payment?.due_date ? (
            <View style={styles.dueRow}>
              <StatusChip
                label={daysUntilDue(payment.due_date)}
                variant={payment.status === 'overdue' ? 'urgent' : 'pending'}
              />
              <Text style={styles.dueDateText}>
                Due {new Date(payment.due_date).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </Text>
            </View>
          ) : (
            <View style={styles.dueRow}>
              <StatusChip label="Due this month" variant="pending" />
            </View>
          )}
        </View>

        {/* UPI Methods */}
        <View style={styles.methodsSection}>
          <Text style={styles.methodsTitle}>Pay via UPI</Text>
          {UPI_METHODS.map(method => (
            <TouchableOpacity
              key={method.key}
              style={[styles.methodCard, selectedMethod === method.key && styles.methodCardActive]}
              onPress={() => setSelectedMethod(method.key)}
              activeOpacity={0.8}
            >
              <View style={styles.methodIconBg}>
                <MaterialIcons name={method.icon} size={22} color={colors.primary} />
              </View>
              <View style={styles.methodInfo}>
                <Text style={styles.methodLabel}>{method.label}</Text>
                <Text style={styles.methodSub}>{method.sub}</Text>
              </View>
              <View style={[styles.radioOuter, selectedMethod === method.key && styles.radioOuterActive]}>
                {selectedMethod === method.key ? <View style={styles.radioInner} /> : null}
              </View>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.addUpiRow}>
            <MaterialIcons name="add" size={16} color={colors.primary} />
            <Text style={styles.addUpiText}>Add another UPI ID</Text>
          </TouchableOpacity>
        </View>

        {/* Security badge */}
        <View style={styles.securitySection}>
          <View style={styles.securityBadge}>
            <MaterialIcons name="verified-user" size={16} color={colors.tertiaryFixedDim} />
            <Text style={styles.securityText}>100% Secure Payments</Text>
          </View>
          <Text style={styles.securitySubtext}>PCI-DSS Compliant & End-to-End Encrypted</Text>
        </View>

        {/* CTA */}
        <View style={styles.ctaSection}>
          <PrimaryButton
            label={`Confirm & Pay ₹${Number(payment?.amount ?? lease?.monthly_rent ?? 0).toLocaleString('en-IN')}`}
            onPress={handleConfirmPay}
            loading={paying}
            icon="lock"
          />
          <Text style={styles.mockNote}>
            * Payment is simulated. No real transaction will occur.
          </Text>
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

  amountSection: {
    backgroundColor: colors.primaryContainer,
    padding: 24,
    paddingBottom: 28,
  },
  amountLabel: {
    fontFamily: fonts.interSemiBold,
    fontSize: 10, letterSpacing: 2,
    color: 'rgba(255,255,255,0.55)',
    textTransform: 'uppercase', marginBottom: 6,
  },
  amountValue: {
    fontFamily: fonts.manropeBold, fontSize: 42,
    color: colors.onPrimary, marginBottom: 4,
  },
  amountCurrency: {
    fontFamily: fonts.interRegular, fontSize: 12,
    color: 'rgba(255,255,255,0.55)', marginBottom: 12,
  },
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dueDateText: {
    fontFamily: fonts.interRegular, fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
  },

  methodsSection: { padding: 20 },
  methodsTitle: {
    fontFamily: fonts.manropeSemiBold, fontSize: 16,
    color: colors.onSurface, marginBottom: 12,
  },
  methodCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 12, padding: 14, marginBottom: 8,
  },
  methodCardActive: {
    backgroundColor: colors.surfaceContainerLow,
  },
  methodIconBg: {
    width: 42, height: 42, borderRadius: 10,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center', justifyContent: 'center',
  },
  methodInfo: { flex: 1 },
  methodLabel: { fontFamily: fonts.interSemiBold, fontSize: 14, color: colors.onSurface, marginBottom: 2 },
  methodSub: { fontFamily: fonts.interRegular, fontSize: 12, color: colors.onSurfaceVariant },
  radioOuter: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: colors.outline,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOuterActive: { borderColor: colors.primary },
  radioInner: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: colors.primary,
  },
  addUpiRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, paddingVertical: 8,
  },
  addUpiText: { fontFamily: fonts.interMedium, fontSize: 13, color: colors.primary },

  securitySection: { alignItems: 'center', paddingBottom: 8 },
  securityBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  securityText: { fontFamily: fonts.interSemiBold, fontSize: 13, color: colors.onSurface },
  securitySubtext: { fontFamily: fonts.interRegular, fontSize: 12, color: colors.onSurfaceVariant },

  ctaSection: { paddingHorizontal: 20, paddingTop: 8, gap: 10 },
  mockNote: {
    fontFamily: fonts.interRegular, fontSize: 11,
    color: colors.outline, textAlign: 'center',
  },

  noDueTitle: { fontFamily: fonts.manropeSemiBold, fontSize: 20, color: colors.onSurface, marginTop: 12, marginBottom: 6 },
  noDueSubtitle: { fontFamily: fonts.interRegular, fontSize: 14, color: colors.onSurfaceVariant, textAlign: 'center' },

  errorTitle: { fontFamily: fonts.manropeSemiBold, fontSize: 18, color: colors.onSurface, marginTop: 12, marginBottom: 6 },
  errorMsg: { fontFamily: fonts.interRegular, fontSize: 13, color: colors.onSurfaceVariant, textAlign: 'center', marginBottom: 20 },
  retryBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 28 },
  retryText: { fontFamily: fonts.interSemiBold, fontSize: 14, color: colors.onPrimary },
});
