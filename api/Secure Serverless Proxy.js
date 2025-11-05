/**
 * Vercel Serverless Function: OpenRouter Gemini Proxy
 * * This file replaces proxy_server.js for deployment. It exports the Express
 * app handler, allowing Vercel to run it as a serverless function.
 * * CRITICAL: The OPENROUTER_API_KEY is retrieved from Vercel's Environment Variables.
 */
const express = require('express');
const fetch = require('node-fetch');

const app = express();
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY; // Retrieved from Vercel Environment

// Middleware to parse JSON bodies. Must be placed before handlers.
// The Vercel function URL will be /api/flux-generate
app.use(express.json({ limit: '10mb' })); 

// --- SECURITY AND VALIDATION (Remains the same as before) ---

/**
 * MANDATORY: Check the user's license key against your commercial database.
 * This is the core of your monetization and security.
 * @param {string} key - The license key sent from the Photoshop client.
 * @returns {boolean} - True if the license is valid and active.
 */
function checkLicenseValidity(key) {
    if (!key || key.length < 10) {
        return false;
    }
    
    // !!! CRITICAL COMMERCIAL STEP !!!
    // In a real application, you connect to your database here to verify the key.
    // For deployment, this is a placeholder.
    console.log(`License Key received: ${key.substring(0, 8)}... (Validation placeholder passed)`);
    return true; 
}


// --- API ENDPOINT HANDLER (The Vercel function entry point) ---

app.post('/api/flux-generate', async (req, res) => {
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

    // 3. Check for API Key Availability
    if (!OPENROUTER_API_KEY) {
        console.error('Server missing OPENROUTER_API_KEY environment variable.');
        return res.status(500).json({
            error: {
                type: 'InternalServerError',
                message: 'Server configuration error. Contact support.'
            }
        });
    }

    // 4. Construct OpenRouter Payload
    const messages = [];
    
    // Add image content part
    messages.push({
        type: "text",
        text: analyze_only ? prompt : 'Generate an image that blends seamlessly with the existing content and follows this description: ' + prompt
    });

    // Add text content part (containing the image data URI)
    messages.push({
        type: "image_url",
        image_url: {
            url: image_data // Base64 data URI from the client
        }
    });

    const openRouterPayload = {
        model: model_id,
        messages: [{ role: "user", content: messages }],
        temperature: parseFloat(temperature),
        stream: false
    };

    try {
        // 5. Call OpenRouter API (Securely)
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