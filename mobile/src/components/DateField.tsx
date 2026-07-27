import React, { useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Platform, Modal } from 'react-native'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'

type Props = {
  label: string
  value: string // DD/MM/YYYY, or '' when empty
  onChange: (value: string) => void
  required?: boolean
  maximumDate?: Date
  minimumDate?: Date
}

function parseDDMMYYYY(s: string): Date | null {
  const parts = s.split('/')
  if (parts.length !== 3) return null
  const d = parseInt(parts[0], 10), m = parseInt(parts[1], 10) - 1, y = parseInt(parts[2], 10)
  const dt = new Date(y, m, d)
  return isNaN(dt.getTime()) ? null : dt
}

function formatDDMMYYYY(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export default function DateField({ label, value, onChange, required, maximumDate, minimumDate }: Props) {
  const [show, setShow] = useState(false)
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const currentDate = parseDDMMYYYY(value) || new Date()

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShow(false)
    if (event.type === 'dismissed') return
    if (selectedDate) onChange(formatDDMMYYYY(selectedDate))
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label}{required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <TouchableOpacity style={styles.input} onPress={() => setShow(true)} activeOpacity={0.7}>
        <Text style={value ? styles.valueText : styles.placeholderText}>
          {value || 'DD/MM/YYYY'}
        </Text>
      </TouchableOpacity>

      {show && Platform.OS === 'android' && (
        <DateTimePicker
          value={currentDate}
          mode="date"
          display="default"
          onChange={handleChange}
          maximumDate={maximumDate}
          minimumDate={minimumDate}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal visible={show} transparent animationType="slide" onRequestClose={() => setShow(false)}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setShow(false)} />
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <TouchableOpacity onPress={() => setShow(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.doneText}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={currentDate}
              mode="date"
              display="spinner"
              onChange={handleChange}
              maximumDate={maximumDate}
              minimumDate={minimumDate}
            />
          </View>
        </Modal>
      )}
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    wrap: { marginBottom: 16 },
    label: { fontSize: 13, fontWeight: '600', color: c.textSub, marginBottom: 6 },
    required: { color: c.error },
    input: {
      backgroundColor: c.surface, borderRadius: 10, borderWidth: 1, borderColor: c.borderMid,
      paddingHorizontal: 14, paddingVertical: 13,
    },
    valueText: { fontSize: 15, color: c.text },
    placeholderText: { fontSize: 15, color: c.textFaint },

    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    pickerSheet: { backgroundColor: c.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
    pickerHeader: {
      flexDirection: 'row', justifyContent: 'flex-end',
      paddingHorizontal: 20, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    doneText: { fontSize: 16, fontWeight: '700', color: c.primary },
  })
}
