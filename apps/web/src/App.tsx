import { useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeMessage, SystemSummary, TagSnapshot, TagValue } from '@helm/shared';
import Dashboard from './components/Dashboard';

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...init,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function mergeTags(previous: TagSnapshot[], incoming: TagSnapshot[]) {
  const incomingMap = new Map(incoming.map((tag) => [tag.name, tag]));
  const merged = previous.map((tag) => incomingMap.get(tag.name) ?? tag);

  for (const tag of incoming) {
    if (!merged.some((existing) => existing.name === tag.name)) {
      merged.push(tag);
    }
  }

  return merged;
}

function getWebSocketUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

function App() {
  const [summary, setSummary] = useState<SystemSummary | null>(null);
  const [tags, setTags] = useState<TagSnapshot[]>([]);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    let socket: WebSocket | null = null;

    const loadInitialSnapshot = async () => {
      try {
        const [summaryResponse, tagsResponse] = await Promise.all([
          fetchJson<SystemSummary>('/api/system/summary'),
          fetchJson<{ items: TagSnapshot[] }>('/api/tags?refresh=1'),
        ]);

        if (!isMounted) {
          return;
        }

        setSummary(summaryResponse);
        setTags(tagsResponse.items);
        setError(null);
      } catch (requestError) {
        if (!isMounted) {
          return;
        }

        setError(requestError instanceof Error ? requestError.message : String(requestError));
      }
    };

    const connect = () => {
      socket = new WebSocket(getWebSocketUrl());

      socket.onopen = () => {
        if (!isMounted) {
          return;
        }

        setIsRealtimeConnected(true);
        setError(null);
      };

      socket.onmessage = (event) => {
        if (!isMounted) {
          return;
        }

        try {
          const message = JSON.parse(event.data) as RealtimeMessage;

          if (message.type === 'hello') {
            setSummary(message.summary);
            setTags(message.tags);
            return;
          }

          if (message.type === 'summary') {
            setSummary(message.summary);
            return;
          }

          if (message.type === 'tags') {
            setTags((previous) => mergeTags(previous, message.tags));
            return;
          }

          if (message.type === 'error') {
            setError(message.message);
          }
        } catch (parseError) {
          setError(parseError instanceof Error ? parseError.message : String(parseError));
        }
      };

      socket.onclose = () => {
        if (!isMounted) {
          return;
        }

        setIsRealtimeConnected(false);
        reconnectTimerRef.current = window.setTimeout(connect, 2000);
      };

      socket.onerror = () => {
        if (!isMounted) {
          return;
        }

        setError('Realtime connection error');
      };
    };

    void loadInitialSnapshot();
    connect();

    return () => {
      isMounted = false;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      socket?.close();
    };
  }, []);

  const tagMap = useMemo(() => {
    return Object.fromEntries(tags.map((tag) => [tag.name, tag])) as Record<string, TagSnapshot>;
  }, [tags]);

  const plcState = useMemo(() => {
    const readBool = (name: string, fallback = false) => {
      const value = tagMap[name]?.value;
      return typeof value === 'boolean' ? value : fallback;
    };

    const readNumber = (name: string, fallback = 0) => {
      const value = tagMap[name]?.value;
      return typeof value === 'number' ? value : fallback;
    };

    return {
      deviceState: readNumber('device.state', 1),
      isRunning: readBool('device.running', false),
      isLightOn: readBool('device.light', true),
      isResetting: readBool('device.resetting', false),
      isInitializing: readBool('device.initializing', false),
      isFireEngaged: readBool('device.fire', false),
      isRunIndicatorOn: readBool('device.runIndicator', false),
      isSuctionShieldOn: readBool('device.suctionShield', false),
    };
  }, [tagMap]);

  const writeTag = async (name: string, value: TagValue) => {
    const result = await fetchJson<TagSnapshot>(`/api/tags/${encodeURIComponent(name)}/write`, {
      method: 'POST',
      body: JSON.stringify({
        value,
        operator: 'web-ui',
        source: 'dashboard',
      }),
    });

    setTags((previous) => mergeTags(previous, [result]));
  };

  return (
    <div className="relative w-full h-full">
      <Dashboard
        plcConnected={summary?.plc.connected ?? false}
        dbConnected={!!summary?.database}
        plcMode={`${summary?.plc.mode ?? 'mock'} / ${isRealtimeConnected ? 'ws' : 'reconnecting'}`}
        plcState={plcState}
        onWriteTag={writeTag}
      />

      {error ? (
        <div className="pointer-events-none absolute left-4 top-4 z-[9998] rounded-2xl border border-amber-400/30 bg-slate-950/80 px-4 py-3 text-sm text-amber-200 shadow-2xl backdrop-blur-md">
          {error}
        </div>
      ) : null}
    </div>
  );
}

export default App;
