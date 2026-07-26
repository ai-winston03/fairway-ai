import { foreup } from "./foreup-adapter";

export type MenuItem = {
  id: string;
  foreupItemId: string;
  name: string;
  category: "Breakfast" | "Drinks" | "Snacks" | "Grill";
  priceCents: number;
  available: boolean;
  prepMinutes: number;
};

export const menuItems: MenuItem[] = [
  {
    id: "menu_breakfast_burrito",
    foreupItemId: "fnb_1101",
    name: "Breakfast burrito",
    category: "Breakfast",
    priceCents: 975,
    available: true,
    prepMinutes: 12
  },
  {
    id: "menu_transfusion",
    foreupItemId: "fnb_2204",
    name: "Transfusion",
    category: "Drinks",
    priceCents: 850,
    available: true,
    prepMinutes: 3
  },
  {
    id: "menu_turn_dog",
    foreupItemId: "fnb_3308",
    name: "Turn hot dog",
    category: "Grill",
    priceCents: 700,
    available: true,
    prepMinutes: 8
  },
  {
    id: "menu_protein_box",
    foreupItemId: "fnb_4410",
    name: "Protein snack box",
    category: "Snacks",
    priceCents: 1150,
    available: true,
    prepMinutes: 5
  },
  {
    id: "menu_chicken_wrap",
    foreupItemId: "fnb_5512",
    name: "Grilled chicken wrap",
    category: "Grill",
    priceCents: 1395,
    available: true,
    prepMinutes: 15
  }
];

export function getPublicMenuUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_FAIRWAY_AI_URL ?? "https://winstons-mac-mini-1.tailddb8f5.ts.net/fairwayai";

  return `${baseUrl.replace(/\/$/, "")}/menu`;
}

export function getAvailableMenuItems() {
  return menuItems.filter((item) => item.available);
}

export async function getForeupMenu(courseId = "demo-course") {
  const foreupResponse = await foreup.listMenuItems(courseId);

  return {
    mode: foreupResponse.mode,
    courseId,
    menuUrl: getPublicMenuUrl(),
    items: getAvailableMenuItems(),
    note: "Live ForeUp items endpoint is mapped; menu presentation still requires its approved item-category mapping."
  };
}

export function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}
