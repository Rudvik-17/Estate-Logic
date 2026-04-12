import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import PrimaryButton from '../../components/PrimaryButton';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUpScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [errors, setErrors] = useState({
    fullName: null,
    email: null,
    password: null,
    confirmPassword: null,
    submit: null,
  });

  const validate = () => {
    const next = { fullName: null, email: null, password: null, confirmPassword: null, submit: null };
    let valid = true;

    if (!fullName.trim()) {
      next.fullName = 'Full name is required.';
      valid = false;
    }
    if (!email.trim()) {
      next.email = 'Email is required.';
      valid = false;
    } else if (!EMAIL_REGEX.test(email.trim())) {
      next.email = 'Enter a valid email address.';
      valid = false;
    }
    if (!password) {
      next.password = 'Password is required.';
      valid = false;
    } else if (password.length < 6) {
      next.password = 'Password must be at least 6 characters.';
      valid = false;
    }
    if (!confirmPassword) {
      next.confirmPassword = 'Please confirm your password.';
      valid = false;
    } else if (password !== confirmPassword) {
      next.confirmPassword = 'Passwords do not match.';
      valid = false;
    }

    setErrors(next);
    return valid;
  };

  const handleCreateAccount = async () => {
    if (!validate()) return;

    setLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    setLoading(false);

    if (signUpError) {
      const message = signUpError.message.toLowerCase().includes('already registered')
        ? 'This email is already registered. Try signing in instead.'
        : signUpError.message;
      setErrors(prev => ({ ...prev, submit: message }));
      return;
    }

    Alert.alert(
      'Verify your email',
      'Check your inbox and click the verification link to activate your account.',
      [{ text: 'OK', onPress: () => navigation.navigate('Login') }],
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={[styles.hero, { paddingTop: insets.top + 32 }]}>
          <Text style={styles.logoText}>ESTATE LOGIC</Text>
          <Text style={styles.tagline}>Architectural Trust. Defined.</Text>
          <View style={styles.heroDivider} />
        </View>

        {/* Form card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Create Account</Text>
          <Text style={styles.cardSubtitle}>Join EstateLogic to manage your properties</Text>

          {/* Full Name */}
          <Text style={styles.fieldLabel}>FULL NAME</Text>
          <TextInput
            style={[styles.input, errors.fullName && styles.inputError]}
            value={fullName}
            onChangeText={text => { setFullName(text); setErrors(prev => ({ ...prev, fullName: null })); }}
            placeholder="Jane Smith"
            placeholderTextColor={colors.outline}
            autoCapitalize="words"
            autoCorrect={false}
          />
          {errors.fullName ? <Text style={styles.fieldError}>{errors.fullName}</Text> : null}

          {/* Email */}
          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>EMAIL</Text>
          <TextInput
            style={[styles.input, errors.email && styles.inputError]}
            value={email}
            onChangeText={text => { setEmail(text); setErrors(prev => ({ ...prev, email: null })); }}
            placeholder="you@example.com"
            placeholderTextColor={colors.outline}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}

          {/* Password */}
          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>PASSWORD</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput, errors.password && styles.inputError]}
              value={password}
              onChangeText={text => { setPassword(text); setErrors(prev => ({ ...prev, password: null })); }}
              placeholder="Min. 6 characters"
              placeholderTextColor={colors.outline}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)}>
              <MaterialIcons
                name={showPassword ? 'visibility-off' : 'visibility'}
                size={20}
                color={colors.outline}
              />
            </TouchableOpacity>
          </View>
          {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}

          {/* Confirm Password */}
          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>CONFIRM PASSWORD</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput, errors.confirmPassword && styles.inputError]}
              value={confirmPassword}
              onChangeText={text => { setConfirmPassword(text); setErrors(prev => ({ ...prev, confirmPassword: null })); }}
              placeholder="Re-enter password"
              placeholderTextColor={colors.outline}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirmPassword(v => !v)}>
              <MaterialIcons
                name={showConfirmPassword ? 'visibility-off' : 'visibility'}
                size={20}
                color={colors.outline}
              />
            </TouchableOpacity>
          </View>
          {errors.confirmPassword ? <Text style={styles.fieldError}>{errors.confirmPassword}</Text> : null}

          {/* Submit error */}
          {errors.submit ? <Text style={styles.submitError}>{errors.submit}</Text> : null}

          {/* CTA */}
          <View style={styles.buttonWrapper}>
            <PrimaryButton
              label="CREATE ACCOUNT"
              onPress={handleCreateAccount}
              loading={loading}
              icon="person-add"
            />
          </View>

          {/* Sign in link */}
          <TouchableOpacity
            style={styles.textLinkBtn}
            onPress={() => navigation.navigate('Login')}
            disabled={loading}
          >
            <Text style={styles.textLink}>
              Already have an account?{' '}
              <Text style={styles.textLinkAccent}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* Trust badges */}
        <View style={styles.trustRow}>
          <View style={styles.trustBadge}>
            <MaterialIcons name="security" size={14} color={colors.tertiaryFixedDim} />
            <Text style={styles.trustText}>Bank-Grade Security</Text>
          </View>
          <View style={styles.trustBadge}>
            <MaterialIcons name="lock" size={14} color={colors.tertiaryFixedDim} />
            <Text style={styles.trustText}>Data Encryption</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  scroll: { flexGrow: 1 },

  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: 28,
    paddingBottom: 48,
    position: 'relative',
    overflow: 'hidden',
  },
  logoText: {
    fontFamily: fonts.manropeBold,
    fontSize: 22,
    letterSpacing: 4,
    color: colors.onPrimary,
    marginBottom: 6,
  },
  tagline: {
    fontFamily: fonts.interRegular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.5,
  },
  heroDivider: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 36,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },

  card: {
    paddingHorizontal: 28,
    paddingTop: 8,
  },
  cardTitle: {
    fontFamily: fonts.manropeBold,
    fontSize: 28,
    color: colors.onSurface,
    marginBottom: 6,
  },
  cardSubtitle: {
    fontFamily: fonts.interRegular,
    fontSize: 14,
    color: colors.onSurfaceVariant,
    marginBottom: 28,
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
  inputError: {
    backgroundColor: colors.errorContainer ?? '#fde8e8',
  },
  passwordRow: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    top: 14,
  },

  fieldError: {
    fontFamily: fonts.interRegular,
    fontSize: 12,
    color: colors.error,
    marginTop: 4,
  },
  submitError: {
    fontFamily: fonts.interRegular,
    fontSize: 13,
    color: colors.error,
    marginTop: 16,
  },

  buttonWrapper: {
    marginTop: 24,
  },
  textLinkBtn: {
    alignItems: 'center',
    marginTop: 20,
  },
  textLink: {
    fontFamily: fonts.interRegular,
    fontSize: 14,
    color: colors.onSurfaceVariant,
  },
  textLinkAccent: {
    fontFamily: fonts.interSemiBold,
    color: colors.primary,
  },

  trustRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 32,
    paddingHorizontal: 28,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  trustText: {
    fontFamily: fonts.interMedium,
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
});
