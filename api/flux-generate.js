/**
 * Vercel Serverless Function: OpenRouter Gemini Proxy
 * * Purpose: This script securely handles requests from the Photoshop JSX client.
 * 1. Validates the commercial license key sent by the client.
 * 2. Uses the secret OPENROUTER_API_KEY (stored securely on Vercel) to make the API call.
 * 3. Relays the result back to the Photoshop client.
 * * CRITICAL: This file exports the Express app handler (`module.exports = app;`), which
 * allows Vercel's serverless runtime to execute it.
 */
const express = require('express');
const fetch = require('node-fetch');

const app = express();
// Key is retrieved from Vercel's Environment Variables (set in Vercel project settings)
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY; 

// Middleware: Allows large payloads (up to 10MB) to handle the base64 image data.
app.use(express.json({ limit: '10mb' })); 

// --- SECURITY AND VALIDATION ---

/**
 * MANDATORY: Check the user's license key against your commercial database.
 * @param {string} key - The license key sent from the Photoshop client.
 * @returns {boolean} - True if the license is valid and active.
 */
function checkLicenseValidity(key) {
    if (!key || key.length < 10) {
        return false;
    }
    
    // !!! CRITICAL COMMERCIAL STEP !!!
    // REPLACE THIS PLACEHOLDER: This is where you connect to your database 
    // (e.g., Firestore, MongoDB) to verify the purchased key's status.
    console.log(`License Key received: ${key.substring(0, 8)}... (Validation placeholder passed)`);
    return true; 
}


// --- API ENDPOINT HANDLER (The Vercel function entry point) ---

// 1. GET ROUTE (Health Check)
// The Vercel URL (e.g., https://your-domain.vercel.app/api/flux-generate) maps to this path.
app.get('/', (req, res) => {
    res.status(200).json({
        status: 'OK',
        message: 'Vercel Serverless Function is running. Ready for POST requests.',
        instructions: 'Send a POST request to this endpoint (/api/flux-generate) with license_key and image_data.'
    });
});

// 2. POST ROUTE (The core logic)
// Using '/' here ensures the handler fires correctly when a POST request hits /api/flux-generate.
app.post('/', async (req, res) => {
    // 1. Extract Data from Client
    const { 
        license_key, 
        model_id, 
        temperature, 
        prompt, 
        negative_prompt, 
        analyze_only, 
        image_data 
    } = req.body;

    // 2. License Validation Check
    if (!checkLicenseValidity(license_key)) {
        console.error('Validation failed for key:', license_key);
        return res.status(403).json({
            error: {
                type: 'AuthenticationError',
                message: 'Invalid or expired product license key. Please check your settings.'
            }
        });
    }

    // 3. Check for API Key Availability (Must be set in Vercel Environment Variables)
    if (!OPENROUTER_API_KEY) {
        console.error('Server missing OPENROUTER_API_KEY environment variable.');
        return res.status(500).json({
            error: {
                type: 'InternalServerError',
                message: 'Server configuration error. OPENROUTER_API_KEY not found.'
            }
        });
    }

    // 4. Construct OpenRouter Payload
    const messages = [];
    
    // Add text part (prompt/instruction)
    messages.push({
        type: "text",
        text: analyze_only ? prompt : 'Generate an image that blends seamlessly with the existing content and follows this description: ' + prompt
    });

    // Add image part (base64 data URI)
    messages.push({
        type: "image_url",
        image_url: {
            url: image_data 
        }
    });

    const openRouterPayload = {
        model: model_id,
        messages: [{ role: "user", content: messages }],
        temperature: parseFloat(temperature),
        stream: false
    };

    try {
        // 5. Call OpenRouter API (Securely with hidden key)
        const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`, // <-- SECRET KEY USED HERE
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(openRouterPayload)
        });

        const data = await openRouterResponse.json();

        // 6. Relay Response to Client
        if (openRouterResponse.ok) {
            console.log('OpenRouter API call successful. Relaying result.');
            return res.json(data);
        } else {
            console.error('OpenRouter API returned an error:', data);
            return res.status(data.status || 500).json({
                error: {
                    type: data.error?.type || 'OpenRouterAPIError',
                    message: data.error?.message || 'Failed to generate image due to an external API issue.'
                }
            });
        }

    } catch (error) {
        console.error('Proxy caught an exception:', error);
        res.status(500).json({
            error: {
                type: 'ProxyExecutionError',
                message: 'An unexpected error occurred on the proxy server.'
            }
        });
    }
});


// IMPORTANT: Export the app handler for Vercel's serverless runtime
module.exports = app;
