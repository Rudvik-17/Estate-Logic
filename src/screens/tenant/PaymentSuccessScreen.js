import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { fonts } from '../../theme/typography';
import { buildReceiptHTML } from '../../lib/receiptHTML';
import { RateLimitedButton } from '../../components/RateLimitedButton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const METHOD_LABELS = {
  gpay: 'Google Pay',
  phonepe: 'PhonePe',
  paytm: 'Paytm',
  razorpay: 'Razorpay',
};

const METHOD_ICONS = {
  gpay: 'payment',
  phonepe: 'smartphone',
  paytm: 'account-balance-wallet',
  razorpay: 'credit-card',
};

export default function PaymentSuccessScreen({ navigation, route }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { amount = 0, method = 'razorpay', txnId = '', paidAt = new Date().toISOString() } = route?.params ?? {};

  const [tenantInfo, setTenantInfo] = useState(null);
  const [downloading, setDownloading] = useState(false);

  // Animations
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.3)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslate = useRef(new Animated.Value(40)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslate = useRef(new Animated.Value(60)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const buttonsTranslate = useRef(new Animated.Value(50)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  const confettiDots = useRef(
    Array.from({ length: 8 }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0),
    }))
  ).current;

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

  useEffect(() => {
    // Staggered entrance animation
    Animated.sequence([
      // Ring pulse
      Animated.parallel([
        Animated.spring(ringScale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
        Animated.timing(ringOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      // Checkmark pop
      Animated.parallel([
        Animated.spring(checkScale, { toValue: 1, friction: 3, tension: 120, useNativeDriver: true }),
        Animated.timing(checkOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
      // Confetti burst
      Animated.parallel(
        confettiDots.map((dot, i) => {
          const angle = (i / 8) * Math.PI * 2;
          const distance = 50 + Math.random() * 30;
          return Animated.parallel([
            Animated.timing(dot.opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
            Animated.timing(dot.scale, { toValue: 1, duration: 200, useNativeDriver: true }),
            Animated.timing(dot.x, { toValue: Math.cos(angle) * distance, duration: 400, useNativeDriver: true }),
            Animated.timing(dot.y, { toValue: Math.sin(angle) * distance, duration: 400, useNativeDriver: true }),
          ]);
        })
      ),
      // Fade confetti out
      Animated.parallel(
        confettiDots.map((dot) =>
          Animated.timing(dot.opacity, { toValue: 0, duration: 300, useNativeDriver: true })
        )
      ),
    ]).start();

    // Content slide in (runs in parallel)
    Animated.stagger(120, [
      Animated.parallel([
        Animated.spring(contentTranslate, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
        Animated.timing(contentOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(cardTranslate, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(buttonsTranslate, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
        Animated.timing(buttonsOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const formattedDate = new Date(paidAt).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const formattedTime = new Date(paidAt).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit',
  });

  const methodLabel = METHOD_LABELS[method] ?? method;
  const methodIcon = METHOD_ICONS[method] ?? 'payment';

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

  const confettiColors = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF8FD8', '#A66CFF', '#00E5FF', '#FF9F43'];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MaterialIcons name="arrow-back" size={20} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payment Receipt</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Success Animation Area */}
        <View style={styles.successArea}>
          {/* Outer ring pulse */}
          <Animated.View style={[styles.ringOuter, {
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          }]} />
          {/* Inner ring */}
          <Animated.View style={[styles.ringInner, {
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          }]} />
          {/* Checkmark */}
          <Animated.View style={[styles.checkCircle, {
            opacity: checkOpacity,
            transform: [{ scale: checkScale }],
          }]}>
            <MaterialIcons name="check" size={44} color="#FFFFFF" />
          </Animated.View>

          {/* Confetti particles */}
          {confettiDots.map((dot, i) => (
            <Animated.View
              key={i}
              style={[styles.confettiDot, {
                backgroundColor: confettiColors[i],
                opacity: dot.opacity,
                transform: [
                  { translateX: dot.x },
                  { translateY: dot.y },
                  { scale: dot.scale },
                ],
              }]}
            />
          ))}
        </View>

        {/* Title & Amount */}
        <Animated.View style={[styles.titleArea, {
          opacity: contentOpacity,
          transform: [{ translateY: contentTranslate }],
        }]}>
          <Text style={styles.successTitle}>Payment Successful!</Text>
          <Text style={styles.amountText}>
            ₹{Number(amount).toLocaleString('en-IN')}
          </Text>
          <View style={styles.methodChip}>
            <MaterialIcons name={methodIcon} size={14} color={colors.tertiary} />
            <Text style={styles.methodChipText}>Paid via {methodLabel}</Text>
          </View>
        </Animated.View>

        {/* Transaction Details Card */}
        <Animated.View style={[styles.detailCard, {
          opacity: cardOpacity,
          transform: [{ translateY: cardTranslate }],
        }]}>
          <Text style={styles.detailCardTitle}>TRANSACTION DETAILS</Text>

          <View style={styles.detailDivider} />

          <View style={styles.detailRow}>
            <View style={styles.detailIconRow}>
              <MaterialIcons name="calendar-today" size={16} color={colors.onSurfaceVariant} />
              <Text style={styles.detailKey}>Date & Time</Text>
            </View>
            <Text style={styles.detailValue}>{formattedDate}</Text>
          </View>
          <Text style={styles.detailValueSub}>{formattedTime}</Text>

          <View style={styles.detailDividerLight} />

          <View style={styles.detailRow}>
            <View style={styles.detailIconRow}>
              <MaterialIcons name="receipt-long" size={16} color={colors.onSurfaceVariant} />
              <Text style={styles.detailKey}>Transaction ID</Text>
            </View>
            <Text style={[styles.detailValue, styles.detailMono]} numberOfLines={1}>
              {txnId}
            </Text>
          </View>

          <View style={styles.detailDividerLight} />

          <View style={styles.detailRow}>
            <View style={styles.detailIconRow}>
              <MaterialIcons name={methodIcon} size={16} color={colors.onSurfaceVariant} />
              <Text style={styles.detailKey}>Payment Method</Text>
            </View>
            <Text style={styles.detailValue}>{methodLabel}</Text>
          </View>

          <View style={styles.detailDividerLight} />

          <View style={styles.detailRow}>
            <View style={styles.detailIconRow}>
              <MaterialIcons name="verified" size={16} color={colors.tertiary} />
              <Text style={styles.detailKey}>Status</Text>
            </View>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Confirmed</Text>
            </View>
          </View>

          {tenantInfo && (
            <>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <View style={styles.detailIconRow}>
                  <MaterialIcons name="apartment" size={16} color={colors.onSurfaceVariant} />
                  <Text style={styles.detailKey}>Property</Text>
                </View>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {tenantInfo.properties?.name ?? '—'}
                </Text>
              </View>
              <View style={styles.detailDividerLight} />
              <View style={styles.detailRow}>
                <View style={styles.detailIconRow}>
                  <MaterialIcons name="meeting-room" size={16} color={colors.onSurfaceVariant} />
                  <Text style={styles.detailKey}>Unit</Text>
                </View>
                <Text style={styles.detailValue}>{tenantInfo.unit_number ?? '—'}</Text>
              </View>
            </>
          )}
        </Animated.View>

        {/* Action Buttons */}
        <Animated.View style={[styles.actionsArea, {
          opacity: buttonsOpacity,
          transform: [{ translateY: buttonsTranslate }],
        }]}>
          <RateLimitedButton
            style={[styles.downloadBtn, downloading && styles.downloadBtnDisabled]}
            onPress={handleDownload}
            disabled={downloading}
          >
            {downloading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <MaterialIcons name="picture-as-pdf" size={18} color={colors.primary} />
            )}
            <Text style={styles.downloadText}>
              {downloading ? 'Generating…' : 'Download Receipt'}
            </Text>
          </RateLimitedButton>

          <TouchableOpacity
            style={styles.dashboardBtn}
            onPress={() => navigation.getParent()?.navigate('Dashboard')}
            activeOpacity={0.85}
          >
            <MaterialIcons name="home" size={18} color="#FFFFFF" />
            <Text style={styles.dashboardText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Security Footer */}
        <View style={styles.securityRow}>
          <MaterialIcons name="lock" size={12} color={colors.outline} />
          <Text style={styles.securityText}>End-to-End Encrypted · Secured by Razorpay</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scroll: {
    alignItems: 'center',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 16,
    color: colors.onSurface,
  },

  // Success animation area
  successArea: {
    width: 160, height: 160,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
  ringOuter: {
    position: 'absolute',
    width: 140, height: 140, borderRadius: 70,
    borderWidth: 2,
    borderColor: colors.tertiary,
    opacity: 0.15,
  },
  ringInner: {
    position: 'absolute',
    width: 115, height: 115, borderRadius: 58,
    borderWidth: 2,
    borderColor: colors.tertiary,
    opacity: 0.25,
  },
  checkCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: colors.tertiary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.tertiary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  confettiDot: {
    position: 'absolute',
    width: 8, height: 8, borderRadius: 4,
  },

  // Title & amount
  titleArea: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 28,
  },
  successTitle: {
    fontFamily: fonts.manropeBold,
    fontSize: 26,
    color: colors.onSurface,
    marginBottom: 8,
    textAlign: 'center',
  },
  amountText: {
    fontFamily: fonts.manropeBold,
    fontSize: 42,
    color: colors.tertiary,
    marginBottom: 12,
    letterSpacing: -1,
  },
  methodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.tertiaryContainer,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  methodChipText: {
    fontFamily: fonts.interMedium,
    fontSize: 13,
    color: colors.tertiary,
  },

  // Detail card
  detailCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 20,
    padding: 20,
    width: SCREEN_WIDTH - 40,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  detailCardTitle: {
    fontFamily: fonts.interSemiBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.outline,
    marginBottom: 12,
  },
  detailDivider: {
    height: 1,
    backgroundColor: colors.surfaceContainerHigh,
    marginBottom: 14,
  },
  detailDividerLight: {
    height: 1,
    backgroundColor: colors.surfaceContainerLow,
    marginVertical: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailKey: {
    fontFamily: fonts.interRegular,
    fontSize: 13,
    color: colors.onSurfaceVariant,
  },
  detailValue: {
    fontFamily: fonts.interSemiBold,
    fontSize: 13,
    color: colors.onSurface,
    textAlign: 'right',
    flexShrink: 1,
    maxWidth: '50%',
  },
  detailValueSub: {
    fontFamily: fonts.interRegular,
    fontSize: 12,
    color: colors.onSurfaceVariant,
    textAlign: 'right',
    marginTop: 2,
  },
  detailMono: {
    fontFamily: fonts.interMedium,
    fontSize: 11,
    letterSpacing: 0.3,
  },

  // Status badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.tertiaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: colors.tertiary,
  },
  statusText: {
    fontFamily: fonts.interSemiBold,
    fontSize: 12,
    color: colors.tertiary,
  },

  // Actions
  actionsArea: {
    width: SCREEN_WIDTH - 40,
    gap: 12,
    marginBottom: 24,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 14,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: colors.primaryFixed,
  },
  downloadBtnDisabled: {
    opacity: 0.5,
  },
  downloadText: {
    fontFamily: fonts.interSemiBold,
    fontSize: 15,
    color: colors.primary,
  },
  dashboardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  dashboardText: {
    fontFamily: fonts.interSemiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },

  // Security
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  securityText: {
    fontFamily: fonts.interRegular,
    fontSize: 11,
    color: colors.outline,
  },
});
