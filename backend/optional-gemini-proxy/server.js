// backend/optional-gemini-proxy/server.js
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3001;

// Helper to load environment variables from .env files
function loadEnv() {
  let apiKey = process.env.GEMINI_API_KEY || '';
  
  // Try loading from root .env
  const possiblePaths = [
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, './.env'),
    path.resolve(process.cwd(), '.env')
  ];

  for (const envPath of possiblePaths) {
    try {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const match = content.match(/GEMINI_API_KEY\s*=\s*([^\r\n]+)/);
        if (match && match[1]) {
          apiKey = match[1].trim().replace(/['"]/g, '');
          break;
        }
      }
    } catch (e) {
      // Ignore reading error
    }
  }
  return apiKey;
}

const geminiApiKey = loadEnv();

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/api/agentic-voice' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { prompt } = JSON.parse(body);
        const apiKey = geminiApiKey || process.env.GEMINI_API_KEY || '';

        if (!apiKey) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            error: "Gemini API key is not configured in the backend environment. Please set GEMINI_API_KEY in your .env file." 
          }));
          return;
        }

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const geminiReq = https.request(geminiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        }, (geminiRes) => {
          let geminiBody = '';
          geminiRes.on('data', c => { geminiBody += c; });
          geminiRes.on('end', () => {
            res.writeHead(geminiRes.statusCode, { 'Content-Type': 'application/json' });
            res.end(geminiBody);
          });
        });

        geminiReq.on('error', (err) => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Proxy server connection to Gemini API failed: ${err.message}` }));
        });

        geminiReq.write(JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        }));
        geminiReq.end();

      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Invalid request payload: ${err.message}` }));
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found.' }));
  }
});

server.listen(PORT, () => {
  console.log(`Backend Gemini proxy server running on http://localhost:${PORT}`);
});
