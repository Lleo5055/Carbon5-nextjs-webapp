// app/api/debug/ai-test/page.tsx

import React from 'react';
import { generateAIInsightForAllUsers } from '@/lib/aiInsightsCore';

export const dynamic = 'force-dynamic';

export default async function AITestPage() {
  try {
    const result = await generateAIInsightForAllUsers('last_12_months', 12);

    return (
      <div style={{ padding: '24px' }}>
        <h1>AI Test Insight (Debug)</h1>
        <pre>{JSON.stringify(result, null, 2)}</pre>
      </div>
    );
  } catch (e: any) {
    return (
      <div style={{ padding: '24px' }}>
        <h1>AI Test Insight (Debug)</h1>
        <div style={{ color: 'red' }}>
          Error: {e.message ?? 'Unknown error'}
        </div>
        <pre>{JSON.stringify(e, null, 2)}</pre>
      </div>
    );
  }
}
