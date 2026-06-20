import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * Map DocuSign envelope status strings to our internal status values.
 * DocuSign statuses: created, sent, delivered, completed, declined, voided, etc.
 */
function mapDocuSignStatus(dsStatus: string): string | null {
  const normalized = dsStatus.toLowerCase().trim()
  const statusMap: Record<string, string> = {
    sent: 'sent',
    delivered: 'delivered',
    completed: 'completed',
    signed: 'completed',
    declined: 'declined',
    voided: 'voided',
  }
  return statusMap[normalized] ?? null
}

/**
 * Extract envelope ID and status from DocuSign Connect XML payload.
 * DocuSign Connect sends XML by default.
 */
function parseXmlPayload(xml: string): { envelopeId: string; status: string } | null {
  // Extract EnvelopeStatus > EnvelopeID
  const envelopeIdMatch = xml.match(/<EnvelopeID>([^<]+)<\/EnvelopeID>/i)
  // Extract EnvelopeStatus > Status
  const statusMatch = xml.match(/<Status>([^<]+)<\/Status>/i)

  if (!envelopeIdMatch || !statusMatch) {
    return null
  }

  return {
    envelopeId: envelopeIdMatch[1].trim(),
    status: statusMatch[1].trim(),
  }
}

/**
 * Extract envelope ID and status from JSON payload.
 * DocuSign Connect can also be configured to send JSON.
 */
function parseJsonPayload(body: Record<string, unknown>): { envelopeId: string; status: string } | null {
  // JSON webhook format varies; common shapes:
  // { envelopeId, status } or { data: { envelopeId, envelopeSummary: { status } } }
  const envelopeId = (body.envelopeId as string)
    || (body.data as Record<string, unknown>)?.envelopeId as string
    || ''
  const status = (body.status as string)
    || (body.data as Record<string, unknown>)?.envelopeSummary
      && ((body.data as Record<string, unknown>).envelopeSummary as Record<string, unknown>).status as string
    || ''

  if (!envelopeId || !status) return null
  return { envelopeId, status }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const contentType = req.headers.get('content-type') || ''
    const rawBody = await req.text()

    let parsed: { envelopeId: string; status: string } | null = null

    if (contentType.includes('xml') || rawBody.trim().startsWith('<')) {
      // Parse XML payload (default DocuSign Connect format)
      parsed = parseXmlPayload(rawBody)
    } else {
      // Try JSON
      try {
        const jsonBody = JSON.parse(rawBody)
        parsed = parseJsonPayload(jsonBody)
      } catch {
        // Fallback: try XML parsing on the raw body
        parsed = parseXmlPayload(rawBody)
      }
    }

    if (!parsed) {
      console.error('Could not parse webhook payload:', rawBody.substring(0, 500))
      // Return 200 to prevent DocuSign from retrying for unparseable payloads
      return new Response('OK', { status: 200, headers: corsHeaders })
    }

    const { envelopeId, status: rawStatus } = parsed
    const mappedStatus = mapDocuSignStatus(rawStatus)

    if (!mappedStatus) {
      console.log(`Ignoring unrecognized DocuSign status: ${rawStatus} for envelope ${envelopeId}`)
      return new Response('OK', { status: 200, headers: corsHeaders })
    }

    console.log(`DocuSign webhook: envelope=${envelopeId}, status=${rawStatus} → ${mappedStatus}`)

    // Update Supabase using service role key to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Build update payload
    const updateData: Record<string, unknown> = {
      docusign_status: mappedStatus,
    }

    // If signing is completed, also mark the lease as signed and active
    if (mappedStatus === 'completed') {
      const now = new Date().toISOString()
      updateData.docusign_signed_at = now
      updateData.signed_at = now
      updateData.status = 'active'
    }

    const { data, error: dbError } = await supabase
      .from('leases')
      .update(updateData)
      .eq('docusign_envelope_id', envelopeId)
      .select('id')

    if (dbError) {
      console.error(`Database update error for envelope ${envelopeId}:`, dbError.message)
      // Still return 200 to prevent DocuSign retries — log the error for debugging
      return new Response('OK', { status: 200, headers: corsHeaders })
    }

    if (!data || data.length === 0) {
      console.warn(`No lease found for envelope ID: ${envelopeId}`)
    } else {
      console.log(`Updated lease ${data[0].id} to status ${mappedStatus}`)
    }

    return new Response('OK', { status: 200, headers: corsHeaders })
  } catch (error) {
    console.error('docusign-webhook error:', error.message)
    // Return 200 to prevent infinite retries from DocuSign
    return new Response('OK', { status: 200, headers: corsHeaders })
  }
})
