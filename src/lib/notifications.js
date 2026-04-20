import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Foreground behaviour: show the alert/sound/badge while app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const METHOD_LABELS = {
  gpay: 'Google Pay',
  phonepe: 'PhonePe',
  paytm: 'Paytm',
};

export async function requestPermissions() {
  if (!Device.isDevice) return false; // simulators don't support push

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return false;

  // Android requires a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'EstateLogic',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  return true;
}

export async function showPaymentConfirmed({ amount, method }) {
  const label = METHOD_LABELS[method] ?? method;
  const formatted = `₹${Number(amount).toLocaleString('en-IN')}`;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Payment Confirmed ✓',
      body: `Payment of ${formatted} confirmed via ${label}`,
      sound: true,
    },
    trigger: null, // immediate
  });
}

export async function scheduleRentReminder({ amount, dueDate }) {
  const trigger = new Date(dueDate);
  trigger.setHours(9, 0, 0, 0); // 9 AM on the due date

  // Only schedule if the due date is in the future
  if (trigger <= new Date()) return;

  const formatted = `₹${Number(amount).toLocaleString('en-IN')}`;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Rent Due Today',
      body: `Rent of ${formatted} is due today`,
      sound: true,
    },
    trigger,
  });
}

export async function showMaintenanceUpdate({ caseNumber }) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Issue Resolved',
      body: `Issue ${caseNumber} marked as resolved`,
      sound: true,
    },
    trigger: null,
  });
}

export async function showMessageSent({ recipientLabel }) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Message Sent',
      body: `Message sent to ${recipientLabel}`,
      sound: true,
    },
    trigger: null,
  });
}
