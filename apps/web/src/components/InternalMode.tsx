"use client";

import { CalendarClock, ChevronRight, Flag, LogOut, ShoppingBag, Users, Utensils, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { TeamUser } from "@/lib/bot-config";
import { can, roleLabels } from "@/lib/authz";
import { firebaseAuth, firebaseEnabled } from "@/lib/firebase-client";
import { InternalDashboard, OperationsArea } from "@/components/InternalDashboard";
import { InternalLogin } from "@/components/InternalLogin";
import { UserAccessManager } from "@/components/UserAccessManager";

const nav: Array<{ id: OperationsArea; label: string; icon: typeof Flag; children: string[] }> = [
  { id: "golf", label: "Golf", icon: Flag, children: ["Overview", "Member play", "Non-member play", "Tee sheet"] },
  { id: "pro-shop", label: "Pro Shop", icon: ShoppingBag, children: ["Overview", "Sales", "Inventory"] },
  { id: "clubhouse", label: "Clubhouse", icon: Utensils, children: ["Overview", "Food & beverage", "Events"] },
  { id: "members", label: "Members", icon: Users, children: ["Directory", "Activity", "Accounts"] },
  { id: "automations", label: "Automations", icon: CalendarClock, children: ["Rules", "Schedule", "History"] },
  { id: "platform", label: "Platform", icon: Wrench, children: ["Connections", "Data sync", "Access"] }
];

export function InternalMode() {
  const [user, setUser] = useState<TeamUser | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [activeArea, setActiveArea] = useState<OperationsArea>("golf");
  const [activeTab, setActiveTab] = useState("Overview");
  const [expandedArea, setExpandedArea] = useState<OperationsArea>("golf");
  useEffect(() => {
    if (!firebaseAuth) return;
    return onAuthStateChanged(firebaseAuth, async (account) => {
      if (!account) { setUser(null); return; }
      try {
        const token = await account.getIdToken();
        const response = await fetch("/api/access/me", { headers: { authorization: `Bearer ${token}` } });
        const payload = await response.json() as { profile?: TeamUser; error?: string };
        if (!response.ok || !payload.profile) throw new Error(payload.error ?? "Access was not granted.");
        setUser(payload.profile); setAccessError(null);
      } catch (error) { setUser(null); setAccessError(error instanceof Error ? error.message : "Access was not granted."); }
    });
  }, []);
  if (!user) return <InternalLogin error={accessError} />;
  return <div className="workspace-shell">
    <aside className="workspace-nav" aria-label="Yuba Golf Club navigation">
      <div className="workspace-brand"><span>YG</span><div><strong>Yuba Golf Club</strong><small>Operations</small></div></div>
      <nav>{nav.map((item) => { const Icon = item.icon; const expanded = expandedArea === item.id; return <div className="nav-group" key={item.id}>
        <button aria-expanded={expanded} className={activeArea === item.id ? "active" : ""} onClick={() => { setActiveArea(item.id); setActiveTab(item.children[0]); setExpandedArea(expanded ? "" as OperationsArea : item.id); }} type="button"><Icon size={17} /><span>{item.label}</span><ChevronRight className={expanded ? "rotate" : ""} size={15} /></button>
        {expanded && <div className="nav-submenu">{item.children.map((child) => <button className={activeArea === item.id && activeTab === child ? "active" : ""} key={child} onClick={() => { setActiveArea(item.id); setActiveTab(child); }} type="button">{child}</button>)}</div>}
      </div>; })}</nav>
      <div className="workspace-nav-footer"><span><i />Live data</span><small>ForeUp · Yuba Golf Club</small></div>
    </aside>
    <main className="workspace-main"><header className="workspace-header"><div><div className="eyebrow">Yuba Golf Club</div><h1>Operations desk</h1></div><div><span>{user.name} · {roleLabels[user.role]}</span><button onClick={() => firebaseAuth ? void signOut(firebaseAuth) : setUser(null)} type="button"><LogOut size={15} /> Sign out</button></div></header>{activeArea === "platform" && can(user, "users:manage") ? <UserAccessManager /> : <InternalDashboard area={activeArea} requestedTab={activeTab} />}</main>
  </div>;
}
