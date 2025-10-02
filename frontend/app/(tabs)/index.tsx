import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  Button,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from "react-native";
import { CameraView, Camera } from "expo-camera";
import uuid from 'react-native-uuid';
import { useBundle } from '../../context/BundleContext';
import { useAuth } from '@/context/AuthContext';
import { useIsFocused } from "@react-navigation/native";
import * as SecureStore from 'expo-secure-store';


// Backend base URL
const BACKEND_BASE_URL = 'https://tcnuitydvx.ap-southeast-2.awsapprunner.com';
const BACKEND_POST_PATH = "/v1/trials";

// Store code comes from authenticated user profile; falls back to BIN
const DEFAULT_FALLBACK_STORE = "BIN";

// Public GET API base used when the scanned data is an SKU, not a URL
const PUBLIC_PRODUCT_API = "https://bronco.nicobar.com/api/getProductsbySKU?sku=";

// Feedback options for non-purchase reasons
const FEEDBACK_OPTIONS = [
  "Fit Issue",
  "Color Issue", 
  "Fabric Feel",
  "Defective Item",
  "Transparency",
  "Comfort Level",
  "Price Too High",
  "Style Not Liked"
];

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
  feedback: string[];
  raw?: unknown;
};

type NicobarApiResponse = {
  data?: {
    attributes?: {
      color?: string;
      material?: string;
      size?: string;
      stock?: number;
    };
    productDetails?: {
      title?: string;
      price?: string;
      images?: string[];
      description?: string;
    };
    category_hierarchy?: {
      product_category?: string;
      product_subcategory?: string;
      product_class?: string;
      product_subclass?: string;
    };
  };
};

interface Basket {
  id: string;
  items: ProductPayload[];
  createdAt: Date;
}

