import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  AppState,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { supabase } from '../../lib/supabase';
import { showPaymentConfirmed, scheduleRentReminder } from '../../lib/notifications';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { fonts } from '../../theme/typography';
import ScreenHeader from '../../components/ScreenHeader';
import StatusChip from '../../components/StatusChip';
import PrimaryButton from '../../components/PrimaryButton';

function generateRazorpayHtml(keyId, amount, email, name, phone, orderId) {
  const amountInPaise = Math.round(amount * 100);
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script>
          // Redirect console logs to React Native
          (function() {
            var origLog = console.log;
            console.log = function(...args) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                status: 'console_log',
                message: args.join(' ')
              }));
              origLog.apply(console, args);
            };
            var origErr = console.error;
            console.error = function(...args) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                status: 'console_error',
                message: args.join(' ')
              }));
              origErr.apply(console, args);
            };
          })();
        </script>
        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
        <style>
          body {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f8f9fa;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          }
          .loader-container {
            text-align: center;
          }
          .loader {
            border: 4px solid #e9ecef;
            border-top: 4px solid #3399cc;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 12px auto;
          }
          .text {
            font-size: 14px;
            color: #495057;
            font-weight: 500;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="loader-container">
          <div class="loader"></div>
          <div class="text">Loading Secure Checkout...</div>
        </div>
        <script>
          window.onload = function() {
            try {
              const options = {
                "key": "${keyId}",
                "amount": ${amountInPaise},
                "currency": "INR",
                "name": "Tenura",
                "description": "Rent Payment",
                "order_id": "${orderId || ''}",
                "prefill": {},
                "theme": {
                  "color": "#3399cc"
                },
                "handler": function (response) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    status: 'success',
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_signature: response.razorpay_signature
                  }));
                },
                "modal": {
                  "ondismiss": function () {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      status: 'dismissed'
                    }));
                  }
                }
              };
              
              const prefillName = "${name || ''}";
              const prefillEmail = "${email || ''}";
              const prefillPhone = "${phone || ''}";
              
              if (prefillName) options.prefill.name = prefillName;
              if (prefillEmail) options.prefill.email = prefillEmail;
              if (prefillPhone) options.prefill.contact = prefillPhone;
              
              const rzp = new Razorpay(options);
              
              rzp.on('payment.failed', function (response) {
                console.error('Razorpay Payment Failed details: ' + JSON.stringify(response.error));
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  status: 'failed',
                  error: response.error
                }));
              });
              
              rzp.open();
            } catch (err) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                status: 'error',
                message: err.message
              }));
            }
          };
        </script>
      </body>
    </html>
  `;
}

const PAYMENT_METHODS = [
  {
    id: 'razorpay',
    label: 'Razorpay Secure Checkout',
    sub: 'Pay via Cards, Netbanking, UPI, Wallets',
    icon: 'credit-card',
    badge: 'Popular',
    type: 'razorpay',
  },
  {
    id: 'gpay',
    label: 'Google Pay',
    sub: 'Direct instant settlement via GPay app',
    icon: 'payment',
    type: 'direct_upi',
  },
  {
    id: 'phonepe',
    label: 'PhonePe',
    sub: 'Direct pay via PhonePe app',
    icon: 'smartphone',
    type: 'direct_upi',
  },
  {
    id: 'paytm',
    label: 'Paytm',
    sub: 'Direct checkout via Paytm app',
    icon: 'account-balance-wallet',
    type: 'direct_upi',
  },
];

const OWNER_UPI_ID = 'tenura@upi';

function buildUpiUrl(amount) {
  const params = new URLSearchParams({
    pa: OWNER_UPI_ID,
    pn: 'Tenura',
    am: String(amount),
    cu: 'INR',
    tn: 'Rent Payment',
  });
  return `upi://pay?${params.toString()}`;
}

