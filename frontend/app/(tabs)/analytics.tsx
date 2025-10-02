import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import useAnalytics from '../../hooks/useAnalytics'; 
import SummaryCards from '../../components/analytics/SummaryCards';
import TopTryNotBuyList from '../../components/analytics/TopTryNotBuyList';
import DateFilter from '../../components/analytics/DateFilter';
import { useAuth } from '@/context/AuthContext';

export default function AnalyticsScreen() {
  const { user } = useAuth();
  const [storeCode] = useState((user?.storeCode || "DKN").toUpperCase());
  const [showDateFilter, setShowDateFilter] = useState(false);

  const [dateRange, setDateRange] = useState({
    date: new Date().toISOString().split('T')[0],
    days: 7
  });

  // Change this line to use real hook:
  const { data, loading, error, refetch } = useAnalytics(
    storeCode, 
    dateRange.date, 
    dateRange.days
  );

  const handleDateRangeChange = (newDateRange: { date: string; days: number }) => {
    setDateRange(newDateRange);
    setShowDateFilter(false);
  };

  const getDateRangeText = () => {
    switch (dateRange.days) {
      case 1: return "Today";
      case 7: return "Last 7 days";
      case 14: return "Last 14 days";
      case 30: return "Last 30 days";
      default: return `Last ${dateRange.days} days`;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading analytics data...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity onPress={refetch} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Handle empty data case
  if (!data || data.totals.trials === 0) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Nicobar Retail</Text>
          <TouchableOpacity 
            style={styles.dateRangeButton}
            onPress={() => setShowDateFilter(true)}
          >
            <Text style={styles.dateRangeText}>📅 {getDateRangeText()}</Text>
          </TouchableOpacity>
        </View>

        {/* Empty State */}
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No Data Available</Text>
          <Text style={styles.emptyMessage}>
            No trial or purchase data found for the selected date range.
          </Text>
          <Text style={styles.emptySubtext}>
            Date range: {data?.fromDate} to {data?.toDate}
          </Text>
        </View>

        <DateFilter 
          visible={showDateFilter}
          onClose={() => setShowDateFilter(false)}
          onDateRangeSelect={handleDateRangeChange}
          currentRange={dateRange}
        />
      </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={refetch} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Nicobar Retail</Text>
        
        <TouchableOpacity 
          style={styles.dateRangeButton}
          onPress={() => setShowDateFilter(true)}
        >
          <Text style={styles.dateRangeText}>📅 {getDateRangeText()}</Text>
        </TouchableOpacity>
      </View>

      {/* Summary Cards */}
      <SummaryCards totals={data.totals} />

      {/* Product Performance List */}
      <TopTryNotBuyList items={data.topTryNotBuy} />

      {/* Date Filter Modal */}
      <DateFilter 
        visible={showDateFilter}
        onClose={() => setShowDateFilter(false)}
        onDateRangeSelect={handleDateRangeChange}
        currentRange={dateRange}
      />
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 5,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  dateRangeButton: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  dateRangeText: {
    fontSize: 16,
    color: '#333',
  },
  downloadButton: {
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
  },
  downloadText: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
  },
  retryText: {
    color: 'white',
    fontWeight: '600',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  emptyMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
