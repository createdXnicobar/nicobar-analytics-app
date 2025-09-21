import { Tabs, Redirect } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { BundleProvider } from "@/context/BundleContext";
import BottomNav from '@/components/BottomNav';
import { useAuth } from '@/context/AuthContext';

export default function TabLayout() {
  const { isAuthenticated, loading } = useAuth();

  const tabs = (
    <Tabs
      tabBar={props => <BottomNav {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: Platform.select({
          ios: { position: 'absolute' },
          default: {},
        }),
      }}>
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="reports" options={{ title: 'Insights' }} />
      <Tabs.Screen name="scan" options={{ title: 'Scan' }} />
      <Tabs.Screen name="notes" options={{ title: 'Notes' }} />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
      <Tabs.Screen name="analytics" options={{ title: 'Analytics' }} />
    </Tabs>
  );

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/(auth)/sign-in" />;

  return (
    <BundleProvider>
      {tabs}
    </BundleProvider>
  );
}
