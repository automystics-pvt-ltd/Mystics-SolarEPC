import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { formatINR } from '@/lib/currency';
import { StatusBadge } from '@/components/StatusBadge';
import { useGetPurchaseOrder, useGetPODeliveryStatus } from '@workspace/api-client-react';

function InfoRow({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={infoStyles.row}>
      <Text style={[infoStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[infoStyles.value, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  label: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  value: { fontSize: 13, fontFamily: 'Inter_600SemiBold', maxWidth: '60%', textAlign: 'right' },
});

export default function PODetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const router = useRouter();
  const numId = Number(id);

  const {
    data: po,
    isLoading: poLoading,
    isError: poError,
  } = useGetPurchaseOrder(numId);

  const {
    data: delivery,
    isLoading: deliveryLoading,
  } = useGetPODeliveryStatus(numId);

  if (poLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (poError || !po) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={36} color="#EF4444" />
        <Text style={[styles.errorText, { color: colors.foreground }]}>
          Purchase order not found
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: colors.primary }]}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* PO hero card */}
        <View style={[styles.heroCard, { backgroundColor: '#0B1229' }]}>
          <View style={styles.heroTop}>
            <Text style={styles.poNumber}>{po.poNumber}</Text>
            <StatusBadge status={po.status ?? 'Draft'} size="md" />
          </View>
          <Text style={styles.vendorName}>{po.vendorName}</Text>
          <Text style={styles.amount}>
            {formatINR(po.amount)}
          </Text>
          {po.poDate && (
            <Text style={styles.poDate}>
              Issued {new Date(po.poDate).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </Text>
          )}
        </View>

        {/* Details */}
        <View
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Order Details</Text>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <InfoRow label="PO Number" value={po.poNumber} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <InfoRow label="Status" value={po.status ?? '—'} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <InfoRow label="Vendor" value={po.vendorName} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <InfoRow
            label="Amount"
            value={formatINR(po.amount)}
          />
          {po.poDate && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <InfoRow
                label="PO Date"
                value={new Date(po.poDate).toLocaleDateString('en-IN')}
              />
            </>
          )}
          {po.projectId && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <InfoRow label="Project ID" value={String(po.projectId)} />
            </>
          )}
        </View>

        {/* Delivery status */}
        <View
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Delivery Status</Text>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {deliveryLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                Loading delivery data…
              </Text>
            </View>
          ) : delivery ? (
            <>
              {(delivery.lines ?? []).map((line, idx) => (
                <View key={idx}>
                  <View style={styles.deliveryRow}>
                    <Text style={[styles.deliveryItem, { color: colors.foreground }]}>
                      {line.itemName}
                    </Text>
                    <View style={styles.deliveryQtys}>
                      <View style={styles.qtyBlock}>
                        <Text style={[styles.qtyNum, { color: colors.primary }]}>
                          {line.receivedQty ?? 0}
                        </Text>
                        <Text style={[styles.qtyLabel, { color: colors.mutedForeground }]}>
                          received
                        </Text>
                      </View>
                      <Text style={[styles.qtySlash, { color: colors.mutedForeground }]}>/</Text>
                      <View style={styles.qtyBlock}>
                        <Text style={[styles.qtyNum, { color: colors.foreground }]}>
                          {line.orderedQty ?? 0}
                        </Text>
                        <Text style={[styles.qtyLabel, { color: colors.mutedForeground }]}>
                          ordered
                        </Text>
                      </View>
                    </View>
                  </View>
                  {idx < (delivery.lines ?? []).length - 1 && (
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  )}
                </View>
              ))}
              {(!delivery.lines || delivery.lines.length === 0) && (
                <View style={styles.noDelivery}>
                  <Feather name="package" size={22} color={colors.mutedForeground} />
                  <Text style={[styles.noDeliveryText, { color: colors.mutedForeground }]}>
                    No deliveries recorded yet
                  </Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.noDelivery}>
              <Feather name="package" size={22} color={colors.mutedForeground} />
              <Text style={[styles.noDeliveryText, { color: colors.mutedForeground }]}>
                No delivery data available
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 16, fontFamily: 'Inter_500Medium' },
  backBtn: { marginTop: 8 },
  backBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  body: { padding: 16, gap: 14 },
  heroCard: {
    borderRadius: 16,
    padding: 20,
    gap: 4,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  poNumber: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 8,
  },
  vendorName: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#8D9CB8',
  },
  amount: {
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
    color: '#F97316',
    marginTop: 8,
  },
  poDate: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#6B7A99',
    marginTop: 4,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    marginBottom: 12,
  },
  divider: { height: 1, marginVertical: 0 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  loadingText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  deliveryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  deliveryItem: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', marginRight: 8 },
  deliveryQtys: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBlock: { alignItems: 'center' },
  qtyNum: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  qtyLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 1 },
  qtySlash: { fontSize: 16, fontFamily: 'Inter_400Regular' },
  noDelivery: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  noDeliveryText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
});
