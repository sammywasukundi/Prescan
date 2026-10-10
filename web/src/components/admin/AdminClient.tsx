"use client";

import { useState } from "react";
import { AccountsTab } from "./AccountsTab";
import { ModelsTab } from "./ModelsTab";
import { DocumentsTab } from "./DocumentsTab";
import { AuditTab } from "./AuditTab";
import { useI18n } from "@/lib/i18n/client";

const TABS = [
  { id: "accounts", key: "adm.tab.accounts" },
  { id: "models", key: "adm.tab.models" },
  { id: "documents", key: "adm.tab.documents" },
  { id: "audit", key: "adm.tab.audit" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function AdminClient({ currentUserId }: { currentUserId: string }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<TabId>("accounts");

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label={t("adm.tabsAria")} className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            role="tab"
            id={`tab-${tb.id}`}
            aria-selected={tab === tb.id}
            aria-controls={`panel-${tb.id}`}
            type="button"
            onClick={() => setTab(tb.id)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === tb.id ? "border-primary text-primary" : "border-transparent text-muted hover:text-fg"
            }`}
          >
            {t(tb.key)}
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
