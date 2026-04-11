import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '../theme/colors';

import LoginScreen from '../screens/auth/LoginScreen';
import RoleSelectionScreen from '../screens/auth/RoleSelectionScreen';
import OwnerNavigator from './OwnerNavigator';
import TenantNavigator from './TenantNavigator';

const Stack = createStackNavigator();

export default function RootNavigator() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary }}>
        <ActivityIndicator size="large" color={colors.tertiaryFixedDim} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          // Not logged in
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : !role ? (
          // Logged in but no role set yet — always show role picker
          <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
        ) : role === 'owner' ? (
          <Stack.Screen name="OwnerApp" component={OwnerNavigator} />
        ) : (
          <Stack.Screen name="TenantApp" component={TenantNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
