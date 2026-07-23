import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useOffline } from '@/context/OfflineContext';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useGetPurchaseOrders } from '@workspace/api-client-react';

const QUICK_ACTIONS = [
  { label: 'New GRN', icon: 'package' as const, route: '/grn/new', color: '#F97316' },
  { label: 'Log DPR', icon: 'bar-chart-2' as const, route: '/(tabs)/dpr', color: '#3B82F6' },
  { label: 'Raise MR', icon: 'clipboard' as const, route: '/mr/new', color: '#10B981' },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();
  const { isOnline, queue, processQueue, isSyncing } = useOffline();

  const { data: pos, isLoading: posLoading, refetch } = useGetPurchaseOrders();

  const recentPOs = (pos ?? []).slice(0, 4);
  const todayDate = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const handleQuickAction = useCallback(
    async (route: string) => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push(route as never);
    },
    [router],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Navy header */}
      <View style={[styles.header, { paddingTop: Platform.OS === 'web' ? 67 : insets.top }]}>
        <View>
          <Text style={styles.greeting}>{greeting},</Text>
          <Text style={styles.userName}>{user?.name ?? 'Field Staff'}</Text>
          <Text style={styles.dateText}>{todayDate}</Text>
        </View>
        <View style={[styles.onlineDot, { backgroundColor: isOnline ? '#4ADE80' : '#9CA3AF' }]} />
      </View>

      <OfflineBanner />

      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 80 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={posLoading} onRefresh={refetch} tintColor={colors.primary} />
        }
      >
        {/* Queue status card */}
        {queue.length > 0 && (
          <TouchableOpacity
            style={styles.queueCard}
            onPress={processQueue}
            disabled={isSyncing}
            activeOpacity={0.8}
          >
            <View style={styles.queueLeft}>
              <Feather name="upload-cloud" size={18} color="#1D4ED8" />
              <View>
                <Text style={styles.queueTitle}>
                  {queue.length} action{queue.length !== 1 ? 's' : ''} queued
                </Text>
                <Text style={styles.queueSub}>Tap to sync when online</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={16} color="#6B7282" />
          </TouchableOpacity>
        )}

        {/* Quick actions */}
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>QUICK ACTIONS</Text>
        <View style={styles.actionsRow}>
          {QUICK_ACTIONS.map((a) => (
            <TouchableOpacity
              key={a.label}
              style={[styles.actionCard, { backgroundColor: colors.card }]}
              onPress={() => handleQuickAction(a.route)}
              activeOpacity={0.75}
            >
              <View style={[styles.actionIcon, { backgroundColor: a.color + '1A' }]}>
                <Feather name={a.icon} size={20} color={a.color} />
              </View>
              <Text style={[styles.actionLabel, { color: colors.foreground }]}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent POs */}
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground, marginTop: 24 }]}>
          RECENT PURCHASE ORDERS
        </Text>
        {posLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <View key={i} style={[styles.skeletonCard, { backgroundColor: colors.card }]}>
              <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '60%' }]} />
              <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '40%', marginTop: 8 }]} />
            </View>
          ))
        ) : recentPOs.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
            <Feather name="file-text" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No purchase orders yet</Text>
          </View>
        ) : (
          recentPOs.map((po) => (
            <TouchableOpacity
              key={po.id}
              style={[styles.poCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push(`/po/${po.id}` as never)}
              activeOpacity={0.8}
            >
              <View style={styles.poHeader}>
                <Text style={[styles.poNumber, { color: colors.foreground }]}>{po.poNumber}</Text>
                <View
                  style={[
                    styles.poStatusBadge,
                    {
                      backgroundColor:
                        po.status === 'FullyReceived'
                          ? '#DCFCE7'
                          : po.status === 'PartiallyReceived'
                          ? '#FEF9C3'
                          : po.status === 'Cancelled'
                          ? '#FEE2E2'
                          : '#EEF2F7',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.poStatusText,
                      {
                        color:
                          po.status === 'FullyReceived'
                            ? '#166534'
                            : po.status === 'PartiallyReceived'
                            ? '#854D0E'
                            : po.status === 'Cancelled'
                            ? '#991B1B'
                            : '#374151',
                      },
                    ]}
                  >
                    {po.status}
                  </Text>
                </View>
              </View>
              <Text style={[styles.poVendor, { color: colors.mutedForeground }]}>
                {po.vendorName}
              </Text>
              <Text style={[styles.poAmount, { color: colors.primary }]}>
                ₹{Number(po.amount).toLocaleString('en-IN')}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    backgroundColor: '#0B1229',
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  greeting: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#8D9CB8',
  },
  userName: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    marginTop: 2,
  },
  dateText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#8D9CB8',
    marginTop: 3,
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 4,
  },
  body: { paddingHorizontal: 16, paddingTop: 20 },
  queueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  queueLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  queueTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#1E40AF' },
  queueSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#3B82F6', marginTop: 2 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  actionsRow: { flexDirection: 'row', gap: 10 },
  actionCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  skeletonCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  skeletonLine: {
    height: 14,
    borderRadius: 7,
  },
  emptyState: {
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  poCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  poHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  poNumber: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  poStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  poStatusText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  poVendor: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 4 },
  poAmount: { fontSize: 15, fontFamily: 'Inter_700Bold', marginTop: 6 },
});
