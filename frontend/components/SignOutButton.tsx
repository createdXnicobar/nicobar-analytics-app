import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useAuth } from '@/context/AuthContext';

export const SignOutButton: React.FC = () => {
  const { logout } = useAuth();

  return (
    <TouchableOpacity
      onPress={() => logout()}
      style={styles.btn}
      accessibilityLabel="Sign out"
    >
      <Text style={styles.text}>Sign out</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    marginTop: 12,
    backgroundColor: '#e11d48',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  text: {
    color: '#fff',
    fontWeight: '600',
  },
});
