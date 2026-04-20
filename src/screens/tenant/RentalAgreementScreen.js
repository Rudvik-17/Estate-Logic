import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import ScreenHeader from '../../components/ScreenHeader';
import PrimaryButton from '../../components/PrimaryButton';
import StatusChip from '../../components/StatusChip';
import { buildLeaseAgreementHTML } from '../../lib/leaseAgreementHTML';

const CLAUSES = [
  {
    title: 'Rent Payment Terms',
    body: 'Monthly rent is due on the 5th of each calendar month. Late payments after the 10th are subject to a 2% penalty of the monthly rent amount. Payments accepted via approved UPI methods only.',
  },
  {
    title: 'Maintenance Responsibilities',
    body: 'Tenant is responsible for minor day-to-day maintenance. Structural repairs, plumbing, and electrical issues must be reported via the Estate Logic maintenance portal within 24 hours of discovery.',
  },
  {
    title: 'Lease Termination',
    body: 'Either party must provide 60 days written notice prior to lease termination. Early termination by the tenant incurs a penalty equivalent to two months rent unless mutually agreed otherwise.',
  },
];

export default function RentalAgreementScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const leaseId = route?.params?.leaseId;

  const [lease, setLease] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [ownerName, setOwnerName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [signed, setSigned] = useState(false);
  const [signing, setSigning] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const fetchLease = useCallback(async () => {
    if (!user) return;
    setError(null);
    let query = supabase
      .from('leases')
      .select('*, properties(name, address, city), tenants(full_name, unit_number, owner_id)');

    if (leaseId) {
      query = query.eq('id', leaseId);
    } else {
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (tenantData) {
        query = query.eq('tenant_id', tenantData.id).eq('status', 'active');
      }
    }

    const { data, error: fetchError } = await query.single();
    if (fetchError) { setError(fetchError.message); setLoading(false); return; }
    setLease(data);
    setTenant(data?.tenants);
    setSigned(!!data?.signed_at);

    if (data?.tenants?.owner_id) {
      const { data: ownerRows } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', data.tenants.owner_id)
        .limit(1);
      setOwnerName(ownerRows?.[0]?.full_name ?? null);
    }

    setLoading(false);
  }, [leaseId, user?.id]);

  useEffect(() => { fetchLease(); }, [fetchLease]);

  if (!user) return null;

  const handleDownload = async () => {
    if (!lease) return;
    setDownloading(true);
    try {
      const property = lease.properties;
      const html = buildLeaseAgreementHTML({
        landlordName: ownerName ?? 'Landlord',
        tenantName: tenant?.full_name ?? 'Tenant',
        propertyName: property?.name ?? 'Property',
        propertyAddress: property ? `${property.address}, ${property.city}` : '—',
        unitNumber: tenant?.unit_number ?? '—',
        monthlyRent: lease.monthly_rent,
        startDate: lease.start_date,
        endDate: lease.end_date,
        securityDeposit: null,
        agreementDate: lease.signed_at ?? lease.start_date,
      });
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save or share your lease agreement',
          UTI: 'com.adobe.pdf',
        });
      }
    } catch {
      Alert.alert('Error', 'Could not generate PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handleSign = async () => {
    setSigning(true);
    const now = new Date().toISOString();
    const { error: signError } = await supabase
      .from('leases')
      .update({ signed_at: now, status: 'active' })
      .eq('id', lease.id);
    setSigning(false);
    if (signError) {
      Alert.alert('Error', signError.message);
      return;
    }
    setSigned(true);
    Alert.alert('Agreement Signed', 'Your rental agreement has been signed successfully.');
  };

  const toggleClause = (i) =>
    setExpanded(prev => ({ ...prev, [i]: !prev[i] }));

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !lease) {
    return (
      <View style={styles.centered}>
        <MaterialIcons name="description" size={40} color={colors.outline} />
        <Text style={styles.errorTitle}>No agreement on file</Text>
        <Text style={styles.errorMsg}>{error ?? 'Your lease agreement is not yet available.'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchLease}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Rental Agreement"
        showBack
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Document metadata */}
        <View style={styles.metaCard}>
          <View style={styles.metaHeader}>
            <MaterialIcons name="description" size={20} color={colors.primary} />
            <Text style={styles.metaTitle}>Lease Agreement</Text>
            <StatusChip
              label={signed ? 'Signed' : 'Pending'}
              variant={signed ? 'active' : 'pending'}
            />
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>Property</Text>
            <Text style={styles.metaVal}>{lease.properties?.name}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>Unit</Text>
            <Text style={styles.metaVal}>{tenant?.unit_number}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>Duration</Text>
            <Text style={styles.metaVal}>{formatDate(lease.start_date)} → {formatDate(lease.end_date)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>Monthly Rent</Text>
            <Text style={[styles.metaVal, { color: colors.onTertiaryContainer }]}>
              ₹{Number(lease.monthly_rent).toLocaleString('en-IN')}
            </Text>
          </View>
          {lease.signed_at ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>Signed On</Text>
              <Text style={styles.metaVal}>{formatDate(lease.signed_at)}</Text>
            </View>
          ) : null}
        </View>

        {/* Terms summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rental Terms</Text>
          {CLAUSES.map((clause, i) => (
            <TouchableOpacity
              key={i}
              style={styles.clauseRow}
              onPress={() => toggleClause(i)}
              activeOpacity={0.8}
            >
              <View style={styles.clauseHeader}>
                <Text style={styles.clauseTitle}>{clause.title}</Text>
                <MaterialIcons
                  name={expanded[i] ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                  size={20}
                  color={colors.onSurfaceVariant}
                />
              </View>
              {expanded[i] ? (
                <Text style={styles.clauseBody}>{clause.body}</Text>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign / Download */}
        <View style={styles.actionSection}>
          {!signed ? (
            <PrimaryButton
              label="Sign Agreement"
              onPress={handleSign}
              loading={signing}
              icon="draw"
            />
          ) : (
            <View style={styles.signedBadge}>
              <MaterialIcons name="verified" size={20} color={colors.tertiaryFixedDim} />
              <Text style={styles.signedText}>Agreement Signed</Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.downloadBtn, downloading && styles.downloadBtnDisabled]}
            onPress={handleDownload}
            disabled={downloading}
          >
            {downloading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <MaterialIcons name="download" size={18} color={colors.primary} />
            )}
            <Text style={styles.downloadText}>
              {downloading ? 'Generating PDF…' : 'Download PDF'}
            </Text>
          </TouchableOpacity>
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

  metaCard: {
    backgroundColor: colors.surfaceContainerLowest,
    margin: 16,
    borderRadius: 16,
    padding: 16,
  },
  metaHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14,
  },
  metaTitle: {
    fontFamily: fonts.manropeSemiBold, fontSize: 16, color: colors.onSurface, flex: 1,
  },
  metaRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10,
  },
  metaKey: { fontFamily: fonts.interRegular, fontSize: 13, color: colors.onSurfaceVariant },
  metaVal: { fontFamily: fonts.interSemiBold, fontSize: 13, color: colors.onSurface },

  section: { paddingHorizontal: 16, marginBottom: 8 },
  sectionTitle: {
    fontFamily: fonts.manropeSemiBold, fontSize: 18, color: colors.onSurface, marginBottom: 12,
  },
  clauseRow: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  clauseHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  clauseTitle: {
    fontFamily: fonts.interSemiBold, fontSize: 14, color: colors.onSurface, flex: 1,
  },
  clauseBody: {
    fontFamily: fonts.interRegular, fontSize: 13,
    color: colors.onSurfaceVariant, lineHeight: 20, marginTop: 10,
  },

  actionSection: { padding: 16, gap: 12 },
  signedBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14,
    backgroundColor: 'rgba(104, 219, 169, 0.12)',
    borderRadius: 8,
  },
  signedText: { fontFamily: fonts.interSemiBold, fontSize: 14, color: colors.onTertiaryContainer },
  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14,
  },
  downloadBtnDisabled: { opacity: 0.5 },
  downloadText: { fontFamily: fonts.interMedium, fontSize: 14, color: colors.primary },

  errorTitle: { fontFamily: fonts.manropeSemiBold, fontSize: 18, color: colors.onSurface, marginTop: 12, marginBottom: 6 },
  errorMsg: { fontFamily: fonts.interRegular, fontSize: 13, color: colors.onSurfaceVariant, textAlign: 'center', marginBottom: 20 },
  retryBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 28 },
  retryText: { fontFamily: fonts.interSemiBold, fontSize: 14, color: colors.onPrimary },
});
