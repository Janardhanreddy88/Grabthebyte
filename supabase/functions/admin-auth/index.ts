import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// PBKDF2 key derivation for secure PIN hashing
async function hashPinSecure(pin: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const pinData = encoder.encode(pin);
  const saltData = encoder.encode(salt);
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    pinData,
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltData,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  
  const hashArray = Array.from(new Uint8Array(derivedBits));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate secure random salt
function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Rate limiting: track failed attempts
const failedAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(userId: string): { allowed: boolean; remainingAttempts: number; lockoutEnds?: number } {
  const now = Date.now();
  const record = failedAttempts.get(userId);
  
  if (!record) {
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
  }
  
  // Reset if lockout period has passed
  if (now - record.lastAttempt > LOCKOUT_TIME) {
    failedAttempts.delete(userId);
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
  }
  
  if (record.count >= MAX_ATTEMPTS) {
    return { 
      allowed: false, 
      remainingAttempts: 0,
      lockoutEnds: record.lastAttempt + LOCKOUT_TIME 
    };
  }
  
  return { allowed: true, remainingAttempts: MAX_ATTEMPTS - record.count };
}

function recordFailedAttempt(userId: string): void {
  const now = Date.now();
  const record = failedAttempts.get(userId);
  
  if (record) {
    record.count += 1;
    record.lastAttempt = now;
  } else {
    failedAttempts.set(userId, { count: 1, lastAttempt: now });
  }
}

function clearFailedAttempts(userId: string): void {
  failedAttempts.delete(userId);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey!);

    // Get authorization header to identify user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify JWT and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, pin, newPin } = await req.json();
    const userId = user.id;

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .in('role', ['admin', 'super_admin'])
      .limit(1)
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle different actions
    switch (action) {
      case 'check-pin': {
        // Check if user has a PIN set
        const { data: pinData } = await supabase
          .from('admin_pins')
          .select('id')
          .eq('user_id', userId)
          .limit(1)
          .single();

        return new Response(
          JSON.stringify({ hasPin: !!pinData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create-pin': {
        // Validate PIN: must be 4-8 digits only
        if (!pin || typeof pin !== 'string' || pin.length < 4 || pin.length > 8 || !/^\d+$/.test(pin)) {
          return new Response(
            JSON.stringify({ error: 'PIN must be 4-8 digits (numbers only)' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if PIN already exists
        const { data: existingPin } = await supabase
          .from('admin_pins')
          .select('id')
          .eq('user_id', userId)
          .limit(1)
          .single();

        if (existingPin) {
          return new Response(
            JSON.stringify({ error: 'PIN already exists. Use change-pin action.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const salt = generateSalt();
        const hashedPin = await hashPinSecure(pin, salt);

        const { error: insertError } = await supabase
          .from('admin_pins')
          .insert({
            user_id: userId,
            pin_hash: hashedPin,
            salt: salt,
          });

        if (insertError) {
          console.error('Error creating PIN:', insertError);
          return new Response(
            JSON.stringify({ error: 'Failed to create PIN' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`PIN created for user ${userId}`);
        return new Response(
          JSON.stringify({ success: true, message: 'PIN created successfully' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'verify-pin': {
        // Check rate limit
        const rateLimit = checkRateLimit(userId);
        if (!rateLimit.allowed) {
          const remainingTime = Math.ceil((rateLimit.lockoutEnds! - Date.now()) / 60000);
          return new Response(
            JSON.stringify({ 
              error: `Too many failed attempts. Try again in ${remainingTime} minutes.`,
              locked: true 
            }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Validate PIN format
        if (!pin || typeof pin !== 'string' || !/^\d{4,8}$/.test(pin)) {
          return new Response(
            JSON.stringify({ error: 'PIN must be 4-8 digits (numbers only)' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: pinData } = await supabase
          .from('admin_pins')
          .select('pin_hash, salt')
          .eq('user_id', userId)
          .limit(1)
          .single();

        if (!pinData) {
          return new Response(
            JSON.stringify({ error: 'No PIN set' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const hashedInput = await hashPinSecure(pin, pinData.salt);
        
        if (hashedInput === pinData.pin_hash) {
          clearFailedAttempts(userId);
          
          // Generate session token
          const sessionToken = generateSalt() + generateSalt();
          const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

          // Store session in database
          await supabase
            .from('admin_sessions')
            .upsert({
              user_id: userId,
              session_token: sessionToken,
              expires_at: expiresAt.toISOString(),
            });

          console.log(`PIN verified for user ${userId}`);
          return new Response(
            JSON.stringify({ 
              success: true, 
              sessionToken,
              expiresAt: expiresAt.toISOString()
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          recordFailedAttempt(userId);
          const remaining = rateLimit.remainingAttempts - 1;
          console.log(`Failed PIN attempt for user ${userId}, ${remaining} attempts remaining`);
          
          return new Response(
            JSON.stringify({ 
              error: 'Invalid PIN',
              remainingAttempts: remaining
            }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'verify-session': {
        const sessionToken = req.headers.get('X-Admin-Session');
        
        if (!sessionToken) {
          return new Response(
            JSON.stringify({ valid: false }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: session } = await supabase
          .from('admin_sessions')
          .select('expires_at')
          .eq('user_id', userId)
          .eq('session_token', sessionToken)
          .limit(1)
          .single();

        if (!session || new Date(session.expires_at) < new Date()) {
          return new Response(
            JSON.stringify({ valid: false }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Extend session
        const newExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
        await supabase
          .from('admin_sessions')
          .update({ expires_at: newExpiresAt.toISOString() })
          .eq('user_id', userId)
          .eq('session_token', sessionToken);

        return new Response(
          JSON.stringify({ valid: true, expiresAt: newExpiresAt.toISOString() }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'change-pin': {
        if (!pin || !newPin) {
          return new Response(
            JSON.stringify({ error: 'Current and new PIN required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify current PIN first
        const { data: pinData } = await supabase
          .from('admin_pins')
          .select('pin_hash, salt')
          .eq('user_id', userId)
          .limit(1)
          .single();

        if (!pinData) {
          return new Response(
            JSON.stringify({ error: 'No PIN set' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const hashedInput = await hashPinSecure(pin, pinData.salt);
        if (hashedInput !== pinData.pin_hash) {
          return new Response(
            JSON.stringify({ error: 'Current PIN is incorrect' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create new PIN
        const newSalt = generateSalt();
        const newHashedPin = await hashPinSecure(newPin, newSalt);

        const { error: updateError } = await supabase
          .from('admin_pins')
          .update({
            pin_hash: newHashedPin,
            salt: newSalt,
          })
          .eq('user_id', userId);

        if (updateError) {
          return new Response(
            JSON.stringify({ error: 'Failed to change PIN' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`PIN changed for user ${userId}`);
        return new Response(
          JSON.stringify({ success: true, message: 'PIN changed successfully' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'logout': {
        const sessionToken = req.headers.get('X-Admin-Session');
        
        if (sessionToken) {
          await supabase
            .from('admin_sessions')
            .delete()
            .eq('user_id', userId)
            .eq('session_token', sessionToken);
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'reset-pin': {
        await supabase
          .from('admin_pins')
          .delete()
          .eq('user_id', userId);

        await supabase
          .from('admin_sessions')
          .delete()
          .eq('user_id', userId);

        console.log(`PIN reset for user ${userId}`);
        return new Response(
          JSON.stringify({ success: true, message: 'PIN reset successfully' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error: unknown) {
    console.error('Admin auth error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
