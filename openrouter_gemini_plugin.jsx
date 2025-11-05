/**
 * Script for Photoshop ExtendScript (JSX)
 *
 * Commercial Readiness Update: Secure Proxy Architecture
 * The script now communicates with a placeholder backend server URL (BACKEND_API_URL)
 * instead of the OpenRouter API directly. This removes the sensitive OPENROUTER_API_KEY
 * from the client-side code, which is MANDATORY for commercial stability.
 *
 * The client sends the user's Product License Key to the server for authentication.
 */

#target photoshop

// ===== CONFIGURATION =====
var CONFIG = {
    // Model versions (OpenRouter model id)
    MODELS: {
        "Nano Banana (مجانا)": "google/gemini-2.5-flash-image-preview"
    },
    // Server Endpoint: Replace this with the URL of your secure API proxy.
    // === UPDATED FOR LOCAL TESTING ===
    BACKEND_API_URL: "http://localhost:3000/api/flux-generate", 
    DEFAULT_MODEL: "Nano Banana (مجانا)",
    DEFAULT_TEMPERATURE: 0.7,
    DEFAULT_NEGATIVE_PROMPT: "low quality, blurry, distorted, tiling, watermark",
    
    // This key is loaded from the file and acts as the commercial gate (DRM)
    PRODUCT_LICENSE_KEY: getLicenseKey() 
};

// Global for the progress dialog
var progressWindow = null;

// =================================================================================
// NOTE FOR COMMERCIALIZATION: 
// The OpenRouter API Key is NO LONGER IN THIS FILE. It must be stored securely
// on the server you are pointing to via CONFIG.BACKEND_API_URL.
// =================================================================================

// ===== CORE UTILITIES =====

function parseJSON(str) {
    var result = {};
    if (!str) return null;

    try {
        str = str.replace(/\s+/g, ' ').trim();
        
        var match;
        
        // Check for common API error structure (including errors returned from your server)
        if (match = str.match(/"error"\s*:\s*\{([^}]+)\}/)) {
            var errorContent = match[1];
            var messageMatch = errorContent.match(/"message"\s*:\s*"([^"]+)"/);
            var typeMatch = errorContent.match(/"type"\s*:\s*"([^"]+)"/);
            
            result.error = {
                message: messageMatch ? messageMatch[1] : 'Unknown Server/API Error',
                type: typeMatch ? typeMatch[1] : 'API_ERROR'
            };
            return result;
        }

        // Check for success content (text or image data URI/URL)
        var contentMatch = str.match(/"content"\s*:\s*"([^"]+)"/);
        var textMatch = str.match(/"text"\s*:\s*"([^"]+)"/);

        var finalContent = textMatch ? textMatch[1] : (contentMatch ? contentMatch[1] : null);
        
        if (finalContent) {
            var urlRe = new RegExp("(data:image\\/[A-Za-z0-9+]+;base64,[A-Za-z0-9+\\/=]+|https?:\\/\\/[^\"'\\s]+\\.(?:jpg|jpeg|png|webp)(?:\\?[^\"'\\s]*)?)", "i");
            var urlMatch = urlRe.exec(finalContent);
            if (urlMatch) {
                return { 
                    choices: [{ 
                        message: { 
                            content: urlMatch[1] 
                        } 
                    }] 
                };
            } else {
                return { choices: [{ message: { content: finalContent } }] };
            }
        }

    } catch (e) {
        return null; 
    }
    return null;
}

function showProgress(message) {
    if (!progressWindow) {
        progressWindow = new Window("palette", "AI Image Generation", [100, 100, 500, 180]);
        progressWindow.alignChildren = "center";
        progressWindow.orientation = "column";
        progressWindow.msg = progressWindow.add("statictext", undefined, message);
        progressWindow.msg.preferredSize.width = 380;
        progressWindow.msg.justify = 'center';
        progressWindow.bar = progressWindow.add("progressbar", [20, 35, 380, 50], 0, 100);
    }
    
    if (progressWindow.bar.value >= 100) progressWindow.bar.value = 0;
    progressWindow.bar.value = (progressWindow.bar.value + 10) % 100;
    progressWindow.msg.text = message;
    progressWindow.show();
    progressWindow.update();
    
    $.sleep(100); 
}

function hideProgress() {
    if (progressWindow) {
        progressWindow.close();
        progressWindow = null;
    }
}

