import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  StyleSheet,
  TouchableOpacity,
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

const STEPS = ['Property Details', 'Personal Info', 'Co-occupants', 'Rental Agreement'];
const CO_OCCUPANT_OPTIONS = ['0', '1', '2', '3+'];

export default function TenantOnboardingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);

  // Step 0 — Property Details
  const [propertyId, setPropertyId] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');

  // Step 1 — Personal Info
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [occupation, setOccupation] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [coOccupants, setCoOccupants] = useState('0');

  // Step 2 — Co-occupants (simplified)
  const [coOccupantName, setCoOccupantName] = useState('');

  // Step 3 — Rental agreement checkbox
  const [agreed, setAgreed] = useState(false);

  const [properties, setProperties] = useState([]);
  const [propertiesLoaded, setPropertiesLoaded] = useState(false);

  const loadProperties = useCallback(async () => {
    if (!user || propertiesLoaded) return;
    const { data } = await supabase
      .from('properties')
      .select('id, name, city')
      .eq('owner_id', user.id);
    setProperties(data ?? []);
    if (data?.[0]) setPropertyId(data[0].id);
    setPropertiesLoaded(true);
  }, [user?.id, propertiesLoaded]);

  React.useEffect(() => { loadProperties(); }, [loadProperties]);

  if (!user) return null;

  const validate = () => {
    const errs = {};
    if (step === 0) {
      if (!unitNumber.trim()) errs.unitNumber = 'Unit number is required';
      if (!startDate.trim()) errs.startDate = 'Start date is required (YYYY-MM-DD)';
      if (!endDate.trim()) errs.endDate = 'End date is required (YYYY-MM-DD)';
      if (!monthlyRent.trim() || isNaN(Number(monthlyRent))) errs.monthlyRent = 'Enter a valid rent amount';
    }
    if (step === 1) {
      if (!fullName.trim()) errs.fullName = 'Full name is required';
      if (!age.trim() || isNaN(Number(age))) errs.age = 'Enter a valid age';
    }
    if (step === 3) {
      if (!agreed) errs.agreed = 'Please acknowledge the rental agreement';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (!validate()) return;
    if (step < 3) { setStep(s => s + 1); return; }
    handleSubmit();
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    setLoading(true);
    // Insert tenant row
    const { data: tenantData, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        owner_id: user.id,
        property_id: propertyId,
        full_name: fullName,
        unit_number: unitNumber,
        email,
        phone,
        status: 'pending',
      })
      .select()
      .single();

    if (tenantError) {
      setSubmitError(tenantError.message);
      setLoading(false);
      return;
    }

    // Insert lease
    const { error: leaseError } = await supabase
      .from('leases')
      .insert({
        tenant_id: tenantData.id,
        property_id: propertyId,
        start_date: startDate,
        end_date: endDate,
        monthly_rent: Number(monthlyRent),
        status: 'pending_signature',
      });

    setLoading(false);
    if (leaseError) {
      setSubmitError(leaseError.message);
      return;
    }

    Alert.alert('Tenant Added', `${fullName} has been added. Lease pending signature.`, [
      { text: 'Done', onPress: () => navigation.goBack() },
    ]);
  };

  const InputField = ({ label, value, onChange, placeholder, keyboardType, error, hint }) => (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, error && styles.inputError]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.outline}
        keyboardType={keyboardType || 'default'}
        autoCapitalize="none"
      />
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      {error ? <Text style={styles.fieldErrorText}>{error}</Text> : null}
    </View>
  );

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <>
            <Text style={styles.stepTitle}>Property Details</Text>
            <Text style={styles.stepSubtitle}>Select the property and unit for this tenant.</Text>

            {properties.length > 0 ? (
              <View style={styles.fieldWrapper}>
                <Text style={styles.fieldLabel}>PROPERTY</Text>
                {properties.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.optionBtn, propertyId === p.id && styles.optionBtnActive]}
                    onPress={() => setPropertyId(p.id)}
                  >
                    <Text style={[styles.optionText, propertyId === p.id && styles.optionTextActive]}>
                      {p.name} · {p.city}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            <InputField label="UNIT NUMBER" value={unitNumber} onChange={setUnitNumber} placeholder="e.g. 402-B" error={fieldErrors.unitNumber} />
            <InputField label="START DATE" value={startDate} onChange={setStartDate} placeholder="YYYY-MM-DD" error={fieldErrors.startDate} />
            <InputField label="END DATE" value={endDate} onChange={setEndDate} placeholder="YYYY-MM-DD" error={fieldErrors.endDate} />
            <InputField label="MONTHLY RENT (₹)" value={monthlyRent} onChange={setMonthlyRent} placeholder="e.g. 45000" keyboardType="numeric" error={fieldErrors.monthlyRent} />
          </>
        );
      case 1:
        return (
          <>
            <Text style={styles.stepTitle}>Personal Info</Text>
            <Text style={styles.stepSubtitle}>Primary tenant details.</Text>
            <InputField label="FULL NAME" value={fullName} onChange={setFullName} placeholder="Arjun Sharma" error={fieldErrors.fullName} />
            <InputField label="AGE" value={age} onChange={setAge} placeholder="28" keyboardType="numeric" error={fieldErrors.age} />
            <InputField label="OCCUPATION" value={occupation} onChange={setOccupation} placeholder="Software Engineer" />
            <InputField label="EMAIL" value={email} onChange={setEmail} placeholder="tenant@email.com" keyboardType="email-address" />
            <InputField label="PHONE" value={phone} onChange={setPhone} placeholder="+91 98765 43210" keyboardType="phone-pad" />

            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>NUMBER OF CO-OCCUPANTS</Text>
              <View style={styles.optionRow}>
                {CO_OCCUPANT_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.coOptBtn, coOccupants === opt && styles.coOptBtnActive]}
                    onPress={() => setCoOccupants(opt)}
                  >
                    <Text style={[styles.coOptText, coOccupants === opt && styles.coOptTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        );
      case 2:
        return (
          <>
            <Text style={styles.stepTitle}>Co-occupants</Text>
            <Text style={styles.stepSubtitle}>Add details for co-residents (if any).</Text>
            {coOccupants === '0' ? (
              <View style={styles.noCoOccupant}>
                <MaterialIcons name="person" size={32} color={colors.outline} />
                <Text style={styles.noCoOccupantText}>No co-occupants selected in previous step.</Text>
              </View>
            ) : (
              <>
                <InputField label="CO-OCCUPANT FULL NAME" value={coOccupantName} onChange={setCoOccupantName} placeholder="Name of co-occupant" />
                <View style={styles.uploadBox}>
                  <MaterialIcons name="upload-file" size={24} color={colors.outline} />
                  <Text style={styles.uploadLabel}>Attach ID Proof</Text>
                  <Text style={styles.uploadHint}>Aadhaar / PAN Card (JPG, PNG, PDF)</Text>
                </View>
              </>
            )}
          </>
        );
      case 3:
        return (
          <>
            <Text style={styles.stepTitle}>Rental Agreement</Text>
            <Text style={styles.stepSubtitle}>Review and acknowledge the agreement before adding.</Text>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Lease Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryKey}>Tenant</Text>
                <Text style={styles.summaryValue}>{fullName || '—'}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryKey}>Unit</Text>
                <Text style={styles.summaryValue}>{unitNumber || '—'}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryKey}>Period</Text>
                <Text style={styles.summaryValue}>{startDate} → {endDate}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryKey}>Monthly Rent</Text>
                <Text style={styles.summaryValue}>₹{monthlyRent ? Number(monthlyRent).toLocaleString('en-IN') : '—'}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.checkRow} onPress={() => setAgreed(v => !v)}>
              <MaterialIcons
                name={agreed ? 'check-box' : 'check-box-outline-blank'}
                size={22}
                color={agreed ? colors.tertiaryFixedDim : colors.outline}
              />
              <Text style={styles.checkLabel}>
                I confirm the details above are correct and the tenant has been informed of the lease terms.
              </Text>
            </TouchableOpacity>
            {fieldErrors.agreed ? <Text style={styles.fieldErrorText}>{fieldErrors.agreed}</Text> : null}
          </>
        );
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Add Resident" showBack onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Step indicator */}
        <View style={styles.stepIndicator}>
          {STEPS.map((s, i) => (
            <View key={s} style={styles.stepDotWrapper}>
              <View style={[styles.stepDot, i === step && styles.stepDotActive, i < step && styles.stepDotDone]}>
                {i < step ? (
                  <MaterialIcons name="check" size={12} color={colors.onPrimary} />
                ) : (
                  <Text style={[styles.stepDotNum, i === step && styles.stepDotNumActive]}>{i + 1}</Text>
                )}
              </View>
              {i < STEPS.length - 1 ? (
                <View style={[styles.stepLine, i < step && styles.stepLineDone]} />
              ) : null}
            </View>
          ))}
        </View>

        <View style={styles.formBody}>{renderStep()}</View>

        {submitError ? (
          <View style={styles.submitErrorBox}>
            <Text style={styles.submitErrorText}>{submitError}</Text>
          </View>
        ) : null}

        {/* Security notice */}
        <View style={styles.securityRow}>
          <MaterialIcons name="verified-user" size={14} color={colors.tertiaryFixedDim} />
          <Text style={styles.securityText}>
            Data encrypted using 256-bit SSL. Never shared without consent.
          </Text>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelText}>Cancel & Save Progress</Text>
          </TouchableOpacity>
          <View style={styles.nextBtnWrapper}>
            <PrimaryButton
              label={step === 3 ? 'Add Tenant' : 'Continue'}
              onPress={handleNext}
              loading={loading}
              icon={step === 3 ? 'person-add' : 'arrow-forward'}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },

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
  stepDotNum: { fontFamily: fonts.interSemiBold, fontSize: 12, color: colors.onSurfaceVariant },
  stepDotNumActive: { color: colors.onPrimary },
  stepLine: { flex: 1, height: 2, backgroundColor: colors.surfaceContainerHighest, marginHorizontal: 4 },
  stepLineDone: { backgroundColor: colors.tertiaryFixedDim },

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
    paddingVertical: 12,
    fontFamily: fonts.interRegular,
    fontSize: 15,
    color: colors.onSurface,
  },
  inputError: {
    backgroundColor: 'rgba(186, 26, 26, 0.08)',
  },
  fieldHint: {
    fontFamily: fonts.interRegular, fontSize: 11,
    color: colors.onSurfaceVariant, marginTop: 4,
  },
  fieldErrorText: {
    fontFamily: fonts.interRegular, fontSize: 12,
    color: colors.error, marginTop: 4,
  },

  optionBtn: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
  },
  optionBtnActive: { backgroundColor: colors.primaryContainer },
  optionText: {
    fontFamily: fonts.interMedium, fontSize: 14, color: colors.onSurface,
  },
  optionTextActive: { color: colors.onPrimary },

  optionRow: { flexDirection: 'row', gap: 8 },
  coOptBtn: {
    width: 48, height: 40, borderRadius: 8,
    backgroundColor: colors.surfaceContainerHighest,
    alignItems: 'center', justifyContent: 'center',
  },
  coOptBtnActive: { backgroundColor: colors.primary },
  coOptText: { fontFamily: fonts.interSemiBold, fontSize: 14, color: colors.onSurface },
  coOptTextActive: { color: colors.onPrimary },

  uploadBox: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  uploadLabel: { fontFamily: fonts.interSemiBold, fontSize: 14, color: colors.onSurface },
  uploadHint: { fontFamily: fonts.interRegular, fontSize: 12, color: colors.onSurfaceVariant },

  noCoOccupant: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  noCoOccupantText: { fontFamily: fonts.interRegular, fontSize: 14, color: colors.onSurfaceVariant, textAlign: 'center' },

  summaryCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  summaryTitle: { fontFamily: fonts.manropeSemiBold, fontSize: 16, color: colors.onSurface, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryKey: { fontFamily: fonts.interRegular, fontSize: 13, color: colors.onSurfaceVariant },
  summaryValue: { fontFamily: fonts.interSemiBold, fontSize: 13, color: colors.onSurface },

  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 4 },
  checkLabel: {
    fontFamily: fonts.interRegular, fontSize: 13,
    color: colors.onSurface, flex: 1, lineHeight: 18,
  },

  submitErrorBox: {
    backgroundColor: colors.errorContainer,
    marginHorizontal: 20,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  submitErrorText: { fontFamily: fonts.interRegular, fontSize: 13, color: colors.error },

  securityRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 6, paddingHorizontal: 20, marginBottom: 16,
  },
  securityText: { fontFamily: fonts.interRegular, fontSize: 12, color: colors.onSurfaceVariant, flex: 1 },

  actionRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, alignItems: 'center' },
  cancelBtn: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  cancelText: { fontFamily: fonts.interMedium, fontSize: 13, color: colors.onSurfaceVariant },
  nextBtnWrapper: { flex: 1 },
});
