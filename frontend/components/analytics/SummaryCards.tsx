import { View, Text, StyleSheet } from 'react-native';

interface SummaryCardsProps {
  totals: {
    trials: number;
    purchases: number;
    conversion: number;
  };
}

export default function SummaryCards({ totals }: SummaryCardsProps) {
  // Calculate the conversion rate percentage
  const conversionRate = ((totals.purchases / totals.trials) * 100).toFixed(2);

  return (
    <View style={styles.container}>
      {/* Total Trials Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Total Trial Scans</Text>
        <Text style={styles.cardNumber}>{totals.trials}</Text>
      </View>

      {/* Items Sold Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Items Sold</Text>
        <Text style={styles.cardNumber}>{totals.purchases}</Text>
      </View>

      {/* Conversion Rate Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Conversion Rate</Text>
        <Text style={styles.cardNumber}>{conversionRate}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3, // for Android shadow
  },
  cardTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  cardNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
});