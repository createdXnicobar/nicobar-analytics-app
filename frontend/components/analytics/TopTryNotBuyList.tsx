import { View, Text, StyleSheet, ScrollView } from 'react-native';

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

export default function TopTryNotBuyList({ items }: TopTryNotBuyListProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeader}>Product Performance</Text>
      <ScrollView style={styles.list}>
        {items.map((item) => (
          <View key={item.sku} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.sku}>SKU: {item.sku}</Text>
              <Text style={styles.conversion}>
                {(item.conversion * 100).toFixed(1)}%
              </Text>
            </View>
            
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
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
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
    padding: 16,
    borderRadius: 8,
    marginVertical: 6,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sku: {
    fontWeight: '500',
    fontSize: 16,
  },
  conversion: {
    fontWeight: 'bold',
    color: '#007AFF', // iOS system blue
  },
  details: {
    color: '#666',
    marginBottom: 8,
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
});