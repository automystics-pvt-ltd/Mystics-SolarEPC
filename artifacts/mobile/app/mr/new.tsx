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
import { useGetProjects } from '@workspace/api-client-react';

interface MRLine {
  id: string;
  itemName: string;
  qty: string;
  unit: string;
  specifications: string;
}

function genId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 6);
}

function emptyLine(): MRLine {
  return { id: genId(), itemName: '', qty: '', unit: 'nos', specifications: '' };
}

export default function NewMRScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useColors();
  const { isOnline, enqueue } = useOffline();

  const thirtyDays = new Date();
  thirtyDays.setDate(thirtyDays.getDate() + 30);
  const defaultDue = thirtyDays.toISOString().split('T')[0];

  const [selectedProject, setSelectedProject] = useState<PickerItem | null>(null);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [requiredByDate, setRequiredByDate] = useState(defaultDue);
  const [lines, setLines] = useState<MRLine[]>([emptyLine()]);
  const [submitting, setSubmitting] = useState(false);

  const { data: projects, isLoading: projectsLoading } = useGetProjects();

  const projectItems: PickerItem[] = (projects ?? []).map((p) => ({
    id: p.id,
    label: p.name,
    sublabel: p.siteLocation ?? undefined,
  }));

  const updateLine = (id: string, key: keyof MRLine, value: string) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, [key]: value } : l)));
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);

  const removeLine = (id: string) => {
    if (lines.length === 1) return;
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleSubmit = async () => {
    if (!selectedProject) {
      Alert.alert('Missing field', 'Please select a project.');
      return;
    }
    const validLines = lines.filter((l) => l.itemName.trim() && l.qty);
    if (validLines.length === 0) {
      Alert.alert('Missing items', 'Add at least one item with name and quantity.');
      return;
    }

    const payload = {
      projectId: selectedProject.id,
      requiredByDate,
      items: validLines.map((l) => ({
        itemName: l.itemName.trim(),
        qty: Number(l.qty),
        unit: l.unit.trim() || 'nos',
        specifications: l.specifications.trim() || undefined,
      })),
    };

    setSubmitting(true);
    try {
      if (isOnline) {
        await apiPost('/api/material-requests', payload);
      } else {
        await enqueue('CREATE_MR', payload, `MR for ${selectedProject.label}`);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        isOnline ? 'MR Raised' : 'Queued Offline',
        isOnline
          ? 'Material request submitted successfully.'
          : 'MR saved and will sync when back online.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to submit material request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <OfflineBanner />

      {/* Project Picker Modal */}
      <SearchPickerModal
        visible={projectPickerOpen}
        title="Select Project"
        items={projectItems}
        loading={projectsLoading}
        isOffline={!isOnline}
        onSelect={(item) => {
          setSelectedProject(item);
          setProjectPickerOpen(false);
        }}
        onClose={() => setProjectPickerOpen(false)}
      />

      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header details */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
            REQUEST DETAILS
          </Text>

          <Text style={[styles.label, { color: colors.foreground }]}>Project *</Text>
          <TouchableOpacity
            style={[styles.pickerWrap, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setProjectPickerOpen(true)}
            activeOpacity={0.7}
          >
            <Feather name="briefcase" size={15} color={colors.mutedForeground} />
            <View style={styles.pickerTextWrap}>
              {selectedProject ? (
                <>
                  <Text style={[styles.pickerValue, { color: colors.foreground }]} numberOfLines={1}>
                    {selectedProject.label}
                  </Text>
                  {selectedProject.sublabel ? (
                    <Text style={[styles.pickerSublabel, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {selectedProject.sublabel}
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text style={[styles.pickerPlaceholder, { color: colors.mutedForeground }]}>
                  {projectsLoading
                    ? 'Loading projects…'
                    : !isOnline && projectItems.length === 0
                    ? 'Unavailable offline'
                    : 'Select project'}
                </Text>
              )}
            </View>
            <Feather name="chevron-down" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>

          <Text style={[styles.label, { color: colors.foreground }]}>Required By Date</Text>
          <View
            style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Feather name="calendar" size={15} color={colors.mutedForeground} />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              value={requiredByDate}
              onChangeText={setRequiredByDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.mutedForeground}
            />
          </View>
        </View>

        {/* Items */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>ITEMS</Text>
            <TouchableOpacity onPress={addLine} style={styles.addBtn}>
              <Feather name="plus" size={14} color={colors.primary} />
              <Text style={[styles.addBtnText, { color: colors.primary }]}>Add item</Text>
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
                style={[
                  styles.lineInput,
                  { color: colors.foreground, borderColor: colors.border },
                ]}
                placeholder="Item name *"
                placeholderTextColor={colors.mutedForeground}
                value={line.itemName}
                onChangeText={(v) => updateLine(line.id, 'itemName', v)}
              />

              <View style={styles.lineRow}>
                <TextInput
                  style={[
                    styles.lineInput,
                    styles.flex1,
                    { color: colors.foreground, borderColor: colors.border },
                  ]}
                  placeholder="Qty *"
                  placeholderTextColor={colors.mutedForeground}
                  value={line.qty}
                  onChangeText={(v) => updateLine(line.id, 'qty', v)}
                  keyboardType="numeric"
                />
                <TextInput
                  style={[
                    styles.lineInput,
                    styles.flex1,
                    { color: colors.foreground, borderColor: colors.border },
                  ]}
                  placeholder="Unit (nos)"
                  placeholderTextColor={colors.mutedForeground}
                  value={line.unit}
                  onChangeText={(v) => updateLine(line.id, 'unit', v)}
                />
              </View>

              <TextInput
                style={[
                  styles.lineInput,
                  { color: colors.foreground, borderColor: colors.border },
                ]}
                placeholder="Specifications (optional)"
                placeholderTextColor={colors.mutedForeground}
                value={line.specifications}
                onChangeText={(v) => updateLine(line.id, 'specifications', v)}
              />
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
                {isOnline ? 'Submit MR' : 'Queue for Sync'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {!isOnline && (
          <Text style={[styles.offlineNote, { color: colors.mutedForeground }]}>
            Offline — MR will sync automatically when connected.
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
  sectionRow: {
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
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginBottom: 6, marginTop: 12 },
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
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
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
  flex1: { flex: 1 },
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
