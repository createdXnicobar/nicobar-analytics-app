import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useClerk } from '@clerk/clerk-expo';

export const SignOutButton: React.FC = () => {
  const { signOut } = useClerk();

  return (
    <TouchableOpacity
      onPress={() => signOut()}
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
