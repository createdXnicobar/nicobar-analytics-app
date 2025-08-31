import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView } from 'react-native';
import { useClerk } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';

export default function Home() {
  const { signOut } = useClerk();
  const router = useRouter();

  const onLogout = async () => {
    await signOut();
    router.replace('/(auth)/sign-in');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Nicobar Retail</Text>

      <Image source={require('@/assets/images/icon.png')} style={styles.logo} />

      <Text style={styles.storeName}>Janakpuri west store</Text>
      <Text style={styles.storeCode}>store code: 110066</Text>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Current Address</Text>
        <Text style={styles.rowValue}>Add shipping address</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Store Manager</Text>
        <Text style={styles.rowValue}>Ms. Lorem Epsum</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Contact info</Text>
        <Text style={styles.rowValue}>1234567890</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Store category</Text>
        <Text style={styles.rowValue}>Apply promo code</Text>
      </View>

      <TouchableOpacity style={styles.logout} onPress={onLogout}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 48 },
  title: { textAlign: 'center', fontSize: 28, fontWeight: '800', marginBottom: 24 },
  logo: { width: 110, height: 110, borderRadius: 55, alignSelf: 'center', marginBottom: 16 },
  storeName: { textAlign: 'center', fontSize: 18, fontWeight: '700' },
  storeCode: { textAlign: 'center', fontSize: 14, color: '#6b7280', marginBottom: 20 },
  row: { backgroundColor: '#fff', paddingVertical: 16, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb' },
  rowLabel: { color: '#6b7280', marginBottom: 6 },
  rowValue: { color: '#111827' },
  logout: { marginTop: 24, backgroundColor: '#ef4444', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  logoutText: { color: '#fff', fontWeight: '700' },
});
