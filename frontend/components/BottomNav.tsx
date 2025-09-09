import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Platform } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const NAV_BG = '#f7f7f7';
const ACTIVE = '#111827';
const INACTIVE = '#9aa0a6';

export default function BottomNav({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const go = (name: string) => navigation.navigate(name as never);

  const isActive = (routeName: string) => {
    const idx = state.routes.findIndex(r => r.name === routeName);
    return state.index === idx;
  };

  return (
    <View style={[
      styles.container,
      {
        paddingBottom: Math.max(12, insets.bottom + 8),
        marginBottom: Math.max(2, insets.bottom ? 4 : 8),
      }
    ]}>
      <TouchableOpacity style={styles.item} onPress={() => go('home')}>
        <IconSymbol size={24} name="house.fill" color={isActive('home') ? ACTIVE : INACTIVE} />
        <Text style={[styles.label, { color: isActive('home') ? ACTIVE : INACTIVE }]}>Home</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={() => go('Insights')}>
        <IconSymbol size={24} name="chart.bar.fill" color={isActive('Insights') ? ACTIVE : INACTIVE} />
        <Text style={[styles.label, { color: isActive('Insights') ? ACTIVE : INACTIVE }]}>Insights</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.scanButton} onPress={() => go('scan')}>
        <IconSymbol size={28} name="qrcode.viewfinder" color="#fff" />
      </TouchableOpacity>

      
      <TouchableOpacity style={styles.item} onPress={() => go('analytics')}>
        <IconSymbol size={24} name="chart.pie.fill" color={isActive('analytics') ? ACTIVE : INACTIVE} />
        <Text style={[styles.label, { color: isActive('analytics') ? ACTIVE : INACTIVE }]}>Analytics</Text>
      </TouchableOpacity>


      <TouchableOpacity style={styles.item} onPress={() => go('account')}>
        <IconSymbol size={24} name="person.crop.circle" color={isActive('account') ? ACTIVE : INACTIVE} />
        <Text style={[styles.label, { color: isActive('account') ? ACTIVE : INACTIVE }]}>Account</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 10,
    backgroundColor: NAV_BG,
    borderTopWidth: 0,
    marginHorizontal: 12,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  label: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  scanButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#0b1533',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -30,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
});