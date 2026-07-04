/**
 * Logger - Lightweight, configurable logging utility for debugging functional issues.
 *
 * Features:
 * - Log levels: DEBUG, INFO, WARN, ERROR
 * - Category-based filtering (enable/disable specific system logs)
 * - Structured output with timestamps, categories, and contextual data
 * - Zero-cost when disabled (checks level before formatting)
 * - Runtime configuration via window.__CORE_DEFENSE_LOG__ or localStorage
 *
 * Usage:
 *   import { Logger } from '../utils/logger';
 *   const log = Logger.create('Combat');
 *   log.info('Tower fired', { towerId, targetId, damage });
 *   log.debug('Targeting scan', { enemiesInRange: 3 });
 *
 * Runtime control (browser console):
 *   Logger.setLevel('DEBUG');           // Show all logs
 *   Logger.setLevel('WARN');            // Only warnings and errors
 *   Logger.enableCategory('Combat');    // Enable specific category
 *   Logger.disableCategory('Movement'); // Silence noisy category
 *   Logger.enableAll();                 // Enable all categories
 *   Logger.disableAll();                // Disable all categories
 *   Logger.status();                    // Show current configuration
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

export type LogCategory =
  | 'State'
  | 'Pipeline'
  | 'Phase'
  | 'Spawn'
  | 'Combat'
  | 'Movement'
  | 'Economy'
  | 'Entity'
  | 'Init'
  | 'Input'
  | 'GameLoop';

const LEVEL_LABELS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.NONE]: 'NONE',
};

const LEVEL_STYLES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'color: #888',
  [LogLevel.INFO]: 'color: #4fc3f7',
  [LogLevel.WARN]: 'color: #ffb74d',
  [LogLevel.ERROR]: 'color: #ef5350; font-weight: bold',
  [LogLevel.NONE]: '',
};

const CATEGORY_STYLES: Record<string, string> = {
  State: 'color: #ce93d8',
  Pipeline: 'color: #80cbc4',
  Phase: 'color: #a5d6a7',
  Spawn: 'color: #fff176',
  Combat: 'color: #ef9a9a',
  Movement: 'color: #90caf9',
  Economy: 'color: #ffe082',
  Entity: 'color: #b0bec5',
  Init: 'color: #c5e1a5',
  Input: 'color: #f48fb1',
  GameLoop: 'color: #80deea',
};

interface LogConfig {
  level: LogLevel;
  enabledCategories: Set<string>;
  allCategoriesEnabled: boolean;
}

const STORAGE_KEY = 'core_defense_log_config';

function loadConfig(): LogConfig {
  const defaults: LogConfig = {
    level: LogLevel.WARN,
    enabledCategories: new Set<string>(),
    allCategoriesEnabled: false,
  };

  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          level: parsed.level ?? defaults.level,
          enabledCategories: new Set(parsed.enabledCategories ?? []),
          allCategoriesEnabled: parsed.allCategoriesEnabled ?? false,
        };
      }
    }
  } catch {
    // Silently fall back to defaults
  }

  return defaults;
}

function saveConfig(config: LogConfig): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          level: config.level,
          enabledCategories: Array.from(config.enabledCategories),
          allCategoriesEnabled: config.allCategoriesEnabled,
        })
      );
    }
  } catch {
    // Silently ignore storage errors
  }
}

let config = loadConfig();

/**
 * A category-scoped logger instance. Created via Logger.create(category).
 */
export class CategoryLogger {
  private category: string;

  constructor(category: string) {
    this.category = category;
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, data);
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    // Early exit if below threshold or category disabled
    if (level < config.level) return;
    if (!config.allCategoriesEnabled && !config.enabledCategories.has(this.category)) return;

    const timestamp = formatTimestamp();
    const levelLabel = LEVEL_LABELS[level];
    const categoryStyle = CATEGORY_STYLES[this.category] || 'color: #aaa';
    const levelStyle = LEVEL_STYLES[level];

    const prefix = `%c[${timestamp}] %c[${levelLabel}] %c[${this.category}]%c`;
    const styles = [`color: #666`, levelStyle, categoryStyle, 'color: inherit'];

    if (data !== undefined) {
      const consoleFn = level === LogLevel.ERROR ? console.error
        : level === LogLevel.WARN ? console.warn
        : console.log;
      consoleFn(prefix, ...styles, message, data);
    } else {
      const consoleFn = level === LogLevel.ERROR ? console.error
        : level === LogLevel.WARN ? console.warn
        : console.log;
      consoleFn(prefix, ...styles, message);
    }
  }
}

function formatTimestamp(): string {
  const now = performance.now();
  const seconds = Math.floor(now / 1000);
  const ms = Math.floor(now % 1000);
  return `${seconds}.${ms.toString().padStart(3, '0')}`;
}

/**
 * Static Logger class - factory and global configuration.
 * Attach to window for runtime control from browser console.
 */
export class Logger {
  /**
   * Creates a scoped logger for a given category.
   */
  static create(category: LogCategory | string): CategoryLogger {
    return new CategoryLogger(category);
  }

  /**
   * Sets the minimum log level. Messages below this level are suppressed.
   */
  static setLevel(level: keyof typeof LogLevel): void {
    config.level = LogLevel[level];
    saveConfig(config);
    console.log(`[Logger] Level set to ${level}`);
  }

  /**
   * Enables logging for a specific category.
   */
  static enableCategory(category: string): void {
    config.enabledCategories.add(category);
    saveConfig(config);
    console.log(`[Logger] Category "${category}" enabled`);
  }

  /**
   * Disables logging for a specific category.
   */
  static disableCategory(category: string): void {
    config.enabledCategories.delete(category);
    saveConfig(config);
    console.log(`[Logger] Category "${category}" disabled`);
  }

  /**
   * Enables all categories (overrides individual settings).
   */
  static enableAll(): void {
    config.allCategoriesEnabled = true;
    saveConfig(config);
    console.log('[Logger] All categories enabled');
  }

  /**
   * Disables all categories (requires explicit enableCategory calls to see logs).
   */
  static disableAll(): void {
    config.allCategoriesEnabled = false;
    config.enabledCategories.clear();
    saveConfig(config);
    console.log('[Logger] All categories disabled');
  }

  /**
   * Prints the current logger configuration.
   */
  static status(): void {
    console.log('[Logger] Configuration:', {
      level: LEVEL_LABELS[config.level],
      allCategoriesEnabled: config.allCategoriesEnabled,
      enabledCategories: Array.from(config.enabledCategories),
    });
  }

  /**
   * Resets to default configuration (WARN level, no categories enabled).
   */
  static reset(): void {
    config = {
      level: LogLevel.WARN,
      enabledCategories: new Set(),
      allCategoriesEnabled: false,
    };
    saveConfig(config);
    console.log('[Logger] Reset to defaults');
  }
}

// Expose Logger on window for runtime debugging from browser console
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).Logger = Logger;
}
