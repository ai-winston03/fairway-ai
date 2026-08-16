export type ForeupConfig = {
  baseUrl: string;
  token?: string;
  email?: string;
  password?: string;
};

export type BookingRequest = {
  courseId: string;
  teeSheetId: string;
  customerId: string;
  playerCount: number;
  guestCount: number;
  requestedDate: string;
  requestedWindow: string;
  carts: number;
};

type JsonApiResource = {
  id: string;
  type: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, { data?: JsonApiResource | JsonApiResource[] | null }>;
};

type JsonApiDocument = {
  data?: JsonApiResource | JsonApiResource[];
  included?: JsonApiResource[];
  meta?: { warnings?: string[]; total?: number };
};

export type ForeupTeeSheetStats = {
  date: string;
  bookings: number;
  occupancy: number;
  playersCheckedIn: number;
  playerNoShows: number;
  potentialSlots: number;
  slotsAvailable: number;
  revenue: number;
};

export type GolfSegment = {
  rounds: number;
  bookings: number;
  carts: number;
  greenFeeRevenue: number;
};

export type ForeupCustomer = {
  id: string;
  accountNumber: string;
  name: string;
  phone: string;
  email: string;
  member: boolean;
  membershipGroups: string[];
  priceClassId: string;
  accountBalance: number;
  invoiceBalance: number;
  optOutText: boolean;
  optOutEmail: boolean;
  status: number;
  city: string;
  state: string;
  handicap: string;
};

export type ForeupGolfSnapshot = {
  today: ForeupTeeSheetStats;
  period: { start: string; end: string; label: string };
  member: GolfSegment;
  nonMember: GolfSegment;
  unclassifiedRounds: number;
  priceClasses: string[];
  sourceBookings: number;
  /** Present for database-backed reports.  Raw ForeUp snapshots remain usable
   * by the sync code without manufacturing a daily time series. */
  daily?: Array<{
    date: string;
    rounds: number;
    bookings: number;
    occupancy: number;
    potentialSlots: number;
    slotsAvailable: number;
    revenue: number;
    greenFeeRevenue: number;
  }>;
  commerce?: ForeupCommerceMetric[];
};

/** A sale can span outlets, so transaction counts are outlet-attributed—not
 * unique whole-receipt counts across the entire clubhouse. */
export type ForeupCommerceDepartment = "pro_shop" | "snack_shack" | "bar" | "fnb_unassigned";
export type ForeupCommerceMetric = {
  department: ForeupCommerceDepartment;
  transactions: number;
  unitsSold: number;
  revenue: number;
};

export type ForeupUpcomingTeeTime = {
  id: string;
  startsAt: string;
  title: string;
  players: number;
  carts: number;
  status: string;
};

export class ForeupAdapter {
  constructor(private readonly config: ForeupConfig) {}

