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
import { CameraView, Camera } from "expo-camera";
import uuid from 'react-native-uuid';

// Backend base URL (ngrok)
const BACKEND_BASE_URL = "https://9346bbd8718c.ngrok-free.app"; // change as needed
const BACKEND_POST_PATH = "/v1/trials"; // updated to match backend router

// Configure your store code here (e.g., "AON", "BIN", ...)
const DEFAULT_STORE_CODE = "BIN";

// Public GET API base used when the scanned data is an SKU, not a URL
const PUBLIC_PRODUCT_API = "https://bronco.nicobar.com/api/getProductsbySKU?sku=";

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

export default function Index() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);
  const [canScan, setCanScan] = useState(true);
  const [countdown, setCountdown] = useState(0);
  const lastScanned = useRef<string | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal state and product data
  const [modalVisible, setModalVisible] = useState(false);
  const [product, setProduct] = useState<ProductPayload | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
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

  // Cleanup timeouts on unmount
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

    // Prevent duplicate scans of the same data
    if (lastScanned.current === data) return;

    lastScanned.current = data;
    setCanScan(false);

    // Tiny debounce to avoid rapid duplicate callbacks
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
      // Treat data as SKU if it's not a URL
      return `${PUBLIC_PRODUCT_API}${encodeURIComponent(data)}`;
    }
  };

  const generateId = () => `trial_${Math.random().toString(36).slice(2)}_${Date.now()}`;

  const deriveSku = async (scannedCode: string): Promise<string> => {
    try {
      // First, check if it's already a direct URL with SKU parameter
      const u = new URL(scannedCode);
      const sku = u.searchParams.get("sku");
      if (sku) return sku;

      // If no SKU parameter, try to follow redirects to get the final URL
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

  const submitToBackend = async () => {
    if (!product) return;
    try {
      setSending(true);
      const trialId = generateId();
      const sku = await deriveSku(product.scannedCode);
      console.log("sku", sku);
      const body = {
        trialId,
        sku,
        storeCode: DEFAULT_STORE_CODE
      };

      const res = await fetch(`${BACKEND_BASE_URL}${BACKEND_POST_PATH}` , {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": uuid.v4(),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Backend responded ${res.status}`);
      Alert.alert("Submitted", "Trial stored successfully.");
      setModalVisible(false);
      setCountdown(2);
    } catch (err) {
      Alert.alert("Submit Error", String(err));
    } finally {
      setSending(false);
      lastScanned.current = null;
    }
  };

  if (hasPermission === null) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#fff" }}>Requesting camera permission...</Text>
      </View>
    );
  }
  if (hasPermission === false) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#fff" }}>No camera access</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Scan QR / Barcode</Text>
      <Text style={styles.subtitle}>Point camera at QR code - scans automatically</Text>
      
      <View style={styles.scanner}>
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
        
        {/* Scanning overlay */}
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
      
      <Button 
        title="Reset Scanner" 
        onPress={() => { 
          if (scanTimeoutRef.current) {
            clearTimeout(scanTimeoutRef.current);
            scanTimeoutRef.current = null;
          }
          lastScanned.current = null;
          setCanScan(true);
          setCountdown(0);
        }} 
        disabled={sending}
      />

      {/* Bottom-sheet style modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setModalVisible(false);
          setCanScan(true);
          lastScanned.current = null;
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
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

              <View style={styles.tagRow}>
                {product?.attributes?.color ? (
                  <View style={styles.tag}><Text style={styles.tagText}>Color: {product.attributes.color}</Text></View>
                ) : null}
                {product?.attributes?.size ? (
                  <View style={styles.tag}><Text style={styles.tagText}>Size: {product.attributes.size}</Text></View>
                ) : null}
                {product?.attributes?.material ? (
                  <View style={styles.tag}><Text style={styles.tagText}>Cloth: {product.attributes.material}</Text></View>
                ) : null}
              </View>

              <View style={styles.tagRow}>
                {product?.attributes?.category ? (
                  <View style={styles.tag}><Text style={styles.tagText}>Category: {product.attributes.category}</Text></View>
                ) : null}
                {product?.attributes?.subclass ? (
                  <View style={styles.tag}><Text style={styles.tagText}>Subclass: {product.attributes.subclass}</Text></View>
                ) : null}
              </View>

              <View style={styles.sheetButtons}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnLight]}
                  onPress={() => {
                    setModalVisible(false);
                    setCanScan(true);
                    lastScanned.current = null;
                  }}
                  disabled={sending}
                >
                  <Text style={[styles.btnText, { color: "#111" }]}>Retake</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.btnDark]} onPress={submitToBackend} disabled={sending}>
                  <Text style={styles.btnText}>Submit</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    paddingTop: 50, 
    backgroundColor: "#111", 
    padding: 16 
  },
  title: { 
    color: "#fff", 
    fontSize: 20, 
    textAlign: "center", 
    marginBottom: 5,
    fontWeight: "bold"
  },
  subtitle: {
    color: "#aaa",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20
  },
  scanner: { 
    flex: 1, 
    borderRadius: 8, 
    overflow: "hidden",
    marginBottom: 20,
    position: "relative"
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center"
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: "#fff",
    borderRadius: 12,
    backgroundColor: "transparent"
  },
  loadingOverlay: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 20,
    borderRadius: 10,
    alignItems: "center"
  },
  loadingText: {
    color: "#fff",
    marginTop: 10,
    fontSize: 16
  },
  status: {
    color: "#fff",
    textAlign: "center",
    marginBottom: 15,
    fontSize: 16
  },
  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: "70%",
  },
  sheetHandle: {
    width: 160,
    height: 4,
    backgroundColor: "#ccc",
    alignSelf: "center",
    borderRadius: 2,
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  productImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
  },
  productId: {
    color: "#666",
    fontSize: 12,
  },
  productTitle: {
    color: "#111",
    fontSize: 20,
    fontWeight: "bold",
  },
  subtitleText: {
    color: "#333",
    marginTop: 2,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  tag: {
    backgroundColor: "#f1f1f1",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    color: "#111",
  },
  sheetButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  btnLight: {
    backgroundColor: "#e9eaee",
    marginRight: 10,
  },
  btnDark: {
    backgroundColor: "#111827",
    marginLeft: 10,
  },
  btnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
});
