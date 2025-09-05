import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useOAuth, SignedIn, SignedOut } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { Redirect, Link, useRouter } from 'expo-router';

WebBrowser.maybeCompleteAuthSession();

export default function SignUp() {
  const router = useRouter();
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });

  const onGooglePress = async () => {
    try {
      const redirectUrl = makeRedirectUri({ scheme: 'qrpostapp' });
      const { createdSessionId, setActive } = await startOAuthFlow({ redirectUrl });
      if (createdSessionId) {
        await setActive?.({ session: createdSessionId });
        router.replace('/');
      }
    } catch (err) {
      Alert.alert('Sign-up error', String(err));
    }
  };

  return (
    <View style={styles.container}>
      <SignedIn>
        <Redirect href="/" />
      </SignedIn>
      <SignedOut>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Start by continuing with Google</Text>

        <TouchableOpacity onPress={onGooglePress} style={styles.googleBtn}>
          <Text style={styles.googleText}>Continue with Google</Text>
        </TouchableOpacity>

        <View style={{ height: 12 }} />
        <Link href="/(auth)/sign-in"><Text style={styles.link}>Already have an account? Sign in</Text></Link>
      </SignedOut>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 16, color: '#555', marginBottom: 20 },
  googleBtn: { backgroundColor: '#111827', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 10 },
  googleText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  link: { color: '#2563eb', fontSize: 14 },
});
