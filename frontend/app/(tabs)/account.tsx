import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useClerk } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';

export default function Account() {
  const { signOut } = useClerk();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Account</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Store details</Text>
        <Text>Janakpuri west store</Text>
        <Text>Store code: 110066</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Contact</Text>
        <Text>Store Manager: Ms. Lorem Ipsum</Text>
        <Text>Contact: 1234567890</Text>
        <Text>Address: Add shipping address</Text>
      </View>

      <TouchableOpacity style={styles.logout} onPress={async () => { await signOut(); router.replace('/(auth)/sign-in'); }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 16 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 8, marginBottom: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#eee' },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  logout: { backgroundColor: '#ef4444', padding: 14, alignItems: 'center', borderRadius: 10, marginTop: 16 }
});