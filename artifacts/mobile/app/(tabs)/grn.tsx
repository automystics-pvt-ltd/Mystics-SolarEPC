import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useGetGRNs } from '@workspace/api-client-react';
import { OfflineBanner } from '@/components/OfflineBanner';
import { StatusBadge } from '@/components/StatusBadge';

export default function GRNScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useColors();
  const [search, setSearch] = useState('');

  const { data: grns, isLoading, refetch } = useGetGRNs();

  const filtered = (grns ?? []).filter(
    (g) =>
      !search ||
      String(g.id).includes(search) ||
      String(g.poId).includes(search),
  );

  const handleNew = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/grn/new');
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 12 },
        ]}
      >
        <View>
          <Text style={styles.headerTitle}>Receipts</Text>
          <Text style={styles.headerSub}>Goods Receipt Notes</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={handleNew}>
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <OfflineBanner />

      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={15} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search by GRN or PO ID…"
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Feather name="x" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />
        }
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 80 },
        ]}
        scrollEnabled={filtered.length > 0}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="package" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {isLoading ? 'Loading…' : 'No GRNs found'}
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {isLoading ? '' : 'Tap + to record a goods receipt'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={[styles.grnId, { color: colors.foreground }]}>GRN #{item.id}</Text>
                <Text style={[styles.poRef, { color: colors.mutedForeground }]}>PO #{item.poId}</Text>
              </View>
              <StatusBadge status={item.qcStatus ?? 'Pending'} />
            </View>
            <View style={styles.cardRow}>
              <Feather name="map-pin" size={13} color={colors.mutedForeground} />
              <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>
                Warehouse #{item.warehouseId}
              </Text>
            </View>
            {item.receivedDate ? (
              <View style={styles.cardRow}>
                <Feather name="calendar" size={13} color={colors.mutedForeground} />
                <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>
                  {new Date(item.receivedDate).toLocaleDateString('en-IN')}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      />
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
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  list: { paddingHorizontal: 14 },
  card: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  grnId: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  poRef: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardMeta: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginTop: 8 },
  emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
});
