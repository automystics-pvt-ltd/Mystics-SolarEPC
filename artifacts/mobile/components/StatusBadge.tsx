import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { useColors } from '@/hooks/useColors';

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary';

const STATUS_MAP: Record<string, Variant> = {
  // GRN / PO delivery
  Draft: 'neutral',
  Pending: 'warning',
  Approved: 'success',
  Rejected: 'danger',
  PartiallyReceived: 'warning',
  FullyReceived: 'success',
  // PO
  Sent: 'info',
  Cancelled: 'danger',
  Closed: 'neutral',
  // MR
  Open: 'primary',
  QuotationPending: 'warning',
  POGenerated: 'success',
  Fulfilled: 'success',
  // DPR
  Submitted: 'success',
  // Projects / generic
  Active: 'success',
  Inactive: 'neutral',
  InProgress: 'info',
  Completed: 'success',
  OnHold: 'warning',
};

function getVariant(status: string): Variant {
  return STATUS_MAP[status] ?? 'neutral';
}

interface Props {
  status: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'sm' }: Props) {
  const colors = useColors();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const variant = getVariant(status);

  const bg = {
    success: isDark ? colors.successBg : colors.successBg,
    warning: isDark ? colors.warningBg : colors.warningBg,
    danger: isDark ? colors.dangerBg : colors.dangerBg,
    info: isDark ? colors.infoBg : colors.infoBg,
    neutral: isDark ? colors.neutralBg : colors.neutralBg,
    primary: '#FFF7ED',
  }[variant];

  const textColor = {
    success: isDark ? colors.successText : colors.successText,
    warning: isDark ? colors.warningText : colors.warningText,
    danger: isDark ? colors.dangerText : colors.dangerText,
    info: isDark ? colors.infoText : colors.infoText,
    neutral: isDark ? colors.neutralText : colors.neutralText,
    primary: '#C2410C',
  }[variant];

  return (
    <View style={[styles.badge, { backgroundColor: bg }, size === 'md' && styles.badgeMd]}>
      <Text style={[styles.text, { color: textColor }, size === 'md' && styles.textMd]}>
        {status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  badgeMd: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  textMd: {
    fontSize: 12,
  },
});
