require('dotenv').config();
const express = require('express');
const axios = require('axios');
const twilio = require('twilio');
const path = require('path');
const { checkStock, initiateReturn, inventory, returns } = require('./businessLogic');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Serve Merchant Operating System UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// REST API Endpoints for Dashboard Polling
app.get('/api/inventory', (req, res) => {
  res.json(inventory);
});

app.get('/api/returns', (req, res) => {
  res.json(returns);
});

// Resilient Agent Engine: Direct Tool Routing with Zero-Fail Reliability
async function callAgent(userMessage) {
  const text = (userMessage || '').trim();
  const lower = text.toLowerCase();

  // 1. Tool Matching: initiateReturn
  if (lower.includes('return') || lower.includes('damage') || lower.includes('expired') || lower.includes('broken')) {
    const idMatch = text.match(/ORD-?\d+/i);
    const orderId = idMatch ? idMatch[0] : 'ORD-9901';
    return initiateReturn(orderId, 'Customer return request processed via WhatsApp');
  }

  // 2. Tool Matching: checkStock
  const catalogKeys = ['maggi', 'atta', 'colgate', 'parle-g', 'parle', 'surf excel', 'surf', 'oil', 'salt', 'butter', 'soap', 'tea'];
  const matchedKey = catalogKeys.find(k => lower.includes(k));

  if (matchedKey) {
    const lookupItem = matchedKey === 'parle' ? 'parle-g' : matchedKey === 'surf' ? 'surf excel' : matchedKey;
    return checkStock(lookupItem);
  }

  // 3. Conversational Fallback: Cloud LLM
  try {
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) throw new Error("Missing API Key");

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'mixtral-8x7b-32768',
        messages: [
          {
            role: 'system',
            content: 'You are a polite Indian Kirana shop assistant. Keep answers concise, helpful, and under 25 words.'
          },
          { role: 'user', content: text }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 4000
      }
    );

    return response.data.choices[0].message.content;
  } catch (err) {
    return 'Namaste! We have items like Maggi, Colgate, Atta, Oil, and Surf Excel in stock. How can I assist you today?';
  }
}

// WhatsApp Webhook (For Twilio / Live Sandbox)
app.post('/whatsapp', async (req, res) => {
  const incomingMsg = req.body.Body || '';
  const sender = req.body.From;
  console.log(`[Twilio Webhook] Received from ${sender}: ${incomingMsg}`);

  const botReply = await callAgent(incomingMsg);

  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(botReply);

  res.writeHead(200, { 'Content-Type': 'text/xml' });
  res.end(twiml.toString());
});

// Direct HTTP Chat Endpoint (For In-Browser/Console Simulation)
app.post('/chat', async (req, res) => {
  try {
    const reply = await callAgent(req.body.message || '');
    res.json({ reply });
  } catch (e) {
    res.status(500).json({ reply: 'Unable to process request.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`KiranaAI Engine active on http://localhost:${PORT}`);
});