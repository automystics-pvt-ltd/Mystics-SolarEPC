type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

// Respect env — suppress debug in production
const IS_DEV = import.meta.env.DEV;

function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
  if (!IS_DEV && level === 'debug') return;
  const entry: LogEntry = { level, message, context, timestamp: new Date().toISOString() };
  const style = {
    debug: 'color:#6b7280',
    info:  'color:#2563eb;font-weight:bold',
    warn:  'color:#d97706;font-weight:bold',
    error: 'color:#dc2626;font-weight:bold',
  }[level];
  console[level === 'debug' ? 'log' : level](`%c[${entry.timestamp.slice(11,19)}] [${level.toUpperCase()}] ${message}`, style, context ?? '');
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => log('debug', msg, ctx),
  info:  (msg: string, ctx?: Record<string, unknown>) => log('info', msg, ctx),
  warn:  (msg: string, ctx?: Record<string, unknown>) => log('warn', msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => log('error', msg, ctx),
};
