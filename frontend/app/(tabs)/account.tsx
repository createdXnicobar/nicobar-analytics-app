import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function Account() {
  const { logout, user } = useAuth();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Account</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Profile</Text>
        <View style={styles.row}><Text style={styles.label}>Full name</Text><Text style={styles.value}>{user?.fullName || '-'}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Email</Text><Text style={styles.value}>{user?.email || '-'}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Store code</Text><Text style={styles.value}>{user?.storeCode || '-'}</Text></View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Store details</Text>
        <Text>Store code: {user?.storeCode || '-'}</Text>
      </View>

      <TouchableOpacity style={styles.logout} onPress={async () => { await logout(); router.replace('/(auth)/sign-in'); }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>Log out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 16 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#eee' },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  label: { color: '#6b7280' },
  value: { color: '#111827', fontWeight: '600' },
  logout: { backgroundColor: '#ef4444', padding: 14, alignItems: 'center', borderRadius: 10, marginTop: 16 }
});