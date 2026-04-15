import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

import OwnerDashboard from '../screens/owner/OwnerDashboard';
import AddPropertyScreen from '../screens/owner/AddPropertyScreen';
import EditPropertyScreen from '../screens/owner/EditPropertyScreen';
import ResidentDataScreen from '../screens/owner/ResidentDataScreen';
import TenantOnboardingScreen from '../screens/owner/TenantOnboardingScreen';
import TenantDetailScreen from '../screens/owner/TenantDetailScreen';
import FinanceOverviewScreen from '../screens/owner/FinanceOverviewScreen';
import RentCollectionScreen from '../screens/owner/RentCollectionScreen';
import ResidentIssuesScreen from '../screens/owner/ResidentIssuesScreen';
import ProfileScreen from '../screens/shared/ProfileScreen';

const Tab = createBottomTabNavigator();
const PortfolioStack = createStackNavigator();
const ResidentsStack = createStackNavigator();
const FinanceStack = createStackNavigator();
const IssuesStack = createStackNavigator();

function PortfolioStackNav() {
  return (
    <PortfolioStack.Navigator screenOptions={{ headerShown: false }}>
      <PortfolioStack.Screen name="OwnerDashboard" component={OwnerDashboard} />
      <PortfolioStack.Screen name="AddProperty" component={AddPropertyScreen} />
      <PortfolioStack.Screen name="EditProperty" component={EditPropertyScreen} />
    </PortfolioStack.Navigator>
  );
}

function ResidentsStackNav() {
  return (
    <ResidentsStack.Navigator screenOptions={{ headerShown: false }}>
      <ResidentsStack.Screen name="ResidentData" component={ResidentDataScreen} />
      <ResidentsStack.Screen name="TenantOnboarding" component={TenantOnboardingScreen} />
      <ResidentsStack.Screen name="TenantDetail" component={TenantDetailScreen} />
    </ResidentsStack.Navigator>
  );
}

function FinanceStackNav() {
  return (
    <FinanceStack.Navigator screenOptions={{ headerShown: false }}>
      <FinanceStack.Screen name="FinanceOverview" component={FinanceOverviewScreen} />
      <FinanceStack.Screen name="RentCollection" component={RentCollectionScreen} />
    </FinanceStack.Navigator>
  );
}

function IssuesStackNav() {
  return (
    <IssuesStack.Navigator screenOptions={{ headerShown: false }}>
      <IssuesStack.Screen name="ResidentIssues" component={ResidentIssuesScreen} />
    </IssuesStack.Navigator>
  );
}

const TAB_BAR_STYLE = {
  backgroundColor: colors.primary,
  borderTopWidth: 0,
  elevation: 0,
  height: 64,
  paddingBottom: 8,
  paddingTop: 8,
};

export default function OwnerNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: TAB_BAR_STYLE,
        tabBarActiveTintColor: colors.tertiaryFixedDim,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.45)',
        tabBarLabelStyle: {
          fontFamily: fonts.interMedium,
          fontSize: 11,
        },
        tabBarIcon: ({ color, size }) => {
          const icons = {
            Portfolio: 'domain',
            Residents: 'groups',
            Finance: 'payments',
            Issues: 'report-problem',
            Profile: 'person',
          };
          return <MaterialIcons name={icons[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Portfolio" component={PortfolioStackNav} />
      <Tab.Screen name="Residents" component={ResidentsStackNav} />
      <Tab.Screen name="Finance" component={FinanceStackNav} />
      <Tab.Screen name="Issues" component={IssuesStackNav} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