  async createToken() {
    if (!this.config.email || !this.config.password) throw new Error("ForeUp API credentials are not configured.");

    const response = await fetch(`${this.config.baseUrl}/tokens`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: this.config.email, password: this.config.password }),
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`ForeUp token request failed (${response.status}).`);

    const body = (await response.json()) as { data?: { id?: string } };
    if (!body.data?.id) throw new Error("ForeUp token response did not include a token.");
    return body.data.id;
  }

  async listCourses() {
    return this.request("/courses");
  }

  async listTeeSheets(courseId: string) {
    return this.request(`/courses/${courseId}/teesheets`);
  }

  async listPriceClasses(courseId: string, token?: string) {
    return this.request(`/courses/${courseId}/priceClasses`, token);
  }

  async listMenuItems(courseId: string) {
    return { mode: "live" as const, data: await this.request(`/courses/${courseId}/items`) };
  }

  async listCustomers(courseId: string): Promise<ForeupCustomer[]> {
    const token = await this.createToken();
    const first = await this.request(`/courses/${courseId}/customers?limit=100&start=0`, token);
    const firstPage = Array.isArray(first.data) ? first.data : [];
    const total = Number(first.meta?.total ?? firstPage.length);
    const remainingStarts = Array.from({ length: Math.ceil(Math.max(0, total - 100) / 100) }, (_, index) => (index + 1) * 100);
    const remaining = await Promise.all(remainingStarts.map((start) => this.request(`/courses/${courseId}/customers?limit=100&start=${start}`, token)));
    return [firstPage, ...remaining.map((page) => Array.isArray(page.data) ? page.data : [])].flat().map(mapCustomer);
  }

  async createBooking(_request: BookingRequest): Promise<never> {
    throw new Error("Live booking creation is intentionally disabled until an approved booking workflow is implemented.");
  }

  async getTeeSheetStats(courseId: string, teeSheetId: string, date: string, token?: string): Promise<ForeupTeeSheetStats> {
    const body = await this.request(`/courses/${courseId}/teesheets/${teeSheetId}/stats?date=${encodeURIComponent(date)}`, token);
    const resource = body.data as JsonApiResource | undefined;
    const a = resource?.attributes;
    if (!a) throw new Error("ForeUp tee-sheet stats response was empty.");

    return {
      date: resource?.id ?? date,
      bookings: numberAt(a, "bookings"),
      occupancy: numberAt(a, "occupancy"),
      playersCheckedIn: numberAt(a, "playersCheckedIn"),
      playerNoShows: numberAt(a, "playerNoShows"),
      potentialSlots: numberAt(a, "potentialSlots", "potential_slots"),
      slotsAvailable: numberAt(a, "slotsAvailable", "slots_available"),
      revenue: numberAt(a, "revenue")
    };
  }

  async listBookings(courseId: string, teeSheetId: string, startDate: string, endDate: string, token?: string) {
    const auth = token ?? await this.createToken();
    const all: JsonApiResource[] = [];
    const included = new Map<string, JsonApiResource>();
    for (let start = 0; start < 50000; start += 500) {
      const pages = await Promise.all([0, 100, 200, 300, 400].map(async (offset) => {
        const query = new URLSearchParams({ startDate, endDate, include: "players,sales,sales.items", limit: "100", start: String(start + offset) });
        return this.request(`/courses/${courseId}/teesheets/${teeSheetId}/bookings?${query.toString()}`, auth);
      }));
      const lengths = pages.map((body) => Array.isArray(body.data) ? body.data.length : 0);
      for (const body of pages) {
        if (Array.isArray(body.data)) all.push(...body.data);
        for (const record of body.included ?? []) included.set(`${record.type}:${record.id}`, record);
      }
      if (lengths.some((length) => length < 100)) break;
    }
    return { data: all, included: [...included.values()] };
  }

  /** Full POS ledger: includes standalone snack-shack, restaurant/bar, and
   * counter sales—not merely purchases attached to a tee time. */
  async listSales(courseId: string, startDate: string, endDate: string, token?: string) {
    const auth = token ?? await this.createToken();
    // ForeUp's sales date filter is end-exclusive.  A same-day reporting sync
    // therefore needs the following calendar day as the endpoint's end date.
    const exclusiveEndDate = nextIsoDate(endDate);
    const all: JsonApiResource[] = [];
    const included = new Map<string, JsonApiResource>();
    for (let start = 0; start < 50000; start += 500) {
      const pages = await Promise.all([0, 100, 200, 300, 400].map(async (offset) => {
        const query = new URLSearchParams({ startDate, endDate: exclusiveEndDate, include: "items,payments", limit: "100", start: String(start + offset) });
        return this.request(`/courses/${courseId}/sales?${query.toString()}`, auth);
      }));
      const lengths = pages.map((body) => Array.isArray(body.data) ? body.data.length : 0);
      for (const body of pages) {
        if (Array.isArray(body.data)) all.push(...body.data);
        for (const record of body.included ?? []) included.set(`${record.type}:${record.id}`, record);
      }
      if (lengths.some((length) => length < 100)) break;
    }
    return { data: all, included: [...included.values()] };
  }

  async listUpcomingBookingsForCustomer(courseId: string, teeSheetId: string, customerId: string, startDate: string, endDate: string): Promise<ForeupUpcomingTeeTime[]> {
    const token = await this.createToken();
    const query = new URLSearchParams({ startDate, endDate, include: "players", limit: "100", start: "0", "filter[customerId]": customerId });
    const document = await this.request(`/courses/${courseId}/teesheets/${teeSheetId}/bookings?${query.toString()}`, token);
    const bookings = Array.isArray(document.data) ? document.data : [];
    return bookings
      .filter((booking) => booking.attributes?.isReround !== true && booking.attributes?.status !== "deleted")
      .map((booking) => {
        const attributes = booking.attributes ?? {};
        return {
          id: booking.id,
          startsAt: String(attributes.start ?? ""),
          title: String(attributes.title ?? "Tee time"),
          players: numberAt(attributes, "playerCount", "players"),
          carts: numberAt(attributes, "carts"),
          status: String(attributes.status ?? "confirmed")
        };
      })
      .filter((booking) => booking.startsAt)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  async getGolfSnapshot(courseId: string, teeSheetId: string, period: { start: string; end: string; label: string }, todayDate = period.end) {
    const token = await this.createToken();
    const [today, priceClasses, bookings, sales] = await Promise.all([
      this.getTeeSheetStats(courseId, teeSheetId, todayDate, token),
      this.listPriceClasses(courseId, token),
      this.listBookings(courseId, teeSheetId, period.start, period.end, token),
      this.listSales(courseId, period.start, period.end, token)
    ]);
    return { ...summarizeGolf(today, period, priceClasses, bookings), commerce: summarizeCommerce(sales) };
  }

  private async request(path: string, token?: string): Promise<JsonApiDocument> {
    const auth = token ?? await this.createToken();
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      headers: { "x-authorization": `Bearer ${auth}` },
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`ForeUp ${path.split("?")[0]} request failed (${response.status}).`);
    return response.json() as Promise<JsonApiDocument>;
  }
}

function summarizeGolf(today: ForeupTeeSheetStats, period: ForeupGolfSnapshot["period"], priceClassDocument: JsonApiDocument, bookings: { data: JsonApiResource[]; included: JsonApiResource[] }): ForeupGolfSnapshot {
  const classes = Array.isArray(priceClassDocument.data) ? priceClassDocument.data : [];
  const classById = new Map(classes.map((item) => [item.id, String(item.attributes?.name ?? "Unclassified")]));
  const includedByKey = new Map(bookings.included.map((item) => [`${item.type}:${item.id}`, item]));
  const member: GolfSegment = { rounds: 0, bookings: 0, carts: 0, greenFeeRevenue: 0 };
  const nonMember: GolfSegment = { rounds: 0, bookings: 0, carts: 0, greenFeeRevenue: 0 };
  let unclassifiedRounds = 0;

  for (const booking of bookings.data) {
    const attributes = booking.attributes ?? {};
    if (attributes.isReround === true || attributes.status === "deleted") continue;
    const carts = numberAt(attributes, "carts");
    const sales = relationshipRecords(booking, "sales", includedByKey);
    let memberPlayers = 0;
    let nonMemberPlayers = 0;
    for (const sale of sales) {
      const items = bookings.included.filter((item) => item.type === "sales_items" && String(item.attributes?.sale_id ?? "") === sale.id);
      for (const item of items) {
        const a = item.attributes ?? {};
        if (String(a.category ?? "").toLowerCase() !== "green fees") continue;
        const segment = isMemberClass(String(a.priceClass ?? classById.get(String(a.priceClassId ?? "")) ?? "")) ? member : nonMember;
        const players = numberAt(a, "player_count", "quantity");
        if (segment === member) memberPlayers += players;
        else nonMemberPlayers += players;
        segment.rounds += players;
        segment.greenFeeRevenue += numberAt(a, "total");
      }
    }
    const classifiedPlayers = memberPlayers + nonMemberPlayers;
    if (memberPlayers) { member.bookings += 1; member.carts += proportional(carts, memberPlayers, classifiedPlayers); }
    if (nonMemberPlayers) { nonMember.bookings += 1; nonMember.carts += proportional(carts, nonMemberPlayers, classifiedPlayers); }
    if (!classifiedPlayers) unclassifiedRounds += numberAt(attributes, "playerCount");
  }

  return {
    today,
    period,
    member: roundSegment(member),
    nonMember: roundSegment(nonMember),
    unclassifiedRounds,
    priceClasses: classes.map((item) => String(item.attributes?.name ?? "Unclassified")),
    sourceBookings: bookings.data.length
  };
}

/**
 * ForeUp's /sales ledger includes standalone POS and tee-sheet sales.  We use
 * its included line items, exclude green fees (already modeled in golf), and
 * always emit every reporting department so a quiet day is an explicit zero—not an
 * ambiguous missing row.
 */
