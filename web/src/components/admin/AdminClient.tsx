"use client";

import { useState } from "react";
import { AccountsTab } from "./AccountsTab";
import { ModelsTab } from "./ModelsTab";
import { DocumentsTab } from "./DocumentsTab";
import { AuditTab } from "./AuditTab";

const TABS = [
  { id: "accounts", label: "Comptes" },
  { id: "models", label: "Modèles" },
  { id: "documents", label: "Documents de l'assistant" },
  { id: "audit", label: "Journal d'audit" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function AdminClient({ currentUserId }: { currentUserId: string }) {
  const [tab, setTab] = useState<TabId>("accounts");

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Sections d'administration" className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.id ? "border-primary text-primary" : "border-transparent text-muted hover:text-fg"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "accounts" && <AccountsTab currentUserId={currentUserId} />}
        {tab === "models" && <ModelsTab />}
        {tab === "documents" && <DocumentsTab />}
        {tab === "audit" && <AuditTab />}
      </div>
    </div>
  );
}
