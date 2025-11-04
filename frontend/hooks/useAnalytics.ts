import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// Prefer environment variable; fall back to sensible defaults per platform
// To set: add EXPO_PUBLIC_API_BASE_URL in your env (e.g., .env) pointing to FastAPI base URL
const API_BASE_URL = 'https://tcnuitydvx.ap-southeast-2.awsapprunner.com';

interface AnalyticsData {
  storeCode: string;
  fromDate: string;
  toDate: string;
  totals: {
    trials: number;
    purchases: number;
    conversion: number;
  };
  topTryNotBuy: Array<{
    sku: string;
    title: string | null;
    size: string | null;
    color: string | null;
    trials: number;
    purchases: number;
    tryNotBuy: number;
    conversion: number;
  }>;
}



const useAnalytics = (storeCode: string, date: string, days: number) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Always normalize the date to IST (YYYY-MM-DD) before hitting backend
      const istDate = new Date(date + 'T00:00:00Z').toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

      const requestUrl = `${API_BASE_URL}/v1/insights/store/${storeCode}`;
      console.log('🌐 Making request to:', requestUrl, { date: istDate, days });
      const response = await axios.get(requestUrl, {
        params: { date: istDate, days },
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      // console.log('✅ Success! Response status:', response.status);
      
      setData(response.data);
    } catch (err: any) {
      console.error('❌ Full error object:', err);
      
      if (err.response) {
        // Server responded with error status
        console.log('📡 Server error response:', err.response.status, err.response.data);
        setError(`Server Error: ${err.response.status} - ${err.response.statusText}`);
      } else if (err.request) {
        // Request made but no response received
        console.log('📡 Request details:', {
          url: err.config?.url,
          method: err.config?.method,
          timeout: err.config?.timeout
        });
        setError('Connection timeout - Server took too long to respond');
      } else {
        // Error setting up the request
        setError(`Request Error: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  }, [storeCode, date, days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
};

export default useAnalytics;
