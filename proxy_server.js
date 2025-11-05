/**
 * Secure Proxy Server for OpenRouter/Gemini API Calls
 *
 * This Node.js/Express server handles requests from the Photoshop JSX client.
 * Its purpose is to securely validate the user's commercial license key and
 * use the secret OpenRouter API Key (stored in environment variables) to
 * make the paid API call.
 */

// Load environment variables from .env file (for local development)
require('dotenv').config(); 
const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = 3000;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY; // Loaded securely from .env

// Middleware to parse JSON bodies
app.use(express.json({ limit: '10mb' })); // Allow large payloads for image data

// --- SECURITY AND VALIDATION ---

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
    // In a real application, this is where you would:
    // 1. Connect to your Firestore/MongoDB/SQL database.
    // 2. Look up the key.
    // 3. Check its expiration date and usage limits.
    // 4. Return true only if valid.
    
    console.log(`License Key received: ${key.substring(0, 8)}... (Validation placeholder passed)`);
    return true; 
}


// --- API ENDPOINT ---

// NEW: Add a simple GET route for health checks/browser access
app.get('/api/flux-generate', (req, res) => {
    res.status(200).json({
        status: 'OK',
        message: 'AI Proxy Server is running and ready to accept POST requests from the Photoshop plugin.',
        instructions: 'Please run the Photoshop ExtendScript to send a POST request with the license key and image data.'
    });
});

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
        // OpenRouter specific parameters
        temperature: parseFloat(temperature),
        // Add negative prompt in the 'system' role or via extension if the model supports it.
        // For Gemini (image model), we often embed negative prompts in the user instruction.
        // For now, we rely on the prompt construction above.
        // Add additional request headers for openrouter
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

// --- SERVER STARTUP ---
app.listen(PORT, () => {
    if (!OPENROUTER_API_KEY) {
        console.error('\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        console.error('!!! ERROR: OPENROUTER_API_KEY is not set in .env file. !!!');
        console.error('!!! The server will not function correctly.            !!!');
        console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n');
    }
    console.log(`\n--- Server is running on http://localhost:${PORT} ---`);
    console.log('Update openrouter_gemini_plugin.jsx CONFIG.BACKEND_API_URL to:');
    console.log(`http://localhost:${PORT}/api/flux-generate\n`);
});