export default function Index() {
  const { user } = useAuth();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);
  const [canScan, setCanScan] = useState(true);
  const [countdown, setCountdown] = useState(0);
  const [cameraKey, setCameraKey] = useState(0); 
  const lastScanned = useRef<string | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();

  // Modal state and product data
  const [modalVisible, setModalVisible] = useState(false);
  const [product, setProduct] = useState<ProductPayload | null>(null);
  
  // Feedback and basket state
  const [selectedFeedbacks, setSelectedFeedbacks] = useState<string[]>([]);
  const [currentBasket, setCurrentBasket] = useState<ProductPayload[]>([]);
  const [currentBasketId, setCurrentBasketId] = useState<string | null>(null);
  const { addBasket } = useBundle();
  const [toast, setToast] = useState<string | null>(null);

  
  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();

    // Log resolved API base once for troubleshooting
    console.log("API base URL:", BACKEND_BASE_URL, "Platform:", Platform.OS);

    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, []);

  // Countdown timer effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev: number) => {
          if (prev <= 1) {
            setCanScan(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [countdown]);

  const isLikelySku = (raw: string): boolean => {
    const s = (raw || "").trim();
    if (!s || s.includes("://") || s.toLowerCase().startsWith("http")) return false;
    return /^[A-Za-z0-9_-]{3,32}$/.test(s);
  };

  const handleScan = ({ data, type }: { data: string; type: string }) => {
    if (!canScan || sending) return;
    if (!data) return;

    // Accept only barcodes that look like plain SKU strings; ignore QR and URLs
    if (type?.toLowerCase() === "qr" || !isLikelySku(data)) return;

    if (lastScanned.current === data) return;

    lastScanned.current = data;
    setCanScan(false);

    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    scanTimeoutRef.current = setTimeout(() => {
      void fetchAndShowProduct(data, type);
    }, 150);
  };

  const fetchAndShowProduct = async (data: string, type: string) => {
    try {
      setSending(true);
      const targetUrl = buildProductUrlFromScan(data, type);
      const response = await fetch(targetUrl);
      if (!response.ok) throw new Error(`GET failed ${response.status}`);
      const json: NicobarApiResponse = await response.json();

      const payload: ProductPayload = {
        scannedCode: data,
        codeType: type,
        productTitle: json?.data?.productDetails?.title,
        price: json?.data?.productDetails?.price,
        image: json?.data?.productDetails?.images?.[0],
        attributes: {
          color: json?.data?.attributes?.color,
          material: json?.data?.attributes?.material,
          size: json?.data?.attributes?.size,
          category: json?.data?.category_hierarchy?.product_category,
          subclass: json?.data?.category_hierarchy?.product_subclass,
        },
        feedback: [],
        raw: json,
      };

      setProduct(payload);
      setSelectedFeedbacks([]);
      setModalVisible(true);
    } catch (err) {
      const msg = String(err || "error");
      let short = "Scan failed";
      const match = msg.match(/\b(401|403|404|5\d{2})\b/);
    if (match) {
      const status = match[0];
      if (status === "401" || status === "403") {
        short = `Unauthorized (${status}) – please sign in`;
      } else if (status === "404") {
        short = `Not Found (${status}) – ${msg}`;
      } else if (status.startsWith("5")) {
        short = `Server Error (${status}) – try again`;
      } else {
        short = `Error (${status}) – ${msg}`;
      }
    } else {
      short = `Error – ${msg}`;
    }
      setCanScan(true);
      lastScanned.current = null;
    } finally {
      setSending(false);
    }
  };

  const buildProductUrlFromScan = (data: string, type?: string): string => {
    const raw = (data || '').trim();
    // If the scanner reported a non-QR symbology, treat payload as a plain SKU
    if (type && type.toLowerCase() !== 'qr') {
      return `${PUBLIC_PRODUCT_API}${encodeURIComponent(raw)}`;
    }
    // Otherwise, if it looks like a URL, use as-is; if not, treat as SKU
    try {
      const u = new URL(raw);
      return u.toString();
    } catch (_) {
      return `${PUBLIC_PRODUCT_API}${encodeURIComponent(raw)}`;
    }
  };

  const generateId = () => `trial_${Math.random().toString(36).slice(2)}_${Date.now()}`;

  // Simple INR formatter
  const formatINR = (value?: string) => {
    if (!value) return "-";
    const n = Number(value);
    if (!isNaN(n)) return `₹${Math.round(n).toLocaleString('en-IN')}`;
    return value;
  };

  const deriveSku = async (scannedCode: string): Promise<string> => {
    try {
      const u = new URL(scannedCode);
      const sku = u.searchParams.get("sku");
      if (sku) return sku;

      const response = await fetch(scannedCode, { 
        method: 'HEAD',
        redirect: 'follow'
      });
      
      if (response.url) {
        const finalUrl = new URL(response.url);
        const finalSku = finalUrl.searchParams.get("sku");
        if (finalSku) return finalSku;
      }
      
      return scannedCode;
    } catch (_) {
      return scannedCode;
    }
  };

  // Use the existing /v1/trials endpoint
  const submitToBackend = async (productData: ProductPayload, opts?: { silent?: boolean }) => {
    try {
      setSending(true);
      const sku = await deriveSku(productData.scannedCode);
      
      const body = {
        sku,
        storeCode: (user?.storeCode || DEFAULT_FALLBACK_STORE).toUpperCase(),
        feedback: productData.feedback,
        scannedBy: user?.email || "app-user", 
        bundleId: currentBasketId || undefined,
        timestamp: new Date().toISOString(),
        sessionId: null,
      };

      const submitUrl = `${BACKEND_BASE_URL}${BACKEND_POST_PATH}`;
      console.log("Submitting to backend:", { url: submitUrl, body });
      const token = await SecureStore.getItemAsync('auth_token');
      const res = await fetch(submitUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // use the same id for idempotency to match backend expectations
          "X-Idempotency-Key": `trial_${Math.random().toString(36).slice(2)}_${Date.now()}`,
          "X-Auth-Token": token ?? "",
        },
        body: JSON.stringify(body),
      });
      
      if (!res.ok) {
        const status = res.status;
        const errorText = await res.text();
        console.log("submit error", { status, errorText });
        let message = "Submit failed";
        if (status === 401 || status === 403) message = "Unauthorized – please sign in again";
        else if (status === 409) message = "Duplicate submission";
        else if (status === 422) message = "Invalid data – please rescan";
        else if (status >= 500) message = "Server error – try later";
        throw new Error(message);
      }
      // Close the details modal immediately on success
      setModalVisible(false);
      if (!opts?.silent) {
        setToast("Submitted successfully");
        setTimeout(() => setToast(null), 1500);
      }
      // re-scan
      setCanScan(true);
      lastScanned.current = null;
      setCameraKey(prev => prev + 1);
      
    } catch (err) {
      // Always close modal to prevent stuck UI, then show error toast
      setModalVisible(false);
      setToast(String((err as Error)?.message || "Submit failed"));
      setTimeout(() => setToast(null), 1800);
    } finally {
      setSending(false);
      lastScanned.current = null;
    }
  };

  const addToBasket = (productData: ProductPayload) => {
    const productWithFeedback = {
      ...productData,
      feedback: selectedFeedbacks
    };
    
    if (!currentBasketId) {
      setCurrentBasketId(String(uuid.v4()));
    }
    setCurrentBasket(prev => [...prev, productWithFeedback]);
    setToast(`Added to basket (${currentBasket.length + 1})`);
    setTimeout(() => setToast(null), 1200);
    setModalVisible(false);
    setCanScan(true);
    setSelectedFeedbacks([]);
    lastScanned.current = null;
    setCameraKey(prev => prev + 1);
  };

  const submitBasket = async () => {
    if (currentBasket.length === 0) {
      setToast("Basket is empty");
      setTimeout(() => setToast(null), 1200);
      return;
    }
    
    try {
      setSending(true);
      const basketId = currentBasketId || String(uuid.v4());
      setCurrentBasketId(basketId);
      // Submit each item individually to the existing endpoint with shared bundleId
      for (const item of currentBasket) {
        await submitToBackend(item, { silent: true });
      }
      setToast(`Submitted ${currentBasket.length} items`);
      setTimeout(() => setToast(null), 1500);
      // Save to local context for home screen listing
      addBasket(currentBasket);
      // Reset basket after submit
      setCurrentBasket([]);
      setCurrentBasketId(null);
      
    } catch (error) {
      setToast("Basket submit failed");
      setTimeout(() => setToast(null), 1500);
    } finally {
      setSending(false);
    }
  };

  
  const handleModalClose = () => {
    setModalVisible(false);
    setCanScan(true);
    setSelectedFeedbacks([]);
    lastScanned.current = null;
    setCameraKey(prev => prev + 1); 
  };

  const BasketStatus = () => {
    if (currentBasket.length === 0) return null;
    
    return (
      <View style={styles.basketStatus}>
        <Text style={styles.basketText}>
          🛒 Basket: {currentBasket.length} item{currentBasket.length !== 1 ? 's' : ''}
        </Text>
        <TouchableOpacity onPress={submitBasket} disabled={sending}>
          <Text style={styles.submitBasketText}>Submit Basket</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (hasPermission === null) {
    return <View style={styles.centerContainer}><Text style={styles.whiteText}>Requesting camera permission...</Text></View>;
  }
  if (hasPermission === false) {
    return <View style={styles.centerContainer}><Text style={styles.whiteText}>No camera access</Text></View>;
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: Math.max(30, insets.top) }] }>
      <Text style={styles.title}>Scan Barcode</Text>
      <Text style={styles.subtitle}>Point camera at Barcode - scans automatically</Text>
      
      <BasketStatus />
      
      <View style={styles.scanner}>
        {/* Mount camera only when tab is focused to ensure immediate start */}
        {isFocused && (
          <CameraView
            key={cameraKey}
            style={StyleSheet.absoluteFillObject}
            barcodeScannerSettings={{
              barcodeTypes: [
                "qr", "pdf417", "aztec", "ean13", "ean8", "upc_a", 
                "upc_e", "code39", "code93", "code128", "codabar", "itf14",
              ],
            }}
            onBarcodeScanned={isFocused && canScan ? handleScan : undefined}
          />
        )}
        
        <View style={styles.overlay}>
          <View style={styles.scanFrame} />
          {sending && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>Processing...</Text>
            </View>
          )}
          {toast && (
            <View style={styles.toast}>
              <Text style={styles.toastText}>{toast}</Text>
            </View>
          )}
        </View>
      </View>

      <Text style={styles.status}>
        {sending ? "🔄 Processing..." :
         countdown > 0 ? `⏱️ Wait ${countdown}s before next scan` :
         canScan ? "✅ Ready to scan" : "⏳ Processing..."}
      </Text>
      
      <Button 
        title="Reset Scanner" 
        onPress={() => { 
          if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
          lastScanned.current = null;
          setCanScan(true);
          setCountdown(0);
          setCameraKey(prev => prev + 1); // Reset camera
        }} 
        disabled={sending}
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={handleModalClose}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
              <View style={styles.sheetHeader}>
                {product?.image ? (
                  <Image source={{ uri: product.image }} style={styles.productImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.productImage, { backgroundColor: "#eee" }]} />
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.productId}>#{product?.scannedCode ?? ""}</Text>
                  <Text style={styles.productTitle}>{product?.productTitle ?? "Product"}</Text>
                </View>
              </View>

              <View style={styles.detailList}>
                {product?.price ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Price</Text>
                    <Text style={styles.detailValue}>{formatINR(product.price)}</Text>
                  </View>
                ) : null}
                {product?.attributes?.color ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Color</Text>
                    <Text style={styles.detailValue}>{product.attributes.color}</Text>
                  </View>
                ) : null}
                {product?.attributes?.size ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Size</Text>
                    <Text style={styles.detailValue}>{product.attributes.size}</Text>
                  </View>
                ) : null}
                {product?.attributes?.material ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Material</Text>
                    <Text style={styles.detailValue}>{product.attributes.material}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.feedbackSection}>
                <Text style={styles.feedbackTitle}>Not purchasing? Select reasons:</Text>
                <View style={styles.feedbackOptions}>
                  {FEEDBACK_OPTIONS.map(option => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.feedbackOption,
                        selectedFeedbacks.includes(option) && styles.feedbackOptionSelected
                      ]}
                      onPress={() => {
                        setSelectedFeedbacks(prev =>
                          prev.includes(option)
                            ? prev.filter(item => item !== option)
                            : [...prev, option]
                        );
                      }}
                    >
                      <Text style={[
                        styles.feedbackOptionText,
                        selectedFeedbacks.includes(option) && styles.feedbackOptionTextSelected
                      ]}>
                        {option}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.threeButtonRow}>
                <TouchableOpacity
                  style={[styles.bigButton, styles.retakeButton]}
                  onPress={handleModalClose}
                  disabled={sending}
                >
                  <Text style={styles.bigButtonText}>Retake</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.bigButton, styles.addToBasketButton]}
                  onPress={() => product && addToBasket(product)}
                  disabled={sending}
                >
                  <Text style={styles.bigButtonText}>Add to Basket</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.bigButton, styles.submitButton]}
                  onPress={() => {
                    if (product) {
                      const productWithFeedback = {
                        ...product,
                        feedback: selectedFeedbacks
                      };
                      submitToBackend(productWithFeedback);
                    }
                  }}
                  disabled={sending}
                >
                  <Text style={styles.bigButtonText}>Submit</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 50, backgroundColor: "#111", padding: 16 },
  centerContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  whiteText: { color: "#fff" },
  title: { color: "#fff", fontSize: 20, textAlign: "center", marginBottom: 5, fontWeight: "bold" },
  subtitle: { color: "#aaa", fontSize: 14, textAlign: "center", marginBottom: 20 },
  basketStatus: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1f2937', padding: 12, borderRadius: 8, marginBottom: 16 },
  basketText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  submitBasketText: { color: '#10b981', fontSize: 14, fontWeight: 'bold' },
  scanner: { flex: 1, borderRadius: 8, overflow: "hidden", marginBottom: 20, position: "relative" },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  scanFrame: { width: 250, height: 250, borderWidth: 2, borderColor: "#fff", borderRadius: 12, backgroundColor: "transparent" },
  loadingOverlay: { position: "absolute", backgroundColor: "rgba(0,0,0,0.7)", padding: 20, borderRadius: 10, alignItems: "center" },
  loadingText: { color: "#fff", marginTop: 10, fontSize: 16 },
  status: { color: "#fff", textAlign: "center", marginBottom: 15, fontSize: 16 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: "80%" },
  scrollView: { maxHeight: "100%" },
  sheetHandle: { width: 160, height: 4, backgroundColor: "#ccc", alignSelf: "center", borderRadius: 2, marginBottom: 16 },
  sheetHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  productImage: { width: 64, height: 96, borderRadius: 8 },
  productId: { color: "#111", fontSize: 14, fontWeight: '700' },
  productTitle: { color: "#111", fontSize: 20, fontWeight: "bold" },
  subtitleText: { color: "#333", marginTop: 2 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 },
  tag: { backgroundColor: "#f1f1f1", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginRight: 8, marginBottom: 8 },
  tagText: { color: "#111" },
  // New detail list styles
  detailList: { backgroundColor: "#f9fafb", borderRadius: 12, paddingVertical: 6, marginTop: 8 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#e5e7eb" },
  detailLabel: { color: "#6b7280", fontWeight: "600" },
  detailValue: { color: "#111827", fontWeight: "600" },
  feedbackSection: { marginTop: 20, marginBottom: 20 },
  feedbackTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: '#333' },
  feedbackOptions: { flexDirection: 'row', flexWrap: 'wrap' },
  feedbackOption: { backgroundColor: '#f5f5f5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginRight: 8, marginBottom: 8, borderWidth: 1, borderColor: '#ddd' },
  feedbackOptionSelected: { backgroundColor: '#111827', borderColor: '#111827' },
  feedbackOptionText: { color: '#666', fontSize: 12 },
  feedbackOptionTextSelected: { color: '#fff' },
  threeButtonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, gap: 8 },
  bigButton: { flex: 1, paddingVertical: 16, borderRadius: 12, alignItems: 'center', minHeight: 60, justifyContent: 'center' },
  retakeButton: { backgroundColor: '#6b7280' },
  addToBasketButton: { backgroundColor: '#10b981' },
  submitButton: { backgroundColor: '#111827' },
  bigButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14, textAlign: 'center' },
  toast: { position: 'absolute', bottom: 24, alignSelf: 'center', backgroundColor: 'rgba(17,24,39,0.95)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  toastText: { color: '#fff', fontWeight: '700' },
});