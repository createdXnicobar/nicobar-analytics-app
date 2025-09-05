"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { CameraView, Camera } from "expo-camera";
import { useBundle } from '../../context/BundleContext'; // Context hookup

const BACKEND_BASE_URL = "https://9346bbd8718c.ngrok-free.app";
const BACKEND_POST_PATH = "/v1/trials";
const DEFAULT_STORE_CODE = "BIN";
const PUBLIC_PRODUCT_API = "https://bronco.nicobar.com/api/getProductsbySKU?sku=";

type ProductAttributes = {
  color?: string;
  material?: string;
  size?: string;
  category?: string;
  subclass?: string;
};

type ProductPayload = {
  scannedCode: string;
  codeType: string;
  productTitle?: string;
  price?: string;
  image?: string;
  attributes?: ProductAttributes;
  raw?: unknown;
};

type Bundle = {
  id: string;
  name: string;
  items: ProductPayload[];
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

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 50, backgroundColor: "#111", padding: 16 },
  centerScreen: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { color: "#fff", fontSize: 20, textAlign: "center", marginBottom: 5, fontWeight: "bold" },
  subtitle: { color: "#aaa", fontSize: 14, textAlign: "center", marginBottom: 20 },
  scanner: { flex: 1, borderRadius: 8, overflow: "hidden", marginBottom: 20, position: "relative" },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  scanFrame: { width: 250, height: 250, borderWidth: 2, borderColor: "#fff", borderRadius: 12, backgroundColor: "transparent" },
  loadingOverlay: { position: "absolute", backgroundColor: "rgba(0,0,0,0.7)", padding: 20, borderRadius: 10, alignItems: "center" },
  loadingText: { color: "#fff", marginTop: 10, fontSize: 16 },
  status: { color: "#fff", textAlign: "center", marginBottom: 15, fontSize: 16 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: 500 },
  sheetHandle: { width: 160, height: 4, backgroundColor: "#ccc", alignSelf: "center", borderRadius: 2, marginBottom: 16 },
  sheetHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  productImage: { width: 64, height: 64, borderRadius: 8 },
  productId: { color: "#666", fontSize: 12 },
  productTitle: { color: "#111", fontSize: 20, fontWeight: "bold" },
  subtitleText: { color: "#333", marginTop: 2 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 },
  tag: { backgroundColor: "#f1f1f1", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginRight: 8, marginBottom: 8 },
  tagText: { color: "#111" },
  sheetButtons: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  btnLight: { backgroundColor: "#e9eaee", marginRight: 10 },
  btnDark: { backgroundColor: "#111827", marginLeft: 10 },
  btnAdd: { backgroundColor: "#f59e0b", marginHorizontal: 5 },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  bundlePreview: { backgroundColor: "#fff", marginVertical: 10, padding: 10, borderRadius: 6 }
});

export default function Index() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);
  const [canScan, setCanScan] = useState(true);
  const [countdown, setCountdown] = useState(0);
  const lastScanned = useRef<string | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [product, setProduct] = useState<ProductPayload | null>(null);

  // Local bundle for current scan session
  const [sessionBundle, setSessionBundle] = useState<ProductPayload[]>([]);

  // Context hook to add bundle globally
  const { addBundle } = useBundle();

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => {
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

  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, []);

  const handleScan = ({ data, type }: { data: string; type: string }) => {
    if (!canScan || sending) return;
    if (!data) return;
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
      const targetUrl = resolveProductUrl(data);
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
        raw: json,
      };

      setProduct(payload);
      setModalVisible(true);
    } catch (err) {
      Alert.alert("Scan Error", String(err));
      setCanScan(true);
      lastScanned.current = null;
    } finally {
      setSending(false);
    }
  };

  const resolveProductUrl = (data: string): string => {
    try {
      const u = new URL(data);
      return u.toString();
    } catch (_) {
      return `${PUBLIC_PRODUCT_API}${encodeURIComponent(data)}`;
    }
  };

  const handleAdd = () => {
    if (product) setSessionBundle((prev) => [...prev, product]);
    setModalVisible(false);
    setCanScan(true);
    lastScanned.current = null;
    setProduct(null);
  };

  const handleRetake = () => {
    setModalVisible(false);
    setCanScan(true);
    lastScanned.current = null;
    setProduct(null);
  };

  const handleSubmit = () => {
    if (product) {
      const newBundle = [...sessionBundle, product];
      setSessionBundle([]);
      addBundle({
        id: Date.now().toString(),
        name: `Bundle ${Date.now()}`,
        items: newBundle,
      });
      setModalVisible(false);
      setCanScan(true);
      lastScanned.current = null;
      setProduct(null);
      Alert.alert("Bundle Submitted", "Your bundle has been added. Continue scanning for a new bundle.");
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.centerScreen}>
        <Text style={{ color: "#fff" }}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.centerScreen}>
        <Text style={{ color: "#fff" }}>No camera access</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Scan QR / Barcode</Text>
      <Text style={styles.subtitle}>Point camera at QR code - scans automatically</Text>
      <View style={styles.scanner}>
        {!modalVisible && (
          <CameraView
            style={StyleSheet.absoluteFillObject}
            barcodeScannerSettings={{
              barcodeTypes: [
                "qr",
                "pdf417",
                "aztec",
                "ean13",
                "ean8",
                "upc_a",
                "upc_e",
                "code39",
                "code93",
                "code128",
                "codabar",
                "itf14",
              ],
            }}
            onBarcodeScanned={handleScan}
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
        </View>
      </View>
      <Text style={styles.status}>
        {sending
          ? "🔄 Processing..."
          : countdown > 0
          ? `⏱️ Wait ${countdown}s before next scan`
          : canScan
          ? "✅ Ready to scan"
          : "⏳ Processing..."}
      </Text>

      {sessionBundle.length > 0 && (
        <View style={styles.bundlePreview}>
          <Text style={{ fontWeight: "bold", color: "#374151" }}>Current Bundle:</Text>
          {sessionBundle.map((item, idx) => (
            <Text key={idx}>{item.productTitle || item.scannedCode}</Text>
          ))}
        </View>
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={handleRetake}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={handleRetake}
        >
          <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.sheetHeader}>
                {product?.image ? (
                  <Image source={{ uri: product.image }} style={styles.productImage} />
                ) : (
                  <View style={[styles.productImage, { backgroundColor: "#eee" }]} />
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.productId}>#{product?.scannedCode ?? ""}</Text>
                  <Text style={styles.productTitle}>{product?.productTitle ?? "Product"}</Text>
                  <Text style={styles.subtitleText}>Country of Origin: India</Text>
                </View>
              </View>
              {product?.attributes && (
                <View style={styles.tagRow}>
                  {product.attributes.color && (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>Color: {product.attributes.color}</Text>
                    </View>
                  )}
                  {product.attributes.size && (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>Size: {product.attributes.size}</Text>
                    </View>
                  )}
                  {product.attributes.material && (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>Cloth: {product.attributes.material}</Text>
                    </View>
                  )}
                </View>
              )}
              <View style={styles.sheetButtons}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnLight]}
                  onPress={handleRetake}
                  disabled={sending}
                >
                  <Text style={[styles.btnText, { color: "#111" }]}>Retake</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnAdd]}
                  onPress={handleAdd}
                  disabled={sending}
                >
                  <Text style={[styles.btnText, { color: "#111" }]}>Add</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnDark]}
                  onPress={handleSubmit}
                  disabled={sending}
                >
                  <Text style={styles.btnText}>Submit</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
