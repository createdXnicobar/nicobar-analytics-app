import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, ActivityIndicator, Dimensions, Image as RNImage, Animated, Pressable, PanResponder } from 'react-native';

interface Item {
  sku: string;
  title: string | null;
  size: string | null;
  color: string | null;
  trials: number;
  purchases: number;
  tryNotBuy: number;
  conversion: number;
}

interface TopTryNotBuyListProps {
  items: Item[];
}

const PUBLIC_PRODUCT_API = 'https://bronco.nicobar.com/api/getProductsbySKU?sku=';

export default function TopTryNotBuyList({ items }: TopTryNotBuyListProps) {
  // Prefetch image previews for cards
  const [imageMap, setImageMap] = useState<Record<string, string | null>>({});
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const pairs: Array<[string, string | null]> = await Promise.all(
          items.map(async (it) => {
            try {
              const res = await fetch(`${PUBLIC_PRODUCT_API}${encodeURIComponent(it.sku)}`);
              const json = await res.json();
              // Skip including in visuals if upstream returns { status: false }
              if (typeof json?.status === 'boolean' && json.status === false) {
                return [it.sku, null];
              }
              if (json?.data?.productDetails?.title) {
                it.title = json?.data?.productDetails?.title;
              }
              const url: string | null = json?.data?.productDetails?.images?.[0] ?? null;
              return [it.sku, url];
            } catch {
              return [it.sku, null];
            }
          })
        );
        if (!cancelled) setImageMap(Object.fromEntries(pairs));
      } catch {}
    };
    if (items.length) run();
    return () => { cancelled = true; };
  }, [items]);

  // Modal state
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [product, setProduct] = useState<any | null>(null);
  const [fetching, setFetching] = useState(false);
  const [imgHeight, setImgHeight] = useState<number | null>(null);
  const sheetY = useRef(new Animated.Value(140)).current;
  const swipeY = useRef(new Animated.Value(0)).current;
  const openSheet = () => {
    sheetY.setValue(140);
    Animated.timing(sheetY, { toValue: 0, duration: 220, useNativeDriver: true }).start();
  };
  const closeSheet = (onEnd?: () => void) => {
    Animated.timing(sheetY, { toValue: 200, duration: 180, useNativeDriver: true }).start(() => { onEnd && onEnd(); });
  };
  const panHandlers = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8,
      onPanResponderMove: Animated.event([null, { dy: swipeY }], { useNativeDriver: true }),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80) { closeSheet(() => { setSelectedSku(null); setProduct(null); swipeY.setValue(0); }); }
        else { Animated.spring(swipeY, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start(); }
      },
    })
  ).current;

  const openProduct = async (sku: string) => {
    setSelectedSku(sku);
    setFetching(true);
    setProduct(null);
    try {
      const res = await fetch(`${PUBLIC_PRODUCT_API}${encodeURIComponent(sku)}`);
      const json = await res.json();
      setProduct(json);
    } catch (e) {
      console.log('product fetch error', e);
    } finally {
      setFetching(false);
    }
  };

  const closeModal = () => { closeSheet(() => { setSelectedSku(null); setProduct(null); }); };

  // Compute image height dynamically to show more of the image aesthetically
  useEffect(() => {
    const url = product?.data?.productDetails?.images?.[0];
    if (!url) { setImgHeight(null); return; }
    const screenWidth = Dimensions.get('window').width - 32; // sheet padding
    RNImage.getSize(url,
      (w, h) => {
        const desired = Math.min((h / w) * screenWidth, 520);
        setImgHeight(desired);
      },
      () => setImgHeight(360)
    );
  }, [product]);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeader}>Product Performance</Text>
      <ScrollView style={styles.list}>
        {items.map((item) => (
          <TouchableOpacity key={item.sku} style={styles.itemCard} onPress={() => openProduct(item.sku)} activeOpacity={0.85}>
            {imageMap[item.sku] ? (
              <Image source={{ uri: imageMap[item.sku]! }} style={styles.cardImage} resizeMode="cover" />
            ) : (
              <View style={[styles.cardImage, { backgroundColor: '#e5e7eb' }]} />
            )}
            <View style={{ flex: 1 }}>
              <View style={styles.itemHeader}>
                <Text style={styles.sku}>SKU: {item.sku}</Text>
                <Text style={styles.conversion}>{(item.conversion * 100).toFixed(1)}%</Text>
              </View>
              <Text style={styles.title}>{item.title ? <Text style={styles.title}>{item.title}</Text> : null}</Text>
              <Text></Text>
              {(item.color || item.size) && (
                <Text style={styles.details}>
                  {item.color} {item.size}
                </Text>
              )}
              <View style={styles.stats}>
                <Text style={styles.stat}>Trials: {item.trials}</Text>
                <Text style={styles.stat}>Purchases: {item.purchases}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={!!selectedSku} transparent animationType="none" onShow={openSheet} onRequestClose={closeModal}>
        <Pressable style={styles.modalBackdrop} onPress={closeModal}>
          <Animated.View style={[styles.sheet, { transform: [{ translateY: Animated.add(sheetY, swipeY) }] }]} onStartShouldSetResponder={() => true} {...panHandlers.panHandlers}>
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
                    <Image
                      source={{ uri: product.data.productDetails.images[0] }}
                      style={[styles.modalImage, imgHeight ? { height: imgHeight } : null]}
                      resizeMode="contain"
                    />
                  )}
                  <View style={styles.detailList}>
                    {product?.data?.productDetails?.price ? (
                      <View style={styles.detailRow}><Text style={styles.detailLabel}>Price</Text><Text style={styles.detailValue}>{`₹${Math.round(Number(product.data.productDetails.price||0)).toLocaleString('en-IN')}`}</Text></View>
                    ) : null}
                    {product?.data?.attributes?.color && (
                      <View style={styles.detailRow}><Text style={styles.detailLabel}>Color</Text><Text style={styles.detailValue}>{product.data.attributes.color}</Text></View>
                    )}
                    {product?.data?.attributes?.size && (
                      <View style={styles.detailRow}><Text style={styles.detailLabel}>Size</Text><Text style={styles.detailValue}>{product.data.attributes.size}</Text></View>
                    )}
                    {product?.data?.attributes?.material && (
                      <View style={styles.detailRow}><Text style={styles.detailLabel}>Material</Text><Text style={styles.detailValue}>{product.data.attributes.material}</Text></View>
                    )}
                  </View>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  cardTitle: { color: '#374151', marginTop: 2 },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  list: {
    width: '100%',
  },
  itemCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginVertical: 6,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardImage: { width: 56, height: 84, borderRadius: 8 },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sku: {
    fontWeight: '500',
    fontSize: 16,
  },
  title: {
    fontSize: 14,
    fontWeight: '400',
  },
  conversion: {
    fontWeight: 'bold',
    color: '#007AFF',
  },
  details: {
    color: '#666',
    marginBottom: 6,
    fontSize: 14,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    color: '#888',
    fontSize: 14,
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '90%' },
  sheetHandle: { width: 160, height: 4, backgroundColor: '#ccc', alignSelf: 'center', borderRadius: 2, marginBottom: 12 },
  closeBtn: { position: 'absolute', right: 16, top: 12, padding: 6, zIndex: 10 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  textSmall: { color: '#6b7280', marginBottom: 6 },
  productTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  modalImage: { width: '100%', height: 360, borderRadius: 12, marginBottom: 12, backgroundColor: '#fff' },
  // List styles to match scanner modal aesthetic
  detailList: { backgroundColor: '#f9fafb', borderRadius: 12, paddingVertical: 6, marginTop: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb' },
  detailLabel: { color: '#6b7280', fontWeight: '600' },
  detailValue: { color: '#111827', fontWeight: '600' },
});