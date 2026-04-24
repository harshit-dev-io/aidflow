const functions = require('firebase-functions');
const axios = require('axios');
const admin = require('firebase-admin');

admin.initializeApp();

// Configuration: Replace with your actual deployed Django URL later, or use ngrok for local testing
const DJANGO_API_URL = 'http://localhost:8000/api/process-data';

/**
 * Triggered automatically whenever a new file is uploaded to Firebase Storage.
 * It immediately sends the file reference to the Django backend for Gemini AI processing.
 */
exports.onFileUploaded = functions.storage.object().onFinalize(async (object) => {
    try {
        const fileBucket = object.bucket; // The Storage bucket that contains the file.
        const filePath = object.name; // File path in the bucket.
        const contentType = object.contentType; // File content type.

        // Generate a public URL or Signed URL to the file so Django can download it
        const bucket = admin.storage().bucket(fileBucket);
        const file = bucket.file(filePath);
        
        const [signedUrl] = await file.getSignedUrl({
            action: 'read',
            expires: '03-09-2491' // Far future expiry for simplicity
        });

        console.log(`[AidFlow Storage Hook] Detected new file: \${filePath}. Forwarding to Django Backend...`);
        
        // POST to your Django `/api/process-data` endpoint
        const response = await axios.post(DJANGO_API_URL, {
            file_url: signedUrl,
            file_type: contentType,
            name: filePath,
            // Simulating OCR extracted text payload for Demo MVP purposes:
            // Assuming the Django prompt parses raw_text_extracted as specified in views.py
            raw_text_extracted: `[Simulation from File \${filePath}] Flood reported near Northern street intersection.` 
        });

        console.log(`[AidFlow Storage Hook] Successfully triggered webhook. Django Response:`, response.data);

    } catch (error) {
        console.error(`[AidFlow Storage Hook] Failed to proxy to Django:`, error.message);
    }
});
