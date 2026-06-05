// ============================================================
// 🛒 GrabTheByte: Abandoned Cart Recovery Engine
// ============================================================
// Triggered by cron job every 5 minutes
// Finds carts idle for 15+ minutes → sends AI nudge
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// ─── ENV VARS ───────────────────────────────────────────────
const ONESIGNAL_APP_ID       = Deno.env.get('ONESIGNAL_APP_ID')!;
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY')!;
const SUPABASE_URL           = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// 🦅 Resilient Gemini Key Pool
const GEMINI_KEYS = [
  Deno.env.get('GEMINI_API_KEY')!,
  Deno.env.get('GEMINI_API_KEY_2')!,
  Deno.env.get('GEMINI_API_KEY_3')!,
].filter(Boolean);

console.log(`🔑 Loaded ${GEMINI_KEYS.length} Gemini keys from secrets`);

// ─── TYPES ──────────────────────────────────────────────────
interface CartRow {
  id: string;
  user_id: string;
  items: CartItem[];
  total: number;
  updated_at: string;
  notified_at: string | null;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

// ─── GEMINI CALL WITH KEY ROTATION ──────────────────────────
async function callGemini(prompt: string): Promise<{ title: string; message: string }> {
  for (let k = 0; k < GEMINI_KEYS.length; k++) {
    let delay = 2000;
    console.log(`🔑 Attempting Gemini Key [${k}]...`);

    for (let attempt = 0; attempt <= 2; attempt++) {
      try {
        const res = await fetch(
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

        if (res.status === 429) {
          if (attempt < 2) {
            console.warn(`⏳ Key [${k}] busy. Retrying in ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
            delay *= 2;
            continue;
          } else {
            console.warn(`⚠️ Key [${k}] exhausted. Rotating...`);
            break;
          }
        }

        const data = await res.json();
        if (!res.ok || !data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          console.error(`❌ Key [${k}] bad response:`, JSON.stringify(data));
          break;
        }

        console.log(`✅ Key [${k}] succeeded!`);
        return JSON.parse(data.candidates[0].content.parts[0].text);

      } catch (err) {
        console.error(`Key [${k}] fetch exception:`, err);
        break;
      }
    }
  }

  throw new Error("All Gemini keys exhausted");
}

// ─── MAIN HANDLER ────────────────────────────────────────────
serve(async (req) => {

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      }
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 1️⃣ FIND ABANDONED CARTS
    // Carts idle for 15+ minutes and not notified in last 2 hours
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    console.log(`🔍 Scanning for abandoned carts idle since: ${fifteenMinsAgo}`);

    const { data: abandonedCarts, error: cartsErr } = await supabase
      .from('carts')
      .select('*')
      .lt('updated_at', fifteenMinsAgo)           // idle for 15+ mins
      .or(`notified_at.is.null,notified_at.lt.${twoHoursAgo}`) // never notified OR notified 2+ hrs ago
      .gt('total', 0)                              // cart has items with value
      .limit(50);                                  // process max 50 at a time

    if (cartsErr) throw new Error(`Failed to fetch carts: ${cartsErr.message}`);

    if (!abandonedCarts || abandonedCarts.length === 0) {
      console.log("✅ No abandoned carts found. All clear!");
      return new Response(
        JSON.stringify({ success: true, message: "No abandoned carts found", processed: 0 }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`🛒 Found ${abandonedCarts.length} abandoned carts!`);

    // 2️⃣ PROCESS EACH ABANDONED CART
    let notifiedCount = 0;
    let failedCount = 0;

    for (const cart of abandonedCarts as CartRow[]) {
      try {
        // Get top 2 item names for the nudge
        const itemNames = cart.items
          .slice(0, 2)
          .map((item: CartItem) => item.name)
          .join(" and ");

        const totalItems = cart.items.reduce((sum: number, item: CartItem) => sum + item.quantity, 0);
        const cartTotal = cart.total;

        console.log(`📦 Processing cart for user: ${cart.user_id} | Items: ${itemNames} | Total: ₹${cartTotal}`);

        // 3️⃣ BUILD AI PROMPT
        const prompt = `
You are the marketing manager for 'GrabTheByte', a campus food ordering app for college students in India.
A student left their cart without completing the order. Write a short, fun push notification to nudge them back.

CART DETAILS:
- Items left behind: ${itemNames}
- Total items: ${totalItems}
- Cart value: ₹${cartTotal}

WRITING RULES:
- Sound like a concerned friend, NOT a salesperson
- Mention the specific food item(s) by name — make it mouth-watering
- Create mild urgency (canteen might run out, food is getting cold etc.)
- College tone: casual, fun, relatable
- Use 1-2 emojis
- NO hashtags
- Title max 30 characters
- Message max 80 characters

Return ONLY a valid JSON object. No markdown. No backticks.
{"title": "max 30 chars", "message": "max 80 chars"}
        `.trim();

        // 4️⃣ GENERATE AI COPY
        let generatedCopy: { title: string; message: string };

        try {
          generatedCopy = await callGemini(prompt);
          console.log(`🤖 AI copy for ${cart.user_id}:`, generatedCopy);
        } catch {
          // Fallback copy if Gemini fails
          generatedCopy = {
            title: `${itemNames} is waiting! 🛒`,
            message: `Your cart worth ₹${cartTotal} is saved. Tap to complete your order before it's gone!`
          };
          console.warn(`⚠️ Using fallback copy for user: ${cart.user_id}`);
        }

        // 5️⃣ SEND ONESIGNAL NOTIFICATION TO SPECIFIC USER
        const oneSignalPayload = {
          app_id: ONESIGNAL_APP_ID,
          include_external_user_ids: [cart.user_id],
          headings: { en: generatedCopy.title },
          contents: { en: generatedCopy.message },
          app_url: "grabthebyte://checkout",
          data: {
            type: "abandoned_cart",
            deep_link: "grabthebyte://checkout"
          }
        };

        const pushResponse = await fetch("https://onesignal.com/api/v1/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`
          },
          body: JSON.stringify(oneSignalPayload)
        });

        const pushResult = await pushResponse.json();
        console.log(`📬 OneSignal response for ${cart.user_id}:`, JSON.stringify(pushResult));

        // 6️⃣ MARK CART AS NOTIFIED
        await supabase
          .from('carts')
          .update({ notified_at: new Date().toISOString() })
          .eq('id', cart.id);

        notifiedCount++;

        // Small delay between notifications to avoid rate limiting
        await new Promise(r => setTimeout(r, 500));

      } catch (cartErr: any) {
        console.error(`❌ Failed to process cart ${cart.id}:`, cartErr.message);
        failedCount++;
      }
    }

    console.log(`✅ Done! Notified: ${notifiedCount} | Failed: ${failedCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        total_found: abandonedCarts.length,
        notified: notifiedCount,
        failed: failedCount
      }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("🔴 Pipeline crashed:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});