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
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(req: NextRequest) {
  try {
    const { goalId, email } = (await req.json()) as { goalId?: string; email?: string };
    if (!goalId || !email) {
      return NextResponse.json({ error: "Missing goalId or email" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    // Verify the caller owns the goal (RLS also enforces this, but let's bail early with a clean message)
    const { data: goal, error: goalErr } = await supabase
      .from("goals")
      .select("id, name, user_id")
      .eq("id", goalId)
      .maybeSingle();
    if (goalErr || !goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    if (goal.user_id !== user.id) {
      return NextResponse.json({ error: "Only the goal owner can invite" }, { status: 403 });
    }

    // Create the invite row
    const token = randomToken();
    const { error: insErr } = await supabase.from("goal_invites").insert({
      goal_id: goalId,
      token,
      email,
      invited_by: user.id,
    });
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    // Build the join link
    const origin = req.headers.get("origin") || `https://${req.headers.get("host") || "localhost:3000"}`;
    const joinUrl = `${origin}/goals/join/${token}`;

    // Build "from" name from inviter's email
    const inviterEmail = user.email || "A friend";
    const inviterName = inviterEmail.split("@")[0];

    // Send the email via Resend. If RESEND_API_KEY isn't set, fall back to
    // returning just the token so the client can still use mailto/copy-link.
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        token,
        joinUrl,
        emailSent: false,
        reason: "RESEND_API_KEY not configured",
      });
    }

    const resend = new Resend(apiKey);
    // Resend's free/shared sender. For custom domains, set RESEND_FROM_EMAIL.
    const fromAddress = process.env.RESEND_FROM_EMAIL || "NetWorth <onboarding@resend.dev>";

    const subject = `${inviterName} invited you to save together on NetWorth`;
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827;">
        <h1 style="font-size:20px;margin:0 0 12px 0;">You're invited to a shared savings goal</h1>
        <p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 20px 0;">
          <strong>${escapeHtml(inviterName)}</strong> (${escapeHtml(inviterEmail)}) is saving for
          <strong>"${escapeHtml(goal.name)}"</strong> on NetWorth Tracker and invited you to track and contribute together.
        </p>
        <a href="${joinUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:500;font-size:14px;">Accept invite →</a>
        <p style="font-size:12px;color:#9ca3af;line-height:1.5;margin:24px 0 0 0;">
          Or copy this link:<br>
          <a href="${joinUrl}" style="color:#2563eb;word-break:break-all;">${joinUrl}</a>
        </p>
        <p style="font-size:12px;color:#9ca3af;margin-top:16px;">This invite expires in 14 days. If you didn't expect this, you can ignore it.</p>
      </div>
    `;
    const text = `${inviterName} (${inviterEmail}) invited you to save together on NetWorth Tracker for "${goal.name}".\n\nAccept the invite: ${joinUrl}\n\nThis link expires in 14 days.`;

    const { error: sendErr } = await resend.emails.send({
      from: fromAddress,
      to: email,
      replyTo: inviterEmail,
      subject,
      html,
      text,
    });

    if (sendErr) {
      // Invite row was still created — user can copy the link manually.
      return NextResponse.json({
        token,
        joinUrl,
        emailSent: false,
        reason: sendErr.message || "Resend error",
      });
    }

    return NextResponse.json({ token, joinUrl, emailSent: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
