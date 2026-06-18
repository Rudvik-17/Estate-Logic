import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Modal,
  Switch,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { fonts } from '../../theme/typography';
import ScreenHeader from '../../components/ScreenHeader';
import SectionHeader from '../../components/SectionHeader';
import StatusChip from '../../components/StatusChip';
import PrimaryButton from '../../components/PrimaryButton';
import { RateLimitedButton } from '../../components/RateLimitedButton';

let caseCounter = 4903;

export default function MaintenanceRequestScreen({ navigation, route }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [tenantId, setTenantId] = useState(null);
  const [propertyId, setPropertyId] = useState(null);
  const [notSetUp, setNotSetUp] = useState(false);
  const [activeRequest, setActiveRequest] = useState(null);
  const [resolvedRequests, setResolvedRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Wizard state
  const [step, setStep] = useState(1); // 1 = Issue Details, 2 = Contact / Entry Toggles & Summary Review
  const [showFormMode, setShowFormMode] = useState(false); // Mode toggling

  // Step 1 Form state
  const [locationType, setLocationType] = useState('');
  const [locationDetails, setLocationDetails] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [describeIssue, setDescribeIssue] = useState('');
  const [hasPhoto, setHasPhoto] = useState(false);

  // Step 2 Form state
  const [contactPreference, setContactPreference] = useState('');
  const [hasAnimal, setHasAnimal] = useState(false);
  const [entryNote, setEntryNote] = useState('');
  const [allowEntry, setAllowEntry] = useState(false);

  // Picker Modal state
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTitle, setPickerTitle] = useState('');
  const [pickerOptions, setPickerOptions] = useState([]);
  const [onSelectOption, setOnSelectOption] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const fetchData = useCallback(async () => {
    if (!user) return;
    setError(null);
    setNotSetUp(false);
    const { data: tenantRows, error: tErr } = await supabase
      .from('tenants')
      .select('id, property_id')
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
      setNotSetUp(true);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setTenantId(tenantData.id);
    setPropertyId(tenantData.property_id);

    const { data: requests, error: rErr } = await supabase
      .from('maintenance_requests')
      .select('*')
      .eq('tenant_id', tenantData.id)
      .order('created_at', { ascending: false });

    if (rErr) {
      setError(rErr.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const all = requests ?? [];
    setActiveRequest(all.find(r => r.status !== 'resolved') ?? null);
    setResolvedRequests(all.filter(r => r.status === 'resolved'));
    setLoading(false);
    setRefreshing(false);
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Navigate to form directly if passed via route params
  useEffect(() => {
    if (route.params?.showForm) {
      setShowFormMode(true);
      setStep(1);
      navigation.setParams({ showForm: undefined });
    }
  }, [route.params?.showForm]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const openPicker = (title, options, onSelect) => {
    setPickerTitle(title);
    setPickerOptions(options);
    setOnSelectOption(() => (option) => {
      onSelect(option);
      setPickerVisible(false);
    });
    setPickerVisible(true);
  };

  const handleLocationTypeSelect = (type) => {
    setLocationType(type);
    setLocationDetails(''); // Clear specific location since types differ
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permissions are required to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setHasPhoto(true);
      }
    } catch (err) {
      console.error('Error taking photo:', err.message);
      Alert.alert('Error', 'Failed to open camera.');
    }
  };

  const handleChooseFromLibrary = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Gallery permissions are required to choose photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setHasPhoto(true);
      }
    } catch (err) {
      console.error('Error choosing photo:', err.message);
      Alert.alert('Error', 'Failed to open photo library.');
    }
  };

  const handlePhotoPress = () => {
    openPicker(
      'Add Photos (Optional)',
      ['Take Photo', 'Choose from Library', 'Cancel / None'],
      async (option) => {
        if (option === 'Take Photo') {
          await handleTakePhoto();
        } else if (option === 'Choose from Library') {
          await handleChooseFromLibrary();
        } else {
          setHasPhoto(false);
        }
      }
    );
  };

  const handleNextStep = () => {
    const errors = {};
    if (!locationType) errors.locationType = 'Location type is required';
    if (!locationDetails) errors.locationDetails = 'Location details are required';
    if (!category) errors.category = 'Category is required';
    if (!priority) errors.priority = 'Priority is required';
    if (!describeIssue.trim()) errors.describeIssue = 'Please describe the issue';

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setStep(2);
  };

  const handleSubmit = async () => {
    const errors = {};
    if (!contactPreference) errors.contactPreference = 'Contact preference is required';

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    const caseNumber = `EL-${caseCounter++}`;
    
    // Subject built from Category + Specific location detail
    const subject = `${category} in ${locationDetails}`;
    
    // Details field populated with description, toggles and notes for backwards compatibility
    const details = `${describeIssue}\n\nContact Preference: ${contactPreference}\nAnimal: ${hasAnimal ? 'Yes' : 'No'}\nAllow Entry: ${allowEntry ? 'Yes' : 'No'}${entryNote.trim() ? '\nEntry Notes: ' + entryNote.trim() : ''}`;

    const { error: insertError } = await supabase
      .from('maintenance_requests')
      .insert({
        tenant_id: tenantId,
        property_id: propertyId,
        subject,
        details,
        status: 'open',
        priority: priority.toLowerCase(),
        case_number: caseNumber,
        resolution_progress: 0,
        // Detailed columns
        location_type: locationType,
        location_details: locationDetails,
        category: category,
        contact_preference: contactPreference,
        has_animal: hasAnimal,
        entry_note: entryNote.trim() || null,
        allow_entry: allowEntry,
      });

    setSubmitting(false);
    if (insertError) {
      Alert.alert('Error', insertError.message);
      return;
    }

    // Reset Form state
    setStep(1);
    setLocationType('');
    setLocationDetails('');
    setCategory('');
    setPriority('');
    setDescribeIssue('');
    setHasPhoto(false);
    setContactPreference('');
    setHasAnimal(false);
    setEntryNote('');
    setAllowEntry(false);
    setShowFormMode(false);

    Alert.alert(
      'Request Submitted',
      `Your maintenance request (${caseNumber}) has been submitted.`,
      [
        {
          text: 'OK',
          onPress: () => {
            // Navigate back to the Home Dashboard screen as requested
            navigation.getParent().navigate('Dashboard');
          },
        },
      ]
    );
    fetchData();
  };

  const handleBack = () => {
    if (showFormMode) {
      if (step === 2) {
        setStep(1);
      } else {
        setShowFormMode(false);
      }
    } else {
      navigation.goBack();
    }
  };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diff / 3_600_000);
    if (hours < 24) return `${hours > 0 ? hours + 'h' : 'Just now'} ago`;
    return `${Math.floor(hours / 24)}d ago`;
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
        <Text style={styles.errorTitle}>Unable to load requests</Text>
        <Text style={styles.errorMsg}>{error}</Text>
        <RateLimitedButton style={styles.retryBtn} onPress={fetchData}>
          <Text style={styles.retryText}>Retry</Text>
        </RateLimitedButton>
      </View>
    );
  }

  if (notSetUp) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Maintenance" showBell />
        <View style={styles.centered}>
          <MaterialIcons name="home" size={48} color={colors.outline} />
          <Text style={styles.errorTitle}>Account not set up</Text>
          <Text style={styles.errorMsg}>
            Contact your property manager to get linked to your unit.
          </Text>
        </View>
      </View>
    );
  }

  const renderSelectField = (label, value, placeholder, onPress, error) => (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity
        style={[styles.selectBox, error && styles.selectBoxError]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Text style={[styles.selectText, !value && styles.placeholderText]}>
          {value || placeholder}
        </Text>
        <MaterialIcons name="chevron-right" size={20} color={colors.outline} />
      </TouchableOpacity>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <View style={styles.container}>
        <ScreenHeader
          title="Maintenance Request"
          showBack
          onBack={handleBack}
          showBell
        />

        {showFormMode ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {step === 1 ? (
              <View style={styles.formSection}>
                <Text style={styles.formTitle}>Issue Details</Text>

                {renderSelectField(
                  'Location type',
                  locationType,
                  'Select One',
                  () => openPicker('Location type', ['Apartment', 'Community Area'], handleLocationTypeSelect),
                  formErrors.locationType
                )}

                {locationType ? (
                  renderSelectField(
                    'Where is the issue located?',
                    locationDetails,
                    'Select One',
                    () => openPicker(
                      'Where is the issue located?',
                      locationType === 'Apartment'
                        ? ['Kitchen', 'Bathroom', 'Living Room', 'Bedroom', 'Balcony', 'Other']
                        : ['Gym', 'Swimming Pool', 'Lobby / Lounge', 'Hallway / Stairs', 'Parking Garage', 'Other'],
                      setLocationDetails
                    ),
                    formErrors.locationDetails
                  )
                ) : null}

                {renderSelectField(
                  'What needs to be fixed?',
                  category,
                  'Select One',
                  () => openPicker(
                    'What needs to be fixed?',
                    ['Plumbing / Leaks', 'Appliance / Electronics', 'Lighting / Electrical', 'HVAC / Heating / Cooling', 'Doors / Windows / Locks', 'Walls / Floor / Ceiling', 'Pest Control', 'Other'],
                    setCategory
                  ),
                  formErrors.category
                )}

                {renderSelectField(
                  'Priority',
                  priority,
                  'Select One',
                  () => openPicker('Priority', ['Low', 'Medium', 'High'], setPriority),
                  formErrors.priority
                )}

                <View style={styles.fieldWrapper}>
                  <Text style={styles.fieldLabel}>Describe the issue</Text>
                  <TextInput
                    style={[styles.input, styles.textArea, formErrors.describeIssue && styles.inputError]}
                    value={describeIssue}
                    onChangeText={setDescribeIssue}
                    placeholder="Describe the issue in detail..."
                    placeholderTextColor={colors.outline}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                  {formErrors.describeIssue ? <Text style={styles.fieldError}>{formErrors.describeIssue}</Text> : null}
                </View>

                {renderSelectField(
                  'Add Photos (Optional)',
                  hasPhoto ? '1 photo attached' : '',
                  'Select One',
                  handlePhotoPress
                )}

                <PrimaryButton
                  label="Next"
                  onPress={handleNextStep}
                  icon="arrow-forward"
                />
              </View>
            ) : (
              <View style={styles.formSection}>
                <Text style={styles.formTitle}>New Maintenance Request</Text>

                {renderSelectField(
                  'Contact Preference',
                  contactPreference,
                  'Select One',
                  () => openPicker(
                    'Contact Preference',
                    ['Phone Call', 'Email', 'In-App Message', 'Text Message'],
                    setContactPreference
                  ),
                  formErrors.contactPreference
                )}

                <View style={styles.fieldWrapper}>
                  <Text style={styles.fieldLabel}>Do you have an animal?</Text>
                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleStatus}>{hasAnimal ? 'Yes' : 'No'}</Text>
                    <Switch
                      value={hasAnimal}
                      onValueChange={setHasAnimal}
                      trackColor={{ false: colors.surfaceContainerHighest, true: colors.tertiaryFixedDim }}
                      thumbColor={hasAnimal ? colors.primary : colors.outline}
                      ios_backgroundColor={colors.surfaceContainerHighest}
                    />
                  </View>
                </View>

                <View style={styles.fieldWrapper}>
                  <Text style={styles.fieldLabel}>Entry Note</Text>
                  <TextInput
                    style={[styles.input, styles.textAreaEntry]}
                    value={entryNote}
                    onChangeText={setEntryNote}
                    placeholder="e.g. Code is 4902, dog in crate, etc."
                    placeholderTextColor={colors.outline}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.fieldWrapper}>
                  <Text style={styles.fieldLabel}>
                    Do you agree to let the property staff enter your unit to work on this maintenance issue?
                  </Text>
                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleStatus}>{allowEntry ? 'Yes' : 'No'}</Text>
                    <Switch
                      value={allowEntry}
                      onValueChange={setAllowEntry}
                      trackColor={{ false: colors.surfaceContainerHighest, true: colors.tertiaryFixedDim }}
                      thumbColor={allowEntry ? colors.primary : colors.outline}
                      ios_backgroundColor={colors.surfaceContainerHighest}
                    />
                  </View>
                </View>

                {/* Step 1 Choice Review Card */}
                <View style={styles.reviewCard}>
                  <Text style={styles.reviewCardTitle}>Issue Details</Text>
                  
                  <View style={styles.reviewItem}>
                    <Text style={styles.reviewLabel}>Location type</Text>
                    <Text style={styles.reviewValue}>{locationType}</Text>
                  </View>

                  <View style={styles.reviewItem}>
                    <Text style={styles.reviewLabel}>Where is the issue located?</Text>
                    <Text style={styles.reviewValue}>{locationDetails}</Text>
                  </View>

                  <View style={styles.reviewItem}>
                    <Text style={styles.reviewLabel}>What needs to be fixed?</Text>
                    <Text style={styles.reviewValue}>{category}</Text>
                  </View>

                  <View style={styles.reviewItem}>
                    <Text style={styles.reviewLabel}>Priority</Text>
                    <Text style={styles.reviewValue}>{priority}</Text>
                  </View>

                  <View style={[styles.reviewItem, { borderBottomWidth: 0 }]}>
                    <Text style={styles.reviewLabel}>Describe the issue</Text>
                    <Text style={styles.reviewValue} numberOfLines={3}>{describeIssue}</Text>
                  </View>
                </View>

                <PrimaryButton
                  label="Submit"
                  onPress={handleSubmit}
                  loading={submitting}
                  icon="send"
                />
              </View>
            )}
          </ScrollView>
        ) : (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
          >
            {/* Launch Form trigger when no request is active */}
            {!activeRequest ? (
              <View style={styles.newRequestTriggerCard}>
                <MaterialIcons name="build" size={32} color={colors.primary} />
                <Text style={styles.newRequestTriggerTitle}>Need something fixed?</Text>
                <Text style={styles.newRequestTriggerDesc}>
                  Submit a structured maintenance request to your property manager.
                </Text>
                <TouchableOpacity
                  style={styles.newRequestTriggerBtn}
                  onPress={() => {
                    setStep(1);
                    setShowFormMode(true);
                  }}
                >
                  <Text style={styles.newRequestTriggerBtnText}>+ New Request</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Active request */}
            <View style={styles.section}>
              <SectionHeader
                title="Active Request"
                actionLabel="+ New Request"
                onAction={() => {
                  setStep(1);
                  setShowFormMode(true);
                }}
              />
              {activeRequest ? (
                <View style={styles.activeCard}>
                  <View style={styles.activeCardHeader}>
                    <StatusChip label={activeRequest.priority} variant={
                      activeRequest.priority === 'high' ? 'urgent' :
                      activeRequest.priority === 'medium' ? 'pending' : 'active'
                    } />
                    <Text style={styles.caseNum}>{activeRequest.case_number}</Text>
                  </View>
                  <Text style={styles.activeSubject}>{activeRequest.subject}</Text>
                  <View style={styles.activeMeta}>
                    <Text style={styles.activeMetaText}>
                      Reported {timeAgo(activeRequest.created_at)}
                    </Text>
                  </View>

                  {/* Progress */}
                  <View style={styles.progressSection}>
                    <View style={styles.progressHeader}>
                      <Text style={styles.progressLabel}>Resolution Progress</Text>
                      <Text style={styles.progressPct}>{activeRequest.resolution_progress}%</Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${activeRequest.resolution_progress}%` }]} />
                    </View>
                  </View>

                  {activeRequest.scheduled_visit ? (
                    <View style={styles.visitRow}>
                      <MaterialIcons name="event" size={14} color={colors.onSurfaceVariant} />
                      <Text style={styles.visitText}>
                        Scheduled: {new Date(activeRequest.scheduled_visit).toLocaleString('en-IN', {
                          weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={styles.messageBtn}
                    onPress={() => navigation.navigate('IssueMessages', {
                      issueId: activeRequest.id,
                      caseNumber: activeRequest.case_number,
                      subject: activeRequest.subject,
                    })}
                  >
                    <MaterialIcons name="message" size={15} color={colors.primary} />
                    <Text style={styles.messageBtnText}>Message Owner</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.noActiveCard}>
                  <MaterialIcons name="check-circle" size={28} color={colors.tertiaryFixedDim} />
                  <Text style={styles.noActiveText}>No active requests</Text>
                </View>
              )}
            </View>

            {/* Past requests */}
            <View style={styles.section}>
              <SectionHeader title="Request History" />
              {resolvedRequests.length === 0 ? (
                <Text style={styles.noHistoryText}>No past requests</Text>
              ) : (
                resolvedRequests.slice(0, 5).map(req => (
                  <View key={req.id} style={styles.historyRow}>
                    <View style={styles.historyIconBg}>
                      <MaterialIcons name="check" size={14} color={colors.onTertiaryContainer} />
                    </View>
                    <View style={styles.historyInfo}>
                      <Text style={styles.historySubject}>{req.subject}</Text>
                      <Text style={styles.historyMeta}>
                        Completed {formatDate(req.created_at)} · {req.case_number}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => navigation.navigate('IssueMessages', {
                        issueId: req.id,
                        caseNumber: req.case_number,
                        subject: req.subject,
                      })}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialIcons name="message" size={18} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        )}

        {/* Option Picker Modal Overlay */}
        <Modal
          visible={pickerVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setPickerVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={styles.modalDismiss}
              activeOpacity={1}
              onPress={() => setPickerVisible(false)}
            />
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{pickerTitle}</Text>
                <TouchableOpacity onPress={() => setPickerVisible(false)}>
                  <MaterialIcons name="close" size={24} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalOptionsList} showsVerticalScrollIndicator={false}>
                {pickerOptions.map((option, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.optionItem}
                    onPress={() => onSelectOption && onSelectOption(option)}
                  >
                    <Text style={styles.optionText}>{option}</Text>
                    <MaterialIcons name="chevron-right" size={20} color={colors.outlineVariant} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.surface },
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, padding: 24,
  },

  section: { padding: 20 },
  formSection: { padding: 20, gap: 16 },
  formTitle: {
    fontFamily: fonts.manropeBold,
    fontSize: 20,
    color: colors.onSurface,
    marginBottom: 8,
  },

  fieldWrapper: { marginBottom: 12 },
  fieldLabel: {
    fontFamily: fonts.interSemiBold,
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginBottom: 6,
  },
  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  selectBoxError: {
    backgroundColor: 'rgba(186,26,26,0.08)',
  },
  selectText: {
    fontFamily: fonts.interMedium,
    fontSize: 15,
    color: colors.onSurface,
  },
  placeholderText: {
    color: colors.outline,
  },
  input: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.interRegular,
    fontSize: 15,
    color: colors.onSurface,
  },
  textArea: { minHeight: 90 },
  textAreaEntry: { minHeight: 70 },
  inputError: { backgroundColor: 'rgba(186,26,26,0.08)' },
  fieldError: { fontFamily: fonts.interRegular, fontSize: 12, color: colors.error, marginTop: 4 },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 2,
  },
  toggleStatus: {
    fontFamily: fonts.interSemiBold,
    fontSize: 14,
    color: colors.onSurface,
  },

  reviewCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    marginTop: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  reviewCardTitle: {
    fontFamily: fonts.manropeBold,
    fontSize: 15,
    color: colors.onSurface,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainerLow,
    paddingBottom: 8,
  },
  reviewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  reviewLabel: {
    fontFamily: fonts.interMedium,
    fontSize: 13,
    color: colors.onSurfaceVariant,
    flex: 1,
  },
  reviewValue: {
    fontFamily: fonts.interSemiBold,
    fontSize: 13,
    color: colors.onSurface,
    flex: 1,
    textAlign: 'right',
  },

  newRequestTriggerCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 20,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  newRequestTriggerTitle: {
    fontFamily: fonts.manropeBold,
    fontSize: 18,
    color: colors.onSurface,
    marginTop: 4,
  },
  newRequestTriggerDesc: {
    fontFamily: fonts.interRegular,
    fontSize: 13,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  newRequestTriggerBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 8,
  },
  newRequestTriggerBtnText: {
    fontFamily: fonts.interSemiBold,
    fontSize: 14,
    color: colors.onPrimary,
  },

  activeCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 14, padding: 16,
  },
  activeCardHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10,
  },
  caseNum: {
    fontFamily: fonts.interSemiBold, fontSize: 11,
    color: colors.onSurfaceVariant, letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  activeSubject: {
    fontFamily: fonts.manropeSemiBold, fontSize: 16,
    color: colors.onSurface, marginBottom: 4,
  },
  activeMeta: { marginBottom: 14 },
  activeMetaText: { fontFamily: fonts.interRegular, fontSize: 12, color: colors.onSurfaceVariant },

  progressSection: { marginBottom: 10 },
  progressHeader: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6,
  },
  progressLabel: { fontFamily: fonts.interMedium, fontSize: 12, color: colors.onSurfaceVariant },
  progressPct: { fontFamily: fonts.interSemiBold, fontSize: 12, color: colors.onSurface },
  progressTrack: {
    height: 6, backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 3, overflow: 'hidden',
  },
  progressFill: {
    height: 6, backgroundColor: colors.tertiaryFixedDim, borderRadius: 3,
  },

  visitRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
  },
  visitText: { fontFamily: fonts.interRegular, fontSize: 12, color: colors.onSurfaceVariant },

  messageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 14, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: colors.surfaceContainerLow,
  },
  messageBtnText: {
    fontFamily: fonts.interMedium, fontSize: 13, color: colors.primary,
  },

  noActiveCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 12, padding: 20,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  noActiveText: { fontFamily: fonts.interMedium, fontSize: 14, color: colors.onSurfaceVariant },

  historyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 10, padding: 12, marginBottom: 8,
  },
  historyIconBg: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(104,219,169,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  historyInfo: { flex: 1 },
  historySubject: { fontFamily: fonts.interSemiBold, fontSize: 13, color: colors.onSurface, marginBottom: 2 },
  historyMeta: { fontFamily: fonts.interRegular, fontSize: 11, color: colors.onSurfaceVariant },

  noHistoryText: {
    fontFamily: fonts.interRegular, fontSize: 14,
    color: colors.onSurfaceVariant, paddingVertical: 12,
  },

  errorTitle: { fontFamily: fonts.manropeSemiBold, fontSize: 18, color: colors.onSurface, marginTop: 12, marginBottom: 6 },
  errorMsg: { fontFamily: fonts.interRegular, fontSize: 13, color: colors.onSurfaceVariant, textAlign: 'center', marginBottom: 20 },
  retryBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 28 },
  retryText: { fontFamily: fonts.interSemiBold, fontSize: 14, color: colors.onPrimary },

  // Picker Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalDismiss: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: colors.surfaceContainerLowest,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainerLow,
  },
  modalTitle: {
    fontFamily: fonts.manropeBold,
    fontSize: 16,
    color: colors.onSurface,
  },
  modalOptionsList: {
    marginBottom: 20,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainerLow,
  },
  optionText: {
    fontFamily: fonts.interMedium,
    fontSize: 15,
    color: colors.onSurface,
  },
});
