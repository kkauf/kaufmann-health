'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function ConfirmSuccessFallback() {
  const [leadId, setLeadId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const id = window.localStorage.getItem('leadId');
      if (id) {
        setLeadId(id);
        // Seamless redirect to preferences when we know the lead id
        window.location.replace(`/fragebogen/confirmed?confirm=1&id=${encodeURIComponent(id)}`);
      }
    } catch {
      // ignore
    }
  }, []);

  const href = leadId ? `/fragebogen/confirmed?confirm=1&id=${encodeURIComponent(leadId)}` : '/therapie-finden';

  return (
    <div className="flex gap-3">
      <Button asChild>
        <Link href={href} aria-label="Zum Fragebogen">
          Zum Fragebogen
        </Link>
      </Button>
    </div>
  );
}
