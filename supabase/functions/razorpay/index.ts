import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID') || ''
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET') || ''

async function verifySignature(orderId: string, paymentId: string, signature: string, secret: string): Promise<boolean> {
  const text = `${orderId}|${paymentId}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(text)
  );
  
  const hashArray = Array.from(new Uint8Array(sigBuffer));
  const generatedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return generatedSignature === signature;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const rawIp = req.headers.get('x-forwarded-for');
  const ip = rawIp ? rawIp.split(',')[0].trim() : 'unknown';
  const key = `razorpay:${ip}`;
  
  const now = new Date();
  const limit = 5; // Razorpay payment function gets limit of 5 per minute
  const windowMs = 60000;
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

  let isLimited = false;
  let retryAfter = 60;

  try {
    const { data: record, error: recordError } = await supabaseAdmin
      .from('rate_limits')
      .select('count, reset_at')
      .eq('id', key)
      .maybeSingle();

    if (recordError) {
      console.error('Database rate limit check error:', recordError.message);
    }

    const resetAtDate = record ? new Date(record.reset_at) : null;
    const isExpired = !resetAtDate || resetAtDate.getTime() <= now.getTime();

    if (record && !isExpired && record.count >= limit) {
      isLimited = true;
      retryAfter = Math.ceil((resetAtDate.getTime() - now.getTime()) / 1000);
    } else {
      if (record && !isExpired) {
        const { error: updateError } = await supabaseAdmin
          .from('rate_limits')
          .update({ count: record.count + 1 })
          .eq('id', key);
        if (updateError) {
          console.error('Database rate limit update error:', updateError.message);
        }
      } else {
        const resetAt = new Date(now.getTime() + windowMs).toISOString();
        const { error: upsertError } = await supabaseAdmin
          .from('rate_limits')
          .upsert({ id: key, count: 1, reset_at: resetAt });
        if (upsertError) {
          console.error('Database rate limit upsert error:', upsertError.message);
        }
      }
    }
  } catch (err) {
    console.error('Rate limit logic error:', err.message);
  }

  if (isLimited) {
    return new Response(JSON.stringify({
      error: "Too many requests. Please try again later.",
      retryAfter: retryAfter > 0 ? retryAfter : 60
    }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const { action, ...payload } = await req.json();

    if (action === 'create-order') {
      const { amount, paymentId } = payload;
      if (!amount || !paymentId) {
        return new Response(JSON.stringify({ error: 'Missing amount or paymentId' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const amountInPaise = Math.round(amount * 100);

      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}`
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: 'INR',
          receipt: paymentId
        })
      });

      const order = await response.json();
      if (!response.ok) {
        throw new Error(order.error?.description || 'Failed to create Razorpay order');
      }

      return new Response(JSON.stringify({ orderId: order.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'verify-payment') {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, paymentId } = payload;
      
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !paymentId) {
        return new Response(JSON.stringify({ error: 'Missing payment details' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const isValid = await verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature, RAZORPAY_KEY_SECRET);
      if (!isValid) {
        return new Response(JSON.stringify({ error: 'Signature verification failed' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Update database using Supabase Service Role client to bypass RLS securely
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
      const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
      const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

      const { error: dbError } = await supabase
        .from('payments')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_method: 'razorpay',
          transaction_id: razorpay_payment_id,
          razorpay_payment_id: razorpay_payment_id,
          razorpay_order_id: razorpay_order_id
        })
        .eq('id', paymentId);

      if (dbError) {
        throw new Error(dbError.message);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    throw new Error('Invalid action');
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})