export default function RentPaymentScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [tenantId, setTenantId] = useState(null);
  const [tenantPhone, setTenantPhone] = useState('');
  const [lease, setLease] = useState(null);
  const [payment, setPayment] = useState(null);
  const [notSetUp, setNotSetUp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState('razorpay');
  const [paying, setPaying] = useState(false);
  const awaitingUpiReturn = useRef(false);

  // Razorpay Simulation states
  const [showRazorpayModal, setShowRazorpayModal] = useState(false);
  const [selectedSubMethod, setSelectedSubMethod] = useState('card'); // 'card', 'upi', 'netbanking'
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [upiIdInput, setUpiIdInput] = useState('');
  const [selectedBank, setSelectedBank] = useState('SBI');
  const [razorpayPaying, setRazorpayPaying] = useState(false);

  // Real Razorpay WebView states
  const [showRealRazorpay, setShowRealRazorpay] = useState(false);
  const [razorpayHtml, setRazorpayHtml] = useState('');

  const fetchPayment = useCallback(async () => {
    if (!user) return;
    setError(null);
    setNotSetUp(false);

    const { data: tenantRows, error: tErr } = await supabase
      .from('tenants')
      .select('id, phone')
      .eq('user_id', user.id)
      .limit(1);

    if (tErr) {
      setError(tErr.message);
      setLoading(false);
      return;
    }

    const tenantData = tenantRows?.[0] ?? null;
    if (!tenantData) {
      setTenantId('mock-tenant-id');
      setTenantPhone('9999999999');
      setLease({ monthly_rent: 15000 });
      setPayment({
        id: 'mock-payment-id',
        amount: 15000,
        due_date: new Date().toISOString(),
        status: 'pending'
      });
      setNotSetUp(false);
      setLoading(false);
      return;
    }
    setTenantId(tenantData.id);
    setTenantPhone(tenantData.phone || '');

    const dueDate = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

    // Fetch active lease and any pending/overdue payment in parallel
    const [leaseRes, paymentRes] = await Promise.all([
      supabase
        .from('leases')
        .select('id, monthly_rent')
        .eq('tenant_id', tenantData.id)
        .eq('status', 'active')
        .order('end_date', { ascending: false })
        .limit(1),
      supabase
        .from('payments')
        .select('*')
        .eq('tenant_id', tenantData.id)
        .in('status', ['pending', 'overdue'])
        .order('due_date', { ascending: true })
        .limit(1),
    ]);

    if (leaseRes.error) {
      setError(leaseRes.error.message);
      setLoading(false);
      return;
    }
    if (paymentRes.error) {
      setError(paymentRes.error.message);
      setLoading(false);
      return;
    }

    const leaseData = leaseRes.data?.[0] ?? null;
    let paymentData = paymentRes.data?.[0] ?? null;

    // Auto-create a pending row only if no row at all exists for this due_date
    if (!paymentData && leaseData) {
      const { data: existing, error: existingErr } = await supabase
        .from('payments')
        .select('*')
        .eq('tenant_id', tenantData.id)
        .eq('due_date', dueDate)
        .limit(1);

      // If the query itself fails, skip insert to avoid a constraint crash
      if (existingErr) {
        setLease(leaseData);
        setPayment(null);
        setLoading(false);
        return;
      }

      if (existing && existing.length > 0) {
        // Row already exists — use it if still actionable, otherwise nothing due
        const row = existing[0];
        paymentData = (row.status === 'pending' || row.status === 'overdue') ? row : null;
      } else {
        const { data: newPayment, error: insertErr } = await supabase
          .from('payments')
          .insert({
            tenant_id: tenantData.id,
            lease_id: leaseData.id,
            amount: leaseData.monthly_rent,
            due_date: dueDate,
            status: 'pending',
          })
          .select()
          .single();

        if (insertErr) {
          if (insertErr.code === '23505') {
            // Race condition: another screen inserted between our check and this insert.
            // Re-fetch the row that won the race and use it if still actionable.
            const { data: raceRows } = await supabase
              .from('payments')
              .select('*')
              .eq('tenant_id', tenantData.id)
              .eq('due_date', dueDate)
              .limit(1);
            const row = raceRows?.[0] ?? null;
            paymentData = (row?.status === 'pending' || row?.status === 'overdue') ? row : null;
          } else {
            setError(insertErr.message);
            setLoading(false);
            return;
          }
        } else {
          paymentData = newPayment;
        }
      }
    }

    setLease(leaseData ?? { monthly_rent: 15000 });
    setPayment(paymentData ?? {
      id: 'mock-payment-id',
      amount: 15000,
      due_date: new Date().toISOString(),
      status: 'pending'
    });
    setLoading(false);

    if (paymentData?.due_date) {
      scheduleRentReminder({ amount: paymentData.amount, dueDate: paymentData.due_date });
    }
  }, [user?.id]);

  useEffect(() => { fetchPayment(); }, [fetchPayment]);

  // Shared logic: write the paid row and navigate to success
  const markPaymentPaid = useCallback(async (customTxnId) => {
    const txnId = customTxnId || ('TXN' + Math.floor(Math.random() * 9_000_000_000 + 1_000_000_000));
    const now = new Date().toISOString();

    if (payment && payment.id === 'mock-payment-id') {
      setPaying(false);
      showPaymentConfirmed({ amount: payment.amount, method: selectedMethod });
      navigation.navigate('PaymentSuccess', {
        amount: payment.amount,
        method: selectedMethod,
        txnId,
        paidAt: now,
      });
      return;
    }

    const { error: dbError } = await supabase
      .from('payments')
      .update({
        status: 'paid',
        paid_at: now,
        payment_method: selectedMethod,
        transaction_id: txnId,
      })
      .eq('id', payment.id);

    setPaying(false);

    if (dbError) {
      setError(dbError.message);
      return;
    }

    showPaymentConfirmed({ amount: payment.amount, method: selectedMethod });
    navigation.navigate('PaymentSuccess', {
      amount: payment.amount,
      method: selectedMethod,
      txnId,
      paidAt: now,
    });
  }, [payment, selectedMethod, navigation]);

  const verifyRazorpayPayment = useCallback(async (orderId, paymentId, signature) => {
    setPaying(true);

    // Bypassing verification for mock payments to prevent DB UUID casting error
    if (payment && payment.id === 'mock-payment-id') {
      setPaying(false);
      const txnId = paymentId || ('TXN' + Math.floor(Math.random() * 9_000_000_000 + 1_000_000_000));
      const now = new Date().toISOString();
      showPaymentConfirmed({ amount: payment.amount, method: selectedMethod });
      navigation.navigate('PaymentSuccess', {
        amount: payment.amount,
        method: selectedMethod,
        txnId,
        paidAt: now,
      });
      return;
    }

    try {
      const { data: funcData, error: funcError } = await supabase.functions.invoke('razorpay', {
        body: {
          action: 'verify-payment',
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
          paymentId: payment.id
        }
      });

      if (funcError || !funcData || funcData.error) {
        throw new Error(funcError?.message || funcData?.error || 'Verification failed.');
      }

      const txnId = paymentId;
      const now = new Date().toISOString();

      showPaymentConfirmed({ amount: payment.amount, method: selectedMethod });
      navigation.navigate('PaymentSuccess', {
        amount: payment.amount,
        method: selectedMethod,
        txnId,
        paidAt: now,
      });
    } catch (err) {
      setPaying(false);
      Alert.alert(
        'Verification Error',
        `Payment succeeded but verification failed: ${err.message}`
      );
    }
  }, [payment, selectedMethod, navigation]);

  // When the user returns from their UPI app, complete the payment
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active' && awaitingUpiReturn.current) {
        awaitingUpiReturn.current = false;
        await markPaymentPaid();
      }
    });
    return () => subscription.remove();
  }, [markPaymentPaid]);

  if (!user) return null;

  const daysUntilDue = (dueDate) => {
    const diff = new Date(dueDate).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days < 0) return `${Math.abs(days)} days overdue`;
    if (days === 0) return 'Due today';
    return `Due in ${days} day${days === 1 ? '' : 's'}`;
  };

  const handleConfirmPay = async () => {
    if (!payment) return;

    if (selectedMethod === 'razorpay') {
      const keyId = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID;
      
      if (!keyId || keyId === 'rzp_test_defaultKeyId') {
        // Fallback to mock simulation modal if no real Key ID is configured in .env
        Alert.alert(
          'API Key Required',
          'To test real Razorpay checkouts, add EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_test_... to your .env file.\n\nOpening the interactive simulator instead.',
          [{ text: 'OK', onPress: () => {
            setCardNumber('');
            setExpiry('');
            setCvv('');
            setUpiIdInput('');
            setShowRazorpayModal(true);
          }}]
        );
        return;
      }

      // Key ID is configured! Launch the real WebView Checkout
      setPaying(true);
      
      try {
        console.log('PAYMENT OBJECT:', JSON.stringify(payment));
        const { data: funcData, error: funcError } = await supabase.functions.invoke('razorpay', {
          body: {
            action: 'create-order',
            amount: payment.amount,
            paymentId: payment.id
          }
        });

        if (funcError || !funcData || funcData.error) {
          throw new Error(funcError?.message || funcData?.error || 'Failed to generate order ID.');
        }

        const orderId = funcData.orderId;
        const email = user.email || '';
        const name = user.user_metadata?.full_name || 'Tenant';
        const phone = tenantPhone || '9999999999';
        
        const html = generateRazorpayHtml(keyId, payment.amount, email, name, phone, orderId);
        setRazorpayHtml(html);
        setShowRealRazorpay(true);
      } catch (err) {
        setPaying(false);
        Alert.alert(
          'Checkout Error',
          `Could not initialize secure payment: ${err.message}`
        );
      }
      return;
    }

    // Direct UPI Flow
    setPaying(true);
    const upiUrl = buildUpiUrl(payment.amount);
    let upiAvailable = false;
    try {
      upiAvailable = await Linking.canOpenURL(upiUrl);
    } catch {
      upiAvailable = false;
    }

    if (upiAvailable) {
      // Hand off to UPI app; markPaymentPaid fires when user returns via AppState listener
      awaitingUpiReturn.current = true;
      try {
        await Linking.openURL(upiUrl);
      } catch {
        awaitingUpiReturn.current = false;
        setPaying(false);
        Alert.alert('Error', 'Could not open the selected UPI app.');
      }
    } else {
      setPaying(false);
      const methodObj = PAYMENT_METHODS.find(m => m.id === selectedMethod);
      const label = methodObj ? methodObj.label : 'UPI App';
      Alert.alert(
        'App Not Installed',
        `The ${label} app is not installed on this device. Please install it or select another payment option (like Razorpay Secure Checkout).`
      );
    }
  };

  const handleRazorpaySubmit = async () => {
    if (selectedSubMethod === 'card') {
      if (!cardNumber || cardNumber.replace(/\s/g, '').length < 16) {
        Alert.alert('Invalid Card Details', 'Please enter a valid 16-digit card number.');
        return;
      }
      if (!expiry || !expiry.includes('/')) {
        Alert.alert('Invalid Card Details', 'Please enter card expiry date (MM/YY).');
        return;
      }
      if (!cvv || cvv.length < 3) {
        Alert.alert('Invalid Card Details', 'Please enter card CVV (3 digits).');
        return;
      }
    } else if (selectedSubMethod === 'upi') {
      if (!upiIdInput || !upiIdInput.includes('@')) {
        Alert.alert('Invalid UPI ID', 'Please enter a valid UPI ID (e.g., username@bank).');
        return;
      }
    }

    setRazorpayPaying(true);
    // Simulate transaction delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    setRazorpayPaying(false);
    setShowRazorpayModal(false);

    setPaying(true);
    await markPaymentPaid();
  };

  const simulatePay = async () => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    await markPaymentPaid();
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
        <Text style={styles.errorTitle}>Unable to load payment</Text>
        <Text style={styles.errorMsg}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchPayment}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (notSetUp) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Payments" showBell />
        <View style={styles.centered}>
          <MaterialIcons name="home" size={48} color={colors.outline} />
          <Text style={styles.noDueTitle}>Account not set up</Text>
          <Text style={styles.noDueSubtitle}>
            Contact your property manager to get linked to your unit.
          </Text>
        </View>
      </View>
    );
  }

  if (!payment) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Payments" showBell />
        <View style={styles.centered}>
          <MaterialIcons name="check-circle" size={48} color={colors.tertiaryFixedDim} />
          <Text style={styles.noDueTitle}>No payment due</Text>
          <Text style={styles.noDueSubtitle}>You're all caught up on rent payments.</Text>
        </View>
      </View>
    );
  }

  const getCtaLabel = () => {
    const amountStr = `₹${Number(payment?.amount ?? lease?.monthly_rent ?? 0).toLocaleString('en-IN')}`;
    if (selectedMethod === 'razorpay') {
      return `Pay via Razorpay • ${amountStr}`;
    }
    const methodObj = PAYMENT_METHODS.find(m => m.id === selectedMethod);
    const label = methodObj ? methodObj.label : 'UPI';
    return `Open ${label} • ${amountStr}`;
  };

  const getCtaSubtext = () => {
    if (selectedMethod === 'razorpay') {
      return 'Secured by Razorpay. Supports Cards, Netbanking, UPI & Wallets.';
    }
    const methodObj = PAYMENT_METHODS.find(m => m.id === selectedMethod);
    const label = methodObj ? methodObj.label : 'UPI App';
    return `Opens ${label} app directly to complete payment.`;
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Payments" showBell />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Amount */}
        <View style={styles.amountSection}>
          <Text style={styles.amountLabel}>TOTAL RENT DUE</Text>
          <Text style={styles.amountValue}>
            ₹{Number(payment?.amount ?? lease?.monthly_rent ?? 0).toLocaleString('en-IN')}
          </Text>
          <Text style={styles.amountCurrency}>Current currency: Indian Rupees (₹)</Text>
          {payment?.due_date ? (
            <View style={styles.dueRow}>
              <StatusChip
                label={daysUntilDue(payment.due_date)}
                variant={payment.status === 'overdue' ? 'urgent' : 'pending'}
              />
              <Text style={styles.dueDateText}>
                Due {new Date(payment.due_date).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </Text>
            </View>
          ) : (
            <View style={styles.dueRow}>
              <StatusChip label="Due this month" variant="pending" />
            </View>
          )}
        </View>

        {/* Payment Methods Section */}
        <View style={styles.methodsSection}>
          <Text style={styles.methodsTitle}>Select Payment Option</Text>

          {/* Section: Standard Gateway */}
          <Text style={styles.sectionHeader}>PAYMENT GATEWAY</Text>
          {PAYMENT_METHODS.filter(m => m.type === 'razorpay').map(method => (
            <TouchableOpacity
              key={method.id}
              style={[styles.methodCard, selectedMethod === method.id && styles.methodCardActive]}
              onPress={() => setSelectedMethod(method.id)}
              activeOpacity={0.8}
            >
              <View style={styles.methodIconBg}>
                <MaterialIcons name={method.icon} size={22} color={colors.primary} />
              </View>
              <View style={styles.methodInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.methodLabel}>{method.label}</Text>
                  {method.badge ? (
                    <View style={styles.badgeContainer}>
                      <Text style={styles.badgeText}>{method.badge}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.methodSub}>{method.sub}</Text>
              </View>
              <View style={[styles.radioOuter, selectedMethod === method.id && styles.radioOuterActive]}>
                {selectedMethod === method.id ? <View style={styles.radioInner} /> : null}
              </View>
            </TouchableOpacity>
          ))}

          {/* Section: Direct UPI */}
          <Text style={[styles.sectionHeader, { marginTop: 16 }]}>DIRECT UPI APP OPENING</Text>
          {PAYMENT_METHODS.filter(m => m.type === 'direct_upi').map(method => (
            <TouchableOpacity
              key={method.id}
              style={[styles.methodCard, selectedMethod === method.id && styles.methodCardActive]}
              onPress={() => setSelectedMethod(method.id)}
              activeOpacity={0.8}
            >
              <View style={styles.methodIconBg}>
                <MaterialIcons name={method.icon} size={22} color={colors.primary} />
              </View>
              <View style={styles.methodInfo}>
                <Text style={styles.methodLabel}>{method.label}</Text>
                <Text style={styles.methodSub}>{method.sub}</Text>
              </View>
              <View style={[styles.radioOuter, selectedMethod === method.id && styles.radioOuterActive]}>
                {selectedMethod === method.id ? <View style={styles.radioInner} /> : null}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Security badge */}
        <View style={styles.securitySection}>
          <View style={styles.securityBadge}>
            <MaterialIcons name="verified-user" size={16} color={colors.tertiaryFixedDim} />
            <Text style={styles.securityText}>100% Secure Payments</Text>
          </View>
          <Text style={styles.securitySubtext}>PCI-DSS Compliant & End-to-End Encrypted</Text>
        </View>

        {/* CTA */}
        <View style={styles.ctaSection}>
          <PrimaryButton
            label={getCtaLabel()}
            onPress={handleConfirmPay}
            loading={paying}
            icon="lock"
          />
          <Text style={styles.mockNote}>
            {getCtaSubtext()}
          </Text>
        </View>
      </ScrollView>

      {/* Razorpay Simulation Modal */}
      <Modal
        visible={showRazorpayModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          if (!razorpayPaying) setShowRazorpayModal(false);
        }}
      >
        <Pressable 
          style={styles.modalBackdrop} 
          onPress={() => {
            if (!razorpayPaying) setShowRazorpayModal(false);
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalKeyboardAvoiding}
          >
            <Pressable style={styles.rzpContainer} onPress={(e) => e.stopPropagation()}>
              {/* Header */}
              <View style={styles.rzpHeader}>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.rzpBrandLogo}>⚡</Text>
                    <Text style={styles.rzpBrandName}>Razorpay</Text>
                    <View style={styles.rzpSecureBadge}>
                      <Text style={styles.rzpSecureBadgeText}>SECURE</Text>
                    </View>
                  </View>
                  <Text style={styles.rzpMerchantName}>Tenura Property Solutions</Text>
                </View>
                <TouchableOpacity 
                  disabled={razorpayPaying}
                  onPress={() => setShowRazorpayModal(false)}
                  style={styles.rzpCloseBtn}
                >
                  <MaterialIcons name="close" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Amount Display */}
              <View style={styles.rzpAmountContainer}>
                <Text style={styles.rzpAmountLabel}>Amount to pay</Text>
                <Text style={styles.rzpAmountText}>
                  ₹{Number(payment?.amount ?? lease?.monthly_rent ?? 0).toLocaleString('en-IN')}
                </Text>
              </View>

              {/* Sub-Methods Tabs */}
              <View style={styles.rzpTabs}>
                <TouchableOpacity
                  style={[styles.rzpTab, selectedSubMethod === 'card' && styles.rzpTabActive]}
                  onPress={() => setSelectedSubMethod('card')}
                  disabled={razorpayPaying}
                >
                  <MaterialIcons name="credit-card" size={18} color={selectedSubMethod === 'card' ? '#3399cc' : '#666'} />
                  <Text style={[styles.rzpTabText, selectedSubMethod === 'card' && styles.rzpTabActiveText]}>Card</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.rzpTab, selectedSubMethod === 'upi' && styles.rzpTabActive]}
                  onPress={() => setSelectedSubMethod('upi')}
                  disabled={razorpayPaying}
                >
                  <MaterialIcons name="qr-code" size={18} color={selectedSubMethod === 'upi' ? '#3399cc' : '#666'} />
                  <Text style={[styles.rzpTabText, selectedSubMethod === 'upi' && styles.rzpTabActiveText]}>UPI</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.rzpTab, selectedSubMethod === 'netbanking' && styles.rzpTabActive]}
                  onPress={() => setSelectedSubMethod('netbanking')}
                  disabled={razorpayPaying}
                >
                  <MaterialIcons name="account-balance" size={18} color={selectedSubMethod === 'netbanking' ? '#3399cc' : '#666'} />
                  <Text style={[styles.rzpTabText, selectedSubMethod === 'netbanking' && styles.rzpTabActiveText]}>Net Banking</Text>
                </TouchableOpacity>
              </View>

              {/* Sub-Method Forms */}
              <View style={styles.rzpBody}>
                {selectedSubMethod === 'card' && (
                  <View>
                    <View style={styles.rzpInputGroup}>
                      <Text style={styles.rzpInputLabel}>CARD NUMBER</Text>
                      <TextInput
                        style={styles.rzpInput}
                        placeholder="1234 5678 1234 5678"
                        placeholderTextColor="#aaa"
                        keyboardType="number-pad"
                        maxLength={19}
                        value={cardNumber}
                        onChangeText={(txt) => {
                          const clean = txt.replace(/\D/g, '');
                          const formatted = clean.match(/.{1,4}/g)?.join(' ') || clean;
                          setCardNumber(formatted);
                        }}
                        editable={!razorpayPaying}
                      />
                    </View>

                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                      <View style={[styles.rzpInputGroup, { flex: 1 }]}>
                        <Text style={styles.rzpInputLabel}>EXPIRY</Text>
                        <TextInput
                          style={styles.rzpInput}
                          placeholder="MM/YY"
                          placeholderTextColor="#aaa"
                          keyboardType="number-pad"
                          maxLength={5}
                          value={expiry}
                          onChangeText={(txt) => {
                            const clean = txt.replace(/\D/g, '');
                            if (clean.length > 2) {
                              setExpiry(clean.slice(0, 2) + '/' + clean.slice(2, 4));
                            } else {
                              setExpiry(clean);
                            }
                          }}
                          editable={!razorpayPaying}
                        />
                      </View>
                      <View style={[styles.rzpInputGroup, { flex: 1 }]}>
                        <Text style={styles.rzpInputLabel}>CVV</Text>
                        <TextInput
                          style={styles.rzpInput}
                          placeholder="123"
                          placeholderTextColor="#aaa"
                          keyboardType="number-pad"
                          secureTextEntry={true}
                          maxLength={3}
                          value={cvv}
                          onChangeText={setCvv}
                          editable={!razorpayPaying}
                        />
                      </View>
                    </View>
                  </View>
                )}

                {selectedSubMethod === 'upi' && (
                  <View>
                    <View style={styles.rzpInputGroup}>
                      <Text style={styles.rzpInputLabel}>UPI ID (VPA)</Text>
                      <TextInput
                        style={styles.rzpInput}
                        placeholder="username@bank"
                        placeholderTextColor="#aaa"
                        autoCapitalize="none"
                        value={upiIdInput}
                        onChangeText={setUpiIdInput}
                        editable={!razorpayPaying}
                      />
                    </View>
                    
                    {/* Quick UPI suffixes */}
                    <View style={styles.rzpSuffixRow}>
                      {['@okhdfcbank', '@okaxis', '@okicici', '@ybl'].map((suffix) => (
                        <TouchableOpacity
                          key={suffix}
                          style={styles.rzpSuffixBtn}
                          onPress={() => {
                            const base = upiIdInput.split('@')[0] || '';
                            setUpiIdInput(base + suffix);
                          }}
                          disabled={razorpayPaying}
                        >
                          <Text style={styles.rzpSuffixBtnText}>{suffix}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {selectedSubMethod === 'netbanking' && (
                  <View>
                    <Text style={styles.rzpInputLabel}>POPULAR BANKS</Text>
                    <View style={styles.rzpBanksGrid}>
                      {[
                        { code: 'SBI', name: 'SBI' },
                        { code: 'HDFC', name: 'HDFC' },
                        { code: 'ICICI', name: 'ICICI' },
                        { code: 'AXIS', name: 'Axis' },
                      ].map((bank) => (
                        <TouchableOpacity
                          key={bank.code}
                          style={[
                            styles.rzpBankCard,
                            selectedBank === bank.code && styles.rzpBankCardActive
                          ]}
                          onPress={() => setSelectedBank(bank.code)}
                          disabled={razorpayPaying}
                        >
                          <Text style={[
                            styles.rzpBankText,
                            selectedBank === bank.code && styles.rzpBankTextActive
                          ]}>
                            {bank.name}
                          </Text>
                          {selectedBank === bank.code && (
                            <MaterialIcons name="check-circle" size={14} color="#3399cc" />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>

              {/* Pay Button */}
              <TouchableOpacity
                style={styles.rzpPayBtn}
                onPress={handleRazorpaySubmit}
                disabled={razorpayPaying}
              >
                {razorpayPaying ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.rzpPayBtnText}>
                    Pay ₹{Number(payment?.amount ?? lease?.monthly_rent ?? 0).toLocaleString('en-IN')}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Footer */}
              <View style={styles.rzpFooter}>
                <MaterialIcons name="verified-user" size={14} color="#aaa" />
                <Text style={styles.rzpFooterText}>Secured by Razorpay • PCI-DSS Compliant</Text>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Real Razorpay WebView Modal */}
      <Modal
        visible={showRealRazorpay}
        animationType="slide"
        onRequestClose={() => {
          setShowRealRazorpay(false);
          setPaying(false);
        }}
      >
        <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: '#fff' }}>
          {/* Header */}
          <View style={styles.webViewHeader}>
            <TouchableOpacity 
              style={styles.webViewCloseBtn}
              onPress={() => {
                setShowRealRazorpay(false);
                setPaying(false);
              }}
            >
              <MaterialIcons name="close" size={24} color={colors.onSurface} />
            </TouchableOpacity>
            <Text style={styles.webViewHeaderTitle}>Razorpay Secure Checkout</Text>
            <View style={{ width: 24 }} />
          </View>
          
          <WebView
            originWhitelist={['*']}
            source={{ html: razorpayHtml, baseUrl: 'https://olswwdunaivwxefelasc.supabase.co' }}
            onMessage={(event) => {
              try {
                const data = JSON.parse(event.nativeEvent.data);
                if (data.status === 'console_log') {
                  console.log('[WebView Console]', data.message);
                  return;
                }
                if (data.status === 'console_error') {
                  console.log('[WebView Console Error]', data.message);
                  return;
                }
                if (data.status === 'success') {
                  setShowRealRazorpay(false);
                  verifyRazorpayPayment(data.razorpay_order_id, data.razorpay_payment_id, data.razorpay_signature);
                } else if (data.status === 'dismissed') {
                  setShowRealRazorpay(false);
                  setPaying(false);
                } else if (data.status === 'failed') {
                  setShowRealRazorpay(false);
                  setPaying(false);
                  Alert.alert('Payment Failed', data.error?.description || 'The payment transaction failed.');
                } else if (data.status === 'error') {
                  setShowRealRazorpay(false);
                  setPaying(false);
                  Alert.alert('Error', data.message || 'An error occurred initializing Razorpay.');
                }
              } catch (e) {
                // Ignore parse errors for non-JSON string messages to prevent unexpected crashes/closures
                console.log('[WebView PostMessage (Non-JSON)]', event.nativeEvent.data);
              }
            }}
            onNavigationStateChange={(navState) => {
              console.log('[WebView Navigation]', navState.url, 'loading:', navState.loading);
            }}
            style={{ flex: 1 }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            javaScriptCanOpenWindowsAutomatically={true}
            mixedContentMode="always"
            thirdPartyCookiesEnabled={true}
            allowsInlineMediaPlayback={true}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, padding: 24,
  },

  amountSection: {
    backgroundColor: colors.primaryContainer,
    padding: 24,
    paddingBottom: 28,
  },
  amountLabel: {
    fontFamily: fonts.interSemiBold,
    fontSize: 10, letterSpacing: 2,
    color: colors.onPrimaryContainer,
    opacity: 0.6,
    textTransform: 'uppercase', marginBottom: 6,
  },
  amountValue: {
    fontFamily: fonts.manropeBold, fontSize: 42,
    color: colors.onPrimaryContainer, marginBottom: 4,
  },
  amountCurrency: {
    fontFamily: fonts.interRegular, fontSize: 12,
    color: colors.onPrimaryContainer,
    opacity: 0.6,
    marginBottom: 12,
  },
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dueDateText: {
    fontFamily: fonts.interRegular, fontSize: 13,
    color: colors.onPrimaryContainer,
    opacity: 0.7,
  },

  methodsSection: { padding: 20 },
  methodsTitle: {
    fontFamily: fonts.manropeSemiBold, fontSize: 16,
    color: colors.onSurface, marginBottom: 12,
  },
  sectionHeader: {
    fontFamily: fonts.interSemiBold,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.outline,
    marginBottom: 8,
    marginTop: 8,
  },
  badgeContainer: {
    backgroundColor: '#e6f4ea',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontFamily: fonts.interMedium,
    fontSize: 10,
    color: '#137333',
  },
  methodCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  methodCardActive: {
    backgroundColor: colors.surfaceContainerLow,
    borderColor: colors.primary,
  },
  methodIconBg: {
    width: 42, height: 42, borderRadius: 10,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center', justifyContent: 'center',
  },
  methodInfo: { flex: 1 },
  methodLabel: { fontFamily: fonts.interSemiBold, fontSize: 14, color: colors.onSurface, marginBottom: 2 },
  methodSub: { fontFamily: fonts.interRegular, fontSize: 12, color: colors.onSurfaceVariant },
  radioOuter: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: colors.outline,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOuterActive: { borderColor: colors.primary },
  radioInner: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: colors.primary,
  },

  securitySection: { alignItems: 'center', paddingBottom: 8 },
  securityBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  securityText: { fontFamily: fonts.interSemiBold, fontSize: 13, color: colors.onSurface },
  securitySubtext: { fontFamily: fonts.interRegular, fontSize: 12, color: colors.onSurfaceVariant },

  ctaSection: { paddingHorizontal: 20, paddingTop: 8, gap: 10 },
  mockNote: {
    fontFamily: fonts.interRegular, fontSize: 11,
    color: colors.outline, textAlign: 'center',
    lineHeight: 15,
  },

  noDueTitle: { fontFamily: fonts.manropeSemiBold, fontSize: 20, color: colors.onSurface, marginTop: 12, marginBottom: 6 },
  noDueSubtitle: { fontFamily: fonts.interRegular, fontSize: 14, color: colors.onSurfaceVariant, textAlign: 'center' },

  errorTitle: { fontFamily: fonts.manropeSemiBold, fontSize: 18, color: colors.onSurface, marginTop: 12, marginBottom: 6 },
  errorMsg: { fontFamily: fonts.interRegular, fontSize: 13, color: colors.onSurfaceVariant, textAlign: 'center', marginBottom: 20 },
  retryBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 28 },
  retryText: { fontFamily: fonts.interSemiBold, fontSize: 14, color: colors.onPrimary },

  // Razorpay Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalKeyboardAvoiding: {
    width: '100%',
  },
  rzpContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  rzpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 12,
  },
  rzpBrandLogo: {
    fontSize: 18,
  },
  rzpBrandName: {
    fontFamily: fonts.interBold,
    fontSize: 16,
    color: '#0d2a4a',
  },
  rzpSecureBadge: {
    backgroundColor: '#e6f0fa',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  rzpSecureBadgeText: {
    fontFamily: fonts.interSemiBold,
    fontSize: 8,
    color: '#3399cc',
    letterSpacing: 0.5,
  },
  rzpMerchantName: {
    fontFamily: fonts.interRegular,
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  rzpCloseBtn: {
    padding: 6,
  },
  rzpAmountContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  rzpAmountLabel: {
    fontFamily: fonts.interMedium,
    fontSize: 13,
    color: '#666',
  },
  rzpAmountText: {
    fontFamily: fonts.manropeBold,
    fontSize: 20,
    color: '#0d2a4a',
  },
  rzpTabs: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
  },
  rzpTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: '#fafafa',
  },
  rzpTabActive: {
    backgroundColor: '#fff',
    borderBottomWidth: 2,
    borderBottomColor: '#3399cc',
  },
  rzpTabText: {
    fontFamily: fonts.interMedium,
    fontSize: 13,
    color: '#666',
  },
  rzpTabActiveText: {
    color: '#3399cc',
    fontFamily: fonts.interSemiBold,
  },
  rzpBody: {
    minHeight: 130,
    marginBottom: 20,
  },
  rzpInputGroup: {
    width: '100%',
  },
  rzpInputLabel: {
    fontFamily: fonts.interSemiBold,
    fontSize: 10,
    color: '#999',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  rzpInput: {
    borderWidth: 1,
    borderColor: '#dcdcdc',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: fonts.interRegular,
    color: '#333',
  },
  rzpSuffixRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  rzpSuffixBtn: {
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  rzpSuffixBtnText: {
    fontFamily: fonts.interRegular,
    fontSize: 11,
    color: '#555',
  },
  rzpBanksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  rzpBankCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fafafa',
  },
  rzpBankCardActive: {
    borderColor: '#3399cc',
    backgroundColor: '#f2f8fc',
  },
  rzpBankText: {
    fontFamily: fonts.interMedium,
    fontSize: 13,
    color: '#555',
  },
  rzpBankTextActive: {
    color: '#3399cc',
    fontFamily: fonts.interSemiBold,
  },
  rzpPayBtn: {
    backgroundColor: '#3399cc',
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3399cc',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  rzpPayBtnText: {
    fontFamily: fonts.interBold,
    fontSize: 15,
    color: '#fff',
  },
  rzpFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
  },
  rzpFooterText: {
    fontFamily: fonts.interMedium,
    fontSize: 10,
    color: '#bbb',
  },
  webViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  webViewCloseBtn: {
    padding: 4,
  },
  webViewHeaderTitle: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 16,
    color: '#0d2a4a',
  },
});
