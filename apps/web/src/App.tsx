import { useEffect, useMemo, useState } from 'react';
import type { PlcStatus, TagSnapshot, TagValue } from '@helm/shared';
import Dashboard from './components/Dashboard';

interface SystemSummary {
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

function App() {
  const [summary, setSummary] = useState<SystemSummary | null>(null);
  const [tags, setTags] = useState<TagSnapshot[]>([]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
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
      } catch (requestError) {
        if (!isMounted) {
          return;
        }

        console.error('API Error:', requestError instanceof Error ? requestError.message : String(requestError));
      } finally {
        if (isMounted) {
          // Finished loading
        }
      }
    };

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 1500);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
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

    setTags((previous) =>
      previous.map((tag) => (tag.name === result.name ? result : tag)),
    );

    const nextSummary = await fetchJson<SystemSummary>('/api/system/summary');
    setSummary(nextSummary);
  };

  return (
    <div className="relative w-full h-full">
      <Dashboard
        plcConnected={summary?.plc.connected ?? false}
        dbConnected={!!summary?.database}
        plcMode={summary?.plc.mode ?? 'mock'}
        plcState={plcState}
        onWriteTag={writeTag}
      />

      {/* Floating System Summary removed and moved to Bottom Dock */}
    </div>
  );
}

export default App;
