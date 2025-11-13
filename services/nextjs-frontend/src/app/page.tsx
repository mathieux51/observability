'use client';

import { useEffect, useState } from 'react';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [pythonData, setPythonData] = useState<any>(null);
  const [goData, setGoData] = useState<any>(null);
  const [rustData, setRustData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Dynamically import telemetry to avoid SSR issues
    import('../lib/telemetry').then(({ initializeTelemetry }) => {
      initializeTelemetry();
    }).catch(err => {
      console.error('Failed to initialize telemetry:', err);
    });
  }, []);

  const fetchFromService = async (service: string, endpoint: string) => {
    setLoading(true);
    try {
      const url = `${endpoint}${service === 'data' ? '/data' : '/'}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (endpoint.includes('8001')) {
        setPythonData(data);
      } else if (endpoint.includes('8002')) {
        setGoData(data);
      } else if (endpoint.includes('8003')) {
        setRustData(data);
      }
    } catch (error) {
      console.error(`Error fetching from ${endpoint}:`, error);
    } finally {
      setLoading(false);
    }
  };

  const triggerError = async (endpoint: string) => {
    try {
      await fetch(`${endpoint}/error`);
    } catch (error) {
      console.error('Error triggered:', error);
    }
  };

  // Don't render until mounted to avoid hydration errors
  if (!mounted) {
    return <div style={{ padding: '2rem' }}>Loading...</div>;
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ marginBottom: '2rem' }}>Observability Stack Demo</h1>
      
      <div style={{ marginBottom: '2rem' }}>
        <h2>Real User Monitoring (RUM) is Active</h2>
        <p>All interactions on this page are being traced with OpenTelemetry</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        {/* Python Service */}
        <div style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: '8px' }}>
          <h2>Python Service</h2>
          <button 
            onClick={() => fetchFromService('root', 'http://localhost:8001')}
            style={{ marginRight: '0.5rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
          >
            Fetch Root
          </button>
          <button 
            onClick={() => fetchFromService('data', 'http://localhost:8001')}
            style={{ marginRight: '0.5rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
          >
            Fetch Data
          </button>
          <button 
            onClick={() => triggerError('http://localhost:8001')}
            style={{ padding: '0.5rem 1rem', cursor: 'pointer', background: '#ff4444', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            Trigger Error
          </button>
          {pythonData && (
            <pre style={{ marginTop: '1rem', background: '#f5f5f5', padding: '1rem', borderRadius: '4px', overflow: 'auto' }}>
              {JSON.stringify(pythonData, null, 2)}
            </pre>
          )}
        </div>

        {/* Go Service */}
        <div style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: '8px' }}>
          <h2>Go Service</h2>
          <button 
            onClick={() => fetchFromService('root', 'http://localhost:8002')}
            style={{ marginRight: '0.5rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
          >
            Fetch Root
          </button>
          <button 
            onClick={() => fetchFromService('data', 'http://localhost:8002')}
            style={{ marginRight: '0.5rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
          >
            Fetch Data
          </button>
          <button 
            onClick={() => triggerError('http://localhost:8002')}
            style={{ padding: '0.5rem 1rem', cursor: 'pointer', background: '#ff4444', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            Trigger Error
          </button>
          {goData && (
            <pre style={{ marginTop: '1rem', background: '#f5f5f5', padding: '1rem', borderRadius: '4px', overflow: 'auto' }}>
              {JSON.stringify(goData, null, 2)}
            </pre>
          )}
        </div>

        {/* Rust Service */}
        <div style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: '8px' }}>
          <h2>Rust Service</h2>
          <button 
            onClick={() => fetchFromService('root', 'http://localhost:8003')}
            style={{ marginRight: '0.5rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
          >
            Fetch Root
          </button>
          <button 
            onClick={() => fetchFromService('data', 'http://localhost:8003')}
            style={{ marginRight: '0.5rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
          >
            Fetch Data
          </button>
          <button 
            onClick={() => triggerError('http://localhost:8003')}
            style={{ padding: '0.5rem 1rem', cursor: 'pointer', background: '#ff4444', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            Trigger Error
          </button>
          {rustData && (
            <pre style={{ marginTop: '1rem', background: '#f5f5f5', padding: '1rem', borderRadius: '4px', overflow: 'auto' }}>
              {JSON.stringify(rustData, null, 2)}
            </pre>
          )}
        </div>
      </div>

      {loading && (
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <p>Loading...</p>
        </div>
      )}

      <div style={{ marginTop: '3rem', padding: '1rem', background: '#e3f2fd', borderRadius: '8px' }}>
        <h3>Observability Stack Access:</h3>
        <ul>
          <li><a href="http://localhost:3000" target="_blank" rel="noopener noreferrer">Grafana Dashboard</a> (localhost:3000)</li>
          <li><a href="http://localhost:9090" target="_blank" rel="noopener noreferrer">Prometheus</a> (localhost:9090)</li>
          <li><a href="http://localhost:3200" target="_blank" rel="noopener noreferrer">Tempo</a> (localhost:3200)</li>
          <li><a href="http://localhost:7280" target="_blank" rel="noopener noreferrer">Quickwit</a> (localhost:7280)</li>
        </ul>
      </div>
    </main>
  );
}
