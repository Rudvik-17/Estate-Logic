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
  Image,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { fonts } from '../../theme/typography';
import ScreenHeader from '../../components/ScreenHeader';
import PrimaryButton from '../../components/PrimaryButton';

const CITIES = [
  'Agra', 'Ahmedabad', 'Agartala', 'Ajmer', 'Aligarh', 'Alwar', 'Allahabad (Prayagraj)', 'Amritsar',
  'Aurangabad', 'Bangalore (Bengaluru)', 'Bareilly', 'Bathinda', 'Belgaum', 'Bhopal', 'Bhubaneswar',
  'Bikaner', 'Bilaspur', 'Chandigarh', 'Chennai', 'Coimbatore', 'Cuttack', 'Dehradun', 'Delhi',
  'Dhanbad', 'Dharamshala', 'Firozabad', 'Ghaziabad', 'Gorakhpur', 'Gulbarga', 'Guntur', 'Gurgaon (Gurugram)',
  'Guwahati', 'Gwalior', 'Haldwani', 'Haridwar', 'Hubli-Dharwad', 'Hyderabad', 'Imphal', 'Indore',
  'Jabalpur', 'Jaipur', 'Jalandhar', 'Jammu', 'Jamshedpur', 'Jhansi', 'Jodhpur', 'Kakinada',
  'Kanpur', 'Kochi (Cochin)', 'Kohima', 'Kolkata', 'Kota', 'Kozhikode', 'Kurnool', 'Lucknow',
  'Ludhiana', 'Madurai', 'Mangalore (Mangaluru)', 'Meerut', 'Moradabad', 'Mumbai', 'Muzaffarnagar',
  'Mysore (Mysuru)', 'Nagpur', 'Nashik', 'Navi Mumbai', 'Nellore', 'Noida', 'Patiala', 'Patna',
  'Pondicherry', 'Pune', 'Raipur', 'Rajkot', 'Ranchi', 'Roorkee', 'Rourkela', 'Saharanpur',
  'Salem', 'Shillong', 'Shimla', 'Siliguri', 'Solapur', 'Srinagar', 'Surat', 'Thane',
  'Thiruvananthapuram', 'Tiruchirappalli', 'Tirupati', 'Tiruppur', 'Udaipur', 'Vadodara',
  'Varanasi', 'Vellore', 'Vijayawada', 'Visakhapatnam', 'Warangal'
];
const TOTAL_STEPS = 3;

const PROPERTY_TYPES = [
  { key: 'apartment', label: 'Apartment', icon: 'apartment' },
  { key: 'commercial', label: 'Commercial', icon: 'business' },
];

