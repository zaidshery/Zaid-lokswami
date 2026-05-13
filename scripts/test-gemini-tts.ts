import dotenv from 'dotenv';
import path from 'path';

// Load env from .env.hostinger to simulate production
dotenv.config({ path: path.resolve(process.cwd(), '.env.hostinger') });

async function testGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  console.log(`Testing Gemini API...`);
  console.log(`Model: ${modelName}`);
  console.log(`API Key: ${apiKey ? (apiKey.slice(0, 5) + '...') : 'MISSING'}`);

  if (!apiKey) {
    console.error('Error: GEMINI_API_KEY is not set in .env.hostinger');
    process.exit(1);
  }

  try {
    // We use a simple fetch to test the API key validity
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: 'Say "Gemini is online" in Hindi' }]
        }]
      })
    });

    const data = await response.json() as any;

    if (!response.ok) {
      throw new Error(`Gemini API Error: ${data.error?.message || response.statusText}`);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log(`Response: ${text}`);
    console.log('PASS: Gemini API is working.');
  } catch (error) {
    console.error('FAIL: Gemini API test failed.');
    console.error(error);
    process.exit(1);
  }
}

testGemini();
