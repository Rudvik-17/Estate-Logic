import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert,
  Modal,
  Switch,
  TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { fonts } from '../../theme/typography';
import ScreenHeader from '../../components/ScreenHeader';
import StatusChip from '../../components/StatusChip';
import PrimaryButton from '../../components/PrimaryButton';
import { buildReceiptHTML } from '../../lib/receiptHTML';

const METHOD_LABELS = {
  gpay: 'Google Pay',
  phonepe: 'PhonePe',
  paytm: 'Paytm',
};

const statusVariant = (status) =>
  status === 'paid' ? 'active' : status === 'overdue' ? 'urgent' : 'pending';

export default function PaymentHistoryScreen({ navigation }) {
  const { theme, colors } = useTheme();
  const styles = getStyles(colors, theme);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // Core Supabase states
  const [payments, setPayments] = useState([]);
  const [pendingPayment, setPendingPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tenantInfo, setTenantInfo] = useState(null);
  const [activeLease, setActiveLease] = useState(null);
  const downloadingRef = useRef(new Set());
  const [downloadingIds, setDownloadingIds] = useState(new Set());

  // Interactive UI states
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showAutoPayModal, setShowAutoPayModal] = useState(false);
  const [showLedger, setShowLedger] = useState(false);

  // Wallet stored payment states (Supabase-backed)
  const [storedMethods, setStoredMethods] = useState([]);
  const [isAddingMethod, setIsAddingMethod] = useState(false);
  const [addMethodType, setAddMethodType] = useState('upi'); // 'upi' or 'card'
  const [newUpiId, setNewUpiId] = useState('');
  const [newCardNumber, setNewCardNumber] = useState('');
  const [newCardName, setNewCardName] = useState('');
  const [newCardExpiry, setNewCardExpiry] = useState('');

  // Auto-Pay configuration states (Supabase-backed)
  const [autoPayEnabled, setAutoPayEnabled] = useState(false);
  const [autoPayDay, setAutoPayDay] = useState(5);
  const [autoPayMethod, setAutoPayMethod] = useState('');

  // Fetch Wallet and Auto-Pay details from Supabase
  const fetchWalletAndAutoPay = useCallback(async () => {
    if (!user) return;
    try {
      // 1. Fetch stored payment methods
      const { data: methodsData, error: methodsErr } = await supabase
        .from('stored_payment_methods')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (methodsErr) {
        console.log('Error fetching payment methods:', methodsErr.message);
      } else if (methodsData) {
        setStoredMethods(methodsData);
      }

      // 2. Fetch auto-pay settings
      const { data: apData, error: apErr } = await supabase
        .from('autopay_settings')
        .select('*')
        .eq('user_id', user.id)
        .limit(1);

      if (apErr) {
        console.log('Error fetching autopay settings:', apErr.message);
      } else if (apData?.[0]) {
        const settings = apData[0];
        setAutoPayEnabled(settings.enabled);
        setAutoPayDay(settings.day);
        setAutoPayMethod(settings.method_id ?? '');
      } else {
        // Fallback default if not yet created in Supabase
        setAutoPayEnabled(false);
        setAutoPayDay(5);
        setAutoPayMethod('');
      }
    } catch (e) {
      console.log('Error loading backend settings:', e);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      fetchWalletAndAutoPay();
    }
  }, [user, fetchWalletAndAutoPay]);

  // Fetch Core Billing Data
  const fetchData = useCallback(async () => {
    if (!user) return;
    setError(null);
    setLoading(true);

    const { data: tenantRows, error: tenantError } = await supabase
      .from('tenants')
      .select('id, full_name, unit_number, properties(name)')
      .eq('user_id', user.id)
      .limit(1);

    if (tenantError) {
      setError(tenantError.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const tenant = tenantRows?.[0] ?? null;
    if (!tenant) {
      setPayments([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setTenantInfo(tenant);

    // Get active lease & payments in parallel
    const [leaseRes, paymentsRes] = await Promise.all([
      supabase
        .from('leases')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('status', 'active')
        .limit(1),
      supabase
        .from('payments')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('due_date', { ascending: false }),
    ]);

    if (leaseRes.error) {
      setError(leaseRes.error.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (paymentsRes.error) {
      setError(paymentsRes.error.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setActiveLease(leaseRes.data?.[0] ?? null);
    
    const allPayments = paymentsRes.data ?? [];
    setPayments(allPayments);
    setPendingPayment(
      allPayments.find(p => p.status === 'pending' || p.status === 'overdue') ?? null
    );
    
    setLoading(false);
    setRefreshing(false);
  }, [user?.id]);

  useFocusEffect(useCallback(() => { 
    fetchData(); 
    fetchWalletAndAutoPay();
  }, [fetchData, fetchWalletAndAutoPay]));

  // Download PDF Receipt flow
  const handleDownloadReceipt = useCallback(async (item) => {
    if (downloadingRef.current.has(item.id)) return;
    downloadingRef.current.add(item.id);
    setDownloadingIds(new Set(downloadingRef.current));

    try {
      const html = buildReceiptHTML({
        txnId: item.transaction_id ?? item.id,
        amount: item.amount,
        method: item.payment_method,
        paidAt: item.paid_at ?? item.due_date,
        tenantName: tenantInfo?.full_name ?? 'Tenant',
        propertyName: tenantInfo?.properties?.name ?? 'Property',
        unitNumber: tenantInfo?.unit_number ?? '—',
      });
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save or share your receipt',
          UTI: 'com.adobe.pdf',
        });
      }
    } catch {
      Alert.alert('Error', 'Could not generate receipt. Please try again.');
    } finally {
      downloadingRef.current.delete(item.id);
      setDownloadingIds(new Set(downloadingRef.current));
    }
  }, [tenantInfo]);

  // Wallet database insertions/deletes
  const handleAddUpi = async () => {
    if (!newUpiId.trim() || !newUpiId.includes('@')) {
      Alert.alert('Error', 'Please enter a valid UPI ID (e.g. name@okaxis)');
      return;
    }
    const { error: addErr } = await supabase
      .from('stored_payment_methods')
      .insert({
        user_id: user.id,
        type: 'upi',
        label: 'UPI Account',
        value: newUpiId.trim().toLowerCase(),
        is_active: storedMethods.length === 0, // active by default if first method
      });

    if (addErr) {
      Alert.alert('Error', addErr.message);
    } else {
      await fetchWalletAndAutoPay();
      setNewUpiId('');
      setIsAddingMethod(false);
    }
  };

  const handleAddCard = async () => {
    if (!newCardNumber.trim() || newCardNumber.length < 15 || !newCardName.trim() || !newCardExpiry.trim()) {
      Alert.alert('Error', 'Please fill in all card details (valid card number required)');
      return;
    }
    const lastFour = newCardNumber.trim().slice(-4);
    const maskedCard = `**** **** **** ${lastFour}`;
    const { error: addErr } = await supabase
      .from('stored_payment_methods')
      .insert({
        user_id: user.id,
        type: 'card',
        label: `${newCardName.trim()}`,
        value: maskedCard,
        is_active: storedMethods.length === 0,
      });

    if (addErr) {
      Alert.alert('Error', addErr.message);
    } else {
      await fetchWalletAndAutoPay();
      setNewCardNumber('');
      setNewCardName('');
      setNewCardExpiry('');
      setIsAddingMethod(false);
    }
  };

  const handleDeleteMethod = async (id) => {
    const { error: delErr } = await supabase
      .from('stored_payment_methods')
      .delete()
      .eq('id', id);

    if (delErr) {
      Alert.alert('Error', delErr.message);
    } else {
      if (autoPayMethod === id) {
        const remaining = storedMethods.filter(m => m.id !== id);
        const nextActive = remaining.find(m => m.is_active)?.id ?? (remaining[0]?.id ?? null);
        await saveAutoPaySettings(autoPayEnabled, autoPayDay, nextActive);
      }
      await fetchWalletAndAutoPay();
    }
  };

  const handleSetMethodActive = async (id) => {
    // 1. Clear active flags for user's payment options
    const { error: err1 } = await supabase
      .from('stored_payment_methods')
      .update({ is_active: false })
      .eq('user_id', user.id);

    if (!err1) {
      // 2. Set chosen method active
      const { error: err2 } = await supabase
        .from('stored_payment_methods')
        .update({ is_active: true })
        .eq('id', id);

      if (err2) {
        Alert.alert('Error', err2.message);
      }
    } else {
      Alert.alert('Error', err1.message);
    }

    await fetchWalletAndAutoPay();
  };

  // Auto-Pay configuration database upserts
  const saveAutoPaySettings = async (enabled, day, methodId) => {
    if (!user) return;
    try {
      const { error: upsertErr } = await supabase
        .from('autopay_settings')
        .upsert({
          user_id: user.id,
          enabled,
          day,
          method_id: methodId || null,
          updated_at: new Date().toISOString(),
        });

      if (upsertErr) {
        console.log('Error saving auto-pay:', upsertErr.message);
        Alert.alert('Error', 'Could not save auto-pay configurations.');
      } else {
        setAutoPayEnabled(enabled);
        setAutoPayDay(day);
        setAutoPayMethod(methodId || '');
      }
    } catch (e) {
      console.log('Error executing upsert query:', e);
    }
  };

  const onRefresh = () => { 
    setRefreshing(true); 
    fetchData(); 
    fetchWalletAndAutoPay();
  };

  const formatDate = (d) =>
    d
      ? new Date(d).toLocaleDateString('en-IN', {
          day: 'numeric', month: 'short', year: 'numeric',
        })
      : '—';

  const selectedMethodObj = storedMethods.find(m => m.id === autoPayMethod) ?? storedMethods.find(m => m.is_active) ?? storedMethods[0];

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
        <Text style={styles.errorTitle}>Unable to load payments</Text>
        <Text style={styles.errorMsg}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchData}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Filter out paid payments for the Ledger history
  const paidPayments = payments.filter(p => p.status === 'paid');

  return (
    <View style={styles.container}>
      <ScreenHeader title="Payments" showBell />
      
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* HERO BALANCE CARD (Tenura Navy Style) */}
        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroStatusLabel}>
              {pendingPayment ? 'BALANCE DUE' : 'NO BALANCE DUE'}
            </Text>
            <Text style={styles.heroAmount}>
              ₹{pendingPayment ? Number(pendingPayment.amount).toLocaleString('en-IN') : '0.00'}
            </Text>
          </View>
          <View style={styles.heroRight}>
            <TouchableOpacity 
              style={styles.heroSecondaryBtn}
              onPress={() => setShowDetailsModal(true)}
            >
              <Text style={styles.heroSecondaryBtnText}>View Details</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.heroPrimaryBtn}
              onPress={() => {
                navigation.navigate('RentPayment');
              }}
            >
              <Text style={styles.heroPrimaryBtnText}>
                Make Payment
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* MENU OPTIONS (Ledger, Wallet, Auto-Payments) */}
        <View style={styles.menuContainer}>
          
          {/* LEDGER */}
          <TouchableOpacity 
            style={styles.menuItem} 
            activeOpacity={0.8}
            onPress={() => setShowLedger(!showLedger)}
          >
            <View style={styles.menuIconBg}>
              <MaterialIcons name="receipt-long" size={20} color={colors.primary} />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Ledger</Text>
              <Text style={styles.menuSubtitle}>See all your payments, charges, and history.</Text>
            </View>
            <MaterialIcons 
              name={showLedger ? 'keyboard-arrow-down' : 'keyboard-arrow-right'} 
              size={24} 
              color={colors.outline} 
            />
          </TouchableOpacity>

          {/* LEDGER EXPANDED HISTORY */}
          {showLedger && (
            <View style={styles.ledgerExpanded}>
              <Text style={styles.ledgerHeaderTitle}>Transaction History</Text>
              {paidPayments.length === 0 ? (
                <View style={styles.emptyLedger}>
                  <MaterialIcons name="receipt" size={32} color={colors.outline} />
                  <Text style={styles.emptyLedgerText}>No paid transaction history yet.</Text>
                </View>
              ) : (
                paidPayments.map((item) => (
                  <View key={item.id} style={styles.paymentRow}>
                    <View style={styles.paymentIconBg}>
                      <MaterialIcons name="check-circle" size={18} color={colors.tertiaryFixedDim} />
                    </View>
                    <View style={styles.paymentInfo}>
                      <Text style={styles.paymentAmount}>
                        ₹{Number(item.amount).toLocaleString('en-IN')}
                      </Text>
                      <Text style={styles.paymentMeta}>
                        Due {formatDate(item.due_date)} · Paid {formatDate(item.paid_at)}
                      </Text>
                      {item.payment_method ? (
                        <Text style={styles.paymentMethod}>
                          {METHOD_LABELS[item.payment_method] ?? item.payment_method}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.paidActions}>
                      <StatusChip label="paid" variant="active" />
                      <TouchableOpacity
                        style={styles.receiptBtn}
                        onPress={() => handleDownloadReceipt(item)}
                        disabled={downloadingIds.has(item.id)}
                      >
                        {downloadingIds.has(item.id) ? (
                          <ActivityIndicator size={14} color={colors.primary} />
                        ) : (
                          <MaterialIcons name="receipt" size={16} color={colors.primary} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          <View style={styles.menuDivider} />

          {/* WALLET */}
          <TouchableOpacity 
            style={styles.menuItem} 
            activeOpacity={0.8}
            onPress={() => {
              setIsAddingMethod(false);
              setShowWalletModal(true);
            }}
          >
            <View style={styles.menuIconBg}>
              <MaterialIcons name="account-balance-wallet" size={20} color={colors.primary} />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Wallet</Text>
              <Text style={styles.menuSubtitle}>Store payment Information for repeat use.</Text>
            </View>
            <MaterialIcons name="keyboard-arrow-right" size={24} color={colors.outline} />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* AUTO-PAYMENTS */}
          <TouchableOpacity 
            style={styles.menuItem} 
            activeOpacity={0.8}
            onPress={() => setShowAutoPayModal(true)}
          >
            <View style={styles.menuIconBg}>
              <MaterialIcons name="autorenew" size={20} color={colors.primary} />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Auto-Payments</Text>
              <Text style={styles.menuSubtitle}>Set up payments to give you peace of mind.</Text>
            </View>
            <MaterialIcons name="keyboard-arrow-right" size={24} color={colors.outline} />
          </TouchableOpacity>

        </View>
      </ScrollView>

      {/* MODAL 1: VIEW DETAILS */}
      <Modal
        visible={showDetailsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Lease Details</Text>
              <TouchableOpacity onPress={() => setShowDetailsModal(false)}>
                <MaterialIcons name="close" size={24} color={colors.onSurface} />
              </TouchableOpacity>
            </View>

            {activeLease ? (
              <View style={styles.detailsBody}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Property Name</Text>
                  <Text style={styles.detailValue}>{tenantInfo?.properties?.name ?? '—'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Unit Number</Text>
                  <Text style={styles.detailValue}>{tenantInfo?.unit_number ?? '—'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Monthly Rent</Text>
                  <Text style={[styles.detailValue, { color: colors.tertiaryFixedDim }]}>
                    ₹{Number(activeLease.monthly_rent).toLocaleString('en-IN')}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Lease Commenced</Text>
                  <Text style={styles.detailValue}>{formatDate(activeLease.start_date)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Lease Terminating</Text>
                  <Text style={styles.detailValue}>{formatDate(activeLease.end_date)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Payment Cycle</Text>
                  <Text style={styles.detailValue}>Monthly</Text>
                </View>
              </View>
            ) : (
              <View style={styles.detailsEmpty}>
                <MaterialIcons name="home" size={48} color={colors.outline} />
                <Text style={styles.detailsEmptyText}>No active lease linked to this account.</Text>
              </View>
            )}

            <PrimaryButton 
              label="Close Details" 
              onPress={() => setShowDetailsModal(false)} 
            />
          </View>
        </View>
      </Modal>

      {/* MODAL 2: WALLET */}
      <Modal
        visible={showWalletModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWalletModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Wallet</Text>
              <TouchableOpacity onPress={() => setShowWalletModal(false)}>
                <MaterialIcons name="close" size={24} color={colors.onSurface} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalSectionTitle}>Stored Payment Methods</Text>
              
              {storedMethods.length === 0 ? (
                <Text style={styles.emptyWalletText}>No saved payment options found. Please add a billing method.</Text>
              ) : (
                storedMethods.map((method) => (
                  <TouchableOpacity
                    key={method.id}
                    style={[styles.walletCard, method.is_active && styles.walletCardActive]}
                    activeOpacity={0.8}
                    onPress={() => handleSetMethodActive(method.id)}
                  >
                    <View style={styles.walletCardLeft}>
                      <MaterialIcons 
                        name={method.type === 'upi' ? 'payment' : 'credit-card'} 
                        size={22} 
                        color={colors.primary} 
                      />
                      <View>
                        <Text style={styles.walletCardLabel}>{method.label}</Text>
                        <Text style={styles.walletCardValue}>{method.value}</Text>
                      </View>
                    </View>
                    <View style={styles.walletCardRight}>
                      {method.is_active && (
                        <MaterialIcons name="check-circle" size={20} color={colors.tertiaryFixedDim} />
                      )}
                      <TouchableOpacity 
                        style={styles.walletDeleteBtn}
                        onPress={() => handleDeleteMethod(method.id)}
                      >
                        <MaterialIcons name="delete" size={18} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))
              )}

              {/* ADD NEW METHOD */}
              {!isAddingMethod ? (
                <TouchableOpacity 
                  style={styles.addMethodBtn}
                  onPress={() => setIsAddingMethod(true)}
                >
                  <MaterialIcons name="add" size={16} color={colors.primary} />
                  <Text style={styles.addMethodBtnText}>Add Payment Option</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.addMethodForm}>
                  <Text style={styles.addMethodTitle}>New Payment Details</Text>
                  
                  {/* Selector Type */}
                  <View style={styles.tabRow}>
                    <TouchableOpacity 
                      style={[styles.tabBtn, addMethodType === 'upi' && styles.tabBtnActive]}
                      onPress={() => setAddMethodType('upi')}
                    >
                      <Text style={[styles.tabBtnText, addMethodType === 'upi' && styles.tabBtnTextActive]}>UPI</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.tabBtn, addMethodType === 'card' && styles.tabBtnActive]}
                      onPress={() => setAddMethodType('card')}
                    >
                      <Text style={[styles.tabBtnText, addMethodType === 'card' && styles.tabBtnTextActive]}>Debit/Credit Card</Text>
                    </TouchableOpacity>
                  </View>

                  {addMethodType === 'upi' ? (
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>UPI ID Address</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="e.g. name@okaxis"
                        value={newUpiId}
                        onChangeText={setNewUpiId}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <TouchableOpacity style={styles.saveAddBtn} onPress={handleAddUpi}>
                        <Text style={styles.saveAddBtnText}>Save UPI ID</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Cardholder Name</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="e.g. Rudvik Dinesh"
                        value={newCardName}
                        onChangeText={setNewCardName}
                      />
                      <Text style={styles.inputLabel}>Card Number</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="16-digit card number"
                        keyboardType="number-pad"
                        maxLength={16}
                        value={newCardNumber}
                        onChangeText={setNewCardNumber}
                      />
                      <Text style={styles.inputLabel}>Expiry Date</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="MM/YY"
                        maxLength={5}
                        value={newCardExpiry}
                        onChangeText={setNewCardExpiry}
                      />
                      <TouchableOpacity style={styles.saveAddBtn} onPress={handleAddCard}>
                        <Text style={styles.saveAddBtnText}>Save Card Details</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <TouchableOpacity 
                    style={styles.cancelAddBtn}
                    onPress={() => setIsAddingMethod(false)}
                  >
                    <Text style={styles.cancelAddText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: AUTO-PAYMENTS */}
      <Modal
        visible={showAutoPayModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAutoPayModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Auto-Payments</Text>
              <TouchableOpacity onPress={() => setShowAutoPayModal(false)}>
                <MaterialIcons name="close" size={24} color={colors.onSurface} />
              </TouchableOpacity>
            </View>

            <View style={styles.autoPayBody}>
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>Enable Auto-Pay</Text>
                  <Text style={styles.toggleSub}>
                    Deducts due rent automatically every month.
                  </Text>
                </View>
                <Switch
                  value={autoPayEnabled}
                  onValueChange={(val) => saveAutoPaySettings(val, autoPayDay, autoPayMethod)}
                  trackColor={{ false: colors.outlineVariant, true: colors.tertiaryFixedDim }}
                  thumbColor={autoPayEnabled ? colors.primary : '#f4f3f4'}
                />
              </View>

              {autoPayEnabled && (
                <View style={styles.autoPaySettings}>
                  
                  {/* Select Payment Source */}
                  <Text style={styles.settingsLabel}>Payment Funding Source</Text>
                  {storedMethods.length === 0 ? (
                    <Text style={styles.settingsAlertText}>
                      No saved methods. Please add one in Wallet first.
                    </Text>
                  ) : (
                    <View style={styles.methodSelectRow}>
                      {storedMethods.map((m) => (
                        <TouchableOpacity
                          key={m.id}
                          style={[
                            styles.methodRadioBtn,
                            autoPayMethod === m.id && styles.methodRadioBtnActive,
                          ]}
                          onPress={() => saveAutoPaySettings(autoPayEnabled, autoPayDay, m.id)}
                        >
                          <Text 
                            style={[
                              styles.methodRadioText,
                              autoPayMethod === m.id && styles.methodRadioTextActive,
                            ]}
                          >
                            {m.label} ({m.value.slice(-8)})
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Day Picker */}
                  <Text style={styles.settingsLabel}>Deduction Day of Month</Text>
                  <View style={styles.daySelectorRow}>
                    {[1, 3, 5, 7, 10].map((d) => (
                      <TouchableOpacity
                        key={d}
                        style={[
                          styles.dayBtn,
                          autoPayDay === d && styles.dayBtnActive,
                        ]}
                        onPress={() => saveAutoPaySettings(autoPayEnabled, d, autoPayMethod)}
                      >
                        <Text 
                          style={[
                            styles.dayBtnText,
                            autoPayDay === d && styles.dayBtnTextActive,
                          ]}
                        >
                          {d}th
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Summary Box */}
                  <View style={styles.summaryBox}>
                    <MaterialIcons name="info" size={16} color={colors.primary} />
                    <Text style={styles.summaryBoxText}>
                      Every month on the <Text style={{ fontFamily: fonts.interBold }}>{autoPayDay}th</Text>, a payment of{' '}
                      <Text style={{ fontFamily: fonts.interBold, color: colors.tertiaryFixedDim }}>
                        ₹{Number(activeLease?.monthly_rent ?? 15000).toLocaleString('en-IN')}
                      </Text>{' '}
                      will be processed automatically using{' '}
                      <Text style={{ fontFamily: fonts.interBold }}>
                        {selectedMethodObj ? selectedMethodObj.label : 'Saved Method'}
                      </Text>.
                    </Text>
                  </View>
                </View>
              )}
            </View>

            <PrimaryButton 
              label="Save & Close" 
              onPress={() => {
                setShowAutoPayModal(false);
                Alert.alert(
                  'Auto-Pay Updated',
                  autoPayEnabled 
                    ? `Auto-pay successfully configured for the ${autoPayDay}th of every month.`
                    : 'Auto-pay successfully disabled.'
                );
              }} 
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (colors, theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, padding: 24,
  },
  errorTitle: { fontFamily: fonts.manropeSemiBold, fontSize: 18, color: colors.onSurface, marginTop: 12, marginBottom: 6 },
  errorMsg: { fontFamily: fonts.interRegular, fontSize: 13, color: colors.onSurfaceVariant, textAlign: 'center', marginBottom: 20 },
  retryBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 28 },
  retryText: { fontFamily: fonts.interSemiBold, fontSize: 14, color: colors.onPrimary },

  // HERO BALANCE CARD
  heroCard: {
    backgroundColor: colors.primary,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  heroLeft: { flex: 1.1 },
  heroStatusLabel: {
    fontFamily: fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 1.5,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  heroAmount: {
    fontFamily: fonts.manropeBold,
    fontSize: 30,
    color: '#FFFFFF',
  },
  heroRight: {
    flex: 0.9,
    alignItems: 'flex-end',
    gap: 8,
  },
  heroSecondaryBtn: {
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  heroSecondaryBtnText: {
    fontFamily: fonts.interSemiBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  heroPrimaryBtn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  heroPrimaryBtnDisabled: {
    backgroundColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.35)',
  },
  heroPrimaryBtnText: {
    fontFamily: fonts.interBold,
    fontSize: 12,
    color: theme === 'dark' ? '#0C0B14' : colors.onPrimaryContainer,
  },
  heroPrimaryBtnTextDisabled: {
    color: theme === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(63, 15, 2, 0.6)',
  },

  // OPTION MENU ITEMS
  menuContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 16,
    paddingVertical: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  menuItemPressed: {
    backgroundColor: colors.surfaceContainerLow,
  },
  menuIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuInfo: { flex: 1 },
  menuTitle: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 15,
    color: colors.onSurface,
    marginBottom: 3,
  },
  menuSubtitle: {
    fontFamily: fonts.interRegular,
    fontSize: 12,
    color: colors.onSurfaceVariant,
    lineHeight: 16,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.surfaceContainerLow,
    marginHorizontal: 16,
  },

  // LEDGER ACCORDION
  ledgerExpanded: {
    backgroundColor: colors.surfaceContainerLow,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  ledgerHeaderTitle: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 13,
    color: colors.outline,
    letterSpacing: 0.5,
    marginVertical: 12,
  },
  emptyLedger: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  emptyLedgerText: {
    fontFamily: fonts.interRegular,
    fontSize: 13,
    color: colors.onSurfaceVariant,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceContainerLowest,
    marginBottom: 8,
    borderRadius: 12,
    padding: 14,
  },
  paymentIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentInfo: { flex: 1 },
  paymentAmount: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 14,
    color: colors.onSurface,
    marginBottom: 2,
  },
  paymentMeta: {
    fontFamily: fonts.interRegular,
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginBottom: 2,
  },
  paymentMethod: {
    fontFamily: fonts.interRegular,
    fontSize: 10,
    color: colors.outline,
  },
  paidActions: {
    alignItems: 'center',
    gap: 6,
  },
  receiptBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // MODAL STYLING
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 20,
    width: '100%',
    maxHeight: '85%',
    padding: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainerLow,
    paddingBottom: 14,
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: fonts.manropeBold,
    fontSize: 18,
    color: colors.onSurface,
  },
  modalScroll: {
    marginBottom: 16,
  },

  // DETAILS MODAL
  detailsBody: {
    gap: 12,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainerLow,
  },
  detailLabel: {
    fontFamily: fonts.interMedium,
    fontSize: 13,
    color: colors.onSurfaceVariant,
  },
  detailValue: {
    fontFamily: fonts.interSemiBold,
    fontSize: 13,
    color: colors.onSurface,
  },
  detailsEmpty: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  detailsEmptyText: {
    fontFamily: fonts.interRegular,
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },

  // WALLET MODAL
  modalSectionTitle: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 14,
    color: colors.outline,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  emptyWalletText: {
    fontFamily: fonts.interRegular,
    fontSize: 13,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    paddingVertical: 16,
  },
  walletCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  walletCardActive: {
    borderColor: colors.tertiaryFixedDim,
    backgroundColor: colors.surfaceContainerLowest,
  },
  walletCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  walletCardLabel: {
    fontFamily: fonts.interSemiBold,
    fontSize: 13,
    color: colors.onSurface,
    marginBottom: 1,
  },
  walletCardValue: {
    fontFamily: fonts.interRegular,
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  walletCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  walletDeleteBtn: {
    padding: 6,
  },
  addMethodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.outline,
    borderRadius: 12,
  },
  addMethodBtnText: {
    fontFamily: fonts.interSemiBold,
    fontSize: 13,
    color: colors.primary,
  },
  addMethodForm: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
  },
  addMethodTitle: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 14,
    color: colors.onSurface,
    marginBottom: 12,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainer,
    borderRadius: 8,
    padding: 3,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabBtnActive: {
    backgroundColor: colors.surfaceContainerLowest,
    elevation: 1,
  },
  tabBtnText: {
    fontFamily: fonts.interMedium,
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  tabBtnTextActive: {
    color: colors.primary,
    fontFamily: fonts.interSemiBold,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontFamily: fonts.interMedium,
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginTop: 6,
  },
  textInput: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: fonts.interRegular,
    fontSize: 13,
    color: colors.onSurface,
  },
  saveAddBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  saveAddBtnText: {
    fontFamily: fonts.interBold,
    fontSize: 13,
    color: colors.onPrimary,
  },
  cancelAddBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  cancelAddText: {
    fontFamily: fonts.interMedium,
    fontSize: 12,
    color: colors.error,
  },

  // AUTO-PAY MODAL
  autoPayBody: {
    marginBottom: 20,
    gap: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainerLow,
  },
  toggleLabel: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 15,
    color: colors.onSurface,
    marginBottom: 2,
  },
  toggleSub: {
    fontFamily: fonts.interRegular,
    fontSize: 12,
    color: colors.onSurfaceVariant,
    paddingRight: 10,
  },
  autoPaySettings: {
    gap: 14,
  },
  settingsLabel: {
    fontFamily: fonts.interSemiBold,
    fontSize: 12,
    color: colors.outline,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 6,
  },
  settingsAlertText: {
    fontFamily: fonts.interRegular,
    fontSize: 13,
    color: colors.error,
  },
  methodSelectRow: {
    gap: 6,
  },
  methodRadioBtn: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  methodRadioBtnActive: {
    borderColor: colors.tertiaryFixedDim,
    backgroundColor: colors.surfaceContainerLowest,
  },
  methodRadioText: {
    fontFamily: fonts.interMedium,
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  methodRadioTextActive: {
    color: colors.primary,
    fontFamily: fonts.interSemiBold,
  },
  daySelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dayBtn: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  dayBtnActive: {
    backgroundColor: colors.primary,
  },
  dayBtnText: {
    fontFamily: fonts.interMedium,
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  dayBtnTextActive: {
    color: colors.onPrimary,
    fontFamily: fonts.interSemiBold,
  },
  summaryBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(108,219,169,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(108,219,169,0.15)',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    alignItems: 'flex-start',
    marginTop: 8,
  },
  summaryBoxText: {
    flex: 1,
    fontFamily: fonts.interRegular,
    fontSize: 12,
    color: colors.onSurface,
    lineHeight: 18,
  },
});
