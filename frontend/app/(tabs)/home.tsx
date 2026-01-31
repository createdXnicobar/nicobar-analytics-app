import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, FlatList, Modal, ActivityIndicator, Pressable, Animated, PanResponder, TextInput, Platform, Keyboard, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import * as SecureStore from 'expo-secure-store';
import { useIsFocused } from '@react-navigation/native';
import uuid from 'react-native-uuid';
import { API_BASE_URL as BACKEND_BASE_URL } from '@/constants/env';

const BACKEND_POST_PATH = '/v1/trials';
const PUBLIC_PRODUCT_API = 'https://bronco.nicobar.com/api/getProductsbySKU?sku=';

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const [showFilter, setShowFilter] = useState(false);
  const [days, setDays] = useState<number>(1);
  const [remoteBundles, setRemoteBundles] = useState<any[]>([]);
  const [loadingBundles, setLoadingBundles] = useState(false);
  const [totalBundles, setTotalBundles] = useState<number>(0);

  // Show bundles from backend instead of session-local context
  const filtered = useMemo(() => remoteBundles, [remoteBundles]);

  // Fetch remote bundles for logged-in user; re-fetch on focus to ensure latest
  const fetchBundles = useCallback(async () => {
    if (!user?.email) { setRemoteBundles([]); setTotalBundles(0); return; }
    try {
      setLoadingBundles(true);
      const token = await SecureStore.getItemAsync('auth_token');
      const url = `${BACKEND_BASE_URL}/v1/bundles/${encodeURIComponent(user.email)}?days=${Math.min(Math.max(days, 1), 31)}`;
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json', 'X-Auth-Token': token ?? '' } });
      if (!res.ok) {
        console.log('fetch bundles error', res.status, await res.text());
        setRemoteBundles([]);
        setTotalBundles(0);
        return;
      }
      const json = await res.json();
      setRemoteBundles(Array.isArray(json?.bundles) ? json.bundles : []);
      setTotalBundles(typeof json?.totalBundles === 'number' ? json.totalBundles : (Array.isArray(json?.bundles) ? json.bundles.length : 0));
    } catch (e) {
      console.log('fetch bundles exception', e);
      setRemoteBundles([]);
      setTotalBundles(0);
    } finally {
      setLoadingBundles(false);
    }
  }, [user?.email, days]);

  useEffect(() => {
    if (isFocused) {
      void fetchBundles();
    }
  }, [isFocused, fetchBundles]);

  // Basket preview modal state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTitle, setPreviewTitle] = useState<string>('');
  const [previewItems, setPreviewItems] = useState<Array<{ sku: string; title: string; image?: string }>>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const panY = useRef(new Animated.Value(0)).current;
  const resetSheet = () => {
    Animated.spring(panY, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
  };
  const animateClose = () => {
    Animated.timing(panY, { toValue: 180, duration: 180, useNativeDriver: true }).start(() => {
      // Do not reset panY here to avoid a one-frame jump back to 0 before unmount.
      setPreviewOpen(false);
      setPreviewItems([]);
    });
  };
  const sheetPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8,
      onPanResponderMove: (_, g) => {
        if (g.dy >= 0) panY.setValue(g.dy); // block upward drag
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80) animateClose(); else resetSheet();
      },
    })
  ).current;

  const openPreview = async (bundle: any, index: number) => {
    panY.setValue(140);
    setPreviewOpen(true);
    setPreviewTitle(`Basket ${index + 1}`);
    setPreviewItems([]);
    setPreviewLoading(true);
    try {
      // Prefer productSnapshot from backend to avoid extra network calls
      const results: Array<{ sku: string; title: string; image?: string }> = (bundle?.items || []).map((trial: any) => ({
        sku: trial?.sku,
        title: trial?.productSnapshot?.title || trial?.sku,
        image: trial?.productSnapshot?.imageUrl,
      }));
      setPreviewItems(results);
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    animateClose();
  };

  // ----- Manual SKU Entry (bottom sheet) -----
  const [manualOpen, setManualOpen] = useState(false);
  const [manualSku, setManualSku] = useState<string>('NBI');
  const [manualBusy, setManualBusy] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualShowPreview, setManualShowPreview] = useState(false);
  const [manualProduct, setManualProduct] = useState<{ sku: string; title?: string; price?: string; image?: string; attributes?: { color?: string; size?: string; material?: string } } | null>(null);
  const manualY = useRef(new Animated.Value(140)).current;
  const keyboardOffset = useRef(new Animated.Value(0)).current;
  const [keyboardShown, setKeyboardShown] = useState(false);
  const [keyboardPad, setKeyboardPad] = useState(0);
  const manualPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8,
      onPanResponderMove: (_, g) => {
        if (g.dy >= 0) manualY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80) {
          Animated.timing(manualY, { toValue: 180, duration: 180, useNativeDriver: true }).start(() => {
            setManualOpen(false);
            setManualProduct(null);
            setManualShowPreview(false);
            setManualError(null);
            setManualBusy(false);
            setManualSku('NBI');
          });
        } else {
          Animated.spring(manualY, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
        }
      },
    })
  ).current;

  const openManual = () => {
    setManualError(null);
    setManualShowPreview(false);
    setManualProduct(null);
    setManualSku('NBI');
    setManualOpen(true);
    manualY.setValue(140);
    Animated.timing(manualY, { toValue: 0, duration: 220, useNativeDriver: true }).start();
  };

  const closeManual = () => {
    setManualOpen(false);
    setManualProduct(null);
    setManualShowPreview(false);
    setManualError(null);
    setManualBusy(false);
    setManualSku('NBI');
  };

  // Lift the sheet when keyboard is visible so the input is never covered
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, (e: any) => {
      const height = e?.endCoordinates?.height ?? 0;
      setKeyboardShown(true);
      setKeyboardPad(Math.max(0, height - insets.bottom));
      Animated.timing(keyboardOffset, {
        toValue: Math.max(0, height - insets.bottom),
        duration: Platform.OS === 'ios' ? (e?.duration ?? 200) : 200,
        useNativeDriver: true,
      }).start();
    });
    const hideSub = Keyboard.addListener(hideEvt, (e: any) => {
      setKeyboardShown(false);
      setKeyboardPad(0);
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? (e?.duration ?? 200) : 200,
        useNativeDriver: true,
      }).start();
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [insets.bottom, keyboardOffset]);

  type NicobarApiResponse = {
    status?: boolean;
    data?: {
      attributes?: { color?: string; size?: string; material?: string };
      productDetails?: { title?: string; price?: string; images?: string[] };
    };
  };

  const formatINR = (value?: string) => {
    if (!value) return '-';
    const n = Number(value);
    if (!isNaN(n)) return `₹${Math.round(n).toLocaleString('en-IN')}`;
    return value;
  };

  const fetchProductBySku = async (sku: string) => {
    const url = `${PUBLIC_PRODUCT_API}${encodeURIComponent(sku)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GET failed ${res.status}`);
    const json: NicobarApiResponse = await res.json();
    if (typeof json?.status === 'boolean' && json.status === false) {
      throw new Error('Product not found');
    }
    const product = {
      sku,
      title: json?.data?.productDetails?.title,
      price: json?.data?.productDetails?.price,
      image: json?.data?.productDetails?.images?.[0],
      attributes: {
        color: json?.data?.attributes?.color,
        size: json?.data?.attributes?.size,
        material: json?.data?.attributes?.material,
      },
    };
    return product;
  };

  const submitSkuAsBasket = async (sku: string) => {
    const bundleId = String(uuid.v4());
    const token = await SecureStore.getItemAsync('auth_token');
    const trial = {
      sku,
      storeCode: (user?.storeCode || 'DKN').toUpperCase(),
      timestamp: new Date().toISOString(),
      feedback: [],
      sessionId: null,
      scannedBy: user?.email || 'app-user',
      bundleId,
    };
    const res = await fetch(`${BACKEND_BASE_URL}${BACKEND_POST_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `manual_${bundleId}`,
        'X-Auth-Token': token ?? '',
      },
      body: JSON.stringify({ trials: [trial] }),
    });
    if (!res.ok) {
      const status = res.status;
      const txt = await res.text();
      console.log('manual submit error', status, txt);
      if (status === 401 || status === 403) throw new Error('Unauthorized – please sign in again');
      throw new Error('Submit failed');
    }
  };

  const safeSku = (v: string) => (v || '').trim().toUpperCase();

  const handleManualSubmit = async () => {
    const sku = safeSku(manualSku);
    if (!sku || sku.length < 3) { setManualError('Enter a valid NBI code'); return; }
    setManualError(null);
    setManualBusy(true);
    try {
      // Pre-flight: ensure SKU exists
      await fetchProductBySku(sku);
      await submitSkuAsBasket(sku);
      // Close and refresh bundles
      setManualOpen(false);
      setManualBusy(false);
      setManualProduct(null);
      setManualShowPreview(false);
      setManualSku('NBI');
      await fetchBundles();
    } catch (e: any) {
      setManualError(e?.message || 'Failed to submit');
      setManualBusy(false);
    }
  };

  const handleManualPreview = async () => {
    const sku = safeSku(manualSku);
    if (!sku || sku.length < 3) { setManualError('Enter a valid NBI code'); return; }
    setManualError(null);
    setManualBusy(true);
    try {
      const p = await fetchProductBySku(sku);
      setManualProduct(p);
      setManualShowPreview(true);
    } catch (e: any) {
      setManualError(e?.message || 'Failed to fetch product');
    } finally {
      setManualBusy(false);
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.title}>Nicobar Retail</Text>
      <Image source={require('@/assets/images/nico_logo.png')} style={styles.logo} />
      <View style={[styles.buttonGroup, { marginTop: 8 }]}>
        <TouchableOpacity
          style={[styles.btn, styles.scanBtn]}
          onPress={() => router.push('/scan')}
        >
          <Text style={styles.btnText}>📷 Scan a new item</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.manualBtn]}
          onPress={openManual}
        >
          <Text style={styles.btnText}>✍️ Enter NBI code</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={styles.sectionTitle}>Your Baskets</Text>
        <TouchableOpacity style={styles.filterChip} onPress={() => setShowFilter(true)}>
          <Text style={styles.filterChipText}>{days === 1 ? 'Today' : `Last ${days} days`}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.totalBundlesText}>Total Baskets: {totalBundles}</Text>
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
    
  // Each bundle card
  // Backend sends UTC timestamps as strings without a timezone suffix (e.g. 2025-10-04T13:49:54.148000)
  // JS Date treats such strings as local time. Normalize to UTC by appending 'Z' when missing
  // and trimming microseconds to milliseconds for compatibility.
  const toIST = (iso: string | Date | undefined) => {
    if (!iso) return '';
    let d: Date;
    if (typeof iso === 'string') {
      let s = iso.trim();
      // Trim microseconds to milliseconds if present
      s = s.replace(/(\.\d{3})\d+$/, '$1');
      // If no timezone info, assume UTC and append 'Z'
      if (!/[zZ]$/.test(s) && !/[+-]\d{2}:\d{2}$/.test(s)) {
        s = `${s}Z`;
      }
      d = new Date(s);
    } else {
      d = iso;
    }
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };


  const renderBundle = ({ item, index }: { item: any; index: number }) => (
    <TouchableOpacity style={styles.bundleCard} activeOpacity={0.85} onPress={() => openPreview(item,index)}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={styles.bundleName}>{`Basket ${index + 1}`}</Text>
        <View style={{ alignItems: 'flex-end' }}>
          {<Text style={styles.bundleDate}>{toIST(item.scanDate)}</Text>}
          <Text style={styles.bundleCount}>{(item?.items?.length ?? 0)} item{(item?.items?.length ?? 0) === 1 ? '' : 's'}</Text>
        </View>
      </View>
      <Text style={styles.bundleItems} numberOfLines={2}>
        {(item?.items || []).map((t: any) => t?.productSnapshot?.title || t?.sku).filter(Boolean).join(', ')}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
    <FlatList
      data={loadingBundles ? [] : filtered}
      keyExtractor={(item, i) => item.id || item.bundleId || String(i)}
      renderItem={renderBundle}
      ListHeaderComponent={renderHeader}
      contentContainerStyle={styles.container}
      refreshing={loadingBundles}
      onRefresh={fetchBundles}
    />

    {/* Basket preview modal */}
    <Modal
      visible={previewOpen}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      hardwareAccelerated
      statusBarTranslucent
      onShow={() => {
        Animated.timing(panY, { toValue: 0, duration: 220, useNativeDriver: true }).start();
      }}
      onRequestClose={closePreview}
    >
      <Pressable style={styles.modalBackdrop} onPress={closePreview}>
        <Animated.View style={[styles.previewSheet, { transform: [{ translateY: panY }] }]} onStartShouldSetResponder={() => true} {...sheetPan.panHandlers}>
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
        </Animated.View>
      </Pressable>
    </Modal>
    
    {/* Manual SKU entry modal */}
    <Modal
      visible={manualOpen}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      hardwareAccelerated
      statusBarTranslucent
      onRequestClose={closeManual}
    >
      <Pressable style={styles.modalBackdrop} onPress={closeManual}>
        <Animated.View
          style={[styles.previewSheet, { transform: [{ translateY: manualY }] }]}
          onStartShouldSetResponder={() => true}
          {...manualPan.panHandlers}
        >
          <View>
            <View style={styles.sheetHandle} />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: (keyboardShown ? keyboardPad : Math.max(insets.bottom, 24)) + 96 }}
              showsVerticalScrollIndicator={false}
            >
              {!manualShowPreview ? (
                <View>
                  <Text style={styles.previewTitle}>Enter NBI Code</Text>
                  <Text style={{ color: '#6b7280', marginBottom: 8 }}>All codes start with NBI</Text>
                  <TextInput
                    value={manualSku}
                    onChangeText={setManualSku}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    placeholder="NBI123456"
                    placeholderTextColor="#9ca3af"
                    style={styles.input}
                    editable={!manualBusy}
                    autoFocus
                    returnKeyType="done"
                  />
                  {manualError ? <Text style={styles.errorText}>{manualError}</Text> : null}
                </View>
              ) : (
                <View>
                  <Text style={styles.previewTitle}>Preview</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    {manualProduct?.image ? (
                      <Image source={{ uri: manualProduct.image }} style={{ width: 64, height: 96, borderRadius: 8, marginRight: 12 }} />
                    ) : (
                      <View style={{ width: 64, height: 96, borderRadius: 8, backgroundColor: '#e5e7eb', marginRight: 12 }} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '800', color: '#111' }}>#{manualProduct?.sku}</Text>
                      <Text style={{ color: '#374151' }}>{manualProduct?.title || 'Product'}</Text>
                    </View>
                  </View>
                  <View style={styles.detailList}>
                    {!!manualProduct?.price && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Price</Text>
                        <Text style={styles.detailValue}>{formatINR(manualProduct.price)}</Text>
                      </View>
                    )}
                    {!!manualProduct?.attributes?.color && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Color</Text>
                        <Text style={styles.detailValue}>{manualProduct?.attributes?.color}</Text>
                      </View>
                    )}
                    {!!manualProduct?.attributes?.size && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Size</Text>
                        <Text style={styles.detailValue}>{manualProduct?.attributes?.size}</Text>
                      </View>
                    )}
                    {!!manualProduct?.attributes?.material && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Material</Text>
                        <Text style={styles.detailValue}>{manualProduct?.attributes?.material}</Text>
                      </View>
                    )}
                  </View>
                  {manualError ? <Text style={[styles.errorText, { marginTop: 8 }]}>{manualError}</Text> : null}
                </View>
              )}
            </ScrollView>
            {/* Sticky action bar above keyboard */}
            {!manualShowPreview ? (
              <View style={[styles.actionBar, { bottom: (keyboardShown ? keyboardPad : Math.max(insets.bottom, 24)) + 16 }]}>
                <TouchableOpacity style={[styles.btnRow, styles.previewBtn]} onPress={handleManualPreview} disabled={manualBusy}>
                  {manualBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnRowText}>Preview</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btnRow, styles.submitBtn]} onPress={handleManualSubmit} disabled={manualBusy}>
                  {manualBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnRowText}>Submit</Text>}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.actionBar, { bottom: (keyboardShown ? keyboardPad : Math.max(insets.bottom, 24)) + 16 }]}>
                <TouchableOpacity
                  style={[styles.btnRow, styles.cancelBtn]}
                  onPress={() => { setManualShowPreview(false); setManualProduct(null); }}
                  disabled={manualBusy}
                >
                  <Text style={[styles.btnRowText]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnRow, styles.submitBtn]}
                  onPress={handleManualSubmit}
                  disabled={manualBusy}
                >
                  {manualBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnRowText}>Submit</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Animated.View>
      </Pressable>
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
  bundleDate: { color: '#6b7280' },
  bundleCount: { color: '#374151', marginTop: 2, fontWeight: '600' },
  bundleItems: { color: '#374151', marginTop: 4 },
  totalBundlesText: { color: '#111827', fontWeight: '700', marginTop: 6 },
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
  manualBtn: { backgroundColor: '#10b981' },
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
  // Detail list styles (match scanner modal aesthetics)
  detailList: { backgroundColor: '#f9fafb', borderRadius: 12, paddingVertical: 6, marginTop: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb' },
  detailLabel: { color: '#6b7280', fontWeight: '600', fontSize: 14 },
  detailValue: { color: '#111827', fontWeight: '600', fontSize: 14 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#111827', backgroundColor: '#fff' },
  errorText: { color: '#ef4444', marginTop: 6 },
  btnRow: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnRowText: { color: '#fff', fontWeight: '700' },
  previewBtn: { backgroundColor: '#6b7280' },
  submitBtn: { backgroundColor: '#111827' },
  cancelBtn: { backgroundColor: '#9ca3af' },
  actionBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', gap: 8 },
});
