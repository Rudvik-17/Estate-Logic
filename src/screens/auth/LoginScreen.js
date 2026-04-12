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

export default function LoginScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSignIn = async () => {
    setError(null);
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) setError(authError.message);
    // On success, AuthContext updates and RootNavigator handles navigation
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Enter your email', 'Type your email address above, then tap "Forgot credentials?"');
      return;
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
    if (resetError) {
      setError(resetError.message);
    } else {
      Alert.alert('Check your inbox', 'A password reset link has been sent to ' + email);
    }
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
        {/* Hero — dark brand section */}
        <View style={[styles.hero, { paddingTop: insets.top + 32 }]}>
          <Text style={styles.logoText}>ESTATE LOGIC</Text>
          <Text style={styles.tagline}>Architectural Trust. Defined.</Text>

          {/* Angled divider illusion */}
          <View style={styles.heroDivider} />
        </View>

        {/* Auth card */}
        <View style={styles.card}>
          <Text style={styles.welcomeTitle}>Welcome Back</Text>
          <Text style={styles.welcomeSubtitle}>
            Access your precision portfolio dashboard
          </Text>

          {/* Email */}
          <Text style={styles.fieldLabel}>EMAIL</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.outline}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Password */}
          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>PASSWORD</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.outline}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword(v => !v)}
            >
              <MaterialIcons
                name={showPassword ? 'visibility-off' : 'visibility'}
                size={20}
                color={colors.outline}
              />
            </TouchableOpacity>
          </View>

          {/* Error */}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Sign in */}
          <View style={styles.buttonWrapper}>
            <PrimaryButton label="Sign In" onPress={handleSignIn} loading={loading} icon="login" />
          </View>

          {/* Create account */}
          <TouchableOpacity style={styles.textLinkBtn} onPress={() => navigation.navigate('SignUp')} disabled={loading}>
            <Text style={styles.textLink}>Create Account</Text>
          </TouchableOpacity>

          {/* Forgot password */}
          <TouchableOpacity style={styles.textLinkBtn} onPress={handleForgotPassword}>
            <Text style={styles.forgotLink}>Forgot your credentials?</Text>
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
  welcomeTitle: {
    fontFamily: fonts.manropeBold,
    fontSize: 28,
    color: colors.onSurface,
    marginBottom: 6,
  },
  welcomeSubtitle: {
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

  errorText: {
    fontFamily: fonts.interRegular,
    fontSize: 13,
    color: colors.error,
    marginTop: 12,
  },

  buttonWrapper: {
    marginTop: 24,
  },
  textLinkBtn: {
    alignItems: 'center',
    marginTop: 16,
  },
  textLink: {
    fontFamily: fonts.interSemiBold,
    fontSize: 14,
    color: colors.primary,
    letterSpacing: 0.5,
  },
  forgotLink: {
    fontFamily: fonts.interRegular,
    fontSize: 13,
    color: colors.onSurfaceVariant,
    textDecorationLine: 'underline',
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
