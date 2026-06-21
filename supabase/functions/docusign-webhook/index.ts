import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const DOCUSIGN_INTEGRATION_KEY = Deno.env.get('DOCUSIGN_INTEGRATION_KEY') || ''
const DOCUSIGN_ACCOUNT_ID = Deno.env.get('DOCUSIGN_ACCOUNT_ID') || ''
const DOCUSIGN_BASE_URI = Deno.env.get('DOCUSIGN_BASE_URI') || 'https://demo.docusign.net'
const DOCUSIGN_USER_ID = Deno.env.get('DOCUSIGN_USER_ID') || ''
const DOCUSIGN_PRIVATE_KEY = Deno.env.get('DOCUSIGN_PRIVATE_KEY') || ''

/** Base64url encode (no padding) */
function b64url(input: Uint8Array | string): string {
  const str = typeof input === 'string'
    ? btoa(input)
    : btoa(String.fromCharCode(...input))
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Get a DocuSign access token via JWT Bearer Grant.
 * Uses crypto.subtle to sign with the PKCS#8 or PKCS#1 RSA private key from DocuSign.
 */
async function getAccessToken(): Promise<string> {
  if (!DOCUSIGN_PRIVATE_KEY) {
    throw new Error('DOCUSIGN_PRIVATE_KEY not configured')
  }

  // Strip PEM headers and whitespace to get raw base64 DER
  const pemContents = DOCUSIGN_PRIVATE_KEY
    .replace('-----BEGIN RSA PRIVATE KEY-----', '')
    .replace('-----END RSA PRIVATE KEY-----', '')
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')

  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))

  // Import the RSA private key for signing
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  // Build JWT header + payload
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({
    iss: DOCUSIGN_INTEGRATION_KEY,
    sub: DOCUSIGN_USER_ID,
    aud: 'account-d.docusign.com',
    iat: now,
    exp: now + 3600,
    scope: 'signature impersonation',
  }))

  // Sign and assemble the JWT
  const signingInput = new TextEncoder().encode(`${header}.${payload}`)
  const signatureBuffer = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, signingInput)
  const signature = b64url(new Uint8Array(signatureBuffer))
  const assertion = `${header}.${payload}.${signature}`

  // Exchange JWT for access token
  const response = await fetch('https://account-d.docusign.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(`DocuSign auth failed: ${data.error || data.error_description || JSON.stringify(data)}`)
  }

  return data.access_token
}

/**
 * Download signed PDF from DocuSign
 */
async function downloadSignedDocument(accessToken: string, envelopeId: string): Promise<Blob> {
  const url = `${DOCUSIGN_BASE_URI}/restapi/v2.1/accounts/${DOCUSIGN_ACCOUNT_ID}/envelopes/${envelopeId}/documents/1`
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`DocuSign PDF download failed: ${response.status} ${response.statusText} - ${errorText}`)
  }

  return await response.blob()
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

    // If signing is completed, also mark the lease as signed and active, and fetch the PDF
    if (mappedStatus === 'completed') {
      const now = new Date().toISOString()
      updateData.docusign_signed_at = now
      updateData.signed_at = now
      updateData.status = 'active'

      try {
        console.log(`Downloading signed PDF from DocuSign for envelope: ${envelopeId}...`)
        const token = await getAccessToken()
        const pdfBlob = await downloadSignedDocument(token, envelopeId)
        
        console.log(`Uploading signed PDF to Supabase Storage for envelope: ${envelopeId}...`)
        // Ensure "leases" bucket exists (safe to run, will be created if not exists)
        await supabase.storage.createBucket('leases', {
          public: true,
          allowedMimeTypes: ['application/pdf']
        })

        const fileName = `${envelopeId}.pdf`
        const { error: uploadError } = await supabase.storage
          .from('leases')
          .upload(fileName, pdfBlob, {
            contentType: 'application/pdf',
            upsert: true
          })

        if (uploadError) {
          throw uploadError
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('leases')
          .getPublicUrl(fileName)

        if (urlData?.publicUrl) {
          console.log(`Signed PDF uploaded successfully. Public URL: ${urlData.publicUrl}`)
          updateData.document_url = urlData.publicUrl
        }
      } catch (err) {
        console.error(`Warning: Failed to fetch/store signed PDF for envelope ${envelopeId}:`, err.message)
      }
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
