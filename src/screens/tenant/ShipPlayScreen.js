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
import { useTheme } from '../../context/ThemeContext';
import { fonts } from '../../theme/typography';
import ScreenHeader from '../../components/ScreenHeader';
import SectionHeader from '../../components/SectionHeader';
import { RateLimitedButton } from '../../components/RateLimitedButton';

export default function ShipPlayScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const insets = useSafeAreaInsets();

  const amenities = [
    {
      id: 'clubhouse',
      name: 'Community Clubhouse',
      desc: 'Perfect for hosting private gatherings. Max capacity: 50 people.',
      status: 'Available',
      icon: 'meeting-room',
    },
    {
      id: 'tennis',
      name: 'Tennis & Pickleball Court',
      desc: 'Equipped with night lighting. Bookable in 1-hour slots.',
      status: 'Available',
      icon: 'sports-tennis',
    },
    {
      id: 'bbq',
      name: 'Rooftop BBQ Grills',
      desc: 'Enjoy outdoor dining. Grills must be cleaned after use.',
      status: 'Available',
      icon: 'outdoor-grill',
    },
  ];

  const partners = [
    {
      id: 'laundry',
      name: 'Speedy Laundry & Dry Cleaning',
      desc: 'Same-day pickup and delivery for wash & fold and dry cleaning. Use code TENURA10 for a 10% resident discount.',
      action: 'Call to Schedule',
      link: 'tel:+919876543210',
      icon: 'local-laundry-service',
    },
    {
      id: 'pets',
      name: 'Happy Paws Pet Care',
      desc: 'Professional dog walking, pet sitting, and grooming. Tap to schedule a free meet-and-greet session with our handlers.',
      action: 'Email to Book',
      link: 'mailto:pets@example.com?subject=Tenura%20Pet%20Sitting',
      icon: 'pets',
    },
    {
      id: 'prep',
      name: 'Metro Meal Prep Co.',
      desc: 'Healthy, portion-controlled meals delivered straight to your door twice a week. 15% discount on your first month using code METROTENURA.',
      action: 'Visit Website',
      link: 'https://example.com/metro-prep',
      icon: 'restaurant',
    },
  ];

  const handleBookAmenity = (name) => {
    Alert.alert(
      'Amenity Reservation',
      `Would you like to request a booking for the ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Request Booking', 
          onPress: () => {
            Alert.alert(
              'Request Received',
              `Your reservation request for the ${name} has been sent to the property manager. We will notify you once approved.`
            );
          } 
        },
      ]
    );
  };

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
        title="Ship&Play"
        showBack
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro */}
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>Exclusive Services & Amenities</Text>
          <Text style={styles.introDesc}>
            Access premium facilities and local partner discounts curated especially for Tenura residents.
          </Text>
        </View>

        {/* Section 1: Amenity Bookings */}
        <View style={styles.section}>
          <SectionHeader title="Book Amenities" />
          <View style={styles.grid}>
            {amenities.map((item) => (
              <View key={item.id} style={styles.amenityCard}>
                <View style={styles.cardLeft}>
                  <View style={styles.amenityIconBg}>
                    <MaterialIcons name={item.icon} size={22} color={colors.primary} />
                  </View>
                  <View style={styles.amenityInfo}>
                    <Text style={styles.amenityName}>{item.name}</Text>
                    <Text style={styles.amenityDesc}>{item.desc}</Text>
                  </View>
                </View>
                <RateLimitedButton
                  style={styles.bookBtn}
                  onPress={() => handleBookAmenity(item.name)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.bookBtnText}>Book</Text>
                </RateLimitedButton>
              </View>
            ))}
          </View>
        </View>

        {/* Section 2: Partner Services */}
        <View style={styles.section}>
          <SectionHeader title="Partner Services" />
          <View style={styles.grid}>
            {partners.map((item) => (
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

const getStyles = (colors) => StyleSheet.create({
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
    color: colors.onPrimaryContainer,
  },
  introDesc: {
    fontFamily: fonts.interRegular,
    fontSize: 13,
    color: colors.onPrimaryContainer,
    opacity: 0.7,
    lineHeight: 18,
  },
  section: {
    paddingHorizontal: 16,
  },
  grid: {
    gap: 12,
    marginTop: 8,
  },
  amenityCard: {
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
  amenityIconBg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amenityInfo: {
    flex: 1,
    gap: 2,
  },
  amenityName: {
    fontFamily: fonts.manropeBold,
    fontSize: 14,
    color: colors.onSurface,
  },
  amenityDesc: {
    fontFamily: fonts.interRegular,
    fontSize: 12,
    color: colors.onSurfaceVariant,
    lineHeight: 16,
  },
  bookBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookBtnText: {
    fontFamily: fonts.interSemiBold,
    fontSize: 12,
    color: colors.onPrimary,
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
