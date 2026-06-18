import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import ScreenHeader from '../../components/ScreenHeader';
import PrimaryButton from '../../components/PrimaryButton';
import { RateLimitedIconButton } from '../../components/RateLimitedIconButton';

export default function AnnouncementsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  
  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPropId, setSelectedPropId] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*, properties!inner(name, owner_id)')
        .eq('properties.owner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnnouncements(data ?? []);
    } catch (err) {
      console.error('Error fetching announcements:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  const fetchPropertiesAndTenants = useCallback(async () => {
    if (!user) return;
    try {
      const { data: propsData, error: propsErr } = await supabase
        .from('properties')
        .select('id, name')
        .eq('owner_id', user.id)
        .order('name', { ascending: true });

      if (propsErr) throw propsErr;
      setProperties(propsData ?? []);
      if (propsData && propsData.length > 0) {
        setSelectedPropId(propsData[0].id);
      }

      const { data: tenantsData, error: tenantsErr } = await supabase
        .from('tenants')
        .select('id, full_name, unit_number, property_id')
        .eq('owner_id', user.id)
        .eq('status', 'active')
        .order('full_name', { ascending: true });

      if (tenantsErr) throw tenantsErr;
      setTenants(tenantsData ?? []);
    } catch (err) {
      console.error('Error fetching properties and tenants:', err.message);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAnnouncements();
    fetchPropertiesAndTenants();
  }, [fetchAnnouncements, fetchPropertiesAndTenants]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAnnouncements();
  };

  const handleCreateAnnouncement = async () => {
    if (!selectedPropId) {
      Alert.alert('Validation Error', 'Please select a property.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Please enter a title.');
      return;
    }
    if (!content.trim()) {
      Alert.alert('Validation Error', 'Please enter content.');
      return;
    }

    setCreating(true);
    try {
      const { error } = await supabase
        .from('announcements')
        .insert({
          property_id: selectedPropId,
          title: title.trim(),
          content: content.trim(),
        });

      if (error) throw error;

      Alert.alert('Success', 'Announcement posted successfully.');
      setModalVisible(false);
      setTitle('');
      setContent('');
      fetchAnnouncements();
    } catch (err) {
      console.error('Error posting announcement:', err.message);
      Alert.alert('Error', 'Could not post announcement.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteAnnouncement = (id) => {
    Alert.alert(
      'Delete Announcement',
      'Are you sure you want to delete this announcement?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('announcements')
                .delete()
                .eq('id', id);

              if (error) throw error;
              Alert.alert('Deleted', 'Announcement deleted successfully.');
              fetchAnnouncements();
            } catch (err) {
              console.error('Error deleting announcement:', err.message);
              Alert.alert('Error', 'Could not delete announcement.');
            }
          },
        },
      ]
    );
  };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  const renderAnnouncement = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.iconBg}>
          <MaterialIcons name="campaign" size={20} color={colors.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.propName}>{item.properties?.name}</Text>
          <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
        </View>
        <RateLimitedIconButton
          style={styles.deleteBtn}
          onPress={() => handleDeleteAnnouncement(item.id)}
          activeOpacity={0.7}
          icon={<MaterialIcons name="delete-outline" size={20} color={colors.error} />}
        />
      </View>

      <Text style={styles.titleText}>{item.title}</Text>
      <Text style={styles.contentText}>{item.content}</Text>
    </View>
  );

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
        title="Announcements"
        showBack
        onBack={() => navigation.goBack()}
      />

      <FlatList
        data={announcements}
        keyExtractor={item => item.id}
        renderItem={renderAnnouncement}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="campaign" size={40} color={colors.outline} />
            <Text style={styles.emptyTitle}>No announcements yet</Text>
            <Text style={styles.emptySubtitle}>Post announcements to notify all residents at your properties.</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Floating Action Button to post new announcement */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 16 }]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <MaterialIcons name="add" size={24} color={colors.onPrimary} />
      </TouchableOpacity>

      {/* Create Announcement Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Announcement</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialIcons name="close" size={24} color={colors.onSurface} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Property Selector */}
              <Text style={styles.label}>Select Property</Text>
              <View style={styles.pickerContainer}>
                {properties.map((prop) => (
                  <TouchableOpacity
                    key={prop.id}
                    style={[
                      styles.pickerOption,
                      selectedPropId === prop.id && styles.pickerOptionSelected
                    ]}
                    onPress={() => setSelectedPropId(prop.id)}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        selectedPropId === prop.id && styles.pickerOptionTextSelected
                      ]}
                    >
                      {prop.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Targeted Residents Audience List */}
              <Text style={styles.label}>Targeted Audience</Text>
              <View style={styles.audienceBox}>
                {(() => {
                  const targetTenants = tenants.filter(t => t.property_id === selectedPropId);
                  if (targetTenants.length === 0) {
                    return (
                      <Text style={styles.emptyAudienceText}>
                        No active residents currently registered at this property.
                      </Text>
                    );
                  }
                  return (
                    <View style={styles.audienceContent}>
                      <Text style={styles.audienceTitle}>
                        Will notify {targetTenants.length} resident(s):
                      </Text>
                      <Text style={styles.audienceListText}>
                        {targetTenants.map(t => `${t.full_name} (Unit ${t.unit_number || 'N/A'})`).join(', ')}
                      </Text>
                    </View>
                  );
                })()}
              </View>

              {/* Title */}
              <Text style={styles.label}>Announcement Title</Text>
              <TextInput
                style={styles.textInput}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Scheduled Maintenance"
                placeholderTextColor={colors.outline}
              />

              {/* Content */}
              <Text style={styles.label}>Message Content</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={content}
                onChangeText={setContent}
                placeholder="Details of the announcement..."
                placeholderTextColor={colors.outline}
                multiline={true}
                numberOfLines={5}
                textAlignVertical="top"
              />

              <View style={styles.modalActionRow}>
                <PrimaryButton
                  label="Publish Announcement"
                  onPress={handleCreateAnnouncement}
                  loading={creating}
                  icon="campaign"
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  listContent: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBg: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  propName: {
    fontFamily: fonts.manropeBold,
    fontSize: 14,
    color: colors.onSurface,
  },
  dateText: {
    fontFamily: fonts.interRegular,
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  deleteBtn: {
    padding: 4,
  },
  titleText: {
    fontFamily: fonts.manropeBold,
    fontSize: 16,
    color: colors.onSurface,
  },
  contentText: {
    fontFamily: fonts.interRegular,
    fontSize: 14,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 96,
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

  // Modal styling
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontFamily: fonts.manropeBold,
    fontSize: 18,
    color: colors.onSurface,
  },
  label: {
    fontFamily: fonts.interSemiBold,
    fontSize: 12,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 6,
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  pickerOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.surfaceContainerLow,
  },
  pickerOptionSelected: {
    backgroundColor: colors.primary,
  },
  pickerOptionText: {
    fontFamily: fonts.interMedium,
    fontSize: 13,
    color: colors.onSurfaceVariant,
  },
  pickerOptionTextSelected: {
    color: colors.onPrimary,
  },
  textInput: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 12,
    fontFamily: fonts.interRegular,
    fontSize: 14,
    color: colors.onSurface,
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  modalActionRow: {
    marginTop: 24,
  },
  audienceBox: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  emptyAudienceText: {
    fontFamily: fonts.interRegular,
    fontSize: 12,
    color: colors.outline,
    fontStyle: 'italic',
  },
  audienceContent: {
    gap: 4,
  },
  audienceTitle: {
    fontFamily: fonts.interSemiBold,
    fontSize: 12,
    color: colors.onSurface,
  },
  audienceListText: {
    fontFamily: fonts.interRegular,
    fontSize: 12,
    color: colors.onSurfaceVariant,
    lineHeight: 16,
  },
});
