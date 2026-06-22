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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { fonts } from '../../theme/typography';
import ScreenHeader from '../../components/ScreenHeader';
import PrimaryButton from '../../components/PrimaryButton';

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];

export default function EditProfileScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const insets = useSafeAreaInsets();
  const { user, profile, refetchProfile } = useAuth();

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [age, setAge] = useState(profile?.age ? String(profile.age) : '');
  const [gender, setGender] = useState(profile?.gender ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? null);
  
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please grant library permissions to upload an avatar.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const selectedUri = result.assets[0].uri;
      setUploading(true);

      // Fetch blob
      const response = await fetch(selectedUri);
      const blob = await response.blob();
      const fileExt = selectedUri.split('.').pop() || 'jpg';
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, {
          contentType: blob.type || 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      setAvatarUrl(publicUrl);
    } catch (err) {
      console.error('Avatar upload error:', err);
      Alert.alert('Error', 'Failed to upload profile picture: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const validate = () => {
    const errs = {};
    if (!fullName.trim()) errs.fullName = 'Full name is required.';
    
    if (age.trim()) {
      const parsedAge = Number(age);
      if (!Number.isInteger(parsedAge) || parsedAge <= 0 || parsedAge > 120) {
        errs.age = 'Enter a valid age (1-120).';
      }
    }
    
    if (phone.trim()) {
      const cleaned = phone.replace(/[^0-9+]/g, '');
      if (cleaned.length < 8 || cleaned.length > 15) {
        errs.phone = 'Enter a valid phone number.';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);

    try {
      const updates = {
        id: user.id,
        full_name: fullName.trim(),
        age: age.trim() ? Number(age) : null,
        gender: gender || null,
        phone: phone.trim() || null,
        avatar_url: avatarUrl,
        email: user.email,
        role: profile?.role ?? 'owner',
      };

      const { error } = await supabase
        .from('users')
        .upsert(updates, { onConflict: 'id' });

      if (error) throw error;

      await refetchProfile();
      Alert.alert('Success', 'Profile updated successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (err) {
      console.error('Error updating profile:', err);
      Alert.alert('Save Failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  const getInitials = () => {
    if (fullName) {
      return fullName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(n => n[0].toUpperCase())
        .join('');
    }
    return user?.email?.substring(0, 2).toUpperCase() || '?';
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Edit Profile" showBack onBack={() => navigation.goBack()} />

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
            {/* Avatar Section */}
            <View style={styles.avatarSection}>
              <TouchableOpacity
                style={styles.avatarContainer}
                onPress={handlePickImage}
                disabled={uploading}
                activeOpacity={0.8}
              >
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitials}>{getInitials()}</Text>
                  </View>
                )}

                {uploading ? (
                  <View style={styles.uploadOverlay}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  </View>
                ) : (
                  <View style={styles.editBadge}>
                    <MaterialIcons name="photo-camera" size={16} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
              <Text style={styles.avatarLabel}>Tap to change photo</Text>
            </View>

            {/* Name */}
            <Text style={styles.fieldLabel}>FULL NAME</Text>
            <TextInput
              style={[styles.input, errors.fullName && styles.inputError]}
              value={fullName}
              onChangeText={t => { setFullName(t); setErrors(e => ({ ...e, fullName: null })); }}
              placeholder="Enter your full name"
              placeholderTextColor={colors.outline}
              autoCapitalize="words"
              autoCorrect={false}
            />
            {errors.fullName ? <Text style={styles.fieldError}>{errors.fullName}</Text> : null}

            {/* Email (Disabled/View Only) */}
            <Text style={[styles.fieldLabel, { marginTop: 20 }]}>EMAIL ADDRESS</Text>
            <TextInput
              style={[styles.input, styles.disabledInput]}
              value={user?.email}
              editable={false}
              placeholderTextColor={colors.outline}
            />

            {/* Phone */}
            <Text style={[styles.fieldLabel, { marginTop: 20 }]}>PHONE NUMBER</Text>
            <TextInput
              style={[styles.input, errors.phone && styles.inputError]}
              value={phone}
              onChangeText={t => { setPhone(t); setErrors(e => ({ ...e, phone: null })); }}
              placeholder="e.g. +91 9876543210"
              placeholderTextColor={colors.outline}
              keyboardType="phone-pad"
              autoCorrect={false}
            />
            {errors.phone ? <Text style={styles.fieldError}>{errors.phone}</Text> : null}

            {/* Age */}
            <Text style={[styles.fieldLabel, { marginTop: 20 }]}>AGE</Text>
            <TextInput
              style={[styles.input, errors.age && styles.inputError]}
              value={age}
              onChangeText={t => { setAge(t); setErrors(e => ({ ...e, age: null })); }}
              placeholder="e.g. 35"
              placeholderTextColor={colors.outline}
              keyboardType="number-pad"
              maxLength={3}
            />
            {errors.age ? <Text style={styles.fieldError}>{errors.age}</Text> : null}

            {/* Gender */}
            <Text style={[styles.fieldLabel, { marginTop: 20 }]}>GENDER</Text>
            <View style={styles.genderGrid}>
              {GENDERS.map(g => (
                <TouchableOpacity
                  key={g}
                  style={[styles.genderChip, gender === g && styles.genderChipActive]}
                  onPress={() => setGender(g)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.genderChipLabel, gender === g && styles.genderChipLabelActive]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <PrimaryButton
            label="Save Profile Changes"
            onPress={handleSave}
            loading={saving}
            icon="check"
          />
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
    paddingTop: 16,
  },
  
  // Avatar Section
  avatarSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    position: 'relative',
    backgroundColor: colors.primaryContainer,
    // Glowing border shadow
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 47,
  },
  avatarPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: fonts.manropeBold,
    fontSize: 36,
    color: colors.onPrimaryContainer,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 47,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    fontFamily: fonts.interMedium,
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 8,
  },

  // Form Fields
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
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: fonts.interRegular,
    fontSize: 15,
    color: colors.onSurface,
  },
  disabledInput: {
    opacity: 0.6,
    backgroundColor: colors.surfaceContainerLow,
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

  // Gender Selector Chips
  genderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  genderChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainerHighest,
  },
  genderChipActive: {
    backgroundColor: colors.primary,
    // Neon glow on active chip
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  genderChipLabel: {
    fontFamily: fonts.interMedium,
    fontSize: 13,
    color: colors.onSurfaceVariant,
  },
  genderChipLabelActive: {
    color: colors.onPrimary,
    fontFamily: fonts.interSemiBold,
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
});
