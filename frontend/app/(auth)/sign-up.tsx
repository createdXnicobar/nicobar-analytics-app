import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Link } from 'expo-router';

export default function SignUp() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Account creation</Text>
      <Text style={styles.subtitle}>Sign-up is managed by admins. Please contact your administrator to create a store account.</Text>
      <Link href="/(auth)/sign-in"><Text style={styles.link}>Back to Sign in</Text></Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#555', marginBottom: 20, textAlign: 'center' },
  link: { color: '#2563eb', fontSize: 14 },
});