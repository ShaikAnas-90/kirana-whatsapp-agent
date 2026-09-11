require('dotenv').config();
const express = require('express');
const axios = require('axios');
const twilio = require('twilio');
const path = require('path');
const { checkStock, initiateReturn, inventory, returns } = require('./businessLogic');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Serve Dashboard Frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// APIs for Dashboard polling
app.get('/api/inventory', (req, res) => res.json(inventory));
app.get('/api/returns', (req, res) => res.json(returns));

// Groq Function Calling Schema
const tools = [
  {
    type: "function",
    function: {
      name: "checkStock",
      description: "Check the price and stock availability of an item in the store.",
      parameters: {
        type: "object",
        properties: {
          itemName: { type: "string", description: "The product name, e.g., 'maggi', 'atta'" }
        },
        required: ["itemName"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "initiateReturn",
      description: "Log a customer return request for a previous order.",
      parameters: {
        type: "object",
        properties: {
          orderId: { type: "string", description: "The order ID, e.g., 'ORD101'" },
          reason: { type: "string", description: "Reason for returning the item" }
        },
        required: ["orderId", "reason"]
      }
    }
  }
];

async function callAgent(userMessage) {
  const groqApiKey = process.env.GROQ_API_KEY;
  const url = "https://api.groq.com/openai/v1/chat/completions";

  const systemMessage = {
    role: "system",
    content: "You are an automated shop assistant for a local Indian Kirana store. Keep answers polite, brief, and under 25 words. Always use function calls to check inventory or initiate returns before responding to the customer."
  };

  const messages = [
    systemMessage,
    { role: "user", content: userMessage }
  ];

  try {
    const response = await axios.post(
      url,
      {
        model: "llama-3.3-70b-versatile",
        messages: messages,
        tools: tools,
        tool_choice: "auto"
      },
      { headers: { Authorization: `Bearer ${groqApiKey}`, "Content-Type": "application/json" } }
    );

    const choice = response.data.choices[0].message;

    if (choice.tool_calls && choice.tool_calls.length > 0) {
      const call = choice.tool_calls[0];
      const fnName = call.function.name;
      const fnArgs = JSON.parse(call.function.arguments);

      let resultText = "";
      if (fnName === "checkStock") {
        resultText = checkStock(fnArgs.itemName);
      } else if (fnName === "initiateReturn") {
        resultText = initiateReturn(fnArgs.orderId, fnArgs.reason);
      }

      const followUp = await axios.post(
        url,
        {
          model: "llama-3.3-70b-versatile",
          messages: [
            ...messages,
            choice,
            {
              role: "tool",
              tool_call_id: call.id,
              name: fnName,
              content: resultText
            }
          ]
        },
        { headers: { Authorization: `Bearer ${groqApiKey}`, "Content-Type": "application/json" } }
      );

      return followUp.data.choices[0].message.content;
    }

    return choice.content;
  } catch (err) {
    console.error("Groq API error:", err.response?.data || err.message);
    return "Sorry, our store system is momentarily offline. Please try again shortly.";
  }
}

// Twilio WhatsApp Webhook Endpoint
app.post('/whatsapp', async (req, res) => {
  const incomingMsg = req.body.Body || '';
  const sender = req.body.From;
  console.log(`Message from ${sender}: ${incomingMsg}`);

  const botReply = await callAgent(incomingMsg);

  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(botReply);

  res.writeHead(200, { 'Content-Type': 'text/xml' });
  res.end(twiml.toString());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Kirana Agent running on port ${PORT}`));