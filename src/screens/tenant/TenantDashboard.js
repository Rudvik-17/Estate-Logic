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
  Alert,
  Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { fonts } from '../../theme/typography';
import { buildLeaseAgreementHTML } from '../../lib/leaseAgreementHTML';
import ScreenHeader from '../../components/ScreenHeader';
import SectionHeader from '../../components/SectionHeader';
import StatusChip from '../../components/StatusChip';
import { RateLimitedButton } from '../../components/RateLimitedButton';
import { RateLimitedIconButton } from '../../components/RateLimitedIconButton';

// DocuSign status → display config
const DOCUSIGN_STATUS_CONFIG = {
  not_sent: { label: 'Not Sent', variant: 'pending', icon: 'schedule' },
  sent: { label: 'Awaiting Signature', variant: 'pending', icon: 'send' },
  delivered: { label: 'Ready to Sign', variant: 'pending', icon: 'mark-email-unread' },
  completed: { label: 'Signed', variant: 'active', icon: 'verified' },
  declined: { label: 'Declined', variant: 'urgent', icon: 'cancel' },
  voided: { label: 'Voided', variant: 'urgent', icon: 'block' },
};

export default function TenantDashboard({ navigation }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [tenantProfile, setTenantProfile] = useState(null);
  const [lease, setLease] = useState(null);
  const [ownerName, setOwnerName] = useState(null);
  const [ownerInfo, setOwnerInfo] = useState(null);
  const [pendingPayment, setPendingPayment] = useState(null);
  const [activeIssues, setActiveIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);

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

    if (tenantData.owner_id) {
      supabase
        .from('users')
        .select('full_name, email, phone')
        .eq('id', tenantData.owner_id)
        .limit(1)
        .then(({ data: ownerRows }) => {
          const owner = ownerRows?.[0] ?? null;
          setOwnerName(owner?.full_name ?? null);
          setOwnerInfo(owner);
        });
    }

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

  const handleLeaseDownload = async () => {
    if (!lease || !tenantProfile) return;
    setDownloading(true);
    try {
      let uri;

      if (lease.document_url) {
        console.log('Downloading signed PDF from:', lease.document_url);
        const filename = `Lease_Agreement_${lease.id.substring(0, 8)}.pdf`;
        const localUri = `${FileSystem.documentDirectory}${filename}`;
        const downloadResult = await FileSystem.downloadAsync(lease.document_url, localUri);
        uri = downloadResult.uri;
      } else {
        const property = tenantProfile.properties;
        const html = buildLeaseAgreementHTML({
          landlordName: ownerName ?? 'Landlord',
          tenantName: tenantProfile.full_name,
          propertyName: property?.name ?? 'Property',
          propertyAddress: property ? `${property.address}, ${property.city}` : '—',
          unitNumber: tenantProfile.unit_number,
          monthlyRent: lease.monthly_rent,
          startDate: lease.start_date,
          endDate: lease.end_date,
          securityDeposit: null,
          agreementDate: lease.signed_at ?? lease.start_date,
        });
        const printResult = await Print.printToFileAsync({ html, base64: false });
        uri = printResult.uri;
      }

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save or share your lease agreement',
          UTI: 'com.adobe.pdf',
        });
      }
    } catch (err) {
      console.error('Error sharing PDF:', err.message);
      Alert.alert('Error', 'Could not share PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  const handleBalanceInfoPress = () => {
    Alert.alert(
      'Rent Balance',
      pendingPayment
        ? `Your current rent payment of ₹${Number(pendingPayment.amount).toLocaleString('en-IN')} is due on ${formatDate(pendingPayment.due_date)}.`
        : 'You have no outstanding rent payments. All payments are up to date!'
    );
  };

  const handleContactPress = () => {
    if (!ownerInfo) {
      Alert.alert('Contact Landlord', 'Landlord contact information is not available.');
      return;
    }
    Alert.alert(
      `Contact ${ownerInfo.full_name || 'Landlord'}`,
      `Phone: ${ownerInfo.phone || 'Not provided'}\nEmail: ${ownerInfo.email || 'Not provided'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        ownerInfo.phone ? { text: 'Call', onPress: () => Linking.openURL(`tel:${ownerInfo.phone}`) } : null,
        ownerInfo.email ? { text: 'Email', onPress: () => Linking.openURL(`mailto:${ownerInfo.email}`) } : null,
      ].filter(Boolean)
    );
  };

  const handleViewDocumentsPress = () => {
    if (lease) {
      navigation.navigate('RentalAgreement', { leaseId: lease.id });
    } else {
      Alert.alert('Documents', 'No active lease or documents found.');
    }
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
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorMsg}>{error}</Text>
        <RateLimitedButton style={styles.retryBtn} onPress={fetchData}>
          <Text style={styles.retryText}>Retry</Text>
        </RateLimitedButton>
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
      <ScreenHeader
        title={`Hello ${tenantProfile?.full_name || ''}`}
        hideLogo
        showBell
      />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Unified Balance Hero Section */}
        <View style={styles.balanceHero}>
          <View style={styles.balanceInfo}>
            <View style={styles.balanceLabelRow}>
              <Text style={styles.balanceLabel}>
                {pendingPayment
                  ? pendingPayment.status === 'overdue'
                    ? 'BALANCE OVERDUE'
                    : 'BALANCE DUE'
                  : 'NO BALANCE DUE'}
              </Text>
              <TouchableOpacity onPress={handleBalanceInfoPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialIcons name="info-outline" size={14} color={colors.onPrimaryContainer} style={{ opacity: 0.6 }} />
              </TouchableOpacity>
            </View>
            <Text style={styles.balanceAmount}>
              ₹{pendingPayment ? Number(pendingPayment.amount).toLocaleString('en-IN') : '0.00'}
            </Text>
            {pendingPayment?.due_date ? (
              <Text style={styles.balanceDueText}>
                Due {formatDate(pendingPayment.due_date)}
              </Text>
            ) : (
              <Text style={styles.balanceDueText}>All systems optimal</Text>
            )}
          </View>
          
          <RateLimitedButton
            style={styles.makePaymentBtn}
            onPress={() => navigation.getParent().navigate('Payments', { screen: 'RentPayment' })}
            activeOpacity={0.8}
          >
            <Text style={styles.makePaymentBtnText}>Make Payment</Text>
          </RateLimitedButton>
        </View>

        {/* Quick Links Section */}
        <View style={styles.quickLinksSection}>
          <Text style={styles.quickLinksTitle}>Quick Links</Text>
          <View style={styles.quickLinksRow}>
            {/* Link 1: Request Maintenance */}
            <View style={styles.quickLinkItem}>
              <RateLimitedButton
                style={styles.quickLinkCircle}
                onPress={() => {
                  navigation.navigate('Maintenance', {
                    screen: 'MaintenanceRequest',
                    params: { showForm: true },
                  });
                }}
                activeOpacity={0.7}
              >
                <MaterialIcons name="build" size={26} color={colors.onPrimary} />
              </RateLimitedButton>
              <Text style={styles.quickLinkLabel} numberOfLines={2}>
                Request{'\n'}Maintenance
              </Text>
            </View>

            {/* Link 2: Contact Us */}
            <View style={styles.quickLinkItem}>
              <RateLimitedButton
                style={styles.quickLinkCircle}
                onPress={handleContactPress}
                activeOpacity={0.7}
              >
                <MaterialIcons name="smartphone" size={26} color={colors.onPrimary} />
              </RateLimitedButton>
              <Text style={styles.quickLinkLabel} numberOfLines={2}>
                Contact Us
              </Text>
            </View>

            {/* Link 3: View Documents */}
            <View style={styles.quickLinkItem}>
              <RateLimitedButton
                style={styles.quickLinkCircle}
                onPress={handleViewDocumentsPress}
                activeOpacity={0.7}
              >
                <MaterialIcons name="description" size={26} color={colors.onPrimary} />
              </RateLimitedButton>
              <Text style={styles.quickLinkLabel} numberOfLines={2}>
                View{'\n'}Documents
              </Text>
            </View>
          </View>
        </View>

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

        {/* Documents */}
        <View style={styles.section}>
          <SectionHeader title="Documents" />
          {lease ? (
            <View style={styles.docCard}>
              <View style={styles.docRow}>
                <MaterialIcons name="picture-as-pdf" size={24} color={colors.error} />
                <View style={styles.docInfo}>
                  <Text style={styles.docName}>Lease_Agreement.pdf</Text>
                  <Text style={styles.docMeta}>
                    Signed {lease.signed_at ? formatDate(lease.signed_at) : 'Pending signature'}
                  </Text>
                </View>
                <RateLimitedIconButton
                  onPress={handleLeaseDownload}
                  disabled={downloading}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  icon={downloading
                    ? <ActivityIndicator size="small" color={colors.primary} />
                    : <MaterialIcons name="download" size={20} color={colors.primary} />}
                />
              </View>

              {/* DocuSign Status Badge */}
              {lease.docusign_status && lease.docusign_status !== 'not_sent' ? (
                <View style={styles.docusignRow}>
                  <MaterialIcons
                    name={DOCUSIGN_STATUS_CONFIG[lease.docusign_status]?.icon || 'info'}
                    size={16}
                    color={lease.docusign_status === 'completed' ? colors.tertiaryFixedDim : colors.secondary}
                  />
                  <StatusChip
                    label={DOCUSIGN_STATUS_CONFIG[lease.docusign_status]?.label || lease.docusign_status}
                    variant={DOCUSIGN_STATUS_CONFIG[lease.docusign_status]?.variant || 'pending'}
                  />
                </View>
              ) : null}

              {/* Sign Now Button — visible when DocuSign envelope is sent or delivered */}
              {lease.docusign_status === 'sent' || lease.docusign_status === 'delivered' ? (
                <RateLimitedButton
                  style={styles.signNowBtn}
                  onPress={() => {
                    Alert.alert(
                      'Sign Your Lease',
                      'Check your email for a message from DocuSign to sign your lease agreement. Look for the subject line "Please sign your lease agreement - Tenura".',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Open Email',
                          onPress: () => {
                            const email = tenantProfile?.email || '';
                            Linking.openURL(`mailto:${email}`).catch(() => {
                              Alert.alert('Error', 'Could not open email app.');
                            });
                          },
                        },
                      ]
                    );
                  }}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="draw" size={18} color={colors.onPrimary} />
                  <Text style={styles.signNowBtnText}>Sign Now</Text>
                </RateLimitedButton>
              ) : null}
            </View>
          ) : (
            <Text style={styles.noDocText}>No documents on file</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, padding: 24,
  },

  balanceHero: {
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 20,
    paddingVertical: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceInfo: {
    flex: 1,
  },
  balanceLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  balanceLabel: {
    fontFamily: fonts.interSemiBold,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.onPrimaryContainer,
    opacity: 0.6,
    textTransform: 'uppercase',
  },
  balanceAmount: {
    fontFamily: fonts.manropeBold,
    fontSize: 34,
    color: colors.onPrimaryContainer,
    marginBottom: 2,
  },
  balanceDueText: {
    fontFamily: fonts.interRegular,
    fontSize: 12,
    color: colors.onPrimaryContainer,
    opacity: 0.7,
  },
  makePaymentBtn: {
    backgroundColor: colors.surfaceContainerLowest,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  makePaymentBtnText: {
    fontFamily: fonts.interSemiBold,
    fontSize: 13,
    color: colors.primary,
  },

  quickLinksSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  quickLinksTitle: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 16,
    color: colors.onSurface,
    marginBottom: 16,
  },
  quickLinksRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
  },
  quickLinkItem: {
    alignItems: 'center',
    width: 100,
  },
  quickLinkCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  quickLinkLabel: {
    fontFamily: fonts.interMedium,
    fontSize: 12,
    color: colors.onSurface,
    textAlign: 'center',
    lineHeight: 16,
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
  docCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  docusignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
  },
  signNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
  },
  signNowBtnText: {
    fontFamily: fonts.interSemiBold,
    fontSize: 14,
    color: colors.onPrimary,
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
