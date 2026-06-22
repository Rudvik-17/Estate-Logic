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

export default function EditPropertyScreen({ navigation, route }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const property = route.params?.property;

  const [name, setName] = useState(property?.name ?? '');
  const [address, setAddress] = useState(property?.address ?? '');
  const [city, setCity] = useState(property?.city ?? '');
  const [totalUnits, setTotalUnits] = useState(String(property?.total_units ?? ''));
  const [avgRent, setAvgRent] = useState(String(property?.avg_rent ?? ''));
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [propertyImage, setPropertyImage] = useState(property?.image_url ?? null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState(null);

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

  if (!user) return null;

  const filteredCities = CITIES.filter(
    c => !city.trim() || c.toLowerCase().startsWith(city.toLowerCase()),
  );

  const validate = () => {
    const errs = {};
    if (!name.trim()) errs.name = 'Property name is required.';
    if (!address.trim()) errs.address = 'Address is required.';
    if (!city.trim()) errs.city = 'City is required.';
    const units = Number(totalUnits);
    if (!totalUnits.trim()) errs.totalUnits = 'Total units is required.';
    else if (!Number.isInteger(units) || units <= 0) errs.totalUnits = 'Enter a valid number of units.';
    const rent = Number(avgRent);
    if (!avgRent.trim()) errs.avgRent = 'Rent per unit is required.';
    else if (isNaN(rent) || rent <= 0) errs.avgRent = 'Enter a valid rent amount.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSubmitError(null);
    setLoading(true);
    const { error: updateError } = await supabase
      .from('properties')
      .update({
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        total_units: Number(totalUnits),
        avg_rent: Number(avgRent),
        image_url: propertyImage,
      })
      .eq('id', property.id)
      .eq('owner_id', user.id);
    setLoading(false);
    if (updateError) {
      setSubmitError(updateError.message);
      return;
    }
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Edit Property" showBack onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formContainer}>
            <Text style={styles.sectionTitle}>Property Details</Text>
            <Text style={styles.sectionSubtitle}>Update the information for this property</Text>

            {/* Name */}
            <Text style={styles.fieldLabel}>PROPERTY NAME</Text>
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

            {/* Address */}
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>ADDRESS</Text>
            <TextInput
              style={[styles.input, styles.multilineInput, errors.address && styles.inputError]}
              value={address}
              onChangeText={t => { setAddress(t); setErrors(e => ({ ...e, address: null })); }}
              placeholder="e.g. Flat 402, Block B, Raheja Mindspace"
              placeholderTextColor={colors.outline}
              autoCapitalize="sentences"
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
            {errors.address ? <Text style={styles.fieldError}>{errors.address}</Text> : null}

            {/* City */}
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

            {/* Total Units */}
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>TOTAL UNITS</Text>
            <TextInput
              style={[styles.input, errors.totalUnits && styles.inputError]}
              value={totalUnits}
              onChangeText={t => { setTotalUnits(t); setErrors(e => ({ ...e, totalUnits: null })); }}
              placeholder="e.g. 120"
              placeholderTextColor={colors.outline}
              keyboardType="number-pad"
            />
            {errors.totalUnits ? <Text style={styles.fieldError}>{errors.totalUnits}</Text> : null}

            {/* Average Rent */}
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>RENT PER UNIT</Text>
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

            {/* Property Photo */}
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

            {submitError ? (
              <View style={styles.submitErrorCard}>
                <MaterialIcons name="error-outline" size={18} color={colors.error} />
                <Text style={styles.submitErrorText}>{submitError}</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <PrimaryButton label="Save Changes" onPress={handleSave} loading={loading} icon="check" />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },

  scroll: { flexGrow: 1 },
  formContainer: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  sectionTitle: {
    fontFamily: fonts.manropeBold,
    fontSize: 22,
    color: colors.onSurface,
    marginBottom: 4,
  },
  sectionSubtitle: {
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

  prefixRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
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

  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: colors.surfaceContainerLowest,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },

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
});
