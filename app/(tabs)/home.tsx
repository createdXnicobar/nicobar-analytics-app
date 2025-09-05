import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, FlatList } from 'react-native';
import { useClerk } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { useBundle } from '../../context/BundleContext'; // Context hook

export default function Home() {
  const { signOut } = useClerk();
  const router = useRouter();
  const { bundles, addDemoBundle } = useBundle();

  const onLogout = async () => {
    await signOut();
    router.replace('/(auth)/sign-in');
  };

  // Header section
  const renderHeader = () => (
    <View style={styles.header}>
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
      <Text style={styles.sectionTitle}>Your Bundles</Text>
      {bundles.length === 0 && (
        <Text style={styles.emptyText}>
          No bundles yet. Scan products to create bundles.
        </Text>
      )}
    </View>
  );


  type ProductPayload = {
  scannedCode: string;
  codeType: string;
  productTitle?: string;
  price?: string;
  image?: string;
  attributes?: {
    color?: string;
    material?: string;
    size?: string;
    category?: string;
    subclass?: string;
  };
  raw?: unknown;
};

type Bundle = {
  id: string;
  name: string;
  items: ProductPayload[];
};
  
  // Each bundle card
  const renderBundle = ({ item }: { item: Bundle }) => (
    <View style={styles.bundleCard}>
      <Text style={styles.bundleName}>{item.name}</Text>
      <Text style={styles.bundleItems}>{item.items.map(i => i.productTitle || 'Unnamed Product').join(', ')}</Text>
    </View>
  );

  // Footer section (buttons)
  const renderFooter = () => (
    <View>
      <View style={styles.buttonGroup}>
        <TouchableOpacity style={[styles.btn, styles.logout]} onPress={onLogout}>
          <Text style={styles.btnText}>Log out</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.scanBtn]}
          onPress={() => router.push('/scan')}
        >
          <Text style={styles.btnText}>📷 Scan a new item</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={[styles.btn, styles.demoBtn]} onPress={addDemoBundle}>
        <Text style={styles.btnText}>➕ Add Demo Bundle</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <FlatList
      data={bundles}
      keyExtractor={(item) => item.id}
      renderItem={renderBundle}
      ListHeaderComponent={renderHeader}
      ListFooterComponent={renderFooter}
      contentContainerStyle={styles.container}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 48 },
  header: { marginBottom: 16 },
  title: { textAlign: 'center', fontSize: 28, fontWeight: '800', marginBottom: 24 },
  logo: { width: 110, height: 110, borderRadius: 55, alignSelf: 'center', marginBottom: 16 },
  storeName: { textAlign: 'center', fontSize: 18, fontWeight: '700' },
  storeCode: { textAlign: 'center', fontSize: 14, color: '#6b7280', marginBottom: 20 },
  row: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  rowLabel: { color: '#6b7280', marginBottom: 6 },
  rowValue: { color: '#111827' },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginTop: 20, marginBottom: 10 },
  emptyText: { color: '#6b7280', marginBottom: 10 },
  bundleCard: { backgroundColor: '#f9fafb', padding: 14, borderRadius: 8, marginBottom: 10 },
  bundleName: { fontSize: 16, fontWeight: '700' },
  bundleItems: { color: '#374151', marginTop: 4 },
  buttonGroup: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  btnText: { color: '#fff', fontWeight: '700' },
  logout: { backgroundColor: '#ef4444' },
  scanBtn: { backgroundColor: '#111827' },
  demoBtn: { marginTop: 16, backgroundColor: '#3b82f6' },
});
