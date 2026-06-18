import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { fonts } from '../../theme/typography';
import ScreenHeader from '../../components/ScreenHeader';
import { RateLimitedButton } from '../../components/RateLimitedButton';

export default function OfficeInfoScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [tenantProfile, setTenantProfile] = useState(null);
  const [ownerInfo, setOwnerInfo] = useState(null);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      try {
        const { data: tenantRows, error: tErr } = await supabase
          .from('tenants')
          .select('*, properties(name, address, city)')
          .eq('user_id', user.id)
          .limit(1);

        if (tErr) throw tErr;

        const tenantData = tenantRows?.[0] ?? null;
        setTenantProfile(tenantData);

        if (tenantData?.owner_id) {
          const { data: ownerRows, error: oErr } = await supabase
            .from('users')
            .select('full_name, email, phone')
            .eq('id', tenantData.owner_id)
            .limit(1);

          if (oErr) throw oErr;
          setOwnerInfo(ownerRows?.[0] ?? null);
        }
      } catch (err) {
        console.error('Error loading office info:', err.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user?.id]);

  const handleCall = () => {
    if (ownerInfo?.phone) {
      Linking.openURL(`tel:${ownerInfo.phone}`);
    } else {
      Alert.alert('Unavailable', 'No phone number on file for this property office.');
    }
  };

  const handleEmail = () => {
    if (ownerInfo?.email) {
      Linking.openURL(`mailto:${ownerInfo.email}`);
    } else {
      Alert.alert('Unavailable', 'No email address on file for this property office.');
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const officeHours = [
    { days: 'Monday - Friday', hours: '9:00 AM - 6:00 PM' },
    { days: 'Saturday', hours: '10:00 AM - 4:00 PM' },
    { days: 'Sunday', hours: 'Closed' },
  ];

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Office Information"
        showBack
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Landlord / Manager Contact Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Property Management</Text>
          
          <View style={styles.infoRow}>
            <View style={styles.iconContainer}>
              <MaterialIcons name="person" size={20} color={colors.primary} />
            </View>
            <View style={styles.infoTextContainer}>
              <Text style={styles.label}>Manager</Text>
              <Text style={styles.value}>{ownerInfo?.full_name || 'Property Manager'}</Text>
            </View>
          </View>

          {ownerInfo?.phone ? (
            <RateLimitedButton style={styles.infoRow} onPress={handleCall}>
              <View style={styles.iconContainer}>
                <MaterialIcons name="phone" size={20} color={colors.primary} />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={styles.label}>Phone</Text>
                <Text style={styles.value}>{ownerInfo.phone}</Text>
              </View>
            </RateLimitedButton>
          ) : null}

          {ownerInfo?.email ? (
            <RateLimitedButton style={styles.infoRow} onPress={handleEmail}>
              <View style={styles.iconContainer}>
                <MaterialIcons name="email" size={20} color={colors.primary} />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={styles.label}>Email</Text>
                <Text style={styles.value}>{ownerInfo.email}</Text>
              </View>
            </RateLimitedButton>
          ) : null}
        </View>

        {/* Office Hours */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Office Hours</Text>
          <View style={styles.hoursList}>
            {officeHours.map((item, index) => (
              <View key={index} style={styles.hoursRow}>
                <Text style={styles.hoursDays}>{item.days}</Text>
                <Text style={styles.hoursText}>{item.hours}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Property Location */}
        {tenantProfile?.properties ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Office Location</Text>
            <View style={styles.infoRow}>
              <View style={styles.iconContainer}>
                <MaterialIcons name="location-on" size={20} color={colors.primary} />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={styles.label}>{tenantProfile.properties.name}</Text>
                <Text style={styles.value}>
                  {tenantProfile.properties.address}, {tenantProfile.properties.city}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Quick Contact Actions */}
        <View style={styles.actionRow}>
          <RateLimitedButton style={[styles.actionBtn, styles.callBtn]} onPress={handleCall}>
            <MaterialIcons name="phone" size={20} color={colors.onPrimary} />
            <Text style={styles.actionBtnText}>Call Office</Text>
          </RateLimitedButton>
          <RateLimitedButton style={[styles.actionBtn, styles.emailBtn]} onPress={handleEmail}>
            <MaterialIcons name="email" size={20} color={colors.primary} />
            <Text style={[styles.actionBtnText, { color: colors.primary }]}>Email Office</Text>
          </RateLimitedButton>
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardTitle: {
    fontFamily: fonts.manropeBold,
    fontSize: 16,
    color: colors.onSurface,
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextContainer: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontFamily: fonts.interSemiBold,
    fontSize: 11,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontFamily: fonts.interRegular,
    fontSize: 14,
    color: colors.onSurface,
  },
  hoursList: {
    gap: 10,
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  hoursDays: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    color: colors.onSurface,
  },
  hoursText: {
    fontFamily: fonts.interRegular,
    fontSize: 14,
    color: colors.onSurfaceVariant,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  callBtn: {
    backgroundColor: colors.primary,
  },
  emailBtn: {
    backgroundColor: colors.primaryFixed,
  },
  actionBtnText: {
    fontFamily: fonts.interSemiBold,
    fontSize: 14,
    color: colors.onPrimary,
  },
});
