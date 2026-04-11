import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';

const METHOD_LABELS = {
  gpay: 'Google Pay',
  phonepe: 'PhonePe',
  paytm: 'Paytm',
};

export default function PaymentSuccessScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { amount = 0, method = 'gpay', txnId = '', paidAt = new Date().toISOString() } = route?.params ?? {};

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
        <TouchableOpacity style={styles.downloadBtn}>
          <MaterialIcons name="download" size={18} color={colors.primary} />
          <Text style={styles.downloadText}>Download Receipt</Text>
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
    borderBottomWidth: 0,
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
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8, paddingVertical: 14,
    paddingHorizontal: 28, marginBottom: 12, width: '100%',
    justifyContent: 'center',
  },
  downloadText: {
    fontFamily: fonts.interSemiBold, fontSize: 14,
    color: colors.onPrimary,
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
