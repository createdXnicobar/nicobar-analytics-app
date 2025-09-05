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
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={() => go('reports')}>
        <IconSymbol size={24} name="chart.bar.fill" color={isActive('reports') ? ACTIVE : INACTIVE} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.scanButton} onPress={() => go('scan')}>
        <IconSymbol size={28} name="qrcode.viewfinder" color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={() => go('notes')}>
        <IconSymbol size={24} name="list.bullet" color={isActive('notes') ? ACTIVE : INACTIVE} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={() => go('account')}>
        <IconSymbol size={24} name="person.crop.circle" color={isActive('account') ? ACTIVE : INACTIVE} />
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
  },
  item: {
    flex: 1,
    alignItems: 'center',
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
