import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { ActivityIndicator, View } from 'react-native';

import LoginScreen from '../screens/auth/LoginScreen';
import RoleSelectionScreen from '../screens/auth/RoleSelectionScreen';
import OwnerDashboard from '../screens/owner/OwnerDashboard';
import TenantDashboard from '../screens/tenant/TenantDashboard';

const Stack = createStackNavigator();

export default function RootNavigator() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#002045' }}>
        <ActivityIndicator size="large" color="#68dba9" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
          </>
        ) : role === 'owner' ? (
          <Stack.Screen name="OwnerDashboard" component={OwnerDashboard} />
        ) : (
          <Stack.Screen name="TenantDashboard" component={TenantDashboard} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}