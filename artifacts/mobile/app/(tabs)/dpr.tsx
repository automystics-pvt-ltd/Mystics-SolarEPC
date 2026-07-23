import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useOffline } from '@/context/OfflineContext';
import { OfflineBanner } from '@/components/OfflineBanner';
import { apiPost } from '@/lib/api';
import { useGetProjects } from '@workspace/api-client-react';

const WEATHER_OPTIONS = ['Clear', 'Cloudy', 'Rainy', 'Windy', 'Hot'];

export default function DPRScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { isOnline, enqueue } = useOffline();

  const { data: projects } = useGetProjects();

  const today = new Date().toISOString().split('T')[0];
  const [projectId, setProjectId] = useState('');
  const [reportDate] = useState(today);
  const [workSummary, setWorkSummary] = useState('');
  const [manpower, setManpower] = useState('');
  const [weather, setWeather] = useState('Clear');
  const [percentComplete, setPercentComplete] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const projectOptions = projects ?? [];

  const handleSubmit = async () => {
    if (!projectId.trim()) {
      Alert.alert('Missing field', 'Please select or enter a project ID.');
      return;
    }
    if (!workSummary.trim()) {
      Alert.alert('Missing field', 'Please enter a work summary.');
      return;
    }

    const payload = {
      projectId: Number(projectId),
      reportDate,
      workSummary: workSummary.trim(),
      manpowerCount: manpower ? Number(manpower) : undefined,
      weather,
      percentComplete: percentComplete ? Number(percentComplete) : undefined,
    };

    setSubmitting(true);
    try {
      if (isOnline) {
        await apiPost('/api/dprs', payload);
      } else {
        await enqueue('CREATE_DPR', payload, `DPR for project ${projectId}`);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmitted(true);
      // reset
      setProjectId('');
      setWorkSummary('');
      setManpower('');
      setWeather('Clear');
      setPercentComplete('');
      setTimeout(() => setSubmitted(false), 3000);
    } catch {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to submit DPR. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[styles.header, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 12 }]}
      >
        <View>
          <Text style={styles.headerTitle}>Daily Report</Text>
          <Text style={styles.headerSub}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
        </View>
        <Feather name="bar-chart-2" size={22} color="#F97316" />
      </View>

      <OfflineBanner />

      {submitted && (
        <View style={styles.successBar}>
          <Feather name="check-circle" size={14} color="#166534" />
          <Text style={styles.successText}>
            {isOnline ? 'DPR submitted successfully' : 'DPR queued for sync'}
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Project */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>PROJECT</Text>
        <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="briefcase" size={15} color={colors.mutedForeground} />
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="Project ID"
            placeholderTextColor={colors.mutedForeground}
            value={projectId}
            onChangeText={setProjectId}
            keyboardType="numeric"
          />
        </View>

        {projectOptions.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {projectOptions.slice(0, 6).map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.chip,
                  {
                    backgroundColor:
                      String(p.id) === projectId ? colors.primary : colors.card,
                    borderColor: String(p.id) === projectId ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setProjectId(String(p.id))}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: String(p.id) === projectId ? '#fff' : colors.foreground },
                  ]}
                  numberOfLines={1}
                >
                  {p.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Work Summary */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>WORK SUMMARY *</Text>
        <View
          style={[styles.textareaCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <TextInput
            style={[styles.textarea, { color: colors.foreground }]}
            placeholder="Describe today's work…"
            placeholderTextColor={colors.mutedForeground}
            value={workSummary}
            onChangeText={setWorkSummary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Manpower + % Complete */}
        <View style={styles.row}>
          <View style={styles.halfField}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>MANPOWER</Text>
            <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="users" size={15} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="Count"
                placeholderTextColor={colors.mutedForeground}
                value={manpower}
                onChangeText={setManpower}
                keyboardType="numeric"
              />
            </View>
          </View>
          <View style={styles.halfField}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>% COMPLETE</Text>
            <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="percent" size={15} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="0–100"
                placeholderTextColor={colors.mutedForeground}
                value={percentComplete}
                onChangeText={setPercentComplete}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        {/* Weather */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>WEATHER</Text>
        <View style={styles.weatherRow}>
          {WEATHER_OPTIONS.map((w) => (
            <TouchableOpacity
              key={w}
              style={[
                styles.weatherChip,
                {
                  backgroundColor: weather === w ? colors.primary : colors.card,
                  borderColor: weather === w ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setWeather(w)}
            >
              <Text
                style={[styles.weatherText, { color: weather === w ? '#fff' : colors.foreground }]}
              >
                {w}
              </Text>
            </TouchableOpacity>
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
              <Feather name={isOnline ? 'send' : 'upload-cloud'} size={16} color="#fff" />
              <Text style={styles.submitBtnText}>
                {isOnline ? 'Submit DPR' : 'Queue for Sync'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    backgroundColor: '#0B1229',
    paddingHorizontal: 20,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#fff' },
  headerSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#8D9CB8', marginTop: 2 },
  successBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#DCFCE7',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  successText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#166534' },
  body: { paddingHorizontal: 16, paddingTop: 20 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.7,
    marginBottom: 8,
    marginTop: 16,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
  },
  input: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },
  textareaCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    minHeight: 100,
  },
  textarea: { fontSize: 14, fontFamily: 'Inter_400Regular', minHeight: 80 },
  row: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },
  weatherRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  weatherChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  weatherText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  chipRow: { marginTop: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    maxWidth: 150,
  },
  chipText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F97316',
    borderRadius: 12,
    height: 52,
    marginTop: 28,
  },
  submitBtnDisabled: { opacity: 0.65 },
  submitBtnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#fff' },
});
