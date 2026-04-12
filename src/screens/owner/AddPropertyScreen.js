import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
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

const CITIES = ['Bangalore', 'Mumbai', 'Delhi', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata'];
const TOTAL_STEPS = 3;

export default function AddPropertyScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [step, setStep] = useState(1);

  // Step 1
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Step 2
  const [totalUnits, setTotalUnits] = useState('');
  const [avgRent, setAvgRent] = useState('');

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  if (!user) return null;

  const filteredCities = CITIES.filter(
    c => !city.trim() || c.toLowerCase().startsWith(city.toLowerCase()),
  );

  // ── Validation ──────────────────────────────────────────────────────────────

  const validateStep1 = () => {
    const errs = {};
    if (!name.trim()) errs.name = 'Property name is required.';
    if (!address.trim()) errs.address = 'Address is required.';
    if (!city.trim()) errs.city = 'City is required.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs = {};
    const units = Number(totalUnits);
    const rent = Number(avgRent);
    if (!totalUnits.trim()) {
      errs.totalUnits = 'Total units is required.';
    } else if (!Number.isInteger(units) || units <= 0) {
      errs.totalUnits = 'Enter a valid number of units.';
    }
    if (!avgRent.trim()) {
      errs.avgRent = 'Average rent is required.';
    } else if (isNaN(rent) || rent <= 0) {
      errs.avgRent = 'Enter a valid rent amount.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Navigation ───────────────────────────────────────────────────────────────

  const handleBack = () => {
    setErrors({});
    if (step > 1) setStep(s => s - 1);
    else navigation.goBack();
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  };

  // ── Submit ───────────────────────────────────────────────────────────────────

  const handleConfirm = async () => {
    setSubmitError(null);
    setLoading(true);
    const { error: insertError } = await supabase.from('properties').insert({
      owner_id: user.id,
      name: name.trim(),
      address: address.trim(),
      city: city.trim(),
      total_units: Number(totalUnits),
      avg_rent: Number(avgRent),
    });
    setLoading(false);
    if (insertError) {
      setSubmitError(insertError.message);
      return;
    }
    Alert.alert(
      'Property Added',
      `${name.trim()} has been added to your portfolio.`,
      [{ text: 'Done', onPress: () => navigation.goBack() }],
    );
  };

  // ── Progress indicator ───────────────────────────────────────────────────────

  const renderProgress = () => (
    <View style={styles.progressContainer}>
      <Text style={styles.stepLabel}>STEP {step} OF {TOTAL_STEPS}</Text>
      <View style={styles.progressTrack}>
        {[1, 2, 3].map(s => (
          <View
            key={s}
            style={[
              styles.progressSegment,
              s <= step ? styles.progressActive : styles.progressInactive,
            ]}
          />
        ))}
      </View>
    </View>
  );

  // ── Step 1: Property Details ─────────────────────────────────────────────────

  const renderStep1 = () => (
    <View>
      <Text style={styles.stepTitle}>Property Details</Text>
      <Text style={styles.stepSubtitle}>Tell us about this property</Text>

      <Text style={styles.fieldLabel}>PROPERTY NAME</Text>
      <TextInput
        style={[styles.input, errors.name && styles.inputError]}
        value={name}
        onChangeText={t => { setName(t); setErrors(e => ({ ...e, name: null })); }}
        placeholder="e.g. The Sterling Heights"
        placeholderTextColor={colors.outline}
        autoCapitalize="words"
        autoCorrect={false}
      />
      {errors.name ? <Text style={styles.fieldError}>{errors.name}</Text> : null}

      <Text style={[styles.fieldLabel, { marginTop: 16 }]}>ADDRESS</Text>
      <TextInput
        style={[styles.input, styles.multilineInput, errors.address && styles.inputError]}
        value={address}
        onChangeText={t => { setAddress(t); setErrors(e => ({ ...e, address: null })); }}
        placeholder="Street, locality"
        placeholderTextColor={colors.outline}
        autoCapitalize="sentences"
        multiline
        numberOfLines={2}
        textAlignVertical="top"
      />
      {errors.address ? <Text style={styles.fieldError}>{errors.address}</Text> : null}

      <Text style={[styles.fieldLabel, { marginTop: 16 }]}>CITY</Text>
      <TextInput
        style={[styles.input, errors.city && styles.inputError]}
        value={city}
        onChangeText={t => {
          setCity(t);
          setErrors(e => ({ ...e, city: null }));
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        placeholder="Select or type a city"
        placeholderTextColor={colors.outline}
        autoCapitalize="words"
        autoCorrect={false}
      />
      {errors.city ? <Text style={styles.fieldError}>{errors.city}</Text> : null}

      {showSuggestions && filteredCities.length > 0 ? (
        <View style={styles.suggestionsBox}>
          {filteredCities.map(c => (
            <TouchableOpacity
              key={c}
              style={styles.suggestionItem}
              onPress={() => { setCity(c); setShowSuggestions(false); }}
            >
              <MaterialIcons name="location-city" size={14} color={colors.outline} />
              <Text style={styles.suggestionText}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );

  // ── Step 2: Unit Configuration ───────────────────────────────────────────────

  const renderStep2 = () => (
    <View>
      <Text style={styles.stepTitle}>Unit Configuration</Text>
      <Text style={styles.stepSubtitle}>Set up the unit and rent details</Text>

      <Text style={styles.fieldLabel}>TOTAL UNITS</Text>
      <TextInput
        style={[styles.input, errors.totalUnits && styles.inputError]}
        value={totalUnits}
        onChangeText={t => { setTotalUnits(t); setErrors(e => ({ ...e, totalUnits: null })); }}
        placeholder="e.g. 120"
        placeholderTextColor={colors.outline}
        keyboardType="number-pad"
      />
      {errors.totalUnits ? <Text style={styles.fieldError}>{errors.totalUnits}</Text> : null}

      <Text style={[styles.fieldLabel, { marginTop: 16 }]}>AVERAGE RENT PER UNIT</Text>
      <View style={styles.prefixRow}>
        <View style={styles.prefixBox}>
          <Text style={styles.prefixText}>₹</Text>
        </View>
        <TextInput
          style={[styles.input, styles.prefixInput, errors.avgRent && styles.inputError]}
          value={avgRent}
          onChangeText={t => { setAvgRent(t); setErrors(e => ({ ...e, avgRent: null })); }}
          placeholder="e.g. 45000"
          placeholderTextColor={colors.outline}
          keyboardType="number-pad"
        />
      </View>
      {errors.avgRent ? <Text style={styles.fieldError}>{errors.avgRent}</Text> : null}
    </View>
  );

  // ── Step 3: Review & Confirm ─────────────────────────────────────────────────

  const annualRevenue = Number(avgRent) * Number(totalUnits) * 12;

  const renderStep3 = () => (
    <View>
      <Text style={styles.stepTitle}>Review & Confirm</Text>
      <Text style={styles.stepSubtitle}>Check that everything looks correct</Text>

      <View style={styles.reviewCard}>
        {/* Property header */}
        <View style={styles.reviewHeader}>
          <View style={styles.reviewIconBg}>
            <MaterialIcons name="apartment" size={26} color={colors.onPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.reviewPropertyName}>{name}</Text>
            <View style={styles.reviewMetaRow}>
              <MaterialIcons name="location-on" size={13} color={colors.onSurfaceVariant} />
              <Text style={styles.reviewMeta}>{city}</Text>
            </View>
          </View>
        </View>

        <View style={styles.reviewDivider} />

        <ReviewDetail icon="home" label="Address" value={address} />
        <ReviewDetail icon="domain" label="Total Units" value={totalUnits} />
        <ReviewDetail
          icon="payments"
          label="Avg Rent / Unit"
          value={`₹${Number(avgRent).toLocaleString('en-IN')}/mo`}
          accent
        />
        <ReviewDetail
          icon="trending-up"
          label="Annual Revenue (est.)"
          value={`₹${annualRevenue.toLocaleString('en-IN')}`}
          accent
          last
        />
      </View>

      {submitError ? (
        <View style={styles.submitErrorCard}>
          <MaterialIcons name="error-outline" size={18} color={colors.error} />
          <Text style={styles.submitErrorText}>{submitError}</Text>
        </View>
      ) : null}
    </View>
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <ScreenHeader title="Add Property" showBack onBack={handleBack} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderProgress()}

          <View style={styles.formContainer}>
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
          </View>
        </ScrollView>

        {/* Footer navigation */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          {step > 1 ? (
            <TouchableOpacity style={styles.backBtnFooter} onPress={handleBack}>
              <MaterialIcons name="arrow-back" size={18} color={colors.primary} />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.footerSpacer} />
          )}

          <View style={styles.nextBtnWrapper}>
            {step < 3 ? (
              <PrimaryButton label="Next" onPress={handleNext} icon="arrow-forward" />
            ) : (
              <PrimaryButton
                label="Confirm & Add Property"
                onPress={handleConfirm}
                loading={loading}
                icon="check"
              />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function ReviewDetail({ icon, label, value, accent, last }) {
  return (
    <View style={[styles.reviewDetailRow, last && { marginBottom: 0 }]}>
      <MaterialIcons
        name={icon}
        size={16}
        color={accent ? colors.tertiaryFixedDim : colors.onSurfaceVariant}
      />
      <View style={styles.reviewDetailContent}>
        <Text style={styles.reviewDetailLabel}>{label}</Text>
        <Text style={[styles.reviewDetailValue, accent && styles.reviewDetailAccent]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },

  // ── Progress ──────────────────────────────────────────────────────────────────
  progressContainer: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 4,
  },
  stepLabel: {
    fontFamily: fonts.interSemiBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.onSurfaceVariant,
    marginBottom: 10,
  },
  progressTrack: {
    flexDirection: 'row',
    gap: 6,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  progressActive: {
    backgroundColor: colors.primary,
  },
  progressInactive: {
    backgroundColor: colors.outlineVariant,
  },

  // ── Form ─────────────────────────────────────────────────────────────────────
  scroll: { flexGrow: 1 },
  formContainer: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  stepTitle: {
    fontFamily: fonts.manropeBold,
    fontSize: 22,
    color: colors.onSurface,
    marginBottom: 4,
  },
  stepSubtitle: {
    fontFamily: fonts.interRegular,
    fontSize: 14,
    color: colors.onSurfaceVariant,
    marginBottom: 24,
  },

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
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: fonts.interRegular,
    fontSize: 15,
    color: colors.onSurface,
  },
  multilineInput: {
    minHeight: 68,
    paddingTop: 14,
  },
  inputError: {
    backgroundColor: colors.errorContainer,
  },
  fieldError: {
    fontFamily: fonts.interRegular,
    fontSize: 12,
    color: colors.error,
    marginTop: 4,
  },

  // ── City suggestions ──────────────────────────────────────────────────────────
  suggestionsBox: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 6,
    marginTop: 4,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surfaceContainerLowest,
  },
  suggestionText: {
    fontFamily: fonts.interRegular,
    fontSize: 14,
    color: colors.onSurface,
  },

  // ── Rent prefix row ───────────────────────────────────────────────────────────
  prefixRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 0,
  },
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

  // ── Review card ───────────────────────────────────────────────────────────────
  reviewCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: 16,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  reviewIconBg: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewPropertyName: {
    fontFamily: fonts.manropeBold,
    fontSize: 17,
    color: colors.onSurface,
    marginBottom: 3,
  },
  reviewMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  reviewMeta: {
    fontFamily: fonts.interRegular,
    fontSize: 13,
    color: colors.onSurfaceVariant,
  },
  reviewDivider: {
    height: 1,
    backgroundColor: colors.surfaceContainerHigh,
    marginBottom: 12,
  },
  reviewDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  reviewDetailContent: { flex: 1 },
  reviewDetailLabel: {
    fontFamily: fonts.interRegular,
    fontSize: 11,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  reviewDetailValue: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    color: colors.onSurface,
  },
  reviewDetailAccent: {
    fontFamily: fonts.manropeSemiBold,
    color: colors.onTertiaryContainer,
  },

  submitErrorCard: {
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
    paddingHorizontal: 24,
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
  footerSpacer: { flex: 0, width: 60 },
  nextBtnWrapper: { flex: 1 },
});
