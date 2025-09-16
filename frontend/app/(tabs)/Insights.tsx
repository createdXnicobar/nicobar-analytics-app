import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Modal, ScrollView, ActivityIndicator } from 'react-native';
import useAnalytics from '@/hooks/useAnalytics';

const PUBLIC_PRODUCT_API = 'https://bronco.nicobar.com/api/getProductsbySKU?sku=';

export default function InsightsScreen() {
  // For now, use static store code and last 7 days
  const storeCode = 'BIN';
  const today = new Date().toISOString().slice(0, 10);
  const { data, loading, error, refetch } = useAnalytics(storeCode, today, 7);

  const items = useMemo(() => data?.topTryNotBuy ?? [], [data]);

  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [product, setProduct] = useState<any | null>(null);
  const [fetching, setFetching] = useState(false);

  const openProduct = async (sku: string) => {
    try {
      setSelectedSku(sku);
      setFetching(true);
      setProduct(null);
      const res = await fetch(`${PUBLIC_PRODUCT_API}${encodeURIComponent(sku)}`);
      const json = await res.json();
      setProduct(json);
    } catch (e) {
      console.log('product fetch error', e);
    } finally {
      setFetching(false);
    }
  };

  const closeModal = () => {
    setSelectedSku(null);
    setProduct(null);
  };

  const renderCard = ({ item }: any) => {
    const img = item.imageUrl || null;
    return (
      <TouchableOpacity style={styles.card} onPress={() => openProduct(item.sku)}>
        {img ? (
          <Image source={{ uri: img }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImage, { backgroundColor: '#e5e7eb' }]} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.cardSku}>SKU: {item.sku}</Text>
          <Text style={styles.cardTitle}>{item.title || '—'}</Text>
          <Text style={styles.cardMeta}>Trials: {item.trials}    Purchases: {item.purchases}</Text>
        </View>
        <Text style={styles.cardConv}>{(item.conversion ?? 0).toFixed(1)}%</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Nicobar Retail</Text>

      {loading && <ActivityIndicator color="#111" style={{ marginTop: 16 }} />}
      {error && <Text style={styles.error}>{error}</Text>}

      {!loading && !error && (
        <FlatList
          data={items}
          keyExtractor={(x) => x.sku}
          renderItem={renderCard}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<Text style={{ color: '#6b7280' }}>No products</Text>}
        />
      )}

      <Modal visible={!!selectedSku} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <TouchableOpacity onPress={closeModal} style={styles.closeBtn} accessibilityLabel="Close details">
              <Text style={{ color: '#111', fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
            <ScrollView>
              <Text style={styles.modalTitle}>Product details</Text>
              {fetching && <ActivityIndicator color="#111" style={{ marginVertical: 16 }} />}
              {product && (
                <View>
                  <Text style={styles.textSmall}>SKU: {selectedSku}</Text>
                  <Text style={styles.productTitle}>{product?.data?.productDetails?.title || '—'}</Text>
                  {product?.data?.productDetails?.images?.[0] && (
                    <Image source={{ uri: product.data.productDetails.images[0] }} style={styles.modalImage} />
                  )}
                  <View style={styles.tagsRow}>
                    {product?.data?.attributes?.color && (
                      <View style={styles.tag}><Text>Color: {product.data.attributes.color}</Text></View>
                    )}
                    {product?.data?.attributes?.size && (
                      <View style={styles.tag}><Text>Size: {product.data.attributes.size}</Text></View>
                    )}
                    {product?.data?.attributes?.material && (
                      <View style={styles.tag}><Text>Material: {product.data.attributes.material}</Text></View>
                    )}
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { fontSize: 28, fontWeight: '800', marginTop: 16, marginHorizontal: 16, marginBottom: 8 },
  error: { color: '#b91c1c', marginTop: 12, marginHorizontal: 16 },
  card: { flexDirection: 'row', backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 10, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  cardImage: { width: 56, height: 56, borderRadius: 8, marginRight: 12 },
  cardSku: { fontWeight: '700', color: '#111' },
  cardTitle: { color: '#374151' },
  cardMeta: { color: '#6b7280', marginTop: 4 },
  cardConv: { fontWeight: '800', color: '#1f2937', marginLeft: 8 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '80%' },
  sheetHandle: { width: 160, height: 4, backgroundColor: '#ccc', alignSelf: 'center', borderRadius: 2, marginBottom: 12 },
  closeBtn: { position: 'absolute', right: 16, top: 12, padding: 6, zIndex: 10 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  textSmall: { color: '#6b7280', marginBottom: 6 },
  productTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  modalImage: { width: '100%', height: 220, borderRadius: 12, marginBottom: 12 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap' },
  tag: { backgroundColor: '#f3f4f6', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, marginRight: 8, marginBottom: 8 },
});


