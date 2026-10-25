"use client";

import { useState } from "react";
import { Badge, Button, Card, EmptyState, useToast } from "@/components/ui";
import { approveFromName, rejectFromName } from "./actions";

export interface PendingName {
  workspaceId: string;
  workspaceName: string;
  requestedName: string;
  blockReason: string | null;
  requestedAt: string; // সার্ভারে আগেই Asia/Dhaka ফরম্যাট করা
}

// ব্লক-তালিকায় পড়া From নামের অনুরোধ — সুপার অ্যাডমিন অনুমোদন বা বাতিল করেন
export default function PendingFromNames({ items }: { items: PendingName[] }) {
  const { showToast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function review(workspaceId: string, approve: boolean) {
    setBusyId(workspaceId);
    const result = approve ? await approveFromName(workspaceId) : await rejectFromName(workspaceId);
    setBusyId(null);
    if (result.error) showToast("error", result.error);
    else showToast("success", approve ? "অনুমোদিত হয়েছে" : "বাতিল করা হয়েছে");
  }

  return (
    <Card>
      <p className="mb-3 text-sm font-semibold text-text">From নামের অনুমোদন ({items.length})</p>
      {items.length === 0 ? (
        <EmptyState title="কোনো অনুরোধ অপেক্ষমান নেই" />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((item) => {
            const term = item.blockReason?.startsWith("blocked_term:") ? item.blockReason.slice("blocked_term:".length) : null;
            return (
              <li key={item.workspaceId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-text">&quot;{item.requestedName}&quot;</p>
                  <p className="text-xs text-text-muted">
                    ওয়ার্কস্পেস: {item.workspaceName} · {item.requestedAt}
                  </p>
                  {term && (
                    <Badge variant="warning" className="mt-1">
                      সংরক্ষিত শব্দ: {term}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" loading={busyId === item.workspaceId} onClick={() => review(item.workspaceId, false)}>
                    বাতিল
                  </Button>
                  <Button loading={busyId === item.workspaceId} onClick={() => review(item.workspaceId, true)}>
                    অনুমোদন
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
