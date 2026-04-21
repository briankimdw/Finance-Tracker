import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";

function randomToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 20; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export async function POST(req: NextRequest) {
  try {
    const { tripId, email } = (await req.json()) as { tripId?: string; email?: string };
    if (!tripId || !email) {
      return NextResponse.json({ error: "Missing tripId or email" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { data: trip, error: tripErr } = await supabase
      .from("trips")
      .select("id, name, destination, user_id")
      .eq("id", tripId)
      .maybeSingle();
    if (tripErr || !trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    if (trip.user_id !== user.id) {
      return NextResponse.json({ error: "Only the trip owner can invite" }, { status: 403 });
    }

    const token = randomToken();
    const { error: insErr } = await supabase.from("trip_invites").insert({
      trip_id: tripId,
      token,
      email,
      invited_by: user.id,
    });
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    // Also mark the trip as shared so the UI knows
    await supabase.from("trips").update({ is_shared: true }).eq("id", tripId);

    const origin = req.headers.get("origin") || `https://${req.headers.get("host") || "localhost:3000"}`;
    const joinUrl = `${origin}/trips/join/${token}`;

    const inviterEmail = user.email || "A friend";
    const inviterName = inviterEmail.split("@")[0];

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ token, joinUrl, emailSent: false, reason: "RESEND_API_KEY not configured" });
    }

    const resend = new Resend(apiKey);
    const fromAddress = process.env.RESEND_FROM_EMAIL || "NetWorth <onboarding@resend.dev>";
    const destinationLine = trip.destination ? ` to ${trip.destination}` : "";
    const subject = `${inviterName} invited you to plan "${trip.name}" together`;
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827;">
        <h1 style="font-size:20px;margin:0 0 12px 0;">You're invited to co-plan a trip</h1>
        <p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 20px 0;">
          <strong>${escapeHtml(inviterName)}</strong> (${escapeHtml(inviterEmail)}) is planning
          <strong>"${escapeHtml(trip.name)}"</strong>${escapeHtml(destinationLine)} on NetWorth Tracker
          and invited you to help build the itinerary and track spending together.
        </p>
        <a href="${joinUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:500;font-size:14px;">Accept invite →</a>
        <p style="font-size:12px;color:#9ca3af;line-height:1.5;margin:24px 0 0 0;">
          Or copy this link:<br>
          <a href="${joinUrl}" style="color:#2563eb;word-break:break-all;">${joinUrl}</a>
        </p>
        <p style="font-size:12px;color:#9ca3af;margin-top:16px;">This invite expires in 14 days. If you didn't expect this, you can ignore it.</p>
      </div>
    `;
    const text = `${inviterName} (${inviterEmail}) invited you to co-plan "${trip.name}"${destinationLine} on NetWorth Tracker.\n\nAccept: ${joinUrl}\n\nExpires in 14 days.`;

    const sendRes = await resend.emails.send({
      from: fromAddress,
      to: email,
      replyTo: inviterEmail,
      subject, html, text,
    });

    if (sendRes.error) {
      console.error("[trip-invite] Resend error:", JSON.stringify(sendRes.error));
      return NextResponse.json({ token, joinUrl, emailSent: false, reason: sendRes.error.message || "Resend error" });
    }
    console.log("[trip-invite] email sent id=", sendRes.data?.id, "to=", email);
    return NextResponse.json({ token, joinUrl, emailSent: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
