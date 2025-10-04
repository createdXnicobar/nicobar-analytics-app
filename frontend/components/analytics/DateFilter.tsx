import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform, Dimensions } from 'react-native';
import { useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';

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
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const [showCustom, setShowCustom] = useState(false);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Format a JS Date as YYYY-MM-DD in IST regardless of device timezone
  const formatIST = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  // Compute inclusive day span based on calendar dates in IST
  const diffDaysInclusiveIST = (a: Date, b: Date) => {
    const aStr = formatIST(a);
    const bStr = formatIST(b);
    const aUTC = new Date(`${aStr}T00:00:00Z`).getTime();
    const bUTC = new Date(`${bStr}T00:00:00Z`).getTime();
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.max(1, Math.round((bUTC - aUTC) / msPerDay) + 1);
  };

  // Helpers for 31-day clamping and today bound
  const MS_DAY = 24 * 60 * 60 * 1000;
  const today = new Date();
  today.setHours(23,59,59,999);

  const dateOptions = [
    { label: 'Today', days: 1 },
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 14 days', days: 14 },
    { label: 'Last 30 days', days: 30 },
  ];

  const handleSelect = (days: number) => {
    const todayIST = formatIST(new Date());
    onDateRangeSelect({ date: todayIST, days });
  };

  const applyCustom = () => {
    let start = new Date(startDate);
    let end = new Date(endDate);
    if (start > end) { const tmp = start; start = end; end = tmp; setStartDate(start); setEndDate(end); }
    const diffDays = diffDaysInclusiveIST(start, end);
    const endStrIST = formatIST(end);
    onDateRangeSelect({ date: endStrIST, days: diffDays });
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={[styles.container, { width: Math.min(screenWidth - 24, 520), maxHeight: screenHeight - 100 }]}>
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

            <TouchableOpacity
              style={[styles.option, showCustom && styles.selectedOption]}
              onPress={() => setShowCustom(!showCustom)}
            >
              <Text style={[styles.optionText, showCustom && styles.selectedText]}>Custom range…</Text>
            </TouchableOpacity>

            {showCustom && (
              <View style={styles.customContainer}>
                <View style={styles.customRow}>
                  <TouchableOpacity style={styles.pill} onPress={() => { setShowStartPicker(true); setShowEndPicker(false); }}>
                    <Text style={styles.pillText}>Start: {formatIST(startDate)}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.pill} onPress={() => { setShowEndPicker(true); setShowStartPicker(false); }}>
                    <Text style={styles.pillText}>End: {formatIST(endDate)}</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.applyBtn} onPress={applyCustom}>
                  <Text style={styles.applyBtnText}>Apply</Text>
                </TouchableOpacity>

                {(showStartPicker || showEndPicker) && (
                  <View style={styles.pickerContainer}>
                    {showStartPicker && (
                      <DateTimePicker
                        value={startDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'inline' : 'default'}
                        themeVariant={'light'}
                        textColor={'#111' as any}
                        onChange={(e, d) => { setShowStartPicker(Platform.OS === 'ios'); if (d) setStartDate(d); }}
                        // Start cannot be after End or after today; cannot be earlier than End - 30 days
                        maximumDate={new Date(Math.min(endDate.getTime(), today.getTime()))}
                        minimumDate={new Date(endDate.getTime() - 30 * MS_DAY)}
                      />
                    )}
                    {showEndPicker && (
                      <DateTimePicker
                        value={endDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'inline' : 'default'}
                        themeVariant={'light'}
                        textColor={'#111' as any}
                        onChange={(e, d) => { setShowEndPicker(Platform.OS === 'ios'); if (d) setEndDate(d); }}
                        // End cannot be before Start; cannot be after today or Start + 30 days
                        minimumDate={startDate}
                        maximumDate={new Date(Math.min(today.getTime(), startDate.getTime() + 30 * MS_DAY))}
                      />
                    )}
                  </View>
                )}
              </View>
            )}
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
    width: '92%',
    maxWidth: 420,
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
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
  customContainer: {
    padding: 12,
    backgroundColor: '#fafafa',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  customRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  pill: {
    flexGrow: 1,
    flexBasis: '48%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    marginTop: 8,
  },
  pillText: {
    textAlign: 'center',
    color: '#111',
    fontWeight: '600',
  },
  applyBtn: {
    marginTop: 12,
    backgroundColor: '#111827',
    paddingVertical: 12,
    borderRadius: 10,
  },
  applyBtnText: {
    textAlign: 'center',
    color: '#fff',
    fontWeight: '700',
  },
  pickerContainer: {
    marginTop: 8,
    alignSelf: 'stretch',
    paddingHorizontal: 4,
  },
});
