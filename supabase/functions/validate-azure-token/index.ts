import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { idToken } = await req.json();
    if (!idToken) {
      return new Response(
        JSON.stringify({ error: "Missing idToken" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decode JWT payload (validation is done by MSAL on the client; here we extract claims)
    const parts = idToken.split(".");
    if (parts.length !== 3) {
      return new Response(
        JSON.stringify({ error: "Invalid token format" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));

    // Validate issuer
    const expectedTenantId = "ea6c052c-f910-4b0a-a2a0-9e5179c0e9fb";
    const validIssuers = [
      `https://login.microsoftonline.com/${expectedTenantId}/v2.0`,
      `https://sts.windows.net/${expectedTenantId}/`,
    ];
    if (!validIssuers.includes(payload.iss)) {
      return new Response(
        JSON.stringify({ error: "Invalid token issuer" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate expiry
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return new Response(
        JSON.stringify({ error: "Token expired" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract email and name
    const email = (
      payload.preferred_username ||
      payload.email ||
      payload.upn ||
      ""
    ).toLowerCase().trim();

    const fullName = payload.name || payload.given_name || email.split("@")[0] || "New User";

    if (!email) {
      return new Response(
        JSON.stringify({ error: "No email found in token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up user in DB
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: user, error: dbError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (dbError && dbError.code !== "PGRST116") {
      return new Response(
        JSON.stringify({ error: "Database error. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let finalUser = user;

    // Sync to auth.users so user appears in Cloud Users section
    try {
      const { data: authLookup } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
      const existingAuthUser = authLookup?.users?.find((u: any) => u.email === email);
      if (!existingAuthUser) {
        await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        });
      }
    } catch (syncErr) {
      console.warn("Auth sync (non-blocking):", syncErr);
    }

    // Auto-register new Azure AD users as employees
    if (!user) {
      const newId = crypto.randomUUID();
      const { data: created, error: insertErr } = await supabaseAdmin
        .from("users")
        .insert({
          id: newId,
          email,
          full_name: fullName,
          role: "employee",
          status: "active",
          tenant_id: "tenant-001",
        })
        .select("*")
        .single();

      if (insertErr || !created) {
        console.error("Auto-register error:", insertErr);
        return new Response(
          JSON.stringify({ error: "Failed to create your account. Contact your admin." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      finalUser = created;
    }

    if (finalUser.status !== "active") {
      return new Response(
        JSON.stringify({ error: "Your account is disabled. Contact your admin." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ user: finalUser }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("validate-azure-token error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