// ===== PRODUCT LICENSE MANAGEMENT (DRM GATE) =====

function getLicenseKey() {
    var licenseKey = loadLicenseKey();
    if (!licenseKey || licenseKey.length < 10) {
        licenseKey = promptForLicenseKey();
        if (licenseKey && licenseKey.length > 10) {
            saveLicenseKey(licenseKey);
        }
    }
    return licenseKey;
}

function getPreferencesFile() {
    var prefsFolder = new Folder(Folder.userData + "/FluxKontext");
    if (!prefsFolder.exists) {
        prefsFolder.create();
    }
    return new File(prefsFolder + "/preferences.json");
}

function saveLicenseKey(licenseKey) {
    try {
        var prefsFile = getPreferencesFile();
        prefsFile.open("w");
        prefsFile.write('{"licenseKey":"' + licenseKey + '"}');
        prefsFile.close();
        return true;
    } catch (e) {
        return false;
    }
}

function loadLicenseKey() {
    try {
        var prefsFile = getPreferencesFile();
        if (prefsFile.exists) {
            prefsFile.open("r");
            var content = prefsFile.read();
            prefsFile.close();
            var match = content.match(/"licenseKey"\s*:\s*"([^"]+)"/);
            if (match && match[1]) {
                return match[1];
            }
        }
    } catch (e) {}
    return null;
}

function promptForLicenseKey(fromSettings) {
    var dialog = new Window("dialog", "Product License Key " + (fromSettings ? "Settings" : "Required"));
    dialog.orientation = "column";
    dialog.alignChildren = "fill";
    dialog.preferredSize.width = 520;
    dialog.margins = 15;
    dialog.spacing = 10;

    var instructionPanel = dialog.add("panel", undefined, fromSettings ? "Update Product License Key" : "License Required to Run");
    instructionPanel.alignChildren = "left";
    instructionPanel.margins = 10;

    instructionPanel.add("statictext", undefined, "1. This product requires a valid commercial license key.");
    instructionPanel.add("statictext", undefined, "2. Enter the key you received after purchase.");
    instructionPanel.add("statictext", undefined, "3. Key is stored locally and sent to your server for validation.");

    var apiKeyGroup = dialog.add("group");
    apiKeyGroup.add("statictext", undefined, "License Key:");
    var apiKeyInput = apiKeyGroup.add("edittext", undefined, "");
    apiKeyInput.characters = 60;

    if (fromSettings && CONFIG.PRODUCT_LICENSE_KEY) {
        apiKeyInput.text = CONFIG.PRODUCT_LICENSE_KEY;
        apiKeyInput.active = true;
        var maskedKey = CONFIG.PRODUCT_LICENSE_KEY.substr(0, 8) + "..." + CONFIG.PRODUCT_LICENSE_KEY.substr(-4);
        var currentKeyText = dialog.add("statictext", undefined, "Current key: " + maskedKey);
        try { currentKeyText.graphics.font = ScriptUI.newFont(currentKeyText.graphics.font.name, ScriptUI.FontStyle.ITALIC, 10); } catch (e) {}
    } else {
        apiKeyInput.active = true;
    }

    var buttonGroup = dialog.add("group");
    buttonGroup.alignment = "center";
    var okButton = buttonGroup.add("button", undefined, fromSettings ? "Update" : "OK");
    var cancelButton = buttonGroup.add("button", undefined, "Cancel");

    okButton.onClick = function () {
        if (apiKeyInput.text.length < 10) {
            alert("Please enter a valid license key (must be at least 10 characters).");
        } else {
            dialog.close(1);
        }
    };

    cancelButton.onClick = function () {
        dialog.close(0);
    };

    var result = dialog.show();

    if (result == 1) {
        return apiKeyInput.text;
    }
    return null;
}

function validateLicense(key) {
    // NOTE: In a production environment, this function MUST be replaced by a 
    // secure call to your server to verify the license key. 
    // Since we're now sending the key with every generation request, 
    // the server will perform the validation there.
    
    // For now, we only check for minimum length.
    return key && key.length >= 10;
}


// ===== CROSS-PLATFORM HELPERS =====

