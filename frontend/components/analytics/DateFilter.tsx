import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';

interface DateFilterProps {
  visible: boolean;
  onClose: () => void;
  onDateRangeSelect: (range: { date: string; days: number }) => void;
  currentRange: { date: string; days: number };
}

export default function DateFilter({ 
  visible, 
  onClose, 
  onDateRangeSelect, 
  currentRange 
}: DateFilterProps) {
  
  const dateOptions = [
    { label: 'Today', days: 1 },
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 14 days', days: 14 },
    { label: 'Last 30 days', days: 30 },
  ];

  const handleSelect = (days: number) => {
    const today = new Date().toISOString().split('T')[0];
    onDateRangeSelect({ date: today, days });
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Select Date Range</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.optionsContainer}>
            {dateOptions.map((option) => (
              <TouchableOpacity
                key={option.days}
                style={[
                  styles.option,
                  currentRange.days === option.days && styles.selectedOption
                ]}
                onPress={() => handleSelect(option.days)}
              >
                <Text style={[
                  styles.optionText,
                  currentRange.days === option.days && styles.selectedText
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '90%',
    maxWidth: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    fontSize: 20,
    color: '#666',
  },
  optionsContainer: {
    padding: 20,
  },
  option: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f8f8f8',
  },
  selectedOption: {
    backgroundColor: '#007AFF',
  },
  optionText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
  },
  selectedText: {
    color: 'white',
    fontWeight: '600',
  },
});
