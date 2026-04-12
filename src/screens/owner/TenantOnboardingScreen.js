import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import ScreenHeader from '../../components/ScreenHeader';
import PrimaryButton from '../../components/PrimaryButton';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STEP_LABELS = ['Tenant Info', 'Property & Unit', 'Lease Details', 'Review'];
const TOTAL_STEPS = STEP_LABELS.length;

const formatDate = (d) =>
  d
    ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

const toISODate = (d) => (d ? d.toISOString().split('T')[0] : '');

export default function TenantOnboardingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);

  // ── All text field values in one object ───────────────────────────────────────
  // Single setState per keystroke — prevents the double re-render that unmounts
  // TextInput and dismisses the keyboard.
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    unitNumber: '',
    monthlyRent: '',
  });

  // Returns a stable onChangeText handler for a given field name.
  const onChange = useCallback(
    (field) => (value) => setForm((f) => ({ ...f, [field]: value })),
    [],
  );

  // ── Step 1: Assignment ────────────────────────────────────────────────────────
  const [properties, setProperties] = useState([]);
  const [propertiesLoaded, setPropertiesLoaded] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');

  // ── Step 2: Lease Details ─────────────────────────────────────────────────────
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  // active date picker: 'start' | 'end' | null
  const [activePicker, setActivePicker] = useState(null);
  const [pickerTempDate, setPickerTempDate] = useState(new Date());

  // ── Load properties once ──────────────────────────────────────────────────────
  const loadProperties = useCallback(async () => {
    if (!user || propertiesLoaded) return;
    const { data } = await supabase
      .from('properties')
      .select('id, name, city')
      .eq('owner_id', user.id);
    const props = data ?? [];
    setProperties(props);
    if (props[0]) setSelectedPropertyId(props[0].id);
    setPropertiesLoaded(true);
  }, [user?.id, propertiesLoaded]);

  React.useEffect(() => { loadProperties(); }, [loadProperties]);

  if (!user) return null;

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);

  // ── Validation ────────────────────────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (step === 0) {
      if (!form.fullName.trim()) errs.fullName = 'Full name is required.';
      if (!form.email.trim()) errs.email = 'Email is required.';
      else if (!EMAIL_REGEX.test(form.email.trim())) errs.email = 'Enter a valid email address.';
    }
    if (step === 1) {
      if (!selectedPropertyId) errs.property = 'Select a property.';
      if (!form.unitNumber.trim()) errs.unitNumber = 'Unit number is required.';
    }
    if (step === 2) {
      const rent = Number(form.monthlyRent);
      if (!form.monthlyRent.trim() || isNaN(rent) || rent <= 0)
        errs.monthlyRent = 'Enter a valid rent amount.';
      if (!startDate) errs.startDate = 'Select a start date.';
      if (!endDate) errs.endDate = 'Select an end date.';
      else if (startDate && endDate <= startDate)
        errs.endDate = 'End date must be after start date.';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Navigation ────────────────────────────────────────────────────────────────
  const handleBack = () => {
    setFieldErrors({});
    if (step > 0) setStep((s) => s - 1);
    else navigation.goBack();
  };

  const handleNext = () => {
    if (!validate()) return;
    if (step < TOTAL_STEPS - 1) { setStep((s) => s + 1); return; }
    handleSubmit();
  };

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitError(null);
    setLoading(true);

    // a) Insert tenant row (user_id stays null until tenant signs up)
    const { data: tenantData, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        owner_id: user.id,
        property_id: selectedPropertyId,
        full_name: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        unit_number: form.unitNumber.trim(),
        user_id: null,
        status: 'pending',
      })
      .select()
      .single();

    if (tenantError) {
      setSubmitError(tenantError.message);
      setLoading(false);
      return;
    }

    // b) Insert lease row
    const { error: leaseError } = await supabase.from('leases').insert({
      tenant_id: tenantData.id,
      property_id: selectedPropertyId,
      monthly_rent: Number(form.monthlyRent),
      start_date: toISODate(startDate),
      end_date: toISODate(endDate),
      status: 'pending_signature',
    });

    setLoading(false);

    if (leaseError) {
      setSubmitError(leaseError.message);
      return;
    }

    Alert.alert(
      'Tenant Added',
      `${form.fullName.trim()} has been added. Lease is pending signature.`,
      [{ text: 'Done', onPress: () => navigation.goBack() }],
    );
  };

  // ── Date picker open/confirm ───────────────────────────────────────────────────
  const openPicker = (which) => {
    const current =
      which === 'start' ? startDate : endDate;
    setPickerTempDate(current ?? new Date());
    setActivePicker(which);
  };

  const confirmPicker = () => {
    if (activePicker === 'start') {
      setStartDate(pickerTempDate);
    } else {
      setEndDate(pickerTempDate);
    }
    setActivePicker(null);
  };

  // ── Step renders ──────────────────────────────────────────────────────────────

  const renderStep0 = () => (
    <>
      <Text style={styles.stepTitle}>Tenant Info</Text>
      <Text style={styles.stepSubtitle}>Basic information about the tenant.</Text>

      <Field label="FULL NAME" error={fieldErrors.fullName}>
        <TextInput
          style={[styles.input, fieldErrors.fullName && styles.inputError]}
          value={form.fullName}
          onChangeText={onChange('fullName')}
          placeholder="e.g. Arjun Sharma"
          placeholderTextColor={colors.outline}
          autoCapitalize="words"
          autoCorrect={false}
        />
      </Field>

      <Field label="EMAIL" error={fieldErrors.email}>
        <TextInput
          style={[styles.input, fieldErrors.email && styles.inputError]}
          value={form.email}
          onChangeText={onChange('email')}
          placeholder="tenant@example.com"
          placeholderTextColor={colors.outline}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </Field>

      <Field label="PHONE (OPTIONAL)">
        <TextInput
          style={styles.input}
          value={form.phone}
          onChangeText={onChange('phone')}
          placeholder="+91 98765 43210"
          placeholderTextColor={colors.outline}
          keyboardType="phone-pad"
        />
      </Field>
    </>
  );

  const renderStep1 = () => (
    <>
      <Text style={styles.stepTitle}>Assignment</Text>
      <Text style={styles.stepSubtitle}>Assign this tenant to a property and unit.</Text>

      <View style={styles.fieldWrapper}>
        <Text style={styles.fieldLabel}>PROPERTY</Text>
        {!propertiesLoaded ? (
          <Text style={styles.loadingText}>Loading properties…</Text>
        ) : properties.length === 0 ? (
          <View style={styles.noPropBox}>
            <MaterialIcons name="apartment" size={24} color={colors.outline} />
            <Text style={styles.noPropText}>
              No properties found. Add a property first from the Portfolio tab.
            </Text>
          </View>
        ) : (
          properties.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[
                styles.optionBtn,
                selectedPropertyId === p.id && styles.optionBtnActive,
              ]}
              onPress={() => setSelectedPropertyId(p.id)}
            >
              <MaterialIcons
                name="apartment"
                size={16}
                color={
                  selectedPropertyId === p.id
                    ? colors.onPrimary
                    : colors.onSurfaceVariant
                }
              />
              <Text
                style={[
                  styles.optionText,
                  selectedPropertyId === p.id && styles.optionTextActive,
                ]}
              >
                {p.name}
                <Text style={styles.optionSubText}> · {p.city}</Text>
              </Text>
            </TouchableOpacity>
          ))
        )}
        {fieldErrors.property ? (
          <Text style={styles.fieldErrorText}>{fieldErrors.property}</Text>
        ) : null}
      </View>

      <Field label="UNIT NUMBER" error={fieldErrors.unitNumber}>
        <TextInput
          style={[styles.input, fieldErrors.unitNumber && styles.inputError]}
          value={form.unitNumber}
          onChangeText={onChange('unitNumber')}
          placeholder="e.g. 402-B"
          placeholderTextColor={colors.outline}
          autoCapitalize="characters"
          autoCorrect={false}
        />
      </Field>
    </>
  );

  const renderStep2 = () => (
    <>
      <Text style={styles.stepTitle}>Lease Details</Text>
      <Text style={styles.stepSubtitle}>Set the rent and lease duration.</Text>

      <View style={styles.fieldWrapper}>
        <Text style={styles.fieldLabel}>MONTHLY RENT</Text>
        <View style={styles.prefixRow}>
          <View style={styles.prefixBox}>
            <Text style={styles.prefixText}>₹</Text>
          </View>
          <TextInput
            style={[
              styles.input,
              styles.prefixInput,
              fieldErrors.monthlyRent && styles.inputError,
            ]}
            value={form.monthlyRent}
            onChangeText={onChange('monthlyRent')}
            placeholder="e.g. 45000"
            placeholderTextColor={colors.outline}
            keyboardType="number-pad"
          />
        </View>
        {fieldErrors.monthlyRent ? (
          <Text style={styles.fieldErrorText}>{fieldErrors.monthlyRent}</Text>
        ) : null}
      </View>

      <View style={styles.fieldWrapper}>
        <Text style={styles.fieldLabel}>LEASE START DATE</Text>
        <TouchableOpacity
          style={[
            styles.dateField,
            fieldErrors.startDate && styles.inputError,
          ]}
          onPress={() => openPicker('start')}
        >
          <Text
            style={[
              styles.dateFieldText,
              !startDate && styles.dateFieldPlaceholder,
            ]}
          >
            {startDate ? formatDate(startDate) : 'Select start date'}
          </Text>
          <MaterialIcons name="calendar-today" size={18} color={colors.outline} />
        </TouchableOpacity>
        {fieldErrors.startDate ? (
          <Text style={styles.fieldErrorText}>{fieldErrors.startDate}</Text>
        ) : null}
      </View>

      <View style={styles.fieldWrapper}>
        <Text style={styles.fieldLabel}>LEASE END DATE</Text>
        <TouchableOpacity
          style={[
            styles.dateField,
            fieldErrors.endDate && styles.inputError,
          ]}
          onPress={() => openPicker('end')}
        >
          <Text
            style={[
              styles.dateFieldText,
              !endDate && styles.dateFieldPlaceholder,
            ]}
          >
            {endDate ? formatDate(endDate) : 'Select end date'}
          </Text>
          <MaterialIcons name="calendar-today" size={18} color={colors.outline} />
        </TouchableOpacity>
        {fieldErrors.endDate ? (
          <Text style={styles.fieldErrorText}>{fieldErrors.endDate}</Text>
        ) : null}
      </View>
    </>
  );

  const renderStep3 = () => (
    <>
      <Text style={styles.stepTitle}>Review & Confirm</Text>
      <Text style={styles.stepSubtitle}>
        Check everything before adding the tenant.
      </Text>

      <View style={styles.reviewCard}>
        {/* Tenant */}
        <ReviewSection icon="person" label="TENANT">
          <Text style={styles.reviewPrimary}>{form.fullName}</Text>
          <Text style={styles.reviewSecondary}>{form.email}</Text>
          {form.phone ? <Text style={styles.reviewSecondary}>{form.phone}</Text> : null}
        </ReviewSection>

        <View style={styles.reviewDivider} />

        {/* Assignment */}
        <ReviewSection icon="apartment" label="PROPERTY & UNIT">
          <Text style={styles.reviewPrimary}>
            {selectedProperty?.name ?? '—'}
          </Text>
          <Text style={styles.reviewSecondary}>
            {selectedProperty?.city} · Unit {form.unitNumber}
          </Text>
        </ReviewSection>

        <View style={styles.reviewDivider} />

        {/* Lease */}
        <ReviewSection icon="description" label="LEASE">
          <Text style={[styles.reviewPrimary, styles.reviewAccent]}>
            ₹{Number(form.monthlyRent).toLocaleString('en-IN')}/mo
          </Text>
          <Text style={styles.reviewSecondary}>
            {formatDate(startDate)} → {formatDate(endDate)}
          </Text>
          <Text style={styles.reviewStatus}>Status: Pending Signature</Text>
        </ReviewSection>
      </View>

      {submitError ? (
        <View style={styles.submitErrorBox}>
          <MaterialIcons name="error-outline" size={16} color={colors.error} />
          <Text style={styles.submitErrorText}>{submitError}</Text>
        </View>
      ) : null}
    </>
  );

  // ── Date picker (cross-platform) ──────────────────────────────────────────────
  const renderDatePicker = () => {
    if (activePicker === null) return null;

    const minDate =
      activePicker === 'end' && startDate
        ? new Date(startDate.getTime() + 24 * 60 * 60 * 1000)
        : new Date();

    if (Platform.OS === 'android') {
      return (
        <DateTimePicker
          value={pickerTempDate}
          mode="date"
          display="default"
          minimumDate={minDate}
          onChange={(event, date) => {
            setActivePicker(null);
            if (event.type === 'set' && date) {
              if (activePicker === 'start') setStartDate(date);
              else setEndDate(date);
            }
          }}
        />
      );
    }

    // iOS — show in bottom sheet Modal
    return (
      <Modal visible transparent animationType="slide">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerToolbar}>
              <TouchableOpacity
                onPress={() => setActivePicker(null)}
                style={styles.pickerToolbarBtn}
              >
                <Text style={styles.pickerCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.pickerTitle}>
                {activePicker === 'start' ? 'Start Date' : 'End Date'}
              </Text>
              <TouchableOpacity
                onPress={confirmPicker}
                style={styles.pickerToolbarBtn}
              >
                <Text style={styles.pickerDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={pickerTempDate}
              mode="date"
              display="spinner"
              minimumDate={minDate}
              onChange={(event, date) => {
                if (date) setPickerTempDate(date);
              }}
              style={styles.pickerControl}
            />
          </View>
        </View>
      </Modal>
    );
  };

  // ── Main render ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Add Resident"
        showBack
        onBack={handleBack}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Step indicator */}
          <View style={styles.stepIndicator}>
            {STEP_LABELS.map((label, i) => (
              <View key={label} style={styles.stepDotWrapper}>
                <View
                  style={[
                    styles.stepDot,
                    i === step && styles.stepDotActive,
                    i < step && styles.stepDotDone,
                  ]}
                >
                  {i < step ? (
                    <MaterialIcons name="check" size={12} color={colors.onPrimary} />
                  ) : (
                    <Text
                      style={[
                        styles.stepDotNum,
                        i === step && styles.stepDotNumActive,
                      ]}
                    >
                      {i + 1}
                    </Text>
                  )}
                </View>
                {i < TOTAL_STEPS - 1 ? (
                  <View
                    style={[styles.stepLine, i < step && styles.stepLineDone]}
                  />
                ) : null}
              </View>
            ))}
          </View>

          {/* Form body */}
          <View style={styles.formBody}>
            {step === 0 && renderStep0()}
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          {step > 0 ? (
            <TouchableOpacity style={styles.backBtnFooter} onPress={handleBack}>
              <MaterialIcons name="arrow-back" size={18} color={colors.primary} />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.footerSpacer} />
          )}
          <View style={styles.nextBtnWrapper}>
            <PrimaryButton
              label={step === TOTAL_STEPS - 1 ? 'Confirm & Add Tenant' : 'Next'}
              onPress={handleNext}
              loading={loading}
              icon={step === TOTAL_STEPS - 1 ? 'person-add' : 'arrow-forward'}
              disabled={step === 1 && propertiesLoaded && properties.length === 0}
            />
          </View>
        </View>
      </KeyboardAvoidingView>

      {renderDatePicker()}
    </View>
  );
}

