import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { defaultClubSettings } from "@/lib/club-settings";
import { readClubSettings, writeClubSettings } from "@/lib/club-settings-store";
import { staffGuard } from "@/lib/staff-access";

const hoursSchema = z.object({
  open: z.string().min(4).max(5),
  close: z.string().min(4).max(5),
  timezone: z.string().min(1).default("America/Chicago"),
  days: z.array(z.string().min(3)).min(1)
});

const faqSchema = z.object({
  id: z.string().min(1).optional(),
  question: z.string().trim().min(1).max(240),
  answer: z.string().trim().min(1).max(1200),
  tags: z.array(z.string().trim().min(1)).default([])
});

const settingsSchema = z.object({
  proShopPhone: z.string().max(32).optional(),
  restaurantHours: hoursSchema.optional(),
  faq: z.array(faqSchema).max(50).optional(),
  membersOnlyMessage: z.string().trim().min(1).max(320).optional()
});

function courseId() {
  return process.env.FOREUP_COURSE_ID ?? "";
}

export async function GET(request: NextRequest) {
  const access = await staffGuard(request, "member:lookup");
  if (access.error) return access.error;
  const id = courseId();
  if (!id) {
    return NextResponse.json({
      connected: false,
      error: "ForeUp course configuration is missing.",
      settings: defaultClubSettings()
    }, { status: 503 });
  }
  const settings = await readClubSettings(id);
  return NextResponse.json({ connected: true, settings }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: NextRequest) {
  const access = await staffGuard(request, "settings:manage");
  if (access.error) return access.error;
  const id = courseId();
  if (!id) {
    return NextResponse.json({ connected: false, error: "ForeUp course configuration is missing." }, { status: 503 });
  }
  const parsed = settingsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ connected: false, error: "Club settings are incomplete." }, { status: 400 });
  }
  const current = await readClubSettings(id);
  const settings = await writeClubSettings({
    ...current,
    ...parsed.data,
    restaurantHours: parsed.data.restaurantHours ?? current.restaurantHours,
    faq: (parsed.data.faq ?? current.faq).map((item, index) => ({
      ...item,
      id: item.id ?? `faq-${index + 1}`
    })),
    courseId: id
  });
  return NextResponse.json({ connected: true, settings });
}
