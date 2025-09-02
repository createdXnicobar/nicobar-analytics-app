import { Tabs, Redirect } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import BottomNav from '@/components/BottomNav';
import { SignedIn, SignedOut } from '@clerk/clerk-expo';

export default function TabLayout() {
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
      <Tabs.Screen name="reports" options={{ title: 'Reports' }} />
      <Tabs.Screen name="scan" options={{ title: 'Scan' }} />
      <Tabs.Screen name="notes" options={{ title: 'Notes' }} />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
    </Tabs>
  );

  return (
    <>
      <SignedIn>{tabs}</SignedIn>
      <SignedOut>
        <Redirect href="/(auth)/sign-in" />
      </SignedOut>
    </>
  );
}
