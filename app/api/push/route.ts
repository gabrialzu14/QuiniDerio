import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const base = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function serverDb() {
  if (!base || !key) throw new Error("supabase_env");
  return createClient(base, key, { auth: { persistSession: false } });
}

async function authenticated(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const db = serverDb();
  const { data: { user }, error } = await db.auth.getUser(token);
  return error || !user ? null : { db, user };
}

async function findPlayer(db: ReturnType<typeof serverDb>, userId: string) {
  const { data, error } = await db.from("players").select("id").eq("auth_user_id", userId).maybeSingle();
  if (error) throw error;
  return data?.id as string | undefined;
}

async function ensurePlayer(db: ReturnType<typeof serverDb>, userId: string) {
  const existing = await findPlayer(db, userId);
  if (existing) return existing;
  // Identity comes only from this authenticated user's QuiniDerio profile.
  // Never claim unlinked historical player rows solely by matching a display name.
  const { data: profile, error: profileError } = await db.from("quini_profiles")
    .select("username").eq("user_id", userId).maybeSingle();
  if (profileError) throw profileError;
  if (!profile?.username || profile.username.trim().length < 3) return null;
  const name = profile.username.trim();
  const { data, error } = await db.from("players")
    .insert({ auth_user_id: userId, full_name: name, username: name, notifications_enabled: false })
    .select("id").single();
  if (error) {
    // Concurrent requests can create the same user-linked row at the same time.
    const raced = await findPlayer(db, userId);
    if (raced) return raced;
    throw error;
  }
  return data.id as string;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticated(req);
    if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const playerId = await findPlayer(auth.db, auth.user.id);
    if (!playerId) return NextResponse.json({ endpoints: [] }, { headers: { "Cache-Control": "no-store" } });
    const { data, error } = await auth.db.from("push_subscriptions")
      .select("endpoint").eq("player_id", playerId).eq("enabled", true);
    if (error) throw error;
    return NextResponse.json({ endpoints: (data || []).map(s => s.endpoint) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("push-status", error);
    return NextResponse.json({ error: "push" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticated(req);
    if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const playerId = await ensurePlayer(auth.db, auth.user.id);
    if (!playerId) return NextResponse.json({ error: "profile_not_found" }, { status: 409 });
    const body = await req.json();
    if (body.action === "submitted") {
      const round = Number(body.round);
      if (!Number.isSafeInteger(round) || round < 1) return NextResponse.json({ error: "round" }, { status: 400 });
      // Keep the existing reminder suppression log for a submitted round.
      const response = await fetch(base + "/rest/v1/push_notification_log", {
        method: "POST",
        headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates" },
        body: JSON.stringify({ player_id: playerId, round_id: null, kind: "submitted:" + round, notification_key: "submitted:" + round + ":" + playerId })
      });
      if (!response.ok) throw new Error("submitted_log");
      return NextResponse.json({ ok: true });
    }
    const subscription = body.subscription;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: "subscription" }, { status: 400 });
    }
    const { error } = await auth.db.from("push_subscriptions").upsert({
      player_id: playerId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      enabled: true,
      updated_at: new Date().toISOString()
    }, { onConflict: "endpoint" });
    if (error) throw error;
    // Keep other valid devices active; one account may have multiple devices.
    const { error: updateError } = await auth.db.from("players")
      .update({ notifications_enabled: true }).eq("id", playerId);
    if (updateError) throw updateError;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("push-register", error);
    return NextResponse.json({ error: "push" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await authenticated(req);
    if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const body = await req.json();
    if (!body.endpoint || typeof body.endpoint !== "string") {
      return NextResponse.json({ error: "endpoint" }, { status: 400 });
    }
    const playerId = await findPlayer(auth.db, auth.user.id);
    if (!playerId) return NextResponse.json({ ok: true });
    const { error } = await auth.db.from("push_subscriptions")
      .delete().eq("player_id", playerId).eq("endpoint", body.endpoint);
    if (error) throw error;
    const { data: remaining, error: checkError } = await auth.db.from("push_subscriptions")
      .select("id").eq("player_id", playerId).eq("enabled", true).limit(1);
    if (checkError) throw checkError;
    if (!remaining?.length) {
      const { error: updateError } = await auth.db.from("players")
        .update({ notifications_enabled: false }).eq("id", playerId);
      if (updateError) throw updateError;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("push-delete", error);
    return NextResponse.json({ error: "push" }, { status: 500 });
  }
}
