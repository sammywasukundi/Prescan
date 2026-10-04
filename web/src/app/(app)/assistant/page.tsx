import type { Metadata } from "next";
import { ChatPanel } from "@/components/ChatPanel";

export const metadata: Metadata = { title: "Assistant" };

export default function AssistantPage() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Assistant documentaire</h1>
      <ChatPanel />
    </div>
  );
}