// ── Small helper components ───────────────────────────────────────────────────

function Field({ label, error, children }) {
  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {error ? <Text style={styles.fieldErrorText}>{error}</Text> : null}
    </View>
  );
}

function ReviewSection({ icon, label, children }) {
  return (
    <View style={styles.reviewSection}>
      <View style={styles.reviewSectionHeader}>
        <MaterialIcons name={icon} size={14} color={colors.onSurfaceVariant} />
        <Text style={styles.reviewSectionLabel}>{label}</Text>
      </View>
      <View style={styles.reviewSectionBody}>{children}</View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },

  // ── Step indicator ────────────────────────────────────────────────────────────
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: colors.surfaceContainerLow,
  },
  stepDotWrapper: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: colors.primary },
  stepDotDone: { backgroundColor: colors.tertiaryFixedDim },
  stepDotNum: {
    fontFamily: fonts.interSemiBold,
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  stepDotNumActive: { color: colors.onPrimary },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.surfaceContainerHighest,
    marginHorizontal: 4,
  },
  stepLineDone: { backgroundColor: colors.tertiaryFixedDim },

  // ── Form ──────────────────────────────────────────────────────────────────────
  formBody: { padding: 20 },
  stepTitle: {
    fontFamily: fonts.manropeBold,
    fontSize: 22,
    color: colors.onSurface,
    marginBottom: 6,
  },
  stepSubtitle: {
    fontFamily: fonts.interRegular,
    fontSize: 14,
    color: colors.onSurfaceVariant,
    marginBottom: 24,
  },

  fieldWrapper: { marginBottom: 16 },
  fieldLabel: {
    fontFamily: fonts.interSemiBold,
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: fonts.interRegular,
    fontSize: 15,
    color: colors.onSurface,
  },
  inputError: { backgroundColor: colors.errorContainer },
  fieldErrorText: {
    fontFamily: fonts.interRegular,
    fontSize: 12,
    color: colors.error,
    marginTop: 4,
  },

  // ── Property selector ─────────────────────────────────────────────────────────
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  optionBtnActive: { backgroundColor: colors.primaryContainer },
  optionText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    color: colors.onSurface,
    flex: 1,
  },
  optionTextActive: { color: colors.onPrimary },
  optionSubText: {
    fontFamily: fonts.interRegular,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
  },
  noPropBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 8,
    padding: 14,
  },
  noPropText: {
    flex: 1,
    fontFamily: fonts.interRegular,
    fontSize: 13,
    color: colors.onSurfaceVariant,
    lineHeight: 18,
  },
  loadingText: {
    fontFamily: fonts.interRegular,
    fontSize: 14,
    color: colors.onSurfaceVariant,
    paddingVertical: 8,
  },

  // ── Rent prefix ───────────────────────────────────────────────────────────────
  prefixRow: { flexDirection: 'row' },
  prefixBox: {
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  prefixText: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 16,
    color: colors.onSurfaceVariant,
  },
  prefixInput: {
    flex: 1,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },

  // ── Date field ────────────────────────────────────────────────────────────────
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  dateFieldText: {
    fontFamily: fonts.interRegular,
    fontSize: 15,
    color: colors.onSurface,
  },
  dateFieldPlaceholder: { color: colors.outline },

  // ── iOS date picker sheet ─────────────────────────────────────────────────────
  pickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  pickerSheet: {
    backgroundColor: colors.surfaceContainerLowest,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 20,
  },
  pickerToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surfaceContainerLow,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  pickerToolbarBtn: { paddingHorizontal: 4, paddingVertical: 2 },
  pickerTitle: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 15,
    color: colors.onSurface,
  },
  pickerCancel: {
    fontFamily: fonts.interRegular,
    fontSize: 15,
    color: colors.onSurfaceVariant,
  },
  pickerDone: {
    fontFamily: fonts.interSemiBold,
    fontSize: 15,
    color: colors.primary,
  },
  pickerControl: { width: '100%' },

  // ── Review card ───────────────────────────────────────────────────────────────
  reviewCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 12,
    overflow: 'hidden',
  },
  reviewSection: { padding: 16 },
  reviewSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  reviewSectionLabel: {
    fontFamily: fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  reviewSectionBody: { gap: 2 },
  reviewPrimary: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 16,
    color: colors.onSurface,
  },
  reviewSecondary: {
    fontFamily: fonts.interRegular,
    fontSize: 13,
    color: colors.onSurfaceVariant,
  },
  reviewAccent: { color: colors.onTertiaryContainer },
  reviewStatus: {
    fontFamily: fonts.interMedium,
    fontSize: 12,
    color: colors.outline,
    marginTop: 2,
  },
  reviewDivider: {
    height: 1,
    backgroundColor: colors.surfaceContainerLow,
    marginHorizontal: 16,
  },

  submitErrorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.errorContainer,
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  submitErrorText: {
    flex: 1,
    fontFamily: fonts.interRegular,
    fontSize: 13,
    color: colors.onErrorContainer,
  },

  // ── Footer ────────────────────────────────────────────────────────────────────
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.surfaceContainerLowest,
    gap: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  backBtnFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  backBtnText: {
    fontFamily: fonts.interSemiBold,
    fontSize: 14,
    color: colors.primary,
  },
  footerSpacer: { width: 60 },
  nextBtnWrapper: { flex: 1 },
});
