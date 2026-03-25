import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

    // Extract email
    const email = (
      payload.preferred_username ||
      payload.email ||
      payload.upn ||
      ""
    ).toLowerCase().trim();

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

    if (dbError || !user) {
      return new Response(
        JSON.stringify({
          error: "No account found. Your admin must add you to the platform first.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (user.status !== "active") {
      return new Response(
        JSON.stringify({ error: "Your account is disabled. Contact your admin." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ user }), {
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
