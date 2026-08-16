import { describe, expect, it } from "vitest";
import { summarizeCommerce } from "./foreup-adapter";

function salesFixture() {
  return {
    data: [
      { id: "sale-1", type: "sales", relationships: { items: { data: [{ id: "item-1", type: "sales_items" }, { id: "item-2", type: "sales_items" }] } } },
      { id: "sale-2", type: "sales", relationships: { items: { data: [{ id: "item-3", type: "sales_items" }, { id: "item-4", type: "sales_items" }] } } }
    ],
    included: [
      { id: "item-1", type: "sales_items", attributes: { name: "Turn hot dog", category: "Food", department: "Snack Shack", quantity: 2, total: 14 } },
      { id: "item-2", type: "sales_items", attributes: { name: "Draft beer", category: "Beverage", location: "Bar", quantity: 1, total: 7 } },
      { id: "item-3", type: "sales_items", attributes: { name: "Protein snack box", category: "Food", quantity: 1, total: 11.5 } },
      { id: "item-4", type: "sales_items", attributes: { name: "Member account payment", category: "Payments", quantity: 1, total: 50 } }
    ]
  };
}

describe("summarizeCommerce", () => {
  it("separates explicitly tagged outlets and preserves ambiguous F&B for mapping", () => {
    const byDepartment = new Map(summarizeCommerce(salesFixture()).map((metric) => [metric.department, metric]));
    expect(byDepartment.get("snack_shack")).toMatchObject({ transactions: 1, unitsSold: 2, revenue: 14 });
    expect(byDepartment.get("bar")).toMatchObject({ transactions: 1, unitsSold: 1, revenue: 7 });
    expect(byDepartment.get("fnb_unassigned")).toMatchObject({ transactions: 1, unitsSold: 1, revenue: 11.5 });
    expect(byDepartment.get("pro_shop")).toMatchObject({ transactions: 0, unitsSold: 0, revenue: 0 });
  });
});
