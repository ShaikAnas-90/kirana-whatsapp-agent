require('dotenv').config();
const express = require('express');
const twilio = require('twilio');
const path = require('path');
const { checkStock, placeOrder, initiateReturn, approveReturn, addNewItem, removeItem, inventory, returns, recentOrders, metrics } = require('./businessLogic');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // serves qr.jpeg etc from /public

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));

app.get('/api/inventory', (req, res) => res.json(inventory));
app.get('/api/returns', (req, res) => res.json(returns));
app.get('/api/orders', (req, res) => res.json(recentOrders));
app.get('/api/metrics', (req, res) => res.json(metrics));

app.post('/api/approve', (req, res) => {
  approveReturn(req.body.orderId);
  res.json({ success: true });
});

app.post('/api/inventory', (req, res) => {
  const { id, name, price, stock } = req.body;
  addNewItem(id, name, price, stock);
  res.json({ success: true });
});

// NEW: remove an item from the store via the dashboard
app.delete('/api/inventory/:id', (req, res) => {
  const removed = removeItem(req.params.id);
  res.json({ success: removed });
});

// Builds the numbered menu text from whatever is currently in stock
function buildMenuText() {
  const catalogKeys = Object.keys(inventory);
  if (catalogKeys.length === 0) {
    return "Sorry, the store currently has no items listed. Please check back soon!";
  }
  const items = catalogKeys
    .map((key, i) => {
      const item = inventory[key];
      const stockLabel = item.stock === 0 ? '(Out of stock)' : `(${item.stock} left)`;
      return `${i + 1}. ${item.name} — ₹${item.price} ${stockLabel}`;
    })
    .join('\n');
  return `Namaste! 🙏 Welcome to Anas Bhai Kirana Store.\n\nHere's what we have:\n${items}\n\nReply with the item name or number to check stock. To order more than one thing, try:\n"order 2 maggi and 1 oil"`;
}

// Parses free text like "2 maggi and 1 oil" or "maggi x2, surf excel"
// into [{ key: "maggi", qty: 2 }, { key: "oil", qty: 1 }]
function parseOrderItems(text) {
  const catalogKeys = Object.keys(inventory);
  const lower = text.toLowerCase();

  const cleaned = lower.replace(/\b(order|buy|chahiye|pack|bhej do|bhej|send|give|want)\b/g, '');
  const chunks = cleaned.split(/,|\band\b|&|\+/).map(c => c.trim()).filter(Boolean);

  const results = [];
  for (const chunk of chunks) {
    let qty = 1;
    let qtyMatch = chunk.match(/x\s*(\d+)/) || chunk.match(/(\d+)\s*x?/) || chunk.match(/(\d+)/);
    if (qtyMatch) qty = parseInt(qtyMatch[1], 10);

    let matchedKey = catalogKeys.find(k => chunk.includes(k.toLowerCase()));
    if (!matchedKey) {
      if (chunk.includes('tel') || chunk.includes('nune')) matchedKey = 'oil';
      else if (chunk.includes('biscuit') || chunk.includes('parle')) matchedKey = 'parle-g';
      else if (chunk.includes('surf')) matchedKey = 'surf excel';
    }

    if (matchedKey) {
      results.push({ key: matchedKey, qty: qty > 0 ? qty : 1 });
    }
  }

  return results;
}

// Broad set of phrasings that should all show the menu -
// covers greetings AND "give me the list" style requests
function isListRequest(lower) {
  const greetings = ['hii', 'hi', 'hello', 'hey', 'namaste', 'menu', 'start'];
  if (greetings.includes(lower)) return true;

  const listPhrases = [
    'list of items', 'item list', 'list items', 'show items', 'show list',
    'show me the list', 'show me items', 'what do you have', 'what all do you have',
    'products list', 'all products', 'all items', 'full list', 'catalogue',
    'catalog', 'what items', 'available items', 'stock list', 'everything you have',
    'i need list', 'give me list', 'give me the list', 'send list', 'send me list',
    'items available', 'what do you sell', 'what all items', 'show catalogue',
    'show catalog', 'list please', 'sabkuch dikhao', 'sab items', 'list dikhao'
  ];
  return listPhrases.some(p => lower.includes(p));
}

// Smarter Agent Engine
async function callAgent(userMessage) {
  const text = (userMessage || '').trim();
  const lower = text.toLowerCase();

  // 0. Greeting or "show me everything" style request -> live menu
  if (isListRequest(lower)) {
    return buildMenuText();
  }

  const catalogKeys = Object.keys(inventory);

  // 1. Number selection (e.g. user replies "2")
  if (/^\d+$/.test(lower)) {
    const idx = parseInt(lower, 10) - 1;
    if (catalogKeys[idx]) return checkStock(catalogKeys[idx]);
    return 'Please reply with a valid item number from the menu. Type "hii" to see the menu again.';
  }

  const isOrder = ['order', 'buy', 'chahiye', 'pack', 'bhej do', 'bhej', 'send', 'give', 'want'].some(k => lower.includes(k)) && !lower.includes('return');
  const isReturn = ['return', 'damage', 'expired', 'kharab', 'broken', 'wapas'].some(k => lower.includes(k));

  if (isReturn) {
    const idMatch = text.match(/ORD-?\d+/i);
    return initiateReturn(idMatch ? idMatch[0] : 'ORD-9901', 'Customer requested return');
  }

  if (isOrder) {
    const orderItems = parseOrderItems(text);
    return placeOrder(orderItems);
  }

  // 2. Single-item stock check (no order/return keywords)
  let matchedKey = catalogKeys.find(k => lower.includes(k.toLowerCase()));
  if (!matchedKey) {
    if (lower.includes('tel') || lower.includes('nune')) matchedKey = 'oil';
    if (lower.includes('biscuit') || lower.includes('parle')) matchedKey = 'parle-g';
    if (lower.includes('surf')) matchedKey = 'surf excel';
  }

  if (matchedKey) return checkStock(matchedKey);

  return 'Namaste! 🙏 I am KiranaAI. You can ask me to:\n📦 Check stock (e.g. "Do you have Maggi?")\n📋 See the full list (e.g. "list of items")\n🛍️ Order multiple items (e.g. "order 2 maggi and 1 oil")\n🔄 Return (e.g. "Return ORD-1234")';
}

app.post('/chat', async (req, res) => {
  try {
    const reply = await callAgent(req.body.message || '');
    res.json({ reply });
  } catch (e) {
    res.status(500).json({ reply: 'Server error.' });
  }
});

app.post('/whatsapp', async (req, res) => {
  const botReply = await callAgent(req.body.Body || '');
  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(botReply);
  res.writeHead(200, { 'Content-Type': 'text/xml' });
  res.end(twiml.toString());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`KiranaAI OS v2.8 Running: http://localhost:${PORT}`));