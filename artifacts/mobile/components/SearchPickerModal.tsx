import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export interface PickerItem {
  id: number;
  label: string;
  sublabel?: string;
}

interface SearchPickerModalProps {
  visible: boolean;
  title: string;
  items: PickerItem[];
  onSelect: (item: PickerItem) => void;
  onClose: () => void;
  loading?: boolean;
  /** Pass true when the device is offline so empty lists show a network-specific message. */
  isOffline?: boolean;
}

export function SearchPickerModal({
  visible,
  title,
  items,
  onSelect,
  onClose,
  loading = false,
  isOffline = false,
}: SearchPickerModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (it) =>
        it.label.toLowerCase().includes(q) ||
        (it.sublabel?.toLowerCase().includes(q) ?? false),
    );
  }, [items, query]);

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  const handleSelect = (item: PickerItem) => {
    setQuery('');
    onSelect(item);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              paddingBottom: Platform.OS === 'web' ? 24 : insets.bottom + 16,
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View
            style={[
              styles.searchWrap,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="search" size={15} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder="Search…"
              placeholderTextColor={colors.mutedForeground}
              value={query}
              onChangeText={setQuery}
              autoFocus
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Feather name="x-circle" size={15} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>

          {/* List */}
          {loading ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Loading…</Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather
                name={isOffline && items.length === 0 ? 'wifi-off' : 'inbox'}
                size={28}
                color={colors.mutedForeground}
                style={styles.emptyIcon}
              />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {isOffline && items.length === 0
                  ? 'No cached data available'
                  : items.length === 0
                  ? 'No items available'
                  : 'No results found'}
              </Text>
              {isOffline && items.length === 0 && (
                <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
                  Connect to the internet to load {title.toLowerCase()}
                </Text>
              )}
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(it) => String(it.id)}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.row, { borderBottomColor: colors.border }]}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowContent}>
                    <Text style={[styles.rowLabel, { color: colors.foreground }]} numberOfLines={1}>
                      {item.label}
                    </Text>
                    {item.sublabel ? (
                      <Text
                        style={[styles.rowSublabel, { color: colors.mutedForeground }]}
                        numberOfLines={1}
                      >
                        {item.sublabel}
                      </Text>
                    ) : null}
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowContent: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  rowSublabel: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  emptyState: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyIcon: { marginBottom: 12 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  emptyHint: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 6, opacity: 0.75 },
});
