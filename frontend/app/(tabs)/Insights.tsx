import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ReportsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Insights</Text>
      <Text style={styles.note}>LLM Insights will be added Soon...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: '#111' },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 8 },
  note: { color: '#bbb', fontSize: 16, textAlign: 'center' },
});


