'use client';
import { useState } from 'react';

export default function TestAI() {
  const [result, setResult] = useState<any>(null);

  const runTest = async () => {
    try {
      const res = await fetch('/api/ai/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: '0ffe7504-1cf4-4b1f-b834-cfa05e05a60b',
          month: '2025-02-01',
        }),
      });

      const json = await res.json();
      console.log(json);
      setResult(json);
    } catch (err) {
      console.error(err);
      setResult({ error: err.message });
    }
  };

  return (
    <div style={{ padding: 40 }}>
      <button
        onClick={runTest}
        style={{
          padding: '10px 20px',
          background: 'black',
          color: 'white',
          borderRadius: 6,
        }}
      >
        Run AI Test
      </button>

      <pre style={{ marginTop: 20, whiteSpace: 'pre-wrap' }}>
        {JSON.stringify(result, null, 2)}
      </pre>
    </div>
  );
}
