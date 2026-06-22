import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import ScreenHeader from '../../components/ScreenHeader';

export default function CommunityScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const communityItems = [
    {
      id: 'OfficeProfile',
      title: 'Office Profile',
      description: 'Update your contact details that show on the tenant-facing office card',
      icon: 'contact-phone',
      screen: 'OfficeProfile',
    },
    {
      id: 'Announcements',
      title: 'Announcements',
      description: 'Broadcast and manage property-wide updates or policy updates',
      icon: 'campaign',
      screen: 'Announcements',
    },
    {
      id: 'MessagesAlerts',
      title: 'Messages & Alerts',
      description: 'Broadcast warning, emergency or info alerts to residents',
      icon: 'notification-important',
      screen: 'MessagesAlerts',
    },
    {
      id: 'ShipPlay',
      title: 'Ship&Play',
      description: 'Mock services and integrations offered to community properties',
      icon: 'people',
      screen: 'ShipPlay',
    },
  ];

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Community Portal"
        showBack={false}
        showProfile={true}
      />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.listContainer}>
          {communityItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() => navigation.navigate(item.screen)}
              activeOpacity={0.7}
            >
              <View style={styles.iconCircle}>
                <MaterialIcons name={item.icon} size={22} color={colors.onPrimary} />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDescription}>{item.description}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.outlineVariant} />
            </TouchableOpacity>
          ))}
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
  },
  listContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontFamily: fonts.manropeBold,
    fontSize: 16,
    color: colors.onSurface,
  },
  cardDescription: {
    fontFamily: fonts.interRegular,
    fontSize: 12,
    color: colors.onSurfaceVariant,
    lineHeight: 16,
  },
});
