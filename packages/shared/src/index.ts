import { z } from 'zod';

export type PlcMode = 'mock' | 'keyence';
export type TagDataType = 'bool' | 'int16' | 'uint16' | 'int32' | 'uint32' | 'string';
export type TagQuality = 'good' | 'bad' | 'unknown';
export type TagValue = boolean | number | string;

export interface TagDefinition {
  name: string;
  address: string;
  dataType: TagDataType;
  writable: boolean;
  description: string;
  unit?: string;
  stringLength?: number;
}

export interface TagSnapshot extends TagDefinition {
  value: TagValue | null;
  quality: TagQuality;
  updatedAt: string | null;
  source: 'db' | 'plc' | 'mock';
}

export interface PlcStatus {
  mode: PlcMode;
  connected: boolean;
  host: string | null;
  lastError: string | null;
  lastSyncAt: string | null;
}

export interface SystemSummary {
  appName: string;
  apiVersion: string;
  serverTime: string;
  plc: PlcStatus;
  database: {
    path: string;
    tagCount: number;
    auditCount: number;
  };
}

export type RealtimeMessage =
  | {
      type: 'hello';
      summary: SystemSummary;
      tags: TagSnapshot[];
    }
  | {
      type: 'summary';
      summary: SystemSummary;
    }
  | {
      type: 'tags';
      tags: TagSnapshot[];
    }
  | {
      type: 'error';
      message: string;
    };

export const tagValueSchema = z.union([z.boolean(), z.number(), z.string()]);

export const writeTagBodySchema = z.object({
  value: tagValueSchema,
  operator: z.string().min(1).optional(),
  source: z.string().min(1).optional(),
});

export const DEFAULT_TAG_DEFINITIONS: TagDefinition[] = [
  { name: 'device.state', address: 'DM50210', dataType: 'int16', writable: true, description: '设备状态' },
  { name: 'device.running', address: 'MR100', dataType: 'bool', writable: true, description: '运行状态' },
  { name: 'device.light', address: 'R100', dataType: 'bool', writable: true, description: '照明开关' },
  { name: 'device.resetting', address: 'MR101', dataType: 'bool', writable: true, description: '复位动作' },
  { name: 'device.initializing', address: 'MR102', dataType: 'bool', writable: true, description: '初始化动作' },
  { name: 'device.fire', address: 'R101', dataType: 'bool', writable: true, description: '加热点火' },
  { name: 'device.runIndicator', address: 'R102', dataType: 'bool', writable: true, description: '运行指示灯' },
  { name: 'device.suctionShield', address: 'R103', dataType: 'bool', writable: true, description: '吸风罩' },
  { name: 'system.temperature', address: 'DM200', dataType: 'int16', writable: false, description: '系统温度', unit: '°C' },
  { name: 'system.pressure', address: 'DM201', dataType: 'int16', writable: false, description: '系统压力', unit: 'kPa' }
];

export function getDefaultValueByType(dataType: TagDataType): TagValue {
  if (dataType === 'bool') {
    return false;
  }

  if (dataType === 'string') {
    return '';
  }

  return 0;
}

export function stringifyTagValue(value: TagValue | null): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value);
}

export function parseTagValue(dataType: TagDataType, raw: unknown): TagValue | null {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }

  if (dataType === 'bool') {
    if (typeof raw === 'boolean') {
      return raw;
    }

    return raw === 'true' || raw === '1' || raw === 1;
  }

  if (dataType === 'string') {
    return String(raw);
  }

  if (typeof raw === 'number') {
    return raw;
  }

  const parsed = Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
}
