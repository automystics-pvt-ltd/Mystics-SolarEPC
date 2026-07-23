import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useOffline } from '@/context/OfflineContext';

export function OfflineBanner() {
  const { isOnline, queue, isSyncing, processQueue } = useOffline();

  if (isOnline && queue.length === 0) return null;

  if (isOnline && queue.length > 0) {
    return (
      <View style={[styles.banner, styles.syncBanner]}>
        {isSyncing ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Feather name="upload-cloud" size={13} color="#fff" />
        )}
        <Text style={styles.text}>
          {isSyncing ? 'Syncing…' : `${queue.length} item${queue.length !== 1 ? 's' : ''} ready to sync`}
        </Text>
        {!isSyncing && (
          <TouchableOpacity onPress={processQueue} style={styles.syncBtn}>
            <Text style={styles.syncBtnText}>Sync now</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.banner, styles.offlineBanner]}>
      <Feather name="wifi-off" size={13} color="#fff" />
      <Text style={styles.text}>
        Offline{queue.length > 0 ? ` · ${queue.length} queued` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 16,
    gap: 6,
  },
  offlineBanner: {
    backgroundColor: '#374151',
  },
  syncBanner: {
    backgroundColor: '#1D4ED8',
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  syncBtn: {
    marginLeft: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  syncBtnText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
});
