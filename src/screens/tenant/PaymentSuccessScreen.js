import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
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
import { buildReceiptHTML } from '../../lib/receiptHTML';

export default function PaymentSuccessScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { amount = 0, method = 'gpay', txnId = '', paidAt = new Date().toISOString() } = route?.params ?? {};

  const [tenantInfo, setTenantInfo] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('tenants')
      .select('full_name, unit_number, properties(name)')
      .eq('user_id', user.id)
      .limit(1)
      .then(({ data }) => {
        if (data?.[0]) setTenantInfo(data[0]);
      });
  }, [user?.id]);

  const formattedDate = new Date(paidAt).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const formattedTime = new Date(paidAt).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit',
  });

  const DETAILS = [
    { key: 'Amount', value: `₹${Number(amount).toLocaleString('en-IN')}`, highlight: true },
    { key: 'Payment Method', value: `UPI · ${METHOD_LABELS[method] ?? method}` },
    { key: 'Transaction Date', value: `${formattedDate} · ${formattedTime}` },
    { key: 'Transaction ID', value: txnId },
    { key: 'Status', value: 'Confirmed', highlight: true },
  ];

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const html = buildReceiptHTML({
        txnId,
        amount,
        method,
        paidAt,
        tenantName: tenantInfo?.full_name ?? 'Tenant',
        propertyName: tenantInfo?.properties?.name ?? 'Property',
        unitNumber: tenantInfo?.unit_number ?? '—',
      });

      const { uri } = await Print.printToFileAsync({ html, base64: false });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save or share your receipt',
          UTI: 'com.adobe.pdf',
        });
      }
    } catch {
      Alert.alert('Error', 'Could not generate receipt. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}>
        {/* Back link */}
        <TouchableOpacity
          style={styles.backRow}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={18} color="rgba(255,255,255,0.7)" />
          <Text style={styles.backText}>Estate Logic</Text>
        </TouchableOpacity>

        {/* Success icon */}
        <View style={styles.iconWrapper}>
          <View style={styles.iconCircle}>
            <MaterialIcons name="check" size={40} color={colors.primary} />
          </View>
        </View>

        <Text style={styles.successTitle}>Payment Successful</Text>
        <Text style={styles.successSubtitle}>
          Your rent payment has been received successfully via UPI.
        </Text>

        {/* Transaction details */}
        <View style={styles.detailCard}>
          {DETAILS.map(({ key, value, highlight }) => (
            <View key={key} style={styles.detailRow}>
              <Text style={styles.detailKey}>{key}</Text>
              <Text style={[styles.detailValue, highlight && styles.detailValueHighlight]}>
                {value}
              </Text>
            </View>
          ))}
        </View>

        {/* Actions */}
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
            {downloading ? 'Generating receipt…' : 'Download Receipt'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dashboardBtn}
          onPress={() => navigation.getParent()?.navigate('Dashboard')}
        >
          <MaterialIcons name="dashboard" size={18} color={colors.onPrimary} />
          <Text style={styles.dashboardText}>Back to Dashboard</Text>
        </TouchableOpacity>

        {/* Security footer */}
        <View style={styles.securityRow}>
          <MaterialIcons name="lock" size={12} color="rgba(255,255,255,0.4)" />
          <Text style={styles.securityText}>End-to-End Encrypted Secure Payment</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  scroll: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },

  backRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', paddingVertical: 16,
  },
  backText: {
    fontFamily: fonts.manropeSemiBold, fontSize: 13,
    letterSpacing: 1.5, color: 'rgba(255,255,255,0.7)',
  },

  iconWrapper: { marginTop: 20, marginBottom: 20 },
  iconCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: colors.tertiaryFixedDim,
    alignItems: 'center', justifyContent: 'center',
  },

  successTitle: {
    fontFamily: fonts.manropeBold, fontSize: 28,
    color: colors.onPrimary, marginBottom: 8, textAlign: 'center',
  },
  successSubtitle: {
    fontFamily: fonts.interRegular, fontSize: 14,
    color: 'rgba(255,255,255,0.65)', textAlign: 'center',
    lineHeight: 20, marginBottom: 28, paddingHorizontal: 12,
  },

  detailCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16, padding: 16,
    width: '100%', marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', paddingVertical: 10,
  },
  detailKey: {
    fontFamily: fonts.interRegular, fontSize: 13,
    color: 'rgba(255,255,255,0.55)', flex: 1,
  },
  detailValue: {
    fontFamily: fonts.interSemiBold, fontSize: 13,
    color: 'rgba(255,255,255,0.85)', flex: 1.2, textAlign: 'right',
  },
  detailValueHighlight: {
    color: colors.tertiaryFixedDim,
  },

  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 8, paddingVertical: 14,
    paddingHorizontal: 28, marginBottom: 12, width: '100%',
    justifyContent: 'center',
  },
  downloadBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  downloadText: {
    fontFamily: fonts.interSemiBold, fontSize: 14,
    color: colors.primary,
  },

  dashboardBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.tertiaryFixedDim,
    borderRadius: 8, paddingVertical: 14,
    paddingHorizontal: 28, marginBottom: 28, width: '100%',
    justifyContent: 'center',
  },
  dashboardText: {
    fontFamily: fonts.interSemiBold, fontSize: 14,
    color: colors.primary,
  },

  securityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  securityText: {
    fontFamily: fonts.interRegular, fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
  },
});
