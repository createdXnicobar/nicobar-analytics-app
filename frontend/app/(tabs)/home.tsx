import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, FlatList, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useBundle } from '../../context/BundleContext';

const PUBLIC_PRODUCT_API = 'https://bronco.nicobar.com/api/getProductsbySKU?sku=';

export default function Home() {
  const router = useRouter();
  const { bundles } = useBundle();
  const [showFilter, setShowFilter] = useState(false);
  const [days, setDays] = useState<number>(1);

  const filtered = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    return bundles.filter(b => new Date(b.createdAt) >= start);
  }, [bundles, days]);

  // Derive SKU from scanned codes (URL or raw SKU)
  const deriveSku = (scannedCode?: string): string | null => {
    if (!scannedCode) return null;
    try {
      const u = new URL(scannedCode);
      return u.searchParams.get('sku') || scannedCode;
    } catch {
      return scannedCode;
    }
  };

  // Basket preview modal state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTitle, setPreviewTitle] = useState<string>('');
  const [previewItems, setPreviewItems] = useState<Array<{ sku: string; title: string; image?: string }>>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const openPreview = async (bundle: Bundle) => {
    setPreviewOpen(true);
    setPreviewTitle(bundle.name);
    setPreviewItems([]);
    setPreviewLoading(true);
    try {
      const results: Array<{ sku: string; title: string; image?: string }> = [];
      for (const item of bundle.items) {
        const sku = deriveSku(item.scannedCode);
        if (!sku) continue;
        try {
          const res = await fetch(`${PUBLIC_PRODUCT_API}${encodeURIComponent(sku)}`);
          const json = await res.json();
          const title = json?.data?.productDetails?.title || item.productTitle || sku;
          const image = json?.data?.productDetails?.images?.[0];
          results.push({ sku, title, image });
        } catch {
          results.push({ sku, title: item.productTitle || sku });
        }
      }
      setPreviewItems(results);
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewOpen(false);
    setPreviewItems([]);
  };

  // Header section
  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.title}>Nicobar Retail</Text>
      <Image source={require('@/assets/images/nico_logo.png')} style={styles.logo} />
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
    <TouchableOpacity style={styles.bundleCard} activeOpacity={0.85} onPress={() => openPreview(item)}>
      <Text style={styles.bundleName}>{item.name}</Text>
      <Text style={styles.bundleItems}>{item.items.map(i => i.productTitle || 'Unnamed Product').join(', ')}</Text>
    </TouchableOpacity>
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
    <FlatList
      data={filtered}
      keyExtractor={(item) => item.id}
      renderItem={renderBundle}
      ListHeaderComponent={renderHeader}
      ListFooterComponent={renderFooter}
      contentContainerStyle={styles.container}
    />

    {/* Basket preview modal */}
    <Modal visible={previewOpen} transparent animationType="slide" onRequestClose={closePreview}>
      <View style={styles.modalBackdrop}>
        <View style={styles.previewSheet}>
          <View style={styles.sheetHandle} />
          <TouchableOpacity onPress={closePreview} style={styles.closeBtn} accessibilityLabel="Close basket preview">
            <Text style={{ color: '#111', fontWeight: '700' }}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.previewTitle}>{previewTitle}</Text>
          {previewLoading ? (
            <ActivityIndicator color="#111" style={{ marginVertical: 16 }} />
          ) : (
            <FlatList
              data={previewItems}
              keyExtractor={(x, i) => `${x.sku}-${i}`}
              renderItem={({ item }) => (
                <View style={styles.previewItem}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.previewImage} />
                  ) : (
                    <View style={[styles.previewImage, { backgroundColor: '#e5e7eb' }]} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.previewSku}>SKU: {item.sku}</Text>
                    <Text style={styles.previewName}>{item.title}</Text>
                  </View>
                </View>
              )}
              ListEmptyComponent={<Text style={{ color: '#6b7280' }}>No items in this basket</Text>}
            />
          )}
        </View>
      </View>
    </Modal>
    
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 48, backgroundColor: '#fff' },
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
  // Preview styles
  previewSheet: { backgroundColor: '#fff', padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '80%' },
  sheetHandle: { width: 160, height: 4, backgroundColor: '#ccc', alignSelf: 'center', borderRadius: 2, marginBottom: 12 },
  closeBtn: { position: 'absolute', right: 16, top: 12, padding: 6, zIndex: 10 },
  previewTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
  previewItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#eee' },
  previewImage: { width: 56, height: 56, borderRadius: 8, marginRight: 12 },
  previewSku: { fontWeight: '700', color: '#111' },
  previewName: { color: '#374151' },
});
