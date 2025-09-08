import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Platform } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { IconSymbol } from '@/components/ui/IconSymbol';

const NAV_BG = '#fff';
const ACTIVE = '#111827';
const INACTIVE = '#8b8b8b';

export default function BottomNav({ state, descriptors, navigation }: BottomTabBarProps) {
  const go = (name: string) => navigation.navigate(name as never);

  const isActive = (routeName: string) => {
    const idx = state.routes.findIndex(r => r.name === routeName);
    return state.index === idx;
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.item} onPress={() => go('home')}>
        <IconSymbol size={24} name="house.fill" color={isActive('home') ? ACTIVE : INACTIVE} />
        <Text style={[styles.label, { color: isActive('home') ? ACTIVE : INACTIVE }]}>Home</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={() => go('reports')}>
        <IconSymbol size={24} name="chart.bar.fill" color={isActive('reports') ? ACTIVE : INACTIVE} />
        <Text style={[styles.label, { color: isActive('reports') ? ACTIVE : INACTIVE }]}>Reports</Text>
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
    paddingBottom: Platform.select({ ios: 24, default: 14 }),
    backgroundColor: NAV_BG,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
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
    marginTop: -24,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});