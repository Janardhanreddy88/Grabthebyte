// ============================================================
// 🚀 GrabTheByte: 7-Pillar Admin Offers Engine (PRODUCTION READY)
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// ─── ENV VARS ───────────────────────────────────────────────
const ONESIGNAL_APP_ID       = Deno.env.get('ONESIGNAL_APP_ID')!;
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY')!;
const SUPABASE_URL           = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// 🦅 The Resilient Gemini Key Pool
const GEMINI_KEYS = [
  Deno.env.get('GEMINI_API_KEY')!,
  Deno.env.get('GEMINI_API_KEY_2')!,
  Deno.env.get('GEMINI_API_KEY_3')!,
].filter(Boolean);

console.log(`🔑 Loaded ${GEMINI_KEYS.length} Gemini keys from secrets`);

// ─── MAIN HANDLER ────────────────────────────────────────────
serve(async (req) => {

  // CORS preflight — required for browser/dashboard calls
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      }
    });
  }

  try {
    // 1️⃣ CAPTURE THE SUPABASE WEBHOOK PAYLOAD
    const body = await req.json();
    const offer_id = body.record?.id || body.offer_id;

    if (!offer_id) {
      return new Response(JSON.stringify({ error: "offer_id or webhook record is required." }), { status: 400 });
    }

    console.log(`🚀 Triggered! Fetching Offer ID: ${offer_id}`);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 2️⃣ FETCH OFFER DETAILS FROM DATABASE
    const { data: offer, error: offerErr } = await supabase
      .from("offers")
      .select("*")
      .eq("id", offer_id)
      .single();

    if (offerErr || !offer) throw new Error("Offer not found.");

    // 3️⃣ RESOLVE DYNAMIC CONTEXT (Items & Campuses)
    let itemContext = "";
    let appDeepLink = "grabthebyte://offers";

    if (offer.target_item_id) {
      const { data: item } = await supabase
        .from("menu_items")
        .select("name")
        .eq("id", offer.target_item_id)
        .single();
      if (item) {
        itemContext = `Target Food Item: ${item.name} (Make the copy mouth-watering and exclusively about this dish).`;
        appDeepLink = `grabthebyte://canteen/item?id=${offer.target_item_id}`;
        console.log(`🍔 Target item resolved: ${item.name}`);
      }
    }

    let campusContext = "Platform-wide Global Offer";
    if (offer.campus_id) {
      const { data: campus } = await supabase
        .from("campuses")
        .select("name")
        .eq("id", offer.campus_id)
        .single();
      if (campus) {
        campusContext = `Target Campus: ${campus.name}`;
        console.log(`🏫 Campus resolved: ${campus.name}`);
      }
    }

    // 4️⃣ THE AI "GOD MODE" PSYCHOLOGICAL TRIGGERS
    let psychTriggers = "";

    // 🔥 TRIGGER 5: SCARCITY (Calculated Remaining)
    if (offer.max_global_uses != null && offer.current_uses != null) {
      const remaining = offer.max_global_uses - offer.current_uses;
      if (remaining > 0 && remaining <= 50) {
        psychTriggers += `\n- SCARCITY: Only ${remaining} redemptions left! INJECT EXTREME FOMO and panic.`;
        console.log(`🔥 Trigger 5 SCARCITY fired: ${remaining} remaining out of ${offer.max_global_uses}`);
      }
    }

    // 🕒 TRIGGER 6: TICKING CLOCK (Exact Countdown)
    if (offer.valid_until) {
      const diffMs = new Date(offer.valid_until).getTime() - Date.now();
      const diffHours = diffMs / (1000 * 60 * 60);
      if (diffHours > 0 && diffHours <= 6) {
        const timeLabel = diffHours < 1
          ? `${Math.round(diffMs / 60000)} minutes`
          : `${Math.round(diffHours * 10) / 10} hours`;
        psychTriggers += `\n- TICKING CLOCK: Expires in exactly ${timeLabel}. Create absolute urgency. Use time-pressure words.`;
        console.log(`🕒 Trigger 6 TICKING CLOCK fired: expires in ${timeLabel}`);
      }
    }

    // 🍗 TRIGGER 7: UPSELL NUDGE
    if (offer.min_order_value && offer.min_order_value >= 250) {
      psychTriggers += `\n- UPSELL: Minimum cart is ₹${offer.min_order_value}. Tell them to group-order with roommates!`;
      console.log(`🍗 Trigger 7 UPSELL fired: min order ₹${offer.min_order_value}`);
    }

    // ✅ Summary of all triggers built
    console.log(`🧠 Psych triggers built: ${psychTriggers ? psychTriggers.trim() : 'NONE — using warm/fun tone'}`);

    // 5️⃣ ASSEMBLE THE AI PROMPT
    const discountText = offer.discount_type === 'fixed'
      ? `₹${offer.discount_value} OFF`
      : `${offer.discount_value}% OFF`;

    const prompt = `
You are the marketing manager for 'GrabTheByte', a campus food app.
Write a KILLER, highly urgent push notification for college students.

OFFER DETAILS:
- Code: ${offer.promo_code}
- Discount: ${discountText}
- ${itemContext || "Applicable on entire cart"}
- ${campusContext}

PSYCHOLOGICAL RULES:${psychTriggers || " Keep it fun, warm, and highly engaging."}

Sound like a real human friend texting them. Use 1-2 emojis. NO hashtags.
Return ONLY a JSON object: {"title": "max 30 chars", "message": "max 80 chars"}
    `.trim();

    // 6️⃣ CALL GEMINI WITH KEY ROTATION + EXPONENTIAL BACKOFF
    let aiData = null;
    let fallbackSuccess = false;

    for (let k = 0; k < GEMINI_KEYS.length; k++) {
      let delay = 2000;
      console.log(`🔑 Attempting Gemini Key [${k}]...`);

      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          const aiResponse = await fetch(
            // ✅ Current latest model
`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEYS[k]}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { response_mime_type: "application/json" }
              })
            }
          );

          if (aiResponse.status === 429) {
            if (attempt < 2) {
              console.warn(`⏳ Key [${k}] busy. Retrying in ${delay}ms...`);
              await new Promise(r => setTimeout(r, delay));
              delay *= 2;
              continue;
            } else {
              console.warn(`⚠️ Key [${k}] fully exhausted after retries. Rotating to next key...`);
              break;
            }
          }

          aiData = await aiResponse.json();

          if (!aiResponse.ok || !aiData.candidates) {
            console.error(`❌ Key [${k}] bad response:`, JSON.stringify(aiData));
            break;
          }

          console.log(`✅ Key [${k}] succeeded!`);
          fallbackSuccess = true;
          break;

        } catch (err) {
          console.error(`Key [${k}] fetch exception:`, err);
          break;
        }
      }
      if (fallbackSuccess) break;
    }

    // 7️⃣ GENERATE COPY — AI or Fallback
    let generatedCopy: { title: string; message: string };

    if (!fallbackSuccess || !aiData) {
      console.warn("⚠️ All Gemini keys exhausted. Using hardcoded fallback copy.");
      generatedCopy = {
        title: `🔥 ${offer.promo_code} is LIVE!`,
        message: `Save ${discountText} on your order right now. Code: ${offer.promo_code} 🍔`
      };
    } else {
      generatedCopy = JSON.parse(aiData.candidates[0].content.parts[0].text);
      console.log("🤖 AI generated copy successfully!");
    }

    console.log("✨ Final Copy:", JSON.stringify(generatedCopy));

    // 8️⃣ BUILD ONESIGNAL ROUTING MATRIX (All 4 Targeting Pillars)
    const oneSignalPayload: any = {
      app_id: ONESIGNAL_APP_ID,
      headings: { en: generatedCopy.title },
      contents: { en: generatedCopy.message },
      app_url: appDeepLink,
      data: {
        offer_id: offer.id,
        promo_code: offer.promo_code,
        deep_link: appDeepLink
      }
    };

    // PILLAR 1 — VIP Drop: specific user UUIDs
    if (offer.target_user_ids && offer.target_user_ids.length > 0) {
      console.log(`🎯 Mode: VIP Drop → ${offer.target_user_ids.length} users`);
      oneSignalPayload.include_external_user_ids = offer.target_user_ids;
    }
    // PILLAR 2 — Campus Lock: filter by campus_id tag
    else if (offer.campus_id) {
      console.log(`🏫 Mode: Campus Lock → ${campusContext}`);
      oneSignalPayload.filters = [
        { field: "tag", key: "campus_id", relation: "=", value: offer.campus_id }
      ];
    }
    // PILLAR 4 — Global Broadcast
    else {
      console.log(`🌍 Mode: Global Broadcast → All Active Users`);
      oneSignalPayload.included_segments = ["Active Subscriptions"];
    }

    // 9️⃣ FIRE THE BLAST 🔥
    const pushResponse = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`
      },
      body: JSON.stringify(oneSignalPayload)
    });

    const pushResult = await pushResponse.json();
    console.log("📬 OneSignal Response:", JSON.stringify(pushResult));

    return new Response(
      JSON.stringify({ success: true, ai_copy: generatedCopy, onesignal: pushResult }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("🔴 Pipeline crashed:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
});