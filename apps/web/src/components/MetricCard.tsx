"use client";

import { ReceiptText } from "lucide-react";

export function MetricCard({ label, value, note, Icon }: { label: string; value: string | number; note: string; Icon: typeof ReceiptText }) {
  return <article className="live-card"><Icon size={18} /><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}
