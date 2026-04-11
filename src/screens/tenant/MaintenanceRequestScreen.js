import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import ScreenHeader from '../../components/ScreenHeader';
import SectionHeader from '../../components/SectionHeader';
import StatusChip from '../../components/StatusChip';
import PrimaryButton from '../../components/PrimaryButton';

let caseCounter = 4903;

export default function MaintenanceRequestScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [tenantId, setTenantId] = useState(null);
  const [propertyId, setPropertyId] = useState(null);
  const [activeRequest, setActiveRequest] = useState(null);
  const [resolvedRequests, setResolvedRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form state
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const fetchData = useCallback(async () => {
    if (!user) return;
    setError(null);
    const { data: tenantData, error: tErr } = await supabase
      .from('tenants')
      .select('id, property_id')
      .eq('user_id', user.id)
      .single();

    if (tErr || !tenantData) {
      setError(tErr?.message ?? 'No tenant record found.');
      setLoading(false);
      return;
    }
    setTenantId(tenantData.id);
    setPropertyId(tenantData.property_id);

    const { data: requests, error: rErr } = await supabase
      .from('maintenance_requests')
      .select('*')
      .eq('tenant_id', tenantData.id)
      .order('created_at', { ascending: false });

    if (rErr) { setError(rErr.message); setLoading(false); return; }

    const all = requests ?? [];
    setActiveRequest(all.find(r => r.status !== 'resolved') ?? null);
    setResolvedRequests(all.filter(r => r.status === 'resolved'));
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!user) return null;

  const handleSubmit = async () => {
    const errs = {};
    if (!subject.trim()) errs.subject = 'Subject is required';
    if (!details.trim()) errs.details = 'Please describe the issue';
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    const caseNumber = `EL-${caseCounter++}`;
    const { error: insertError } = await supabase
      .from('maintenance_requests')
      .insert({
        tenant_id: tenantId,
        property_id: propertyId,
        subject,
        details,
        status: 'open',
        priority: 'medium',
        case_number: caseNumber,
        resolution_progress: 0,
      });

    setSubmitting(false);
    if (insertError) {
      Alert.alert('Error', insertError.message);
      return;
    }
    setSubject('');
    setDetails('');
    Alert.alert('Request Submitted', `Your maintenance request (${caseNumber}) has been submitted.`);
    fetchData();
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
        <TouchableOpacity style={styles.retryBtn} onPress={fetchData}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>
        <ScreenHeader title="Maintenance" showBell />
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Submit form */}
          <View style={styles.section}>
            <SectionHeader title="Describe the issue" />
            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>SUBJECT</Text>
              <TextInput
                style={[styles.input, formErrors.subject && styles.inputError]}
                value={subject}
                onChangeText={setSubject}
                placeholder="e.g. Leaky faucet in kitchen"
                placeholderTextColor={colors.outline}
              />
              {formErrors.subject ? <Text style={styles.fieldError}>{formErrors.subject}</Text> : null}
            </View>
            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>DETAILS</Text>
              <TextInput
                style={[styles.input, styles.textArea, formErrors.details && styles.inputError]}
                value={details}
                onChangeText={setDetails}
                placeholder="Describe the issue in detail..."
                placeholderTextColor={colors.outline}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              {formErrors.details ? <Text style={styles.fieldError}>{formErrors.details}</Text> : null}
            </View>

            <TouchableOpacity style={styles.attachRow}>
              <MaterialIcons name="attach-file" size={18} color={colors.onSurfaceVariant} />
              <Text style={styles.attachText}>Attach Photo (JPG / PNG)</Text>
            </TouchableOpacity>

            <PrimaryButton
              label="Submit Request"
              onPress={handleSubmit}
              loading={submitting}
              icon="send"
            />
          </View>

          {/* Active request */}
          <View style={styles.section}>
            <SectionHeader title="Active Request" />
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
            <SectionHeader title="Request History" actionLabel="View All" />
            {resolvedRequests.length === 0 ? (
              <Text style={styles.noHistoryText}>No past requests</Text>
            ) : (
              resolvedRequests.slice(0, 3).map(req => (
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
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.surface },
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, padding: 24,
  },

  section: { padding: 20 },

  fieldWrapper: { marginBottom: 14 },
  fieldLabel: {
    fontFamily: fonts.interSemiBold, fontSize: 11,
    letterSpacing: 0.8, color: colors.onSurfaceVariant,
    textTransform: 'uppercase', marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 6, paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: fonts.interRegular, fontSize: 15, color: colors.onSurface,
  },
  textArea: { minHeight: 100 },
  inputError: { backgroundColor: 'rgba(186,26,26,0.08)' },
  fieldError: { fontFamily: fonts.interRegular, fontSize: 12, color: colors.error, marginTop: 4 },

  attachRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, marginBottom: 16,
  },
  attachText: { fontFamily: fonts.interMedium, fontSize: 13, color: colors.onSurfaceVariant },

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
});
