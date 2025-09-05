import React, { createContext, useContext, useState } from "react";

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

type BundleContextType = {
  bundles: Bundle[];
  addBundle: (bundle: Bundle) => void;
  addDemoBundle: () => void;
};

const BundleContext = createContext<BundleContextType | undefined>(undefined);

export const BundleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [bundles, setBundles] = useState<Bundle[]>([]);

  const addBundle = (bundle: Bundle) => setBundles(prev => [...prev, bundle]);

  const addDemoBundle = () => {
    setBundles(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        name: `Demo Bundle ${prev.length + 1}`,
        items: [
          { scannedCode: "demo-1", codeType: "manual", productTitle: "Shirt" },
          { scannedCode: "demo-2", codeType: "manual", productTitle: "Pants" },
        ],
      }
    ]);
  };

  return (
    <BundleContext.Provider value={{ bundles, addBundle, addDemoBundle }}>
      {children}
    </BundleContext.Provider>
  );
};

export const useBundle = () => {
  const ctx = useContext(BundleContext);
  if (!ctx) throw new Error("useBundle must be used within BundleProvider");
  return ctx;
};
