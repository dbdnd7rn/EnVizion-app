import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function medLine(med: any) {
  return [
    med.name,
    med.dose,
    med.route,
    med.instructions,
    med.is_prn ? "PRN / as-needed" : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function labelled(label: string, value: unknown) {
  const text = String(value ?? "").trim();
  return `<div class="row"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(text || "Not recorded")}</div></div>`;
}

function listSection(title: string, values: string[]) {
  const items = values.length
    ? values.map((value) => `<li>${escapeHtml(value)}</li>`).join("")
    : "<li>None recorded</li>";
  return `<section><h2>${escapeHtml(title)}</h2><ul>${items}</ul></section>`;
}

function emergencyHtml(snapshot: any, expiresAt: string) {
  const recipient = snapshot?.recipient ?? {};
  const profile = snapshot?.profile ?? {};
  const meds = Array.isArray(snapshot?.medications) ? snapshot.medications : [];
  const generatedAt = snapshot?.generatedAt
    ? new Date(snapshot.generatedAt).toLocaleString()
    : "Unknown";
  const expiry = new Date(expiresAt).toLocaleString();

  const codeLabels: Record<string, string> = {
    unknown: "Not recorded",
    full_code: "Full code",
    dnr: "DNR",
    dni: "DNI",
    dnr_dni: "DNR / DNI",
    other: "Other directive",
  };

  const poaLabels: Record<string, string> = {
    unknown: "Not recorded",
    none: "No healthcare POA recorded",
    on_file: "Healthcare POA on file",
    not_on_file: "Healthcare POA identified, document not on file",
  };

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex,nofollow,noarchive"/>
<title>Emergency Care Summary</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;background:#f6f1fa;color:#241b2b;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  main{max-width:720px;margin:0 auto;padding:22px 16px 44px}
  .hero{background:linear-gradient(135deg,#412052,#7b428e);color:#fff;border-radius:24px;padding:22px;margin-bottom:14px}
  .brand{font-size:11px;letter-spacing:1.6px;font-weight:700;opacity:.82}
  h1{font-size:28px;line-height:1.1;margin:8px 0 4px}
  .meta{font-size:12px;opacity:.82}
  section{background:#fff;border:1px solid #e7ddea;border-radius:20px;padding:18px;margin:12px 0}
  h2{font-size:17px;margin:0 0 12px;color:#673678}
  .row{display:grid;grid-template-columns:145px 1fr;gap:10px;padding:9px 0;border-bottom:1px solid #f0e8f2}
  .row:last-child{border-bottom:0}
  .label{font-size:12px;color:#706676;font-weight:600}
  .value{font-size:14px;font-weight:600;word-break:break-word}
  ul{padding-left:20px;margin:6px 0 0}
  li{margin:7px 0;font-size:14px}
  .warning{background:#fff8e9;border-color:#f1dfb4}
  .footer{font-size:11px;line-height:1.5;color:#716878;padding:8px 4px}
  @media(max-width:500px){.row{grid-template-columns:1fr;gap:3px}}
</style>
</head>
<body>
<main>
  <div class="hero">
    <div class="brand">ENVIZION LIFE · TEMPORARY EMERGENCY SUMMARY</div>
    <h1>${escapeHtml(recipient.displayName || "Care profile")}</h1>
    <div class="meta">Generated ${escapeHtml(generatedAt)} · Link expires ${escapeHtml(expiry)}</div>
  </div>

  <section>
    <h2>Critical information</h2>
    ${labelled("Blood type", profile.bloodType)}
    ${labelled("Primary language", profile.primaryLanguage)}
    ${labelled("Allergies", profile.allergies)}
    ${labelled("Important conditions / diagnoses", profile.importantConditions)}
    ${labelled("Medical devices", profile.medicalDevices)}
    ${labelled("Preferred hospital", profile.preferredHospital)}
  </section>

  ${listSection("Active medications", meds.map(medLine))}

  <section>
    <h2>Emergency contacts</h2>
    ${labelled("Primary contact", recipient.emergencyContactName)}
    ${labelled("Primary contact phone", recipient.emergencyContactPhone)}
    ${labelled("Local emergency number", profile.localEmergencyNumber)}
  </section>

  <section class="warning">
    <h2>Advance directives</h2>
    ${labelled("Code status", codeLabels[profile.codeStatus] ?? profile.codeStatus)}
    ${labelled("DNR / directive location", profile.dnrLocation || profile.advanceDirectiveLocation)}
    ${labelled("Healthcare POA", poaLabels[profile.poaStatus] ?? profile.poaStatus)}
    ${labelled("POA name", profile.poaName)}
    ${labelled("POA phone", profile.poaPhone)}
  </section>

  <section>
    <h2>Emergency notes</h2>
    <div class="value">${escapeHtml(profile.emergencyNotes || "No additional emergency notes recorded.")}</div>
  </section>

  <div class="footer">
    This temporary page reflects caregiver-entered information from EnVizion Life. It is not a verified clinical medical record and does not replace emergency services or the treating healthcare team. Confirm critical details when possible.
  </div>
</main>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Server configuration unavailable" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (req.method === "GET") {
    const token = new URL(req.url).searchParams.get("token")?.trim() ?? "";
    if (!token) {
      return new Response("Emergency share token is required.", {
        status: 400,
        headers: { ...cors, "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const tokenHash = await sha256(token);
    const now = new Date().toISOString();

    const { data: share, error } = await admin
      .from("emergency_share_links")
      .select("id, snapshot, expires_at, revoked_at, access_count")
      .eq("token_hash", tokenHash)
      .gt("expires_at", now)
      .is("revoked_at", null)
      .maybeSingle();

    if (error || !share) {
      return new Response(
        "<!doctype html><html><body style='font-family:sans-serif;padding:28px'><h2>This emergency summary link is unavailable.</h2><p>It may have expired or been revoked.</p></body></html>",
        {
          status: 404,
          headers: {
            ...cors,
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store, max-age=0",
            "X-Robots-Tag": "noindex, nofollow, noarchive",
          },
        },
      );
    }

    await admin
      .from("emergency_share_links")
      .update({
        access_count: Number(share.access_count ?? 0) + 1,
        last_accessed_at: now,
      })
      .eq("id", share.id);

    const snapshotRecipientId = String(
      share.snapshot?.careRecipientId ??
        share.snapshot?.recipient?.careRecipientId ??
        "",
    );
    if (snapshotRecipientId) {
      await admin.from("care_audit_events").insert({
        care_recipient_id: snapshotRecipientId,
        actor_user_id: null,
        action: "emergency_share_open",
        entity_type: "emergency_share_links",
        entity_id: share.id,
        summary: "Temporary emergency summary link opened.",
      });
    }

    return new Response(emergencyHtml(share.snapshot, share.expires_at), {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
        "Pragma": "no-cache",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Authentication required" }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(token);

  if (userError || !user) return json({ error: "Invalid session" }, 401);

  try {
    const payload = await req.json().catch(() => ({}));
    const action = String(payload.action ?? "create");

    if (action === "revoke") {
      const shareId = String(payload.shareId ?? "");
      if (!shareId) return json({ error: "Share link is required." }, 400);

      const { data, error } = await userClient
        .from("emergency_share_links")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", shareId)
        .is("revoked_at", null)
        .select("id")
        .maybeSingle();

      if (error) throw error;
      if (!data?.id) return json({ error: "Share link not found or not editable." }, 404);

      const { data: revokedShare } = await admin
        .from("emergency_share_links")
        .select("care_recipient_id")
        .eq("id", shareId)
        .maybeSingle();

      if (revokedShare?.care_recipient_id) {
        await admin.from("care_audit_events").insert({
          care_recipient_id: revokedShare.care_recipient_id,
          actor_user_id: user.id,
          action: "emergency_share_revoke",
          entity_type: "emergency_share_links",
          entity_id: shareId,
          summary: "Temporary emergency summary link revoked.",
        });
      }

      return json({ ok: true, shareId });
    }

    if (action !== "create") return json({ error: "Unsupported action" }, 400);

    const careRecipientId = String(payload.careRecipientId ?? "");
    if (!careRecipientId) return json({ error: "Care profile is required." }, 400);

    const requestedMinutes = Number(payload.expiresInMinutes ?? 60);
    const expiresInMinutes = Math.min(1440, Math.max(10, Math.round(requestedMinutes)));

    const { data: recipient, error: recipientError } = await userClient
      .from("care_recipients")
      .select(
        "id, display_name, emergency_contact_name, emergency_contact_phone",
      )
      .eq("id", careRecipientId)
      .single();

    if (recipientError || !recipient) {
      return json({ error: "Care profile was not found or is not accessible." }, 404);
    }

    const { data: profile, error: profileError } = await userClient
      .from("care_emergency_profiles")
      .select(
        "local_emergency_number, preferred_hospital, allergies, important_conditions, medical_devices, advance_directive_location, emergency_notes, blood_type, primary_language, code_status, dnr_location, poa_status, poa_name, poa_phone, last_reviewed_at",
      )
      .eq("care_recipient_id", careRecipientId)
      .maybeSingle();

    if (profileError) throw profileError;

    const { data: medications, error: medError } = await userClient
      .from("medications")
      .select("name, dose, route, instructions, is_prn")
      .eq("care_recipient_id", careRecipientId)
      .eq("active", true)
      .order("name", { ascending: true });

    if (medError) throw medError;

    const { data: editableProbe, error: editableError } = await userClient
      .from("care_emergency_profiles")
      .select("care_recipient_id")
      .eq("care_recipient_id", careRecipientId)
      .maybeSingle();

    if (editableError) throw editableError;

    const { data: memberships } = await admin
      .from("care_recipient_members")
      .select("role, status")
      .eq("care_recipient_id", careRecipientId)
      .eq("user_id", user.id)
      .eq("status", "active");

    const { data: recipientOwner } = await admin
      .from("care_recipients")
      .select("owner_id, care_group_id")
      .eq("id", careRecipientId)
      .single();

    const directEditor =
      recipientOwner?.owner_id === user.id ||
      (memberships ?? []).some((member) =>
        ["owner", "caregiver"].includes(String(member.role)),
      );

    let groupEditor = false;
    if (!directEditor && recipientOwner?.care_group_id) {
      const { data: groupMembership } = await admin
        .from("care_group_members")
        .select("role, status")
        .eq("care_group_id", recipientOwner.care_group_id)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      groupEditor = ["primary_advocate", "co_caregiver"].includes(
        String(groupMembership?.role ?? ""),
      );
    }

    if (!directEditor && !groupEditor) {
      return json(
        { error: "Only a Primary Advocate or Co-Caregiver can create a temporary emergency share link." },
        403,
      );
    }

    const random = new Uint8Array(32);
    crypto.getRandomValues(random);
    const shareToken = bytesToBase64Url(random);
    const tokenHash = await sha256(shareToken);
    const expiresAt = new Date(
      Date.now() + expiresInMinutes * 60_000,
    ).toISOString();

    const snapshot = {
      generatedAt: new Date().toISOString(),
      careRecipientId,
      recipient: {
        careRecipientId,
        displayName: recipient.display_name ?? "",
        emergencyContactName: recipient.emergency_contact_name ?? "",
        emergencyContactPhone: recipient.emergency_contact_phone ?? "",
      },
      profile: {
        localEmergencyNumber: profile?.local_emergency_number ?? "",
        preferredHospital: profile?.preferred_hospital ?? "",
        allergies: profile?.allergies ?? "",
        importantConditions: profile?.important_conditions ?? "",
        medicalDevices: profile?.medical_devices ?? "",
        advanceDirectiveLocation: profile?.advance_directive_location ?? "",
        emergencyNotes: profile?.emergency_notes ?? "",
        bloodType: profile?.blood_type ?? "",
        primaryLanguage: profile?.primary_language ?? "",
        codeStatus: profile?.code_status ?? "unknown",
        dnrLocation: profile?.dnr_location ?? "",
        poaStatus: profile?.poa_status ?? "unknown",
        poaName: profile?.poa_name ?? "",
        poaPhone: profile?.poa_phone ?? "",
        lastReviewedAt: profile?.last_reviewed_at ?? null,
      },
      medications: medications ?? [],
    };

    const { data: share, error: insertError } = await admin
      .from("emergency_share_links")
      .insert({
        care_recipient_id: careRecipientId,
        token_hash: tokenHash,
        snapshot,
        created_by: user.id,
        expires_at: expiresAt,
      })
      .select("id, expires_at, created_at")
      .single();

    if (insertError) throw insertError;

    await admin.from("care_audit_events").insert({
      care_recipient_id: careRecipientId,
      actor_user_id: user.id,
      action: "emergency_share_create",
      entity_type: "emergency_share_links",
      entity_id: share.id,
      summary: `Temporary emergency summary link created for ${expiresInMinutes} minutes.`,
    });

    return json({
      shareId: share.id,
      shareUrl: `${supabaseUrl}/functions/v1/emergency-share?token=${encodeURIComponent(shareToken)}`,
      expiresAt: share.expires_at,
      createdAt: share.created_at,
      expiresInMinutes,
    });
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected emergency share error",
      },
      500,
    );
  }
});
