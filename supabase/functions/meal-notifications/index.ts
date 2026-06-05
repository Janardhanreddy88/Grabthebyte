// ============================================================
// 🍳 GrabTheByte: Scheduled Meal Notifications Engine
// ============================================================
// Handles 3 daily scheduled blasts:
//   ☀️  Morning   → breakfast notification
//   ☀️  Afternoon → lunch notification  
//   🌙  Evening   → snacks notification
//
// Cron jobs call this with: { "mealType": "morning/afternoon/evening" }
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ─── ENV VARS ───────────────────────────────────────────────
const ONESIGNAL_APP_ID       = Deno.env.get('ONESIGNAL_APP_ID')!;
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY')!;

// 🦅 Resilient Gemini Key Pool
const GEMINI_KEYS = [
  Deno.env.get('GEMINI_API_KEY')!,
  Deno.env.get('GEMINI_API_KEY_2')!,
  Deno.env.get('GEMINI_API_KEY_3')!,
].filter(Boolean);

console.log(`🔑 Loaded ${GEMINI_KEYS.length} Gemini keys from secrets`);

// ─── MEAL CONFIG ─────────────────────────────────────────────
const MEAL_CONFIG: Record<string, { label: string; slot: string; emoji: string; deepLink: string }> = {
  morning: {
    label: "breakfast",
    slot: "morning (7AM - 11AM)",
    emoji: "🍳",
    deepLink: "grabthebyte://menu?category=breakfast"
  },
  afternoon: {
    label: "lunch",
    slot: "afternoon (12PM - 3PM)",
    emoji: "🍱",
    deepLink: "grabthebyte://menu?category=lunch"
  },
  evening: {
    label: "evening snacks",
    slot: "evening (5PM - 8PM)",
    emoji: "🍟",
    deepLink: "grabthebyte://menu?category=snacks"
  }
};

// ─── FALLBACK COPY ───────────────────────────────────────────
const FALLBACK_COPY: Record<string, { title: string; message: string }> = {
  morning: {
    title: "🍳 Breakfast is ready!",
    message: "Fuel up before class! Hot breakfast waiting at your canteen 😋"
  },
  afternoon: {
    title: "🍱 Lunch time!",
    message: "Skip the canteen line! Order lunch now and get it fresh 🔥"
  },
  evening: {
    title: "🍟 Evening snacks!",
    message: "Study break? Grab a quick snack from your canteen 😋"
  }
};

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
    // 1️⃣ CAPTURE MEAL TYPE FROM CRON JOB
    const body = await req.json();
    const mealType = body.mealType?.toLowerCase();

    if (!mealType || !MEAL_CONFIG[mealType]) {
      return new Response(
        JSON.stringify({ error: "mealType is required. Valid values: morning, afternoon, evening" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const meal = MEAL_CONFIG[mealType];
    console.log(`🍽️ Scheduled blast triggered for: ${meal.label} (${meal.slot})`);

    // 2️⃣ BUILD THE AI PROMPT
    const prompt = `
You are the marketing manager for 'GrabTheByte', a food ordering app inside college canteens across India.
Write a KILLER push notification for college students for their ${meal.label} time.

TIMING CONTEXT:
- It is currently ${meal.slot}
- Students are either heading to class, on a break, or studying
- Make the copy relevant to this exact time of day

WRITING RULES:
- Sound like a real human friend texting them, NOT a corporate bot
- College tone: casual, fun, relatable (hostel life, canteen lines, boring lectures, study sessions)
- Mention the meal type naturally (${meal.label})
- Use 1-2 emojis — make them count
- NO hashtags
- NO generic phrases like "Don't miss out" or "Order now"
- Title must grab attention in under 5 words
- Message must make them hungry and want to tap immediately

Return ONLY a valid JSON object. No markdown. No explanation. No backticks.
{"title": "max 30 characters", "message": "max 80 characters"}
    `.trim();

    // 3️⃣ CALL GEMINI WITH KEY ROTATION + EXPONENTIAL BACKOFF
    let aiData = null;
    let aiSuccess = false;

    for (let k = 0; k < GEMINI_KEYS.length; k++) {
      let delay = 2000;
      console.log(`🔑 Attempting Gemini Key [${k}]...`);

      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          const aiResponse = await fetch(
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
              console.warn(`⚠️ Key [${k}] exhausted. Rotating to next key...`);
              break;
            }
          }

          aiData = await aiResponse.json();

          if (!aiResponse.ok || !aiData?.candidates?.[0]?.content?.parts?.[0]?.text) {
            console.error(`❌ Key [${k}] bad response:`, JSON.stringify(aiData));
            break;
          }

          console.log(`✅ Key [${k}] succeeded!`);
          aiSuccess = true;
          break;

        } catch (err) {
          console.error(`Key [${k}] fetch exception:`, err);
          break;
        }
      }
      if (aiSuccess) break;
    }

    // 4️⃣ GENERATE COPY — AI or Fallback
    let generatedCopy: { title: string; message: string };

    if (!aiSuccess || !aiData) {
      console.warn(`⚠️ All Gemini keys exhausted. Using fallback copy for ${mealType}.`);
      generatedCopy = FALLBACK_COPY[mealType];
    } else {
      generatedCopy = JSON.parse(aiData.candidates[0].content.parts[0].text);
      console.log("🤖 AI generated copy successfully!");
    }

    console.log("✨ Final Copy:", JSON.stringify(generatedCopy));

    // 5️⃣ BUILD ONESIGNAL PAYLOAD — Global broadcast to all active users
    const oneSignalPayload = {
      app_id: ONESIGNAL_APP_ID,
      included_segments: ["Active Subscriptions"],
      headings: { en: generatedCopy.title },
      contents: { en: generatedCopy.message },
      app_url: meal.deepLink,
      data: {
        type: "meal_notification",
        meal_type: mealType,
        deep_link: meal.deepLink
      }
    };

    // 6️⃣ FIRE THE BLAST! 🔥
    console.log(`📡 Firing ${meal.label} notification to all active users...`);
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
      JSON.stringify({ success: true, meal_type: mealType, ai_copy: generatedCopy, onesignal: pushResult }),
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