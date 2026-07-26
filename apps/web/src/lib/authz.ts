export type StaffRole = "employee" | "department-manager" | "owner" | "admin";

export type Department = "pro-shop" | "fnb" | "membership" | "finance" | "operations";

export type Permission =
  | "member:lookup"
  | "member:message"
  | "workflow:view"
  | "workflow:manage"
  | "kpi:view:pro-shop"
  | "kpi:view:fnb"
  | "kpi:view:membership"
  | "kpi:view:finance"
  | "kpi:view:labor"
  | "kpi:view:all"
  | "settings:manage"
  | "users:manage";

export type TeamAccessProfile = {
  name: string;
  email: string;
  role: StaffRole;
  department: Department;
  permissions: Permission[];
  kpiGroups: string[];
};

export const roleLabels: Record<StaffRole, string> = {
  employee: "General employee",
  "department-manager": "Department manager",
  owner: "Owner",
  admin: "Admin"
};

export const kpiGroupCatalog = [
  {
    id: "pro-shop",
    label: "Pro shop",
    metrics: ["Rounds", "Carts", "Guest attach", "Tee sheet utilization"]
  },
  {
    id: "fnb",
    label: "Food & beverage",
    metrics: ["Pre-orders", "Average order", "Menu movement", "Turn orders"]
  },
  {
    id: "membership",
    label: "Membership",
    metrics: ["Leads", "Guest conversion", "New members", "Member activity"]
  },
  {
    id: "finance",
    label: "Finance",
    metrics: ["AR", "Account holds", "Charge approvals", "Sales"]
  },
  {
    id: "labor",
    label: "Labor",
    metrics: ["Headcount", "Hours", "Overtime", "Labor %", "Payroll import"]
  }
];

export const demoAccessProfiles: TeamAccessProfile[] = [
  {
    name: "General Employee",
    email: "staff@club.example",
    role: "employee",
    department: "operations",
    permissions: ["member:lookup", "member:message", "workflow:view"],
    kpiGroups: []
  },
  {
    name: "F&B Manager",
    email: "fnb@club.example",
    role: "department-manager",
    department: "fnb",
    permissions: ["member:lookup", "member:message", "workflow:view", "kpi:view:fnb", "kpi:view:labor"],
    kpiGroups: ["fnb", "labor"]
  },
  {
    name: "Head Professional",
    email: "proshop@club.example",
    role: "department-manager",
    department: "pro-shop",
    permissions: ["member:lookup", "member:message", "workflow:view", "kpi:view:pro-shop"],
    kpiGroups: ["pro-shop"]
  },
  {
    name: "Owner",
    email: "owner@club.example",
    role: "owner",
    department: "operations",
    permissions: [
      "member:lookup",
      "member:message",
      "workflow:view",
      "workflow:manage",
      "kpi:view:all",
      "settings:manage",
      "users:manage"
    ],
    kpiGroups: ["pro-shop", "fnb", "membership", "finance", "labor"]
  },
  {
    name: "Admin",
    email: "admin@club.example",
    role: "admin",
    department: "operations",
    permissions: [
      "member:lookup",
      "member:message",
      "workflow:view",
      "workflow:manage",
      "kpi:view:all",
      "settings:manage",
      "users:manage"
    ],
    kpiGroups: ["pro-shop", "fnb", "membership", "finance", "labor"]
  }
];

export function can(profile: TeamAccessProfile, permission: Permission) {
  return profile.permissions.includes(permission) || profile.permissions.includes("kpi:view:all");
}

export function visibleKpiGroups(profile: TeamAccessProfile) {
  if (profile.permissions.includes("kpi:view:all")) return kpiGroupCatalog;

  return kpiGroupCatalog.filter((group) => profile.kpiGroups.includes(group.id));
}
