'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MetabaseDashboard } from './MetabaseDashboard';

/** Dashboard tab config — labels shown in UI, keys must match METABASE_DASHBOARD_IDS env var */
const DASHBOARD_TABS = [
  { key: 'kpis', label: 'KPIs' },
  { key: 'funnels', label: 'Funnels' },
  { key: 'trends', label: 'Trends' },
] as const;

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<string>(DASHBOARD_TABS[0].key);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        {DASHBOARD_TABS.map((tab) => (
          <TabsTrigger key={tab.key} value={tab.key}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {DASHBOARD_TABS.map((tab) => (
        <TabsContent key={tab.key} value={tab.key}>
          {activeTab === tab.key && <MetabaseDashboard dashboardKey={tab.key} />}
        </TabsContent>
      ))}
    </Tabs>
  );
}