function getCurlCommand(curlCmd, outputFile, isBinary) {
    var isWindows = $.os.indexOf("Windows") !== -1;
    if (isWindows) {
        curlCmd = curlCmd.replace(/^curl\s/, "curl.exe ");
        if (isBinary) {
            return 'cmd.exe /c ' + curlCmd + ' -o "' + outputFile + '"';
        } else {
            return 'cmd.exe /c ' + curlCmd + ' > "' + outputFile + '" 2>&1';
        }
    } else {
        if (isBinary) {
            return '/bin/sh -c \'' + curlCmd.replace(/"/g, '\\"') + ' -o "' + outputFile + '"\'';
        } else {
            return '/bin/sh -c \'' + curlCmd.replace(/"/g, '\\"') + ' > "' + outputFile + '" 2>&1\'';
        }
    }
}

function getBase64Command(inputFile, outputFile) {
    var isWindows = $.os.indexOf("Windows") !== -1;
    if (isWindows) {
        return 'cmd.exe /c certutil -encode "' + inputFile + '" "' + outputFile + '"';
    } else {
        return '/usr/bin/base64 < "' + inputFile + '" > "' + outputFile + '"';
    }
}


// ===== UNDO MANAGEMENT & DIALOG CREATION =====

function executeWithHistory(operationName, prompt, selectedModel, newDocument, upscale, negativePrompt, temperature, analyzeOnly, generativeExpand) {
    var funcCall = "processSelection('" + 
                   prompt.replace(/'/g, "\\'") + "', '" + 
                   selectedModel + "', " + 
                   newDocument + ", " + 
                   upscale + ", '" + 
                   negativePrompt.replace(/'/g, "\\'") + "', " + 
                   temperature + ", " + 
                   analyzeOnly + ", " + 
                   generativeExpand + ")";
                   
    app.activeDocument.suspendHistory(operationName, funcCall);
}

function main() {
    // 1. DRM CHECK
    if (!CONFIG.PRODUCT_LICENSE_KEY || !validateLicense(CONFIG.PRODUCT_LICENSE_KEY)) {
        CONFIG.PRODUCT_LICENSE_KEY = getLicenseKey();
        if (!validateLicense(CONFIG.PRODUCT_LICENSE_KEY)) {
            alert("Product not licensed. Script execution terminated.");
            return;
        }
    }

    // 2. CONTINUE EXECUTION (App is licensed)
    if (!app.documents.length) {
        alert("Please open an image in Photoshop first!");
        return;
    }

    if (!hasActiveSelection()) {
        alert("Please make a selection first using any selection tool!");
        return;
    }

    var dialog = createDialog();
    var result = dialog.show();

    if (result == 1) {
        var prompt = dialog.promptInput.text;
        var negativePrompt = dialog.negativePromptInput.text;
        var selectedModel = dialog.modelDropdown.selection.text;
        var newDocument = dialog.newDocCheckbox.value;
        var analyzeOnly = dialog.analyzeOnlyCheckbox.value;
        var generativeExpand = dialog.generativeExpandCheckbox.value;
        var temperature = dialog.creativitySlider.value;
        var upscale = false;

        if (prompt.length > 0 || analyzeOnly) {
            var operationName = "AI Generation: " + prompt.substring(0, 30);
            
            if (newDocument || (generativeExpand && !analyzeOnly)) {
                processSelection(prompt, selectedModel, newDocument, upscale, negativePrompt, temperature, analyzeOnly, generativeExpand);
            } else {
                executeWithHistory(operationName, prompt, selectedModel, newDocument, upscale, negativePrompt, temperature, analyzeOnly, generativeExpand);
            }
        } else {
            alert("Please enter a prompt or select 'Analyze Only'!");
        }
    }
}

function createDialog() {
    var dialog = new Window("dialog", "OpenRouter Gemini Image Editor | تطوير قناة مدرسة الذكاء الاصطناعي");
    dialog.orientation = "column";
    dialog.alignChildren = "fill";
    dialog.preferredSize.width = 450;
    dialog.margins = 15;
    dialog.spacing = 10;

    // --- Panel 1: Prompts & Model ---
    var promptPanel = dialog.add("panel", undefined, "Prompts & Model");
    promptPanel.alignChildren = "fill";
    promptPanel.margins = 10;

    promptPanel.add("statictext", undefined, "Positive Prompt (What you want):");
    dialog.promptInput = promptPanel.add("edittext", undefined, "");
    dialog.promptInput.characters = 50;
    dialog.promptInput.active = true;
    
    promptPanel.add("statictext", undefined, "Negative Prompt (What to avoid, e.g., 'blurry'):");
    dialog.negativePromptInput = promptPanel.add("edittext", undefined, CONFIG.DEFAULT_NEGATIVE_PROMPT);
    dialog.negativePromptInput.characters = 50;

    var modelGroup = promptPanel.add("group");
    modelGroup.orientation = "row";
    modelGroup.add("statictext", undefined, "Model:");
    var modelOptions = [];
    for (var k in CONFIG.MODELS) { if (CONFIG.MODELS.hasOwnProperty(k)) modelOptions.push(k); }
    dialog.modelDropdown = modelGroup.add("dropdownlist", undefined, modelOptions);
    dialog.modelDropdown.selection = 0;
    
    // --- Panel 2: Output Options ---
    var optionsPanel = dialog.add("panel", undefined, "Generation Settings");
    optionsPanel.alignChildren = "fill";
    optionsPanel.margins = 10;

    var tempGroup = optionsPanel.add("group");
    tempGroup.alignment = "fill";
    tempGroup.add("statictext", undefined, "Creativity (Temperature 0.0-1.0):");
    dialog.creativitySlider = tempGroup.add("slider", undefined, CONFIG.DEFAULT_TEMPERATURE * 100, 0, 100);
    dialog.creativityValue = tempGroup.add("statictext", undefined, CONFIG.DEFAULT_TEMPERATURE.toFixed(1));
    dialog.creativitySlider.preferredSize.width = 250;
    
    dialog.creativitySlider.onChanging = function() {
        dialog.creativityValue.text = (this.value / 100).toFixed(2);
    };
    
    var checkboxGroup = optionsPanel.add("group");
    checkboxGroup.orientation = "column";
    checkboxGroup.alignChildren = "left";
    
    dialog.newDocCheckbox = checkboxGroup.add("checkbox", undefined, "Output to a new document (No inpaint)");
    dialog.newDocCheckbox.value = false;
    
    dialog.generativeExpandCheckbox = checkboxGroup.add("checkbox", undefined, "Generative Expand (Expand canvas to fit result)");
    dialog.generativeExpandCheckbox.value = false;

    dialog.analyzeOnlyCheckbox = checkboxGroup.add("checkbox", undefined, "Analyze Selection Only (Text output)");
    dialog.analyzeOnlyCheckbox.value = false;
    
    dialog.analyzeOnlyCheckbox.onClick = function() {
        if (this.value) { dialog.generativeExpandCheckbox.value = false; }
    }
    
    dialog.generativeExpandCheckbox.onClick = function() {
        if (this.value) { dialog.analyzeOnlyCheckbox.value = false; }
    }

    // --- Footer and Buttons ---
    var footerGroup = dialog.add("group");
    footerGroup.orientation = "row";
    footerGroup.alignChildren = ["left","center"];
    
    var subscribeText = footerGroup.add("statictext", undefined, "Subscribe to ARABIAN AI channel on YOUTUBE");
    try {
        subscribeText.graphics.font = ScriptUI.newFont(subscribeText.graphics.font.name, ScriptUI.FontStyle.SEMIBOLD, 11);
    } catch (e) {}

    var openBtn = footerGroup.add("button", undefined, "Open Channel");
    openBtn.onClick = function () {
        // Simple helper function to open URL
        try {
            var isWindows = ($.os.indexOf("Windows") !== -1);
            var isMac = ($.os.indexOf("Mac") !== -1 || $.os.indexOf("Macintosh") !== -1);
            if (isWindows) {
                app.system('cmd.exe /c start "" "https://www.youtube.com/@ArabianAiSchool"');
            } else if (isMac) {
                app.system('/usr/bin/open "https://www.youtube.com/@ArabianAiSchool"');
            } else {
                app.system('xdg-open "https://www.youtube.com/@ArabianAiSchool"');
            }
        } catch (e) {
            alert("Could not open URL.");
        }
    };
    
    var settingsBtn = footerGroup.add("button", undefined, "License Key Settings");
    settingsBtn.onClick = function () {
        var newKey = promptForLicenseKey(true);
        if (newKey && newKey.length > 10) {
            CONFIG.PRODUCT_LICENSE_KEY = newKey;
            saveLicenseKey(newKey);
            alert("License key updated successfully!");
        }
    };

    var buttonGroup = dialog.add("group");
    buttonGroup.alignment = "center";
    var generateButton = buttonGroup.add("button", undefined, "Generate / Analyze");
    var cancelButton = buttonGroup.add("button", undefined, "Cancel");

    generateButton.onClick = function () { dialog.close(1); };
    cancelButton.onClick = function () { dialog.close(0); };

    return dialog;
}

function hasActiveSelection() {
    try {
        var bounds = app.activeDocument.selection.bounds;
        return true;
    } catch (e) {
        return false;
    }
}

function processSelection(prompt, modelName, newDocument, upscale, negativePrompt, temperature, analyzeOnly, generativeExpand) {
    var doc = app.activeDocument;
    var modelId = CONFIG.MODELS[modelName];
    var savedSelection = null;
    var tempFile = null;
    var x1, y1, x2, y2;

    try {
        // --- 1. Prepare Document and Get Bounds ---
        if (generativeExpand && !analyzeOnly) {
            newDocument = true;
            doc.selection.copy();
            selectAll();
            doc.selection.paste();
            doc.selection.deselect();
            
            x1 = 0; y1 = 0;
            x2 = doc.width.value; y2 = doc.height.value;
            
        } else {
            savedSelection = doc.channels.add();
            savedSelection.name = "AI Selection";
            doc.selection.store(savedSelection);
            
            var bounds = doc.selection.bounds;
            x1 = Math.round(bounds[0].value);
            y1 = Math.round(bounds[1].value);
            x2 = Math.round(bounds[2].value);
            y2 = Math.round(bounds[3].value);
        }

        // --- 2. Export Selection ---
        showProgress("1/3: Exporting selection...");
        tempFile = exportSelection(doc, x1, y1, x2, y2);
        
        if (!tempFile || !tempFile.exists) {
            alert("Could not export selection.");
            if (savedSelection) savedSelection.remove();
            return;
        }

        // --- 3. Call API (The new proxy call) ---
        showProgress("2/3: Calling Secure Backend Proxy...");
        var resultData = callOpenRouterAPI(tempFile, prompt, modelId, upscale, negativePrompt, temperature, analyzeOnly);

        tempFile.remove(); // Cleanup input file

        if (!resultData) {
            alert("API call failed or returned no data.");
            if (savedSelection) savedSelection.remove();
            return;
        }
        
        // --- 4. Handle Result ---
        if (analyzeOnly) {
            alert("AI Analysis Result:\n\n" + resultData);
        } else {
            showProgress("3/3: Downloading and processing image...");
            var resultFile = downloadOpenRouterResult(resultData);
            
            if (resultFile && resultFile.exists) {
                if (newDocument) {
                    app.open(resultFile);
                } else {
                    placeResultInDocument(doc, resultFile, x1, y1, x2, y2, savedSelection, prompt);
                }
                resultFile.remove();
            } else {
                alert("Generation failed: Could not download result image.");
            }
        }

    } catch (e) {
        alert("Processing error: " + e.message + " on line " + e.line);
    } finally {
        if (savedSelection) savedSelection.remove();
        hideProgress();
    }
}

function exportSelection(doc, x1, y1, x2, y2) {
    try {
        var originalUnit = app.preferences.rulerUnits;
        app.preferences.rulerUnits = Units.PIXELS;
        
        var tempDoc = app.documents.add(x2 - x1, y2 - y1, doc.resolution, "AI Input", NewDocumentMode.RGB, DocumentFill.TRANSPARENT);
        
        doc.selection.copy(true);
        tempDoc.paste();
        
        var timestamp = new Date().getTime();
        var tempFile = new File(Folder.temp + "/flux_input_" + timestamp + ".jpg");

        var saveOptions = new JPEGSaveOptions();
        saveOptions.quality = 10;
        tempDoc.saveAs(tempFile, saveOptions, true, Extension.LOWERCASE);

        tempDoc.close(SaveOptions.DONOTSAVECHANGES);
        app.preferences.rulerUnits = originalUnit;
        
        return tempFile;

    } catch (e) {
        alert("Export error: " + e.message);
        return null;
    }
}

// ===== SECURE PROXY API CALL =====

function callOpenRouterAPI(imageFile, prompt, modelId, upscale, negativePrompt, temperature, analyzeOnly) {
    var response = null;
    try {
        // 1. Convert image to Base64
        showProgress("1/3: Converting image to Base64...");
        var base64File = new File(Folder.temp + "/openrouter_base64_" + new Date().getTime() + ".txt");
        var cmd = getBase64Command(imageFile.fsName, base64File.fsName);
        app.system(cmd);
        if (!base64File.exists) { alert("Could not convert image to base64"); return null; }

        base64File.open("r");
        var base64Data = base64File.read();
        base64File.close();

        if ($.os.indexOf("Windows") !== -1) {
            base64Data = base64Data.replace(/-----BEGIN CERTIFICATE-----/g, "");
            base64Data = base64Data.replace(/-----END CERTIFICATE-----/g, "");
        }
        base64Data = base64Data.replace(/[\r\n\s]/g, "");
        base64File.remove();

        var dataUrl = "data:image/jpeg;base64," + base64Data;
        
        // 2. Construct Payload for YOUR SERVER
        showProgress("2/3: Constructing payload for your server...");
        var payloadFile = new File(Folder.temp + "/openrouter_payload_" + new Date().getTime() + ".json");
        payloadFile.open("w");
        
        var escPrompt = escapeJsonString(prompt);
        var escNegPrompt = escapeJsonString(negativePrompt);
        var tempValue = (temperature / 100).toFixed(2);
        
        // The server receives this simplified payload, validates the license_key, 
        // and then builds the actual OpenRouter API request.
        var payloadStr =
            '{' +
              '"license_key":"' + CONFIG.PRODUCT_LICENSE_KEY + '",' + // <-- CRITICAL: Send key for server validation
              '"model_id":"' + modelId + '",' +
              '"temperature":' + tempValue + ',' +
              '"prompt":"' + escPrompt + '",' +
              '"negative_prompt":"' + escNegPrompt + '",' +
              '"analyze_only":' + analyzeOnly + ',' +
              '"image_data":"' + dataUrl + '"' + // Send image data
            '}';

        payloadFile.write(payloadStr);
        payloadFile.close();
        
        // 3. Execute cURL (to your server endpoint)
        showProgress("3/3: Sending request and waiting for response...");
        var responseFile = new File(Folder.temp + "/openrouter_response_" + new Date().getTime() + ".json");
        var curlCmd = getCurlCommand(
            'curl -s -X POST ' +
            '-H "Content-Type: application/json" ' +
            '-d @"' + payloadFile.fsName + '" ' +
            '"' + CONFIG.BACKEND_API_URL + '"', // <-- TARGETING YOUR SECURE SERVER
            responseFile.fsName
        );
        app.system(curlCmd);
        payloadFile.remove();

        if (!responseFile.exists) { alert("No response file created by cURL (Check your server logs)."); return null; }

        responseFile.open("r");
        response = responseFile.read();
        responseFile.close();
        responseFile.remove();
        
        // 4. Parse Response
        var json = parseJSON(response);

        if (json && json.error) {
            alert("Server/API Error (" + json.error.type + "): \n" + json.error.message);
            return null;
        }

        if (json && json.choices && json.choices.length > 0) {
             var resultContent = json.choices[0].message.content;
             return analyzeOnly ? resultContent : response;
        }

        alert("Could not extract result from response. Response:\n" + response);
        return null;

    } catch (e) {
        alert("API execution error: " + e.message + " on line " + e.line);
        return null;
    } finally {
        if (analyzeOnly) hideProgress();
    }
}

function downloadOpenRouterResult(response) {
    try {
        var json = parseJSON(response);
        var imageUrl = null;

        if (json && json.choices && json.choices.length > 0 && json.choices[0].message && json.choices[0].message.content) {
            var contentStr = json.choices[0].message.content;
            var dataUriRe = new RegExp("(data:image\\/[A-Za-z0-9+]+;base64,[A-Za-z0-9+\\/=]+)");
            var m1 = dataUriRe.exec(contentStr);
            if (m1 && m1[1]) {
                imageUrl = m1[1];
            } else {
                var urlRe = new RegExp("https?:\\/\\/[^\"'\\s]+\\.(?:jpg|jpeg|png|webp)(?:\\?[^\"'\\s]*)?", "i");
                var m2 = urlRe.exec(contentStr);
                if (m2 && m2[0]) imageUrl = m2[0];
            }
        }
        
        if (!imageUrl) {
            alert("No valid image URL or Base64 data found in the AI response.");
            return null;
        }

        var timestamp = new Date().getTime();
        var resultFile = new File(Folder.temp + "/openrouter_result_" + timestamp + ".jpg");

        // Download or decode
        if (imageUrl.indexOf("data:image/") === 0) {
            var b64file = new File(Folder.temp + "/tmp_b64_" + timestamp + ".txt");
            b64file.open("w");
            b64file.write(imageUrl.replace(/^data:image\/[A-Za-z0-9+]+;base64,/, ""));
            b64file.close();

            if ($.os.indexOf("Windows") !== -1) {
                var decCmd = 'cmd.exe /c certutil -decode "' + b64file.fsName + '" "' + resultFile.fsName + '"';
                app.system(decCmd);
            } else {
                var decCmd = '/bin/sh -c \'/usr/bin/base64 -D -i "' + b64file.fsName + '" > "' + resultFile.fsName + '"\'';
                app.system(decCmd);
            }
            b64file.remove();
        } else {
            var curlCmd = getCurlCommand('curl -s -L --max-time 180 "' + imageUrl + '"', resultFile.fsName, true);
            app.system(curlCmd);
        }

        if (resultFile.exists && resultFile.length > 0) {
            return resultFile;
        }
        
        alert("Downloaded file is empty or missing.");
        return null;

    } catch (e) {
        alert("Download error: " + e.message + " on line " + e.line);
        return null;
    }
}


// ===== Placement into document =====

function placeResultInDocument(doc, resultFile, x1, y1, x2, y2, savedSelection, prompt) {
    try {
        var originalRulerUnits = app.preferences.rulerUnits;
        app.preferences.rulerUnits = Units.PIXELS;
        
        var resultDoc = app.open(resultFile);

        resultDoc.artLayers[0].duplicate(doc, ElementPlacement.PLACEATBEGINNING);
        resultDoc.close(SaveOptions.DONOTSAVECHANGES);

        var newLayer = doc.artLayers[0];
        newLayer.name = "Gemini AI: " + prompt.substring(0, 30);

        var targetWidth = x2 - x1;
        var targetHeight = y2 - y1;

        var currentBounds = newLayer.bounds;
        var currentWidth = currentBounds[2].value - currentBounds[0].value;
        var currentHeight = currentBounds[3].value - currentBounds[1].value;

        if (Math.abs(currentWidth - targetWidth) > 1 || Math.abs(currentHeight - targetHeight) > 1) {
             var scaleX = (targetWidth / currentWidth) * 100;
             var scaleY = (targetHeight / currentHeight) * 100;
             newLayer.resize(scaleX, scaleY, AnchorPosition.TOPLEFT);
        }

        var dx = x1 - newLayer.bounds[0].value;
        var dy = y1 - newLayer.bounds[1].value;
        newLayer.translate(dx, dy);

        if (savedSelection) {
            doc.selection.load(savedSelection);
            addLayerMask();
            doc.selection.deselect();
        }
        
        var newGroup = doc.layerSets.add();
        newGroup.name = "AI Inpaint: " + prompt.substring(0, 30);
        newLayer.move(newGroup, ElementPlacement.PLACEATBEGINNING);
        
        app.preferences.rulerUnits = originalRulerUnits;

    } catch (e) {
        alert("Placement error: " + e.message + " on line " + e.line);
    }
}

// ===== HELPER FUNCTIONS =====

function selectAll() {
    app.activeDocument.selection.selectAll();
}

function addLayerMask() {
    try {
        var idMk = charIDToTypeID("Mk  ");
        var desc = new ActionDescriptor();
        var idNw = charIDToTypeID("Nw  ");
        var idChnl = charIDToTypeID("Chnl");
        desc.putClass(idNw, idChnl);
        var idAt = charIDToTypeID("At  ");
        var ref = new ActionReference();
        var idChnl2 = charIDToTypeID("Chnl");
        var idChnl3 = charIDToTypeID("Chnl");
        var idMsk = charIDToTypeID("Msk ");
        ref.putEnumerated(idChnl2, idChnl3, idMsk);
        desc.putReference(idAt, ref);
        var idUsng = charIDToTypeID("Usng");
        var idUsrM = charIDToTypeID("UsrM");
        var idRvlS = charIDToTypeID("RvlS");
        desc.putEnumerated(idUsng, idUsrM, idRvlS);
        executeAction(idMk, desc, DialogModes.NO);
    } catch (e) {}
}

function escapeJsonString(str) {
    return str.replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
}

// ===== START SCRIPT EXECUTION =====
main();