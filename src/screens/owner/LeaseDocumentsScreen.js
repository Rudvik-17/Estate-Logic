import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
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
import StatusChip from '../../components/StatusChip';
import { RateLimitedButton } from '../../components/RateLimitedButton';
import { buildLeaseAgreementHTML } from '../../lib/leaseAgreementHTML';

export default function LeaseDocumentsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [leases, setLeases] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [ownerName, setOwnerName] = useState('');
  const [generatingPdfId, setGeneratingPdfId] = useState(null);

  const fetchLeasesAndOwner = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      // 1. Fetch Owner's Name
      const { data: ownerData } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .single();
      setOwnerName(ownerData?.full_name || 'Owner');

      // 2. Fetch Leases (RLS automatically restricts to owner's properties)
      const { data: leaseRows, error: leaseErr } = await supabase
        .from('leases')
        .select(`
          *,
          properties (
            id,
            name,
            address,
            city,
            owner_id
          ),
          tenants (
            id,
            full_name,
            unit_number
          )
        `)
        .order('created_at', { ascending: false });

      if (leaseErr) throw leaseErr;

      // Ensure properties own_id matches (double security)
      const ownerLeases = (leaseRows ?? []).filter(
        l => l.properties && l.properties.owner_id === user.id
      );

      setLeases(ownerLeases);
      setFiltered(ownerLeases);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchLeasesAndOwner();
  }, [fetchLeasesAndOwner]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeasesAndOwner();
  };

  useEffect(() => {
    const q = query.toLowerCase();
    setFiltered(
      q
        ? leases.filter(
            l =>
              l.tenants?.full_name?.toLowerCase().includes(q) ||
              l.tenants?.unit_number?.toLowerCase().includes(q) ||
              l.properties?.name?.toLowerCase().includes(q)
          )
        : leases
    );
  }, [query, leases]);

  const handleSharePDF = async (lease) => {
    if (!lease) return;
    setGeneratingPdfId(lease.id);
    try {
      const property = lease.properties;
      const tenant = lease.tenants;
      const html = buildLeaseAgreementHTML({
        landlordName: ownerName || 'Landlord',
        tenantName: tenant?.full_name || 'Tenant',
        propertyName: property?.name || 'Property',
        propertyAddress: property ? `${property.address}, ${property.city}` : '—',
        unitNumber: tenant?.unit_number || '—',
        monthlyRent: lease.monthly_rent,
        startDate: lease.start_date,
        endDate: lease.end_date,
        securityDeposit: null,
        agreementDate: lease.signed_at || lease.start_date,
      });

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share Lease Agreement - ${tenant?.full_name}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Sharing Unavailable', 'PDF generated, but sharing services are not available on this device.');
      }
    } catch (err) {
      console.error('Error generating PDF:', err.message);
      Alert.alert('Error', 'Could not generate PDF. Please try again.');
    } finally {
      setGeneratingPdfId(null);
    }
  };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  const renderLease = ({ item }) => {
    const isGenerating = generatingPdfId === item.id;
    return (
      <View style={styles.leaseCard}>
        <View style={styles.cardHeader}>
          <View style={styles.headerInfo}>
            <Text style={styles.tenantName}>{item.tenants?.full_name || 'Resident'}</Text>
            <Text style={styles.unitMeta}>
              Unit {item.tenants?.unit_number || 'N/A'} · {item.properties?.name || 'Property'}
            </Text>
          </View>
          <StatusChip
            label={item.status}
            variant={item.status === 'active' ? 'active' : item.status === 'pending_signature' ? 'pending' : 'urgent'}
          />
        </View>

        <View style={styles.detailsList}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Duration</Text>
            <Text style={styles.detailValue}>
              {formatDate(item.start_date)} – {formatDate(item.end_date)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Monthly Rent</Text>
            <Text style={[styles.detailValue, { color: colors.onTertiaryContainer, fontFamily: fonts.interSemiBold }]}>
              ₹{Number(item.monthly_rent).toLocaleString('en-IN')}
            </Text>
          </View>
          {item.signed_at ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Signed On</Text>
              <Text style={styles.detailValue}>{formatDate(item.signed_at)}</Text>
            </View>
          ) : null}
        </View>

        <RateLimitedButton
          style={[styles.pdfButton, isGenerating && styles.pdfButtonDisabled]}
          onPress={() => handleSharePDF(item)}
          disabled={isGenerating}
          activeOpacity={0.8}
        >
          {isGenerating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <MaterialIcons name="share" size={18} color={colors.primary} />
          )}
          <Text style={styles.pdfButtonText}>
            {isGenerating ? 'Compiling PDF…' : 'Share / Download PDF'}
          </Text>
        </RateLimitedButton>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Lease Documents"
        showBack
        onBack={() => navigation.goBack()}
      />

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderLease}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <MaterialIcons name="search" size={18} color={colors.outline} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search by tenant or unit..."
                placeholderTextColor={colors.outline}
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="description" size={40} color={colors.outline} />
            <Text style={styles.emptyTitle}>No leases found</Text>
            <Text style={styles.emptySubtitle}>Leases will appear here once you onboard residents.</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    padding: 24,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  leaseCard: {
    backgroundColor: colors.surfaceContainerLowest,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  tenantName: {
    fontFamily: fonts.manropeBold,
    fontSize: 16,
    color: colors.onSurface,
  },
  unitMeta: {
    fontFamily: fonts.interRegular,
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  detailsList: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontFamily: fonts.interRegular,
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  detailValue: {
    fontFamily: fonts.interMedium,
    fontSize: 12,
    color: colors.onSurface,
  },
  pdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderWidth: 0,
    borderRadius: 8,
    backgroundColor: colors.surfaceContainerLow,
  },
  pdfButtonDisabled: {
    opacity: 0.6,
  },
  pdfButtonText: {
    fontFamily: fonts.interSemiBold,
    fontSize: 14,
    color: colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: fonts.manropeBold,
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
});
