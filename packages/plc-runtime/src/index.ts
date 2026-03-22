import {
  type PlcMode,
  type PlcStatus,
  type TagDataType,
  type TagSnapshot,
  type TagValue,
  parseTagValue,
} from '@helm/shared';

interface PlcRuntimeOptions {
  mode: PlcMode;
  host?: string;
  port: number;
  station?: number;
  timeout: number;
  initialTags: TagSnapshot[];
}

type KeyenceClient = {
  on(event: string, listener: (...args: unknown[]) => void): void;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  reconnect(): Promise<void>;
  isConnected(): boolean;
  read(address: string): Promise<string>;
  readInt16(address: string): Promise<number>;
  readUInt16(address: string): Promise<number>;
  readInt32(address: string): Promise<number>;
  readUInt32(address: string): Promise<number>;
  readBool(address: string): Promise<boolean>;
  readString(address: string, length: number): Promise<string>;
  write(address: string, value: number | string): Promise<boolean>;
  writeInt16(address: string, value: number): Promise<boolean>;
  writeUInt16(address: string, value: number): Promise<boolean>;
  writeInt32(address: string, value: number): Promise<boolean>;
  writeUInt32(address: string, value: number): Promise<boolean>;
  writeBool(address: string, value: boolean): Promise<boolean>;
  writeString(address: string, value: string): Promise<boolean>;
};

export class PlcRuntime {
  private readonly tagMap = new Map<string, TagSnapshot>();
  private readonly status: PlcStatus;
  private keyenceClient: KeyenceClient | null = null;

  constructor(private readonly options: PlcRuntimeOptions) {
    for (const tag of options.initialTags) {
      this.tagMap.set(tag.name, tag);
    }

    this.status = {
      mode: options.mode,
      connected: false,
      host: options.host ?? null,
      lastError: null,
      lastSyncAt: null,
    };
  }

  async start() {
    if (this.options.mode === 'mock') {
      this.status.connected = true;
      this.status.lastSyncAt = new Date().toISOString();
      this.seedMockTelemetry();
      return;
    }

    if (!this.options.host) {
      this.status.connected = false;
      this.status.lastError = 'PLC_HOST is empty';
      return;
    }

    try {
      const module = (await import('node-keyence-hostlink')) as unknown as {
        KeyencePLC?: new (options: Record<string, unknown>) => KeyenceClient;
        default?: {
          KeyencePLC?: new (options: Record<string, unknown>) => KeyenceClient;
        };
      };
      const KeyencePLC = module.KeyencePLC ?? module.default?.KeyencePLC;

      if (!KeyencePLC) {
        throw new Error('KeyencePLC export not found in node-keyence-hostlink');
      }

      this.keyenceClient = new KeyencePLC({
        host: this.options.host,
        port: this.options.port,
        station: this.options.station,
        timeout: this.options.timeout,
        autoReconnect: true,
        reconnectInterval: 3000,
      });

      this.keyenceClient.on('connected', () => {
        this.status.connected = true;
        this.status.lastError = null;
      });

      this.keyenceClient.on('disconnected', () => {
        this.status.connected = false;
      });

      this.keyenceClient.on('error', (error) => {
        this.status.lastError = error instanceof Error ? error.message : String(error);
      });

      await this.keyenceClient.connect();
      this.status.connected = this.keyenceClient.isConnected();
      await this.readAll();
    } catch (error) {
      this.status.connected = false;
      this.status.lastError = error instanceof Error ? error.message : String(error);
    }
  }

  async stop() {
    if (this.keyenceClient) {
      await this.keyenceClient.disconnect();
    }
  }

  async reconnect() {
    if (this.options.mode === 'mock') {
      this.status.connected = true;
      this.status.lastError = null;
      return;
    }

    if (!this.keyenceClient) {
      await this.start();
      return;
    }

    await this.keyenceClient.reconnect();
    this.status.connected = this.keyenceClient.isConnected();
  }

  getStatus(): PlcStatus {
    return { ...this.status };
  }

  listTags(): TagSnapshot[] {
    return Array.from(this.tagMap.values());
  }

  getTag(name: string): TagSnapshot | undefined {
    return this.tagMap.get(name);
  }

  async readTag(name: string): Promise<TagSnapshot | undefined> {
    const current = this.tagMap.get(name);
    if (!current) {
      return undefined;
    }

    const value = await this.readValue(current);
    const next: TagSnapshot = {
      ...current,
      value,
      source: this.options.mode === 'mock' ? 'mock' : 'plc',
      quality: this.status.connected ? 'good' : current.quality,
      updatedAt: new Date().toISOString(),
    };

    this.tagMap.set(name, next);
    this.status.lastSyncAt = next.updatedAt;
    return next;
  }

