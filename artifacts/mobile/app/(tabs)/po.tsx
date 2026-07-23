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
import { useColors } from '@/hooks/useColors';
import { formatINR } from '@/lib/currency';
import { useGetPurchaseOrders } from '@workspace/api-client-react';
import { OfflineBanner } from '@/components/OfflineBanner';
import { StatusBadge } from '@/components/StatusBadge';

const STATUS_FILTERS = ['All', 'Sent', 'PartiallyReceived', 'FullyReceived', 'Cancelled'];

export default function POScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useColors();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const { data: pos, isLoading, refetch } = useGetPurchaseOrders(
    statusFilter !== 'All' ? { status: statusFilter } : {},
  );

  const filtered = (pos ?? []).filter(
    (p) =>
      !search ||
      p.poNumber.toLowerCase().includes(search.toLowerCase()) ||
      p.vendorName.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[styles.header, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 12 }]}
      >
        <View>
          <Text style={styles.headerTitle}>Purchase Orders</Text>
          <Text style={styles.headerSub}>{(pos ?? []).length} orders</Text>
        </View>
        <Feather name="file-text" size={22} color="#F97316" />
      </View>

      <OfflineBanner />

      {/* Search */}
      <View
        style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Feather name="search" size={15} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search PO number or vendor…"
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

      {/* Status filter chips */}
      <FlatList
        horizontal
        data={STATUS_FILTERS}
        keyExtractor={(s) => s}
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterChip,
              {
                backgroundColor:
                  statusFilter === item ? colors.primary : colors.card,
                borderColor: statusFilter === item ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setStatusFilter(item)}
          >
            <Text
              style={[
                styles.filterText,
                { color: statusFilter === item ? '#fff' : colors.foreground },
              ]}
            >
              {item}
            </Text>
          </TouchableOpacity>
        )}
      />

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
            <Feather name="file-text" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {isLoading ? 'Loading…' : 'No purchase orders'}
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {isLoading ? '' : 'Purchase orders will appear here'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push(`/po/${item.id}` as never)}
            activeOpacity={0.8}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.poNumber, { color: colors.foreground }]}>{item.poNumber}</Text>
              <StatusBadge status={item.status ?? 'Draft'} />
            </View>
            <Text style={[styles.vendorName, { color: colors.mutedForeground }]}>
              {item.vendorName}
            </Text>
            <View style={styles.cardFooter}>
              <Text style={[styles.amount, { color: colors.primary }]}>
                {formatINR(item.amount)}
              </Text>
              {item.poDate && (
                <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
                  {new Date(item.poDate).toLocaleDateString('en-IN')}
                </Text>
              )}
            </View>
            <View style={styles.viewRow}>
              <Text style={[styles.viewLink, { color: colors.primary }]}>View details</Text>
              <Feather name="chevron-right" size={13} color={colors.primary} />
            </View>
          </TouchableOpacity>
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
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginTop: 14,
    marginBottom: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },
  filterBar: { flexGrow: 0, marginTop: 10 },
  filterContent: { paddingHorizontal: 14, gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  list: { paddingHorizontal: 14, paddingTop: 10 },
  card: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    gap: 6,
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
  poNumber: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  vendorName: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  amount: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  dateText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  viewRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  viewLink: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginTop: 8 },
  emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
});