export default function AddPropertyScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [step, setStep] = useState(1);

  // Step 1
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [propertyImage, setPropertyImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handlePickPropertyImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please grant library permissions to upload a photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const selectedUri = result.assets[0].uri;
      setUploadingImage(true);

      const response = await fetch(selectedUri);
      const blob = await response.blob();
      const fileExt = selectedUri.split('.').pop() || 'jpg';
      const fileName = `${user.id}-property-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('properties')
        .upload(fileName, blob, {
          contentType: blob.type || 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('properties')
        .getPublicUrl(fileName);

      setPropertyImage(publicUrl);
    } catch (err) {
      console.error('Property image upload error:', err);
      Alert.alert('Error', 'Failed to upload photo: ' + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemovePropertyImage = () => {
    setPropertyImage(null);
  };

  // Step 1 — property type
  const [propertyType, setPropertyType] = useState('apartment');

  // Step 2
  const [totalUnits, setTotalUnits] = useState('');
  const [avgRent, setAvgRent] = useState('');
  const [commArea, setCommArea] = useState('');
  const [commRate, setCommRate] = useState('');
  const [commParkName, setCommParkName] = useState('');
  const [commBuildingName, setCommBuildingName] = useState('');
  const [commPrefix, setCommPrefix] = useState('Office');
  const [commStartNum, setCommStartNum] = useState('101');

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
    if (propertyType === 'commercial') {
      if (!commParkName.trim()) errs.commParkName = 'Commercial complex / park name is required.';
      if (!commBuildingName.trim()) errs.commBuildingName = 'Building / tower name is required.';
    } else {
      if (!name.trim()) errs.name = 'Property name is required.';
    }
    if (!address.trim()) errs.address = 'Address is required.';
    if (!city.trim()) errs.city = 'City is required.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs = {};
    const units = Number(totalUnits);
    if (!totalUnits.trim()) {
      errs.totalUnits = propertyType === 'commercial' ? 'Total offices/shops is required.' : 'Total units is required.';
    } else if (!Number.isInteger(units) || units <= 0) {
      errs.totalUnits = propertyType === 'commercial' ? 'Enter a valid number of offices/shops.' : 'Enter a valid number of units.';
    }

    if (propertyType === 'commercial') {
      const area = Number(commArea);
      const rate = Number(commRate);
      if (!commArea.trim()) {
        errs.commArea = 'Office area is required.';
      } else if (isNaN(area) || area <= 0) {
        errs.commArea = 'Enter a valid area (sq. ft.).';
      }
      if (!commRate.trim()) {
        errs.commRate = 'Rent per sq. ft. is required.';
      } else if (isNaN(rate) || rate <= 0) {
        errs.commRate = 'Enter a valid rent rate.';
      }
      if (commStartNum.trim()) {
        const start = Number(commStartNum);
        if (!Number.isInteger(start) || start <= 0) {
          errs.commStartNum = 'Enter a valid starting number.';
        }
      } else {
        errs.commStartNum = 'Starting number is required.';
      }
    } else {
      const rent = Number(avgRent);
      if (!avgRent.trim()) {
        errs.avgRent = 'Rent per unit is required.';
      } else if (isNaN(rent) || rent <= 0) {
        errs.avgRent = 'Enter a valid rent amount.';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const isNextDisabled = () => {
    if (step === 1) {
      if (propertyType === 'commercial') {
        return (
          !commParkName.trim() ||
          !commBuildingName.trim() ||
          !address.trim() ||
          !city.trim()
        );
      } else {
        return !name.trim() || !address.trim() || !city.trim();
      }
    }
    if (step === 2) {
      if (propertyType === 'commercial') {
        return (
          !totalUnits.trim() ||
          !commArea.trim() ||
          !commRate.trim() ||
          !commStartNum.trim()
        );
      } else {
        return !totalUnits.trim() || !avgRent.trim();
      }
    }
    return false;
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

    const finalName = propertyType === 'commercial'
      ? `${commParkName.trim()} - ${commBuildingName.trim()}`
      : name.trim();

    const { data: inserted, error: insertError } = await supabase
      .from('properties')
      .insert({
        owner_id: user.id,
        name: finalName,
        address: address.trim(),
        city: city.trim(),
        total_units: Number(totalUnits),
        avg_rent: propertyType === 'commercial' ? Number(commArea) * Number(commRate) : Number(avgRent),
        property_type: propertyType,
        image_url: propertyImage,
      })
      .select('id')
      .single();

    if (insertError) {
      setSubmitError(insertError.message);
      setLoading(false);
      return;
    }

    // Batch-insert unit rows (best-effort — non-blocking if units table isn't migrated yet)
    const count = Math.min(Number(totalUnits), 500);
    const unitRows = Array.from({ length: count }, (_, i) => {
      let unitNum = '';
      if (propertyType === 'commercial') {
        const prefix = commPrefix.trim() ? `${commPrefix.trim()} ` : '';
        const start = Number(commStartNum) || 101;
        unitNum = `${prefix}${start + i}`;
      } else {
        unitNum = String(101 + i);
      }
      return {
        property_id: inserted.id,
        unit_number: unitNum,
      };
    });
    await supabase.from('units').insert(unitRows);

    setLoading(false);
    Alert.alert(
      'Property Added',
      `${finalName} has been added to your portfolio with ${count} unit${count > 1 ? 's' : ''}.`,
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

      <Text style={styles.fieldLabel}>PROPERTY TYPE</Text>
      <View style={styles.typeGrid}>
        {PROPERTY_TYPES.map(pt => (
          <TouchableOpacity
            key={pt.key}
            style={[styles.typeChip, propertyType === pt.key && styles.typeChipActive]}
            onPress={() => setPropertyType(pt.key)}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name={pt.icon}
              size={20}
              color={propertyType === pt.key ? colors.onPrimary : colors.onSurfaceVariant}
            />
            <Text style={[styles.typeChipLabel, propertyType === pt.key && styles.typeChipLabelActive]}>
              {pt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {propertyType === 'commercial' ? (
        <>
          <Text style={[styles.fieldLabel, { marginTop: 20 }]}>COMMERCIAL COMPLEX / TECH PARK</Text>
          <TextInput
            style={[styles.input, errors.commParkName && styles.inputError]}
            value={commParkName}
            onChangeText={t => { setCommParkName(t); setErrors(e => ({ ...e, commParkName: null })); }}
            placeholder="e.g. Prestige Tech Park"
            placeholderTextColor={colors.outline}
            autoCapitalize="words"
            autoCorrect={false}
          />
          {errors.commParkName ? <Text style={styles.fieldError}>{errors.commParkName}</Text> : null}

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>BUILDING / TOWER NAME</Text>
          <TextInput
            style={[styles.input, errors.commBuildingName && styles.inputError]}
            value={commBuildingName}
            onChangeText={t => { setCommBuildingName(t); setErrors(e => ({ ...e, commBuildingName: null })); }}
            placeholder="e.g. Jupiter Block"
            placeholderTextColor={colors.outline}
            autoCapitalize="words"
            autoCorrect={false}
          />
          {errors.commBuildingName ? <Text style={styles.fieldError}>{errors.commBuildingName}</Text> : null}
        </>
      ) : (
        <>
          <Text style={[styles.fieldLabel, { marginTop: 20 }]}>PROPERTY NAME</Text>
          <TextInput
            style={[styles.input, errors.name && styles.inputError]}
            value={name}
            onChangeText={t => { setName(t); setErrors(e => ({ ...e, name: null })); }}
            placeholder="e.g. Prestige Shantiniketan"
            placeholderTextColor={colors.outline}
            autoCapitalize="words"
            autoCorrect={false}
          />
          {errors.name ? <Text style={styles.fieldError}>{errors.name}</Text> : null}
        </>
      )}

      <Text style={[styles.fieldLabel, { marginTop: 16 }]}>ADDRESS</Text>
      <TextInput
        style={[styles.input, styles.multilineInput, errors.address && styles.inputError]}
        value={address}
        onChangeText={t => { setAddress(t); setErrors(e => ({ ...e, address: null })); }}
        placeholder={propertyType === 'commercial' ? "e.g. Unit 3A, 4th Floor, Phase 2, DLF CyberCity" : "e.g. Flat 502, Tower 3, Prestige Shantiniketan, Whitefield"}
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

      <Text style={[styles.fieldLabel, { marginTop: 20 }]}>PROPERTY PHOTO</Text>
      <TouchableOpacity
        style={styles.photoUploadContainer}
        onPress={handlePickPropertyImage}
        disabled={uploadingImage}
        activeOpacity={0.8}
      >
        {propertyImage ? (
          <View style={styles.photoContainer}>
            <Image source={{ uri: propertyImage }} style={styles.photoImage} />
            <TouchableOpacity style={styles.removePhotoBadge} onPress={handleRemovePropertyImage}>
              <MaterialIcons name="close" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.photoPlaceholder}>
            {uploadingImage ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <MaterialIcons name="add-a-photo" size={24} color={colors.outline} />
                <Text style={styles.photoPlaceholderText}>Add a photo of your property</Text>
              </>
            )}
          </View>
        )}
      </TouchableOpacity>
    </View>
  );

  // ── Step 2: Unit Configuration ───────────────────────────────────────────────

  const renderStep2 = () => {
    if (propertyType === 'commercial') {
      const areaVal = Number(commArea);
      const rateVal = Number(commRate);
      const estimatedRent = !isNaN(areaVal) && !isNaN(rateVal) && areaVal > 0 && rateVal > 0 ? areaVal * rateVal : 0;

      return (
        <View>
          <Text style={styles.stepTitle}>Commercial Configuration</Text>
          <Text style={styles.stepSubtitle}>Set up the office/shop area and rent details</Text>

          <Text style={styles.fieldLabel}>TOTAL OFFICES / SHOPS</Text>
          <TextInput
            style={[styles.input, errors.totalUnits && styles.inputError]}
            value={totalUnits}
            onChangeText={t => { setTotalUnits(t); setErrors(e => ({ ...e, totalUnits: null })); }}
            placeholder="e.g. 15"
            placeholderTextColor={colors.outline}
            keyboardType="number-pad"
          />
          {errors.totalUnits ? <Text style={styles.fieldError}>{errors.totalUnits}</Text> : null}

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>AVERAGE OFFICE AREA (SQ. FT.)</Text>
          <TextInput
            style={[styles.input, errors.commArea && styles.inputError]}
            value={commArea}
            onChangeText={t => { setCommArea(t); setErrors(e => ({ ...e, commArea: null })); }}
            placeholder="e.g. 1500"
            placeholderTextColor={colors.outline}
            keyboardType="number-pad"
          />
          {errors.commArea ? <Text style={styles.fieldError}>{errors.commArea}</Text> : null}

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>RENT PER SQ. FT. (MONTHLY)</Text>
          <View style={styles.prefixRow}>
            <View style={styles.prefixBox}>
              <Text style={styles.prefixText}>₹</Text>
            </View>
            <TextInput
              style={[styles.input, styles.prefixInput, errors.commRate && styles.inputError]}
              value={commRate}
              onChangeText={t => { setCommRate(t); setErrors(e => ({ ...e, commRate: null })); }}
              placeholder="e.g. 75"
              placeholderTextColor={colors.outline}
              keyboardType="number-pad"
            />
          </View>
          {errors.commRate ? <Text style={styles.fieldError}>{errors.commRate}</Text> : null}

          <View style={styles.sideBySideRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>OFFICE NO. PREFIX</Text>
              <TextInput
                style={styles.input}
                value={commPrefix}
                onChangeText={setCommPrefix}
                placeholder="e.g. Office, Shop"
                placeholderTextColor={colors.outline}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>STARTING NUMBER</Text>
              <TextInput
                style={[styles.input, errors.commStartNum && styles.inputError]}
                value={commStartNum}
                onChangeText={t => { setCommStartNum(t); setErrors(e => ({ ...e, commStartNum: null })); }}
                placeholder="e.g. 101"
                placeholderTextColor={colors.outline}
                keyboardType="number-pad"
              />
              {errors.commStartNum ? <Text style={styles.fieldError}>{errors.commStartNum}</Text> : null}
            </View>
          </View>

          {estimatedRent > 0 ? (
            <View style={styles.commercialCalcBox}>
              <MaterialIcons name="info-outline" size={16} color={colors.primary} />
              <Text style={styles.commercialCalcText}>
                Estimated Rent per Unit:{' '}
                <Text style={styles.commercialCalcBold}>
                  ₹{estimatedRent.toLocaleString('en-IN')}/mo
                </Text>{' '}
                per office/shop
              </Text>
            </View>
          ) : null}
        </View>
      );
    }

    // Apartment configuration (default)
    return (
      <View>
        <Text style={styles.stepTitle}>Unit Configuration</Text>
        <Text style={styles.stepSubtitle}>Set up the unit and rent details</Text>

        <Text style={styles.fieldLabel}>TOTAL APARTMENTS / UNITS</Text>
        <TextInput
          style={[styles.input, errors.totalUnits && styles.inputError]}
          value={totalUnits}
          onChangeText={t => { setTotalUnits(t); setErrors(e => ({ ...e, totalUnits: null })); }}
          placeholder="e.g. 120"
          placeholderTextColor={colors.outline}
          keyboardType="number-pad"
        />
        {errors.totalUnits ? <Text style={styles.fieldError}>{errors.totalUnits}</Text> : null}

        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>RENT PER UNIT</Text>
        <View style={styles.prefixRow}>
          <View style={styles.prefixBox}>
            <Text style={styles.prefixText}>₹</Text>
          </View>
          <TextInput
            style={[styles.input, styles.prefixInput, errors.avgRent && styles.inputError]}
            value={avgRent}
            onChangeText={t => { setAvgRent(t); setErrors(e => ({ ...e, avgRent: null })); }}
            placeholder="e.g. 35000"
            placeholderTextColor={colors.outline}
            keyboardType="number-pad"
          />
        </View>
        {errors.avgRent ? <Text style={styles.fieldError}>{errors.avgRent}</Text> : null}
      </View>
    );
  };

  // ── Step 3: Review & Confirm ─────────────────────────────────────────────────

  const computedAvgRent = propertyType === 'commercial' ? Number(commArea) * Number(commRate) : Number(avgRent);
  const selectedType = PROPERTY_TYPES.find(pt => pt.key === propertyType);

  const renderStep3 = () => (
    <View>
      <Text style={styles.stepTitle}>Review & Confirm</Text>
      <Text style={styles.stepSubtitle}>Check that everything looks correct</Text>

      <View style={styles.reviewCard}>
        {/* Property header */}
        <View style={styles.reviewHeader}>
          <View style={styles.reviewIconBg}>
            <MaterialIcons name={selectedType?.icon ?? 'apartment'} size={26} color={colors.onPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.reviewPropertyName}>
              {propertyType === 'commercial'
                ? `${commParkName.trim()} - ${commBuildingName.trim()}`
                : name.trim()}
            </Text>
            <View style={styles.reviewMetaRow}>
              <MaterialIcons name="location-on" size={13} color={colors.onSurfaceVariant} />
              <Text style={styles.reviewMeta}>{city}</Text>
            </View>
          </View>
        </View>

        <View style={styles.reviewDivider} />

        {propertyImage && (
          <Image source={{ uri: propertyImage }} style={styles.reviewPropertyImage} />
        )}

        {propertyType === 'commercial' ? (
          <>
            <ReviewDetail icon="business" label="Commercial Park" value={commParkName} />
            <ReviewDetail icon="domain" label="Building / Tower" value={commBuildingName} />
          </>
        ) : (
          <ReviewDetail icon={selectedType?.icon ?? 'apartment'} label="Property Type" value={selectedType?.label ?? 'Apartment'} />
        )}
        <ReviewDetail icon="home" label="Address" value={address} />
        <ReviewDetail
          icon="domain"
          label={propertyType === 'commercial' ? "Total Offices / Shops" : "Total Units"}
          value={totalUnits}
        />
        {propertyType === 'commercial' && (
          <>
            <ReviewDetail
              icon="aspect-ratio"
              label="Avg Area per Office"
              value={`${Number(commArea).toLocaleString('en-IN')} sq. ft.`}
            />
            <ReviewDetail
              icon="tag"
              label="Office Numbering"
              value={`Prefix: "${commPrefix}", Start: ${commStartNum}`}
            />
          </>
        )}
        <ReviewDetail
          icon="payments"
          label={propertyType === 'commercial' ? "Rent / Office" : "Rent / Unit"}
          value={`₹${computedAvgRent.toLocaleString('en-IN')}/mo`}
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
          <View style={styles.nextBtnWrapper}>
            {step < 3 ? (
              <PrimaryButton
                label="Next"
                onPress={handleNext}
                icon="arrow-forward"
                disabled={isNextDisabled()}
              />
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
  const { colors } = useTheme();
  const styles = getStyles(colors);
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

const getStyles = (colors) => StyleSheet.create({
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
  sideBySideRow: {
    flexDirection: 'row',
    gap: 12,
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

  // ── Property type picker ──────────────────────────────────────────────────────
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 4,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: colors.surfaceContainerHighest,
  },
  typeChipActive: {
    backgroundColor: colors.primary,
  },
  typeChipLabel: {
    fontFamily: fonts.interMedium,
    fontSize: 13,
    color: colors.onSurfaceVariant,
  },
  typeChipLabelActive: {
    color: colors.onPrimary,
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

  commercialCalcBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryContainer,
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  commercialCalcText: {
    fontFamily: fonts.interRegular,
    fontSize: 13,
    color: colors.onPrimaryContainer,
  },
  commercialCalcBold: {
    fontFamily: fonts.manropeSemiBold,
    fontWeight: 'bold',
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

  // ── Photo upload styles ──────────────────────────────────────────────────────────
  photoUploadContainer: {
    marginTop: 8,
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    borderStyle: 'dashed',
    height: 150,
    overflow: 'hidden',
  },
  photoContainer: {
    flex: 1,
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removePhotoBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoPlaceholderText: {
    fontFamily: fonts.interMedium,
    fontSize: 13,
    color: colors.onSurfaceVariant,
  },
  reviewPropertyImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 16,
    resizeMode: 'cover',
  },
});
