import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { showMaintenanceUpdate } from '../../lib/notifications';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { fonts } from '../../theme/typography';
import ScreenHeader from '../../components/ScreenHeader';
import SectionHeader from '../../components/SectionHeader';
import StatusChip from '../../components/StatusChip';
import MetricCard from '../../components/MetricCard';
import { RateLimitedButton } from '../../components/RateLimitedButton';

const PRIORITY_FILTERS = [
  { key: 'all', label: 'All', icon: 'list' },
  { key: 'high', label: 'High', icon: 'priority-high' },
  { key: 'medium', label: 'Medium', icon: 'remove' },
  { key: 'low', label: 'Low', icon: 'arrow-downward' },
];

const priorityVariant = (priority) =>
  priority === 'high' ? 'urgent' : priority === 'medium' ? 'pending' : 'active';

export default function ResidentIssuesScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [issues, setIssues] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedIssueIds, setExpandedIssueIds] = useState({});

  const toggleExpand = (id) => {
    setExpandedIssueIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const fetchIssues = useCallback(async () => {
    if (!user) return;
    setError(null);
    setLoading(true);

    const { data: propData, error: propErr } = await supabase
      .from('properties')
      .select('id')
      .eq('owner_id', user.id);

    if (propErr) {
      setError(propErr.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const propIds = propData?.map(p => p.id) ?? [];

    if (propIds.length === 0) {
      setIssues([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from('maintenance_requests')
      .select('*, tenants(full_name, unit_number), properties(name)')
      .in('property_id', propIds)
      .order('created_at', { ascending: false });

    if (fetchError) { setError(fetchError.message); setLoading(false); setRefreshing(false); return; }
    setIssues(data ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [user?.id]);

  useEffect(() => { fetchIssues(); }, [fetchIssues]);

  const onRefresh = () => { setRefreshing(true); fetchIssues(); };

  if (!user) return null;

  const markResolved = async (id) => {
    const { error: updateError } = await supabase
      .from('maintenance_requests')
      .update({ status: 'resolved', resolution_progress: 100 })
      .eq('id', id);
    if (updateError) {
      Alert.alert('Error', updateError.message);
      return;
    }
    const resolved = issues.find(i => i.id === id);
    if (resolved) showMaintenanceUpdate({ caseNumber: resolved.case_number });
    setIssues(prev => prev.map(i => i.id === id ? { ...i, status: 'resolved', resolution_progress: 100 } : i));
  };

  const filtered = filter === 'all' ? issues : issues.filter(i => i.priority === filter);
  const pending = issues.filter(i => i.status !== 'resolved').length;
  const resolved = issues.filter(i => i.status === 'resolved').length;
  const resolutionRate = issues.length > 0 ? Math.round((resolved / issues.length) * 100) : 0;

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diff / 3_600_000);
    if (hours < 24) return `${hours > 0 ? hours + 'h' : 'Just now'} ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const renderIssue = ({ item }) => {
    const isExpanded = expandedIssueIds[item.id];
    return (
      <View style={styles.issueCard}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => toggleExpand(item.id)}
        >
          <View style={styles.issueHeader}>
            <View style={styles.caseNumContainer}>
              <Text style={styles.caseNum}>{item.case_number}</Text>
              {item.properties?.name ? (
                <Text style={styles.propertyNameHeader}> · {item.properties.name}</Text>
              ) : null}
            </View>
            <View style={styles.headerRight}>
              <StatusChip label={item.priority} variant={priorityVariant(item.priority)} />
              <MaterialIcons
                name={isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                size={20}
                color={colors.outline}
              />
            </View>
          </View>
          <Text style={styles.issueSubject}>{item.subject}</Text>
          <View style={styles.issueMeta}>
            <MaterialIcons name="person" size={12} color={colors.onSurfaceVariant} />
            <Text style={styles.issueMetaText}>
              {item.tenants?.full_name} · Unit {item.tenants?.unit_number}
            </Text>
            <Text style={styles.issueMetaDot}>·</Text>
            <Text style={styles.issueMetaText}>{timeAgo(item.created_at)}</Text>
          </View>

          {isExpanded ? (
            <View style={styles.expandedDetailsContainer}>
              {item.details ? (
                <View style={styles.detailsRow}>
                  <Text style={styles.detailsLabel}>Description</Text>
                  <Text style={styles.detailsValue}>{item.details}</Text>
                </View>
              ) : null}

              {/* Structured fields grid */}
              <View style={styles.detailsGrid}>
                {item.category ? (
                  <View style={styles.detailsGridItem}>
                    <Text style={styles.gridLabel}>Category</Text>
                    <Text style={styles.gridValue}>{item.category}</Text>
                  </View>
                ) : null}

                {item.location_type ? (
                  <View style={styles.detailsGridItem}>
                    <Text style={styles.gridLabel}>Location</Text>
                    <Text style={styles.gridValue}>
                      {item.location_type}{item.location_details ? ` (${item.location_details})` : ''}
                    </Text>
                  </View>
                ) : null}

                {item.contact_preference ? (
                  <View style={styles.detailsGridItem}>
                    <Text style={styles.gridLabel}>Contact Via</Text>
                    <Text style={styles.gridValue}>{item.contact_preference}</Text>
                  </View>
                ) : null}

                <View style={styles.detailsGridItem}>
                  <Text style={styles.gridLabel}>Has Animal</Text>
                  <Text style={styles.gridValue}>{item.has_animal ? 'Yes 🐾' : 'No'}</Text>
                </View>

                <View style={styles.detailsGridItem}>
                  <Text style={styles.gridLabel}>Access Permitted</Text>
                  <Text style={styles.gridValue}>{item.allow_entry ? 'Yes ✅' : 'No ❌'}</Text>
                </View>
              </View>

              {item.entry_note ? (
                <View style={styles.entryNoteBox}>
                  <Text style={styles.entryNoteLabel}>Entry Note:</Text>
                  <Text style={styles.entryNoteValue}>"{item.entry_note}"</Text>
                </View>
              ) : null}
            </View>
          ) : (
            item.details ? (
              <Text style={styles.issueDetails} numberOfLines={2}>{item.details}</Text>
            ) : null
          )}
        </TouchableOpacity>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${item.resolution_progress}%` }]} />
        </View>
        <Text style={styles.progressLabel}>{item.resolution_progress}% resolved</Text>

        {/* Actions */}
        {item.status !== 'resolved' ? (
          <View style={styles.actionRow}>
            <RateLimitedButton
              style={styles.actionBtn}
              onPress={() => markResolved(item.id)}
            >
              <MaterialIcons name="check-circle" size={14} color={colors.onTertiaryContainer} />
              <Text style={[styles.actionText, { color: colors.onTertiaryContainer }]}>Mark Resolved</Text>
            </RateLimitedButton>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => navigation.navigate('IssueMessages', {
                issueId: item.id,
                caseNumber: item.case_number,
                subject: item.subject,
                tenantName: item.tenants?.full_name,
                unitNumber: item.tenants?.unit_number,
              })}
            >
              <MaterialIcons name="message" size={14} color={colors.primary} />
              <Text style={[styles.actionText, { color: colors.primary }]}>Message Resident</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.actionRow}>
            <StatusChip label="Resolved" variant="active" />
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => navigation.navigate('IssueMessages', {
                issueId: item.id,
                caseNumber: item.case_number,
                subject: item.subject,
                tenantName: item.tenants?.full_name,
                unitNumber: item.tenants?.unit_number,
              })}
            >
              <MaterialIcons name="message" size={14} color={colors.primary} />
              <Text style={[styles.actionText, { color: colors.primary }]}>View Messages</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
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
        <Text style={styles.errorTitle}>Unable to load issues</Text>
        <Text style={styles.errorMsg}>{error}</Text>
        <RateLimitedButton style={styles.retryBtn} onPress={fetchIssues}>
          <Text style={styles.retryText}>Retry</Text>
        </RateLimitedButton>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Issues" showProfile={true} />

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderIssue}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <>
            {/* Stats */}
            <View style={styles.statsRow}>
              <MetricCard icon="pending-actions" value={String(pending)} label="Pending" trendUp={false} />
              <View style={{ width: 12 }} />
              <MetricCard icon="verified" value={`${resolutionRate}%`} label="Resolution Rate" trendUp />
            </View>

            {/* Filters */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScroll}
            >
              {PRIORITY_FILTERS.map(f => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
                  onPress={() => setFilter(f.key)}
                >
                  <MaterialIcons
                    name={f.icon}
                    size={14}
                    color={filter === f.key ? colors.onPrimary : colors.onSurfaceVariant}
                  />
                  <Text style={[styles.filterLabel, filter === f.key && styles.filterLabelActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.listHeader}>
              <SectionHeader title={`${filtered.length} ${filtered.length === 1 ? 'Issue' : 'Issues'}`} />
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="check-circle" size={40} color={colors.tertiaryFixedDim} />
            <Text style={styles.emptyTitle}>No issues reported</Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'all' ? 'Your property is running smoothly.' : `No ${filter} priority issues found.`}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, padding: 24,
  },

  statsRow: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: colors.surfaceContainerLow,
  },

  filterScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 9999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filterLabel: {
    fontFamily: fonts.interMedium,
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  filterLabelActive: {
    color: colors.onPrimary,
  },

  listHeader: { paddingHorizontal: 20, paddingTop: 4 },

  issueCard: {
    backgroundColor: colors.surfaceContainerLowest,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
  },
  issueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  caseNumContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  propertyNameHeader: {
    fontFamily: fonts.interMedium,
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  caseNum: {
    fontFamily: fonts.interSemiBold,
    fontSize: 11,
    color: colors.onSurfaceVariant,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  expandedDetailsContainer: {
    marginTop: 8,
    marginBottom: 12,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 8,
    padding: 12,
    gap: 12,
  },
  detailsRow: {
    gap: 4,
  },
  detailsLabel: {
    fontFamily: fonts.interSemiBold,
    fontSize: 11,
    color: colors.outline,
    textTransform: 'uppercase',
  },
  detailsValue: {
    fontFamily: fonts.interRegular,
    fontSize: 13,
    color: colors.onSurface,
    lineHeight: 18,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailsGridItem: {
    width: '47%',
    gap: 2,
  },
  gridLabel: {
    fontFamily: fonts.interSemiBold,
    fontSize: 10,
    color: colors.outline,
    textTransform: 'uppercase',
  },
  gridValue: {
    fontFamily: fonts.interMedium,
    fontSize: 12,
    color: colors.onSurface,
  },
  entryNoteBox: {
    backgroundColor: colors.surfaceContainerLowest,
    padding: 8,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  entryNoteLabel: {
    fontFamily: fonts.interSemiBold,
    fontSize: 10,
    color: colors.outline,
  },
  entryNoteValue: {
    fontFamily: fonts.interRegular,
    fontSize: 12,
    color: colors.onSurfaceVariant,
    fontStyle: 'italic',
    marginTop: 2,
  },
  issueSubject: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 15,
    color: colors.onSurface,
    marginBottom: 6,
  },
  issueMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  issueMetaText: {
    fontFamily: fonts.interRegular,
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  issueMetaDot: {
    color: colors.outline,
  },
  issueDetails: {
    fontFamily: fonts.interRegular,
    fontSize: 13,
    color: colors.onSurfaceVariant,
    marginBottom: 12,
    lineHeight: 18,
  },

  progressTrack: {
    height: 4,
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 2,
    marginBottom: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: colors.tertiaryFixedDim,
    borderRadius: 2,
  },
  progressLabel: {
    fontFamily: fonts.interRegular,
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginBottom: 12,
  },

  actionRow: { flexDirection: 'row', gap: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: {
    fontFamily: fonts.interMedium,
    fontSize: 12,
  },

  emptyState: {
    alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32, gap: 8,
  },
  emptyTitle: {
    fontFamily: fonts.manropeSemiBold, fontSize: 18, color: colors.onSurface, marginTop: 8,
  },
  emptySubtitle: {
    fontFamily: fonts.interRegular, fontSize: 14,
    color: colors.onSurfaceVariant, textAlign: 'center',
  },

  errorTitle: { fontFamily: fonts.manropeSemiBold, fontSize: 18, color: colors.onSurface, marginTop: 12, marginBottom: 6 },
  errorMsg: { fontFamily: fonts.interRegular, fontSize: 13, color: colors.onSurfaceVariant, textAlign: 'center', marginBottom: 20 },
  retryBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 28 },
  retryText: { fontFamily: fonts.interSemiBold, fontSize: 14, color: colors.onPrimary },
});
