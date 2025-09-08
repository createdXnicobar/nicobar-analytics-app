import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, FlatList, Modal } from 'react-native';
import { useClerk } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { useBundle } from '../../context/BundleContext'; // Context hook

export default function Home() {
  const { signOut } = useClerk();
  const router = useRouter();
  const { bundles } = useBundle();
  const [showFilter, setShowFilter] = useState(false);
  const [days, setDays] = useState<number>(1);

  const filtered = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    // Start from beginning of the day to include all of "Today"
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    return bundles.filter(b => new Date(b.createdAt) >= start);
  }, [bundles, days]);

  const onLogout = async () => {
    await signOut();
    router.replace('/(auth)/sign-in');
  };

  // Header section
  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.title}>Nicobar Retail</Text>
      <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={styles.sectionTitle}>Your Baskets</Text>
        <TouchableOpacity style={styles.filterChip} onPress={() => setShowFilter(true)}>
          <Text style={styles.filterChipText}>{days === 1 ? 'Today' : `Last ${days} days`}</Text>
        </TouchableOpacity>
      </View>
      {filtered.length === 0 && (
        <Text style={styles.emptyText}>
          No baskets in selected range. Scan products to create baskets.
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
        <TouchableOpacity
          style={[styles.btn, styles.scanBtn]}
          onPress={() => router.push('/scan')}
        >
          <Text style={styles.btnText}>📷 Scan a new item</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <>
    <FlatList
      data={filtered}
      keyExtractor={(item) => item.id}
      renderItem={renderBundle}
      ListHeaderComponent={renderHeader}
      ListFooterComponent={renderFooter}
      contentContainerStyle={styles.container}
    />
    <Modal visible={showFilter} transparent animationType="slide">
      <View style={styles.modalBackdrop}>
        <View style={styles.filterSheet}>
          <Text style={styles.filterTitle}>Select Date Range</Text>
          {[1,7,14,30].map(d => (
            <TouchableOpacity key={d} style={[styles.filterOption, days===d && styles.filterOptionActive]} onPress={() => { setDays(d); setShowFilter(false); }}>
              <Text style={[styles.filterOptionText, days===d && styles.filterOptionTextActive]}>
                {d===1 ? 'Today' : `Last ${d} days`}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => setShowFilter(false)} style={styles.closeFilter}><Text>Close</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
    </>
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
  filterChip: { backgroundColor: '#f3f4f6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  filterChipText: { color: '#111827', fontWeight: '600' },
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
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  filterSheet: { backgroundColor: '#fff', padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  filterTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  filterOption: { backgroundColor: '#f3f4f6', padding: 12, borderRadius: 8, marginBottom: 8 },
  filterOptionActive: { backgroundColor: '#111827' },
  filterOptionText: { textAlign: 'center', color: '#111827', fontWeight: '600' },
  filterOptionTextActive: { color: '#fff' },
  closeFilter: { alignSelf: 'center', padding: 8 },
});
