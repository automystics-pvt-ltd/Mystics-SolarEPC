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
import { useGetMaterialRequests } from '@workspace/api-client-react';
import { OfflineBanner } from '@/components/OfflineBanner';
import { StatusBadge } from '@/components/StatusBadge';

export default function MRScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useColors();
  const [search, setSearch] = useState('');

  const { data: mrs, isPending, isFetching, refetch } = useGetMaterialRequests();

  const filtered = (mrs ?? []).filter(
    (m) =>
      !search ||
      String(m.id).includes(search) ||
      String(m.projectId).includes(search),
  );

  const handleNew = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/mr/new');
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[styles.header, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 12 }]}
      >
        <View>
          <Text style={styles.headerTitle}>Material Requests</Text>
          <Text style={styles.headerSub}>{(mrs ?? []).length} total</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={handleNew}>
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <OfflineBanner />

      <View
        style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Feather name="search" size={15} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search by MR or project ID…"
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
          <RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={colors.primary} />
        }
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 80 },
        ]}
        scrollEnabled={filtered.length > 0}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="clipboard" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {isPending ? 'Loading…' : 'No material requests'}
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {isPending ? '' : 'Tap + to raise a material request'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={[styles.mrId, { color: colors.foreground }]}>MR #{item.id}</Text>
                <Text style={[styles.projectRef, { color: colors.mutedForeground }]}>
                  Project #{item.projectId}
                </Text>
              </View>
              <StatusBadge status={item.status ?? 'Open'} />
            </View>

            {item.items && item.items.length > 0 && (
              <View style={styles.itemsList}>
                {item.items.slice(0, 2).map((it, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <View style={[styles.itemDot, { backgroundColor: colors.primary }]} />
                    <Text style={[styles.itemName, { color: colors.foreground }]}>
                      {it.itemName}
                    </Text>
                    <Text style={[styles.itemQty, { color: colors.mutedForeground }]}>
                      {it.qty} {it.unit}
                    </Text>
                  </View>
                ))}
                {item.items.length > 2 && (
                  <Text style={[styles.moreItems, { color: colors.mutedForeground }]}>
                    +{item.items.length - 2} more items
                  </Text>
                )}
              </View>
            )}

            {item.requiredByDate && (
              <View style={styles.cardFooter}>
                <Feather name="calendar" size={12} color={colors.mutedForeground} />
                <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
                  Required by {new Date(item.requiredByDate).toLocaleDateString('en-IN')}
                </Text>
              </View>
            )}
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
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },
  list: { paddingHorizontal: 14 },
  card: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    gap: 10,
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
  mrId: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  projectRef: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  itemsList: { gap: 5 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemDot: { width: 5, height: 5, borderRadius: 3 },
  itemName: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium' },
  itemQty: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  moreItems: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dateText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginTop: 8 },
  emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
});
