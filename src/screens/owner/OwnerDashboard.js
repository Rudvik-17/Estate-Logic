import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function OwnerDashboard() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Owner Dashboard</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#002045',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: { color: '#68dba9', fontSize: 24, fontWeight: 'bold' },
});