import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useOffline } from '@/context/OfflineContext';
import { OfflineBanner } from '@/components/OfflineBanner';
import { SearchPickerModal, PickerItem } from '@/components/SearchPickerModal';
import { apiPost } from '@/lib/api';
import { useGetPurchaseOrders, useGetWarehouses } from '@workspace/api-client-react';

interface LineItem {
  id: string;
  itemName: string;
  receivedQty: string;
  unit: string;
}

function genId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 6);
}

function emptyLine(): LineItem {
  return { id: genId(), itemName: '', receivedQty: '', unit: 'nos' };
}

export default function NewGRNScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useColors();
  const { isOnline, enqueue } = useOffline();

  const today = new Date().toISOString().split('T')[0];

  // PO picker
  const [selectedPo, setSelectedPo] = useState<PickerItem | null>(null);
  const [poPickerOpen, setPoPickerOpen] = useState(false);

  // Warehouse picker
  const [selectedWarehouse, setSelectedWarehouse] = useState<PickerItem | null>(null);
  const [warehousePickerOpen, setWarehousePickerOpen] = useState(false);

  const [receivedDate, setReceivedDate] = useState(today);
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);
  const [submitting, setSubmitting] = useState(false);

  const [showAllPos, setShowAllPos] = useState(false);

  const { data: pos, isLoading: posLoading } = useGetPurchaseOrders();
  const { data: warehouses, isLoading: warehousesLoading } = useGetWarehouses();

  // Only POs in these statuses can have a GRN raised against them.
  // Matches the allowlist enforced by the API (Issued / Acknowledged / PartiallyReceived).
  const GRN_ELIGIBLE_STATUSES = ['Issued', 'Acknowledged', 'PartiallyReceived'];

  const filteredPos = showAllPos
    ? (pos ?? [])
    : (pos ?? []).filter((po) => GRN_ELIGIBLE_STATUSES.includes(po.status ?? ''));

  const poItems: PickerItem[] = filteredPos.map((po) => ({
    id: po.id,
    label: po.poNumber,
    sublabel: po.vendorName ? `Vendor: ${po.vendorName}` : undefined,
  }));

  const warehouseItems: PickerItem[] = (warehouses ?? []).map((wh) => ({
    id: wh.id,
    label: wh.name,
    sublabel: wh.location ?? undefined,
  }));

  const updateLine = (id: string, key: keyof LineItem, value: string) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, [key]: value } : l)));
  };

  const addLine = () => {
    setLines((prev) => [...prev, emptyLine()]);
  };

  const removeLine = (id: string) => {
    if (lines.length === 1) return;
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleSubmit = async () => {
    if (!selectedPo || !selectedWarehouse) {
      Alert.alert('Missing fields', 'Please select a Purchase Order and Warehouse.');
      return;
    }
    const validLines = lines.filter((l) => l.itemName.trim() && l.receivedQty);
    if (validLines.length === 0) {
      Alert.alert('Missing items', 'Add at least one line item with name and quantity.');
      return;
    }

    const payload = {
      poId: selectedPo.id,
      warehouseId: selectedWarehouse.id,
      receivedDate,
      lineItems: validLines.map((l) => ({
        itemName: l.itemName.trim(),
        receivedQty: Number(l.receivedQty),
        pendingQty: 0,
        poQty: Number(l.receivedQty),
        unit: l.unit.trim() || 'nos',
      })),
      qcStatus: 'Pending',
    };

    setSubmitting(true);
    try {
      if (isOnline) {
        await apiPost('/api/grns', payload);
      } else {
        await enqueue('CREATE_GRN', payload, `GRN for PO ${selectedPo.label}`);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        isOnline ? 'GRN Created' : 'Queued Offline',
        isOnline
          ? 'Goods receipt recorded successfully.'
          : 'GRN saved and will sync when back online.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to create GRN. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <OfflineBanner />

      {/* PO Picker Modal */}
      <SearchPickerModal
        visible={poPickerOpen}
        title="Select Purchase Order"
        items={poItems}
        loading={posLoading}
        isOffline={!isOnline}
        onSelect={(item) => {
          setSelectedPo(item);
          setPoPickerOpen(false);
        }}
        onClose={() => setPoPickerOpen(false)}
      />

      {/* Warehouse Picker Modal */}
      <SearchPickerModal
        visible={warehousePickerOpen}
        title="Select Warehouse"
        items={warehouseItems}
        loading={warehousesLoading}
        isOffline={!isOnline}
        onSelect={(item) => {
          setSelectedWarehouse(item);
          setWarehousePickerOpen(false);
        }}
        onClose={() => setWarehousePickerOpen(false)}
      />

      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header fields */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
            RECEIPT DETAILS
          </Text>

          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: colors.foreground }]}>Purchase Order *</Text>
            <TouchableOpacity onPress={() => setShowAllPos((v) => !v)} style={styles.showAllBtn}>
              <Feather
                name={showAllPos ? 'eye-off' : 'eye'}
                size={13}
                color={colors.mutedForeground}
              />
              <Text style={[styles.showAllTxt, { color: colors.mutedForeground }]}>
                {showAllPos ? 'Open only' : 'Show all'}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.pickerWrap, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setPoPickerOpen(true)}
            activeOpacity={0.7}
          >
            <Feather name="file-text" size={15} color={colors.mutedForeground} />
            <View style={styles.pickerTextWrap}>
              {selectedPo ? (
                <>
                  <Text style={[styles.pickerValue, { color: colors.foreground }]} numberOfLines={1}>
                    {selectedPo.label}
                  </Text>
                  {selectedPo.sublabel ? (
                    <Text style={[styles.pickerSublabel, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {selectedPo.sublabel}
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text style={[styles.pickerPlaceholder, { color: colors.mutedForeground }]}>
                  {posLoading
                    ? 'Loading orders…'
                    : !isOnline && poItems.length === 0
                    ? 'Unavailable offline'
                    : 'Select purchase order'}
                </Text>
              )}
            </View>
            <Feather name="chevron-down" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>

          <Text style={[styles.label, { color: colors.foreground }]}>Warehouse *</Text>
          <TouchableOpacity
            style={[styles.pickerWrap, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setWarehousePickerOpen(true)}
            activeOpacity={0.7}
          >
            <Feather name="map-pin" size={15} color={colors.mutedForeground} />
            <View style={styles.pickerTextWrap}>
              {selectedWarehouse ? (
                <>
                  <Text style={[styles.pickerValue, { color: colors.foreground }]} numberOfLines={1}>
                    {selectedWarehouse.label}
                  </Text>
                  {selectedWarehouse.sublabel ? (
                    <Text style={[styles.pickerSublabel, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {selectedWarehouse.sublabel}
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text style={[styles.pickerPlaceholder, { color: colors.mutedForeground }]}>
                  {warehousesLoading
                    ? 'Loading warehouses…'
                    : !isOnline && warehouseItems.length === 0
                    ? 'Unavailable offline'
                    : 'Select warehouse'}
                </Text>
              )}
            </View>
            <Feather name="chevron-down" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>

          <Text style={[styles.label, { color: colors.foreground }]}>Received Date</Text>
          <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="calendar" size={15} color={colors.mutedForeground} />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              value={receivedDate}
              onChangeText={setReceivedDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.mutedForeground}
            />
          </View>
        </View>

        {/* Line items */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
              LINE ITEMS
            </Text>
            <TouchableOpacity onPress={addLine} style={styles.addLineBtn}>
              <Feather name="plus" size={14} color={colors.primary} />
              <Text style={[styles.addLineTxt, { color: colors.primary }]}>Add item</Text>
            </TouchableOpacity>
          </View>

          {lines.map((line, idx) => (
            <View
              key={line.id}
              style={[styles.lineCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={styles.lineHeader}>
                <Text style={[styles.lineNum, { color: colors.mutedForeground }]}>
                  Item {idx + 1}
                </Text>
                {lines.length > 1 && (
                  <TouchableOpacity onPress={() => removeLine(line.id)}>
                    <Feather name="trash-2" size={14} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>

              <TextInput
                style={[styles.lineInput, { color: colors.foreground, borderColor: colors.border }]}
                placeholder="Item name *"
                placeholderTextColor={colors.mutedForeground}
                value={line.itemName}
                onChangeText={(v) => updateLine(line.id, 'itemName', v)}
              />

              <View style={styles.lineRow}>
                <TextInput
                  style={[
                    styles.lineInput,
                    styles.lineInputHalf,
                    { color: colors.foreground, borderColor: colors.border },
                  ]}
                  placeholder="Qty received *"
                  placeholderTextColor={colors.mutedForeground}
                  value={line.receivedQty}
                  onChangeText={(v) => updateLine(line.id, 'receivedQty', v)}
                  keyboardType="numeric"
                />
                <TextInput
                  style={[
                    styles.lineInput,
                    styles.lineInputHalf,
                    { color: colors.foreground, borderColor: colors.border },
                  ]}
                  placeholder="Unit (nos)"
                  placeholderTextColor={colors.mutedForeground}
                  value={line.unit}
                  onChangeText={(v) => updateLine(line.id, 'unit', v)}
                />
              </View>
            </View>
          ))}
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name={isOnline ? 'check-circle' : 'upload-cloud'} size={18} color="#fff" />
              <Text style={styles.submitBtnText}>
                {isOnline ? 'Create GRN' : 'Queue for Sync'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {!isOnline && (
          <Text style={[styles.offlineNote, { color: colors.mutedForeground }]}>
            You're offline. GRN will sync automatically when connected.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16 },
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.7,
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 6,
  },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  showAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  showAllTxt: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  pickerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 46,
    paddingVertical: 8,
  },
  pickerTextWrap: { flex: 1 },
  pickerValue: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  pickerSublabel: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  pickerPlaceholder: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
  },
  input: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },
  addLineBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addLineTxt: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  lineCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    gap: 8,
  },
  lineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lineNum: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  lineInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  lineRow: { flexDirection: 'row', gap: 8 },
  lineInputHalf: { flex: 1 },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F97316',
    borderRadius: 12,
    height: 52,
    marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.65 },
  submitBtnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  offlineNote: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 12,
  },
});
