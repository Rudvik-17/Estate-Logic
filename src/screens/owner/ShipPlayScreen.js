import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import ScreenHeader from '../../components/ScreenHeader';
import SectionHeader from '../../components/SectionHeader';
import { RateLimitedButton } from '../../components/RateLimitedButton';

export default function ShipPlayScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const facilities = [
    {
      id: 'clubhouse',
      name: 'Community Clubhouse',
      desc: 'Active facility for resident gatherings. Max capacity: 50 people.',
      status: 'Managed',
      icon: 'meeting-room',
    },
    {
      id: 'tennis',
      name: 'Tennis & Pickleball Court',
      desc: 'Equipped with night lighting. Maintenance schedule: alternate Tuesdays.',
      status: 'Active',
      icon: 'sports-tennis',
    },
    {
      id: 'bbq',
      name: 'Rooftop BBQ Grills',
      desc: 'Available for resident booking. Requires cleanup audits.',
      status: 'Active',
      icon: 'outdoor-grill',
    },
  ];

  const vendorPartners = [
    {
      id: 'security',
      name: 'Apex Security Solutions',
      desc: 'Discounted building security audits, automated access control, and 24/7 CCTV surveillance installation packages.',
      action: 'Call Representative',
      link: 'tel:+919876543210',
      icon: 'security',
    },
    {
      id: 'cleaning',
      name: 'GreenScapes Facility Management',
      desc: 'Complete building maintenance, landscaping, common area cleaning, and waste management services for estate owners.',
      action: 'Email for Proposal',
      link: 'mailto:partners@example.com?subject=Tenura%20Facility%20Management',
      icon: 'cleaning-services',
    },
    {
      id: 'legal',
      name: 'LegalAnchor Landlord Counsel',
      desc: 'Standardized tenant agreement templates, background verification, and dispute resolution counsel for properties.',
      action: 'Visit Portal',
      link: 'https://example.com/legal-anchor',
      icon: 'gavel',
    },
  ];

  const handlePartnerAction = (link, name) => {
    Linking.canOpenURL(link).then((supported) => {
      if (supported) {
        Linking.openURL(link);
      } else {
        Alert.alert('Error', `Could not open link for ${name}`);
      }
    });
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Ship&Play Partners"
        showBack
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro */}
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>Estate & Facility Partners</Text>
          <Text style={styles.introDesc}>
            Discover partner services to automate building maintenance, improve security, and access landlord legal support.
          </Text>
        </View>

        {/* Section 1: Facilities */}
        <View style={styles.section}>
          <SectionHeader title="Managed Facilities" />
          <View style={styles.grid}>
            {facilities.map((item) => (
              <View key={item.id} style={styles.facilityCard}>
                <View style={styles.cardLeft}>
                  <View style={styles.facilityIconBg}>
                    <MaterialIcons name={item.icon} size={22} color={colors.primary} />
                  </View>
                  <View style={styles.facilityInfo}>
                    <Text style={styles.facilityName}>{item.name}</Text>
                    <Text style={styles.facilityDesc}>{item.desc}</Text>
                  </View>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Section 2: Vendor Partners */}
        <View style={styles.section}>
          <SectionHeader title="Owner Vendor Partners" />
          <View style={styles.grid}>
            {vendorPartners.map((item) => (
              <View key={item.id} style={styles.partnerCard}>
                <View style={styles.partnerHeader}>
                  <View style={styles.partnerIconBg}>
                    <MaterialIcons name={item.icon} size={20} color={colors.primary} />
                  </View>
                  <Text style={styles.partnerName}>{item.name}</Text>
                </View>
                <Text style={styles.partnerDesc}>{item.desc}</Text>
                <RateLimitedButton
                  style={styles.partnerActionBtn}
                  onPress={() => handlePartnerAction(item.link, item.name)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.partnerActionBtnText}>{item.action}</Text>
                  <MaterialIcons name="arrow-forward" size={16} color={colors.primary} />
                </RateLimitedButton>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scrollContent: {
    paddingVertical: 16,
    gap: 16,
  },
  introCard: {
    backgroundColor: colors.primaryContainer,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 20,
    gap: 6,
  },
  introTitle: {
    fontFamily: fonts.manropeBold,
    fontSize: 18,
    color: colors.onPrimary,
  },
  introDesc: {
    fontFamily: fonts.interRegular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 18,
  },
  section: {
    paddingHorizontal: 16,
  },
  grid: {
    gap: 12,
    marginTop: 8,
  },
  facilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  facilityIconBg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  facilityInfo: {
    flex: 1,
    gap: 2,
  },
  facilityName: {
    fontFamily: fonts.manropeBold,
    fontSize: 14,
    color: colors.onSurface,
  },
  facilityDesc: {
    fontFamily: fonts.interRegular,
    fontSize: 12,
    color: colors.onSurfaceVariant,
    lineHeight: 16,
  },
  statusBadge: {
    backgroundColor: 'rgba(0, 32, 69, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontFamily: fonts.interSemiBold,
    fontSize: 11,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  partnerCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  partnerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  partnerIconBg: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerName: {
    fontFamily: fonts.manropeBold,
    fontSize: 15,
    color: colors.onSurface,
  },
  partnerDesc: {
    fontFamily: fonts.interRegular,
    fontSize: 13,
    color: colors.onSurfaceVariant,
    lineHeight: 18,
  },
  partnerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  partnerActionBtnText: {
    fontFamily: fonts.interSemiBold,
    fontSize: 13,
    color: colors.primary,
  },
});
