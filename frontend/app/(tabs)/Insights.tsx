import { View, Text, StyleSheet } from 'react-native';

export default function InsightsScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.pill}><Text style={styles.pillText}>✨ AI insights are coming soon!</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  pill: { backgroundColor: '#1f2937', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999 },
  pillText: { color: '#e5e7eb', fontWeight: '800' },
});