export function summarizeCommerce(sales: { data: JsonApiResource[]; included: JsonApiResource[] }): ForeupCommerceMetric[] {
  const includedByKey = new Map(sales.included.map((item) => [`${item.type}:${item.id}`, item]));
  const totals: Record<ForeupCommerceDepartment, ForeupCommerceMetric> = {
    pro_shop: { department: "pro_shop", transactions: 0, unitsSold: 0, revenue: 0 },
    snack_shack: { department: "snack_shack", transactions: 0, unitsSold: 0, revenue: 0 },
    bar: { department: "bar", transactions: 0, unitsSold: 0, revenue: 0 },
    fnb_unassigned: { department: "fnb_unassigned", transactions: 0, unitsSold: 0, revenue: 0 }
  };
  const saleIdsByDepartment: Record<ForeupCommerceDepartment, Set<string>> = { pro_shop: new Set(), snack_shack: new Set(), bar: new Set(), fnb_unassigned: new Set() };
  for (const sale of sales.data) {
    const saleAttributes = sale.attributes ?? {};
    if (saleAttributes.deleted === true || saleAttributes.deletedAt) continue;
    const items = relationshipRecords(sale, "items", includedByKey);
    for (const item of items) {
      const attributes = item.attributes ?? {};
      const category = String(attributes.category ?? attributes.category_name ?? "");
      const itemName = String(attributes.name ?? attributes.item_name ?? attributes.title ?? "");
      if (isNonCommerceSale(`${category} ${attributes.price_category ?? ""} ${attributes.department ?? ""} ${itemName}`)) continue;
      const department = commerceDepartment(category, itemName, String(attributes.department ?? attributes.location ?? attributes.revenue_center ?? ""));
      const metric = totals[department];
      metric.unitsSold += Math.max(0, numberAt(attributes, "quantity", "player_count", "units") || 1);
      metric.revenue += numberAt(attributes, "total", "line_total", "amount");
      saleIdsByDepartment[department].add(sale.id);
    }
  }
  for (const department of Object.keys(totals) as ForeupCommerceDepartment[]) {
    totals[department].transactions = saleIdsByDepartment[department].size;
    totals[department].revenue = Math.round(totals[department].revenue * 100) / 100;
  }
  return Object.values(totals);
}

function isGreenFeeCategory(value: string) { return /green\s*fees?/i.test(value); }
function isNonCommerceSale(value: string) {
  return isGreenFeeCategory(value) || /account\s*payments?|invoice\s*payments?|membership\s*fees?|member\s*account/i.test(value);
}
function commerceDepartment(category: string, itemName: string, department: string): ForeupCommerceDepartment {
  const value = `${category} ${itemName} ${department}`.toLowerCase();
  // Prefer an explicit ForeUp department/location.  Name/category matching is
  // deliberately conservative: ambiguous F&B remains visible for mapping,
  // rather than being quietly assigned to the wrong outlet.
  if (/snack\s*shack|turn\s*stand|halfway\s*house|grab.?and.?go/i.test(value)) return "snack_shack";
  if (/\bbar\b|beverage\s*cart|restaurant|grill|kitchen|taproom|lounge/i.test(value)) return "bar";
  if (/food|beverage|drink|snack|breakfast|lunch|dinner/i.test(value)) return "fnb_unassigned";
  return "pro_shop";
}

function relationshipRecords(resource: JsonApiResource, relationship: string, included: Map<string, JsonApiResource>) {
  const data = resource.relationships?.[relationship]?.data;
  const references = Array.isArray(data) ? data : data ? [data] : [];
  return references.map((reference) => included.get(`${reference.type}:${reference.id}`)).filter((value): value is JsonApiResource => Boolean(value));
}

function isMemberClass(value: string) {
  return /member|equity|club|pass/i.test(value) && !/non.?member|guest|public/i.test(value);
}

function numberAt(attributes: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = Number(attributes[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function proportional(total: number, numerator: number, denominator: number) {
  return denominator ? total * numerator / denominator : 0;
}

function roundSegment(segment: GolfSegment): GolfSegment {
  return { ...segment, carts: Math.round(segment.carts), greenFeeRevenue: Math.round(segment.greenFeeRevenue * 100) / 100 };
}

function nextIsoDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function mapCustomer(resource: JsonApiResource): ForeupCustomer {
  const a = resource.attributes ?? {};
  const contact = (a.contact_info ?? {}) as Record<string, unknown>;
  const name = String(contact.formatted_name ?? [contact.first_name, contact.last_name].filter(Boolean).join(" ") ?? "Unnamed customer").trim();
  return {
    id: resource.id,
    accountNumber: String(a.account_number ?? ""),
    name: name || "Unnamed customer",
    phone: String(contact.cell_phone_number ?? contact.phone_number ?? ""),
    email: String(contact.email ?? ""),
    member: Boolean(a.member),
    membershipGroups: Array.isArray(a.groups) ? a.groups.map(String) : [],
    priceClassId: String(a.price_class ?? ""),
    accountBalance: numberAt(a, "account_balance", "member_account_balance"),
    invoiceBalance: numberAt(a, "invoice_balance"),
    optOutText: Boolean(a.opt_out_text),
    optOutEmail: Boolean(a.opt_out_email),
    status: numberAt(a, "status_flag"),
    city: String(contact.city ?? ""),
    state: String(contact.state ?? ""),
    handicap: String(contact.handicap_score ?? "")
  };
}

export const foreup = new ForeupAdapter({
  baseUrl: process.env.FOREUP_BASE_URL ?? "https://api.foreupsoftware.com/api_rest/index.php",
  token: process.env.FOREUP_API_TOKEN,
  email: process.env.FOREUP_API_EMAIL,
  password: process.env.FOREUP_API_PASSWORD
});
