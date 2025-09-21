import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, TextInput, ActivityIndicator } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function SignIn() {
  const router = useRouter();
  const { isAuthenticated, login, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isValidEmail = useMemo(() => /[^\s@]+@[^\s@]+\.[^\s@]+/.test(email.trim()), [email]);

  const onSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter both email and password');
      return;
    }
    if (!isValidEmail) {
      Alert.alert('Invalid email', 'Please enter a valid email address');
      return;
    }
    try {
      setSubmitting(true);
      const result = await login(email.trim(), password);
      if (result.ok) {
        router.replace('/');
      } else {
        Alert.alert('Login failed', result.message || 'Invalid credentials or user not authorised.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (isAuthenticated) return <Redirect href="/" />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome</Text>
      <Text style={styles.subtitle}>Sign in with your store account</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#7b7b7b"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#7b7b7b"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity onPress={onSubmit} style={[styles.primaryBtn, (!isValidEmail || submitting || loading) && styles.primaryBtnDisabled]} disabled={!isValidEmail || submitting || loading}>
        {submitting || loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>Sign in</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#ffffff' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 6, color: '#111827' },
  subtitle: { fontSize: 16, color: '#555', marginBottom: 20 },
  input: { width: '100%', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, marginBottom: 12, backgroundColor: '#ffffff', color: '#111827' },
  primaryBtn: { backgroundColor: '#111827', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 10, width: '100%', alignItems: 'center' },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
