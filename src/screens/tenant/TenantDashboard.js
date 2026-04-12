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
import ScreenHeader from '../../components/ScreenHeader';
import SectionHeader from '../../components/SectionHeader';
import StatusChip from '../../components/StatusChip';
import PrimaryButton from '../../components/PrimaryButton';

export default function TenantDashboard({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [tenantProfile, setTenantProfile] = useState(null);
  const [lease, setLease] = useState(null);
  const [pendingPayment, setPendingPayment] = useState(null);
  const [activeIssues, setActiveIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setError(null);
    setLoading(true);

    // Use limit(1) + array access instead of .single() to handle both
    // zero-row and multi-row cases without throwing a Supabase error.
    const { data: tenantRows, error: tErr } = await supabase
      .from('tenants')
      .select('*, properties(name, city, address)')
      .eq('user_id', user.id)
      .limit(1);

    if (tErr) {
      setError(tErr.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const tenantData = tenantRows?.[0] ?? null;

    if (!tenantData) {
      // No linked tenant row yet — not a network error, just not set up
      setTenantProfile(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setTenantProfile(tenantData);

    const [leaseRes, paymentRes, issuesRes] = await Promise.all([
      // Most recent active lease — limit(1) avoids the multi-row crash
      supabase
        .from('leases')
        .select('*')
        .eq('tenant_id', tenantData.id)
        .eq('status', 'active')
        .order('end_date', { ascending: false })
        .limit(1),
      // Earliest pending/overdue payment — maybeSingle returns null (not error) on 0 rows
      supabase
        .from('payments')
        .select('*')
        .eq('tenant_id', tenantData.id)
        .in('status', ['pending', 'overdue'])
        .order('due_date', { ascending: true })
        .limit(1),
      supabase
        .from('maintenance_requests')
        .select('*')
        .eq('tenant_id', tenantData.id)
        .neq('status', 'resolved')
        .order('created_at', { ascending: false }),
    ]);

    setLease(leaseRes.data?.[0] ?? null);
    setPendingPayment(paymentRes.data?.[0] ?? null);
    setActiveIssues(issuesRes.data ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [user?.id]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  if (!user) return null;

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

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
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorMsg}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchData}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!tenantProfile) {
    return (
      <View style={styles.centered}>
        <MaterialIcons name="home" size={48} color={colors.outline} />
        <Text style={styles.errorTitle}>No active lease</Text>
        <Text style={styles.errorMsg}>
          Contact your property manager to get set up.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader showBell />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Greeting */}
        <View style={styles.greetingSection}>
          <Text style={styles.greetingLabel}>WELCOME HOME</Text>
          <Text style={styles.greetingName}>{tenantProfile.full_name}</Text>
          <View style={styles.locationRow}>
            <MaterialIcons name="location-on" size={13} color="rgba(255,255,255,0.6)" />
            <Text style={styles.locationText}>
              Unit {tenantProfile.unit_number} · {tenantProfile.properties?.name}
            </Text>
          </View>
        </View>

        {/* Monthly Rent Card */}
        {pendingPayment || lease ? (
          <View style={styles.rentCard}>
            <View style={styles.rentCardHeader}>
              <Text style={styles.rentCardLabel}>Monthly Rent</Text>
              <StatusChip
                label={pendingPayment?.status === 'overdue' ? 'Overdue' : 'Due Soon'}
                variant={pendingPayment?.status === 'overdue' ? 'urgent' : 'pending'}
              />
            </View>
            <Text style={styles.rentAmount}>
              ₹{Number(pendingPayment?.amount ?? lease?.monthly_rent ?? 0).toLocaleString('en-IN')}
            </Text>
            {pendingPayment?.due_date ? (
              <Text style={styles.rentDue}>Due {formatDate(pendingPayment.due_date)}</Text>
            ) : null}
            <View style={styles.rentActions}>
              <PrimaryButton
                label="Pay Now"
                onPress={() => navigation.navigate('Payments')}
                icon="arrow-forward"
              />
              <TouchableOpacity style={styles.viewStatementBtn}>
                <Text style={styles.viewStatementText}>View Statement</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={[styles.rentCard, styles.noPaymentCard]}>
            <MaterialIcons name="check-circle" size={24} color={colors.tertiaryFixedDim} />
            <Text style={styles.noPaymentText}>No payment due</Text>
          </View>
        )}

        {/* Home Status */}
        <View style={styles.section}>
          <SectionHeader title="Home Status" />
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <MaterialIcons
                name={activeIssues.length === 0 ? 'check-circle' : 'pending-actions'}
                size={20}
                color={activeIssues.length === 0 ? colors.tertiaryFixedDim : colors.secondary}
              />
              <Text style={styles.statusText}>
                {activeIssues.length === 0
                  ? 'All systems optimal.'
                  : `${activeIssues.length} active ticket${activeIssues.length > 1 ? 's' : ''}`}
              </Text>
            </View>
            {activeIssues.length > 0 ? (
              <StatusChip label={`${activeIssues.length} Active`} variant="pending" />
            ) : null}
          </View>
        </View>

        {/* Quick Access */}
        <View style={styles.section}>
          <SectionHeader title="Quick Access" />
          <TouchableOpacity
            style={styles.quickAccessBtn}
            onPress={() => navigation.navigate('Maintenance')}
          >
            <View style={styles.quickIconBg}>
              <MaterialIcons name="build" size={20} color={colors.primary} />
            </View>
            <Text style={styles.quickAccessLabel}>Maintenance Request</Text>
            <MaterialIcons name="chevron-right" size={20} color={colors.outline} />
          </TouchableOpacity>
          {lease ? (
            <TouchableOpacity
              style={styles.quickAccessBtn}
              onPress={() => navigation.navigate('RentalAgreement', { leaseId: lease.id })}
            >
              <View style={styles.quickIconBg}>
                <MaterialIcons name="description" size={20} color={colors.primary} />
              </View>
              <Text style={styles.quickAccessLabel}>Rental Agreement</Text>
              <MaterialIcons name="chevron-right" size={20} color={colors.outline} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Documents */}
        <View style={styles.section}>
          <SectionHeader title="Documents" />
          {lease ? (
            <View style={styles.docRow}>
              <MaterialIcons name="picture-as-pdf" size={24} color={colors.error} />
              <View style={styles.docInfo}>
                <Text style={styles.docName}>Lease_Agreement.pdf</Text>
                <Text style={styles.docMeta}>
                  Signed {lease.signed_at ? formatDate(lease.signed_at) : 'Pending signature'}
                </Text>
              </View>
              <MaterialIcons name="download" size={20} color={colors.primary} />
            </View>
          ) : (
            <Text style={styles.noDocText}>No documents on file</Text>
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

  greetingSection: {
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 28,
  },
  greetingLabel: {
    fontFamily: fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  greetingName: {
    fontFamily: fonts.manropeBold,
    fontSize: 26,
    color: colors.onPrimary,
    marginBottom: 4,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  locationText: {
    fontFamily: fonts.interRegular, fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
  },

  rentCard: {
    backgroundColor: colors.surfaceContainerLowest,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
  },
  noPaymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  noPaymentText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    color: colors.onSurfaceVariant,
  },
  rentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rentCardLabel: {
    fontFamily: fonts.interSemiBold,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  rentAmount: {
    fontFamily: fonts.manropeBold,
    fontSize: 34,
    color: colors.onSurface,
    marginBottom: 4,
  },
  rentDue: {
    fontFamily: fonts.interRegular,
    fontSize: 13,
    color: colors.onSurfaceVariant,
    marginBottom: 16,
  },
  rentActions: { gap: 12 },
  viewStatementBtn: { alignItems: 'center', paddingVertical: 8 },
  viewStatementText: {
    fontFamily: fonts.interMedium, fontSize: 14,
    color: colors.secondary,
  },

  section: { padding: 20 },

  statusCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  statusText: { fontFamily: fonts.interRegular, fontSize: 14, color: colors.onSurface, flex: 1 },

  quickAccessBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  quickIconBg: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center', justifyContent: 'center',
  },
  quickAccessLabel: {
    fontFamily: fonts.interMedium, fontSize: 14,
    color: colors.onSurface, flex: 1,
  },

  docRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 12, padding: 14,
  },
  docInfo: { flex: 1 },
  docName: { fontFamily: fonts.interSemiBold, fontSize: 14, color: colors.onSurface, marginBottom: 2 },
  docMeta: { fontFamily: fonts.interRegular, fontSize: 12, color: colors.onSurfaceVariant },
  noDocText: { fontFamily: fonts.interRegular, fontSize: 14, color: colors.onSurfaceVariant },

  errorTitle: { fontFamily: fonts.manropeSemiBold, fontSize: 18, color: colors.onSurface, marginTop: 12, marginBottom: 6 },
  errorMsg: { fontFamily: fonts.interRegular, fontSize: 13, color: colors.onSurfaceVariant, textAlign: 'center', marginBottom: 20 },
  retryBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 28 },
  retryText: { fontFamily: fonts.interSemiBold, fontSize: 14, color: colors.onPrimary },
});
