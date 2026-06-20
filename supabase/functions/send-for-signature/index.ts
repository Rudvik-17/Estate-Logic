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
 * Uses crypto.subtle to sign with the PKCS#1 RSA private key from DocuSign.
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
 * Create and send a DocuSign envelope with the provided PDF.
 */
async function createEnvelope(
  accessToken: string,
  pdfBase64: string,
  tenantEmail: string,
  tenantName: string,
  landlordName: string,
): Promise<string> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const webhookUrl = `${supabaseUrl}/functions/v1/docusign-webhook`

  const envelopePayload = {
    emailSubject: 'Please sign your lease agreement - Tenura',
    emailBlurb: `Dear ${tenantName}, your landlord ${landlordName} has sent you a lease agreement to sign via Tenura.`,
    status: 'sent',
    documents: [
      {
        documentBase64: pdfBase64,
        name: 'Lease Agreement',
        fileExtension: 'pdf',
        documentId: '1',
      },
    ],
    recipients: {
      signers: [
        {
          email: tenantEmail,
          name: tenantName,
          recipientId: '1',
          routingOrder: '1',
          tabs: {
            signHereTabs: [
              {
                anchorString: '/sig/',
                anchorUnits: 'pixels',
                anchorXOffset: '0',
                anchorYOffset: '0',
                // Fallback: place at bottom-right of the last page
                documentId: '1',
                pageNumber: '1',
                xPosition: '100',
                yPosition: '700',
              },
            ],
          },
        },
      ],
    },
    eventNotification: {
      url: webhookUrl,
      loggingEnabled: 'true',
      jsonNotificationFormat: 'true',
      envelopeEvents: [
        { envelopeEventStatusCode: 'sent' },
        { envelopeEventStatusCode: 'delivered' },
        { envelopeEventStatusCode: 'completed' },
        { envelopeEventStatusCode: 'declined' },
        { envelopeEventStatusCode: 'voided' },
      ],
    },
  }

  const url = `${DOCUSIGN_BASE_URI}/restapi/v2.1/accounts/${DOCUSIGN_ACCOUNT_ID}/envelopes`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(envelopePayload),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(`DocuSign envelope creation failed: ${data.message || JSON.stringify(data)}`)
  }

  return data.envelopeId
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { leaseId, tenantEmail, tenantName, landlordName, pdfBase64 } = await req.json()

    // Validate required fields
    if (!leaseId || !tenantEmail || !tenantName || !landlordName || !pdfBase64) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: leaseId, tenantEmail, tenantName, landlordName, pdfBase64' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('DOCUSIGN_INTEGRATION_KEY length:', DOCUSIGN_INTEGRATION_KEY.length)
    console.log('DOCUSIGN_ACCOUNT_ID length:', DOCUSIGN_ACCOUNT_ID.length)
    console.log('DOCUSIGN_USER_ID length:', DOCUSIGN_USER_ID.length)
    console.log('DOCUSIGN_PRIVATE_KEY length:', DOCUSIGN_PRIVATE_KEY.length)

    // 1. Authenticate with DocuSign via Basic Auth (client_credentials)
    console.log('Authenticating with DocuSign...')
    const accessToken = await getAccessToken()

    // 2. Create and send the envelope
    console.log('Creating DocuSign envelope...')
    const envelopeId = await createEnvelope(accessToken, pdfBase64, tenantEmail, tenantName, landlordName)
    console.log(`Envelope created: ${envelopeId}`)

    // 3. Update the lease record in Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { error: dbError } = await supabase
      .from('leases')
      .update({
        docusign_envelope_id: envelopeId,
        docusign_status: 'sent',
        docusign_sent_at: new Date().toISOString(),
      })
      .eq('id', leaseId)

    if (dbError) {
      console.error('Database update error:', dbError.message)
      // Envelope was sent successfully, so still return success but warn about DB
      return new Response(
        JSON.stringify({
          success: true,
          envelopeId,
          warning: `Envelope sent but database update failed: ${dbError.message}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, envelopeId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('send-for-signature error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