  async readAll(): Promise<TagSnapshot[]> {
    const names = Array.from(this.tagMap.keys());
    const tags: TagSnapshot[] = [];

    for (const name of names) {
      const tag = await this.readTag(name);
      if (tag) {
        tags.push(tag);
      }
    }

    return tags;
  }

  async writeTag(name: string, value: TagValue): Promise<TagSnapshot | undefined> {
    const current = this.tagMap.get(name);
    if (!current) {
      return undefined;
    }

    if (!current.writable) {
      throw new Error(`Tag ${name} is read-only`);
    }

    await this.writeValue(current, value);

    const next: TagSnapshot = {
      ...current,
      value: this.normalizeValue(current.dataType, value),
      quality: this.status.connected ? 'good' : current.quality,
      source: this.options.mode === 'mock' ? 'mock' : 'plc',
      updatedAt: new Date().toISOString(),
    };

    this.tagMap.set(name, next);
    this.status.lastSyncAt = next.updatedAt;
    return next;
  }

  private async readValue(tag: TagSnapshot): Promise<TagValue | null> {
    if (this.options.mode === 'mock' || !this.keyenceClient || !this.keyenceClient.isConnected()) {
      return this.tagMap.get(tag.name)?.value ?? null;
    }

    switch (tag.dataType) {
      case 'bool':
        return this.keyenceClient.readBool(tag.address);
      case 'int16':
        return this.keyenceClient.readInt16(tag.address);
      case 'uint16':
        return this.keyenceClient.readUInt16(tag.address);
      case 'int32':
        return this.keyenceClient.readInt32(tag.address);
      case 'uint32':
        return this.keyenceClient.readUInt32(tag.address);
      case 'string':
        return this.keyenceClient.readString(tag.address, tag.stringLength ?? 8);
      default:
        return parseTagValue(tag.dataType, await this.keyenceClient.read(tag.address));
    }
  }

  private async writeValue(tag: TagSnapshot, value: TagValue) {
    if (this.options.mode === 'mock' || !this.keyenceClient || !this.keyenceClient.isConnected()) {
      this.seedMockSideEffects(tag.name, value);
      return;
    }

    switch (tag.dataType) {
      case 'bool':
        await this.keyenceClient.writeBool(tag.address, Boolean(value));
        break;
      case 'int16':
        await this.keyenceClient.writeInt16(tag.address, Number(value));
        break;
      case 'uint16':
        await this.keyenceClient.writeUInt16(tag.address, Number(value));
        break;
      case 'int32':
        await this.keyenceClient.writeInt32(tag.address, Number(value));
        break;
      case 'uint32':
        await this.keyenceClient.writeUInt32(tag.address, Number(value));
        break;
      case 'string':
        await this.keyenceClient.writeString(tag.address, String(value));
        break;
      default:
        await this.keyenceClient.write(tag.address, String(value));
    }
  }

  private seedMockTelemetry() {
    const now = new Date().toISOString();
    const patch = (name: string, value: TagValue) => {
      const current = this.tagMap.get(name);
      if (!current) {
        return;
      }

      this.tagMap.set(name, {
        ...current,
        value,
        quality: 'good',
        source: 'mock',
        updatedAt: now,
      });
    };

    patch('device.state', 1);
    patch('device.running', false);
    patch('device.light', true);
    patch('device.resetting', false);
    patch('device.initializing', false);
    patch('device.fire', false);
    patch('device.runIndicator', false);
    patch('device.suctionShield', false);
    patch('system.temperature', 36);
    patch('system.pressure', 92);
  }

  private seedMockSideEffects(tagName: string, value: TagValue) {
    if (tagName === 'device.running') {
      this.patchMockTag('device.state', value ? 1 : 2);
    }

    if (tagName === 'device.initializing' && value) {
      this.patchMockTag('device.state', 3);
    }

    if (tagName === 'device.fire' && value) {
      this.patchMockTag('device.state', 4);
    }

    if (tagName === 'device.resetting' && value) {
      this.patchMockTag('device.state', 0);
    }

    if (tagName === 'device.state') {
      this.patchMockTag('device.running', Number(value) === 1);
    }

    this.patchMockTag(tagName, value);
    this.patchMockTag('system.temperature', 34 + Math.floor(Math.random() * 8));
    this.patchMockTag('system.pressure', 88 + Math.floor(Math.random() * 10));
  }

  private patchMockTag(name: string, value: TagValue) {
    const current = this.tagMap.get(name);
    if (!current) {
      return;
    }

    this.tagMap.set(name, {
      ...current,
      value: this.normalizeValue(current.dataType, value),
      quality: 'good',
      source: 'mock',
      updatedAt: new Date().toISOString(),
    });
  }

  private normalizeValue(dataType: TagDataType, value: TagValue): TagValue {
    if (dataType === 'bool') {
      return Boolean(value);
    }

    if (dataType === 'string') {
      return String(value);
    }

    return Number(value);
  }
}
