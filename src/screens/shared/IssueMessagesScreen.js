import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { showMessageSent } from '../../lib/notifications';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';

export default function IssueMessagesScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { user, role } = useAuth();
  const { issueId, caseNumber, subject, tenantName, unitNumber } = route?.params ?? {};

  // newest first for inverted FlatList
  const [messages, setMessages] = useState([]);
  const [senderName, setSenderName] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef(null);

  // Fetch current user's display name once
  useEffect(() => {
    if (!user) return;
    const resolveDisplayName = async () => {
      const { data } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .limit(1);
      const dbName = data?.[0]?.full_name;
      // user_metadata.full_name (email signup) or name (Google OAuth)
      const metaName = user.user_metadata?.full_name || user.user_metadata?.name;
      const email = user.email ?? '';
      const emailName = email.includes('@') ? email.split('@')[0] : '';
      setSenderName(dbName || metaName || emailName || 'Me');
    };
    resolveDisplayName();
  }, [user?.id]);

  const fetchMessages = useCallback(async () => {
    if (!user || !issueId) return;
    setError(null);

    const { data, error: fetchErr } = await supabase
      .from('issue_messages')
      .select('*')
      .eq('issue_id', issueId)
      .order('created_at', { ascending: false });

    if (fetchErr) {
      setError(fetchErr.message);
    } else {
      setMessages(data ?? []);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user?.id, issueId]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // Realtime subscription — prepend new messages (newest-first array)
  useEffect(() => {
    if (!issueId) return;
    const channel = supabase
      .channel(`messages:issue:${issueId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'issue_messages', filter: `issue_id=eq.${issueId}` },
        (payload) => {
          setMessages(prev => {
            // avoid duplicates when our own optimistic insert arrives
            if (prev.some(m => m.id === payload.new.id)) return prev;
            return [payload.new, ...prev];
          });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [issueId]);

  if (!user) return null;

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText('');

    const { error: insertErr } = await supabase.from('issue_messages').insert({
      issue_id: issueId,
      sender_id: user.id,
      sender_name: senderName || (role === 'owner' ? 'Owner' : 'Tenant'),
      sender_role: role,
      message: trimmed,
    });

    setSending(false);
    if (insertErr) {
      setText(trimmed); // restore on failure
      Alert.alert('Send Failed', insertErr.message);
    } else {
      const recipientLabel = role === 'owner'
        ? (tenantName ?? 'Tenant')
        : 'Owner';
      showMessageSent({ recipientLabel });
    }
  };

  const onRefresh = () => { setRefreshing(true); fetchMessages(); };

  const formatTime = (ts) =>
    new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const formatDay = (ts) => {
    const d = new Date(ts);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Today';
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const renderMessage = ({ item, index }) => {
    const isOwn = item.sender_id === user.id;
    const prevItem = messages[index + 1]; // inverted, so +1 is older
    const showDay =
      !prevItem || formatDay(item.created_at) !== formatDay(prevItem.created_at);

    return (
      <>
        <View style={[styles.bubbleRow, isOwn ? styles.bubbleRowOwn : styles.bubbleRowOther]}>
          {!isOwn && (
            <View style={styles.avatarBg}>
              <Text style={styles.avatarText}>
                {item.sender_name?.[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
          )}
          <View style={styles.bubbleColumn}>
            {!isOwn && (
              <Text style={styles.senderLabel}>
                {(() => {
                  const roleLabel = item.sender_role === 'owner' ? 'Owner' : 'Tenant';
                  const name = item.sender_name;
                  if (!name || name === roleLabel) return roleLabel;
                  return `${name} · ${roleLabel}`;
                })()}
              </Text>
            )}
            <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
              <Text style={[styles.messageText, isOwn ? styles.messageTextOwn : styles.messageTextOther]}>
                {item.message}
              </Text>
            </View>
            <Text style={[styles.timestamp, isOwn ? styles.timestampOwn : styles.timestampOther]}>
              {formatTime(item.created_at)}
            </Text>
          </View>
        </View>
        {showDay && (
          <View style={styles.dayDivider}>
            <Text style={styles.dayLabel}>{formatDay(item.created_at)}</Text>
          </View>
        )}
      </>
    );
  };

  const subTitle = tenantName
    ? `${tenantName}${unitNumber ? ` · Unit ${unitNumber}` : ''}`
    : subject;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={20} color={colors.onPrimary} />
          </TouchableOpacity>
          <View style={styles.headerMeta}>
            <Text style={styles.headerTitle} numberOfLines={1}>{subject ?? 'Issue Chat'}</Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {caseNumber}{subTitle ? ` · ${subTitle}` : ''}
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* Messages */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <MaterialIcons name="error-outline" size={40} color={colors.error} />
            <Text style={styles.errorTitle}>Could not load messages</Text>
            <Text style={styles.errorMsg}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchMessages}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            inverted
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <MaterialIcons name="chat-bubble-outline" size={40} color={colors.outlineVariant} />
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptySubtitle}>
                  {role === 'owner'
                    ? 'Send the tenant a message about this issue.'
                    : 'Send the owner a message about your request.'}
                </Text>
              </View>
            }
          />
        )}

        {/* Input bar */}
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            ref={inputRef}
            style={styles.textInput}
            value={text}
            onChangeText={setText}
            placeholder={role === 'owner' ? 'Message tenant…' : 'Message owner…'}
            placeholderTextColor={colors.outline}
            multiline
            maxLength={500}
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
          >
            {sending
              ? <ActivityIndicator size="small" color={colors.onPrimary} />
              : <MaterialIcons name="send" size={20} color={colors.onPrimary} />}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.surface },

  header: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  backBtn: { padding: 4, width: 36 },
  headerMeta: { flex: 1 },
  headerTitle: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 15,
    color: colors.onPrimary,
  },
  headerSub: {
    fontFamily: fonts.interRegular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 1,
  },

  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, padding: 24,
  },

  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },

  bubbleRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
    gap: 8,
  },
  bubbleRowOwn: { justifyContent: 'flex-end' },
  bubbleRowOther: { justifyContent: 'flex-start' },

  avatarBg: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginBottom: 18,
  },
  avatarText: {
    fontFamily: fonts.manropeBold,
    fontSize: 12,
    color: colors.primary,
  },

  bubbleColumn: { maxWidth: '72%' },

  senderLabel: {
    fontFamily: fonts.interRegular,
    fontSize: 10,
    color: colors.onSurfaceVariant,
    letterSpacing: 0.3,
    marginBottom: 3,
    marginLeft: 2,
  },

  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleOwn: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: colors.surfaceContainerLowest,
    borderBottomLeftRadius: 4,
  },

  messageText: {
    fontFamily: fonts.interRegular,
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextOwn: { color: colors.onPrimary },
  messageTextOther: { color: colors.onSurface },

  timestamp: {
    fontFamily: fonts.interRegular,
    fontSize: 10,
    color: colors.onSurfaceVariant,
    marginTop: 3,
  },
  timestampOwn: { textAlign: 'right', marginRight: 2 },
  timestampOther: { marginLeft: 2 },

  dayDivider: {
    alignItems: 'center',
    marginVertical: 12,
  },
  dayLabel: {
    fontFamily: fonts.interMedium,
    fontSize: 11,
    color: colors.onSurfaceVariant,
    backgroundColor: colors.surfaceContainerLow,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 99,
    overflow: 'hidden',
  },

  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: fonts.manropeSemiBold, fontSize: 17,
    color: colors.onSurface, marginTop: 8,
  },
  emptySubtitle: {
    fontFamily: fonts.interRegular, fontSize: 13,
    color: colors.onSurfaceVariant, textAlign: 'center',
    paddingHorizontal: 32,
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.surfaceContainerLowest,
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontFamily: fonts.interRegular,
    fontSize: 14,
    color: colors.onSurface,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginBottom: 2,
  },
  sendBtnDisabled: {
    backgroundColor: colors.outlineVariant,
  },

  errorTitle: {
    fontFamily: fonts.manropeSemiBold, fontSize: 18,
    color: colors.onSurface, marginTop: 12, marginBottom: 6,
  },
  errorMsg: {
    fontFamily: fonts.interRegular, fontSize: 13,
    color: colors.onSurfaceVariant, textAlign: 'center', marginBottom: 20,
  },
  retryBtn: {
    backgroundColor: colors.primary, borderRadius: 8,
    paddingVertical: 10, paddingHorizontal: 28,
  },
  retryText: { fontFamily: fonts.interSemiBold, fontSize: 14, color: colors.onPrimary },
});
