require('dotenv').config();
const express = require('express');
const twilio = require('twilio');
const path = require('path');
const { checkStock, placeOrder, initiateReturn, approveReturn, addNewItem, inventory, returns, recentOrders, metrics } = require('./businessLogic');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // serves qr.jpeg and dashboard assets

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

// Smarter Agent Engine
async function callAgent(userMessage) {
  const text = (userMessage || '').trim();
  const lower = text.toLowerCase();

  // 0. Greeting -> show live menu of items
  const greetings = ['hii', 'hi', 'hello', 'hey', 'namaste', 'menu', 'start'];
  if (greetings.includes(lower)) {
    const catalogKeys = Object.keys(inventory);
    const items = catalogKeys
      .map((key, i) => {
        const item = inventory[key];
        const stockLabel = item.stock === 0 ? '(Out of stock)' : `(${item.stock} left)`;
        return `${i + 1}. ${item.name} — ₹${item.price} ${stockLabel}`;
      })
      .join('\n');
    return `Namaste! 🙏 Welcome to Shree Ganesh Kirana Store.\n\nHere's what we have:\n${items}\n\nReply with the item name or number to check stock, or type "order <item>" to buy.`;
  }

  const catalogKeys = Object.keys(inventory);

  // 1. Number selection (e.g. user replies "2")
  if (/^\d+$/.test(lower)) {
    const idx = parseInt(lower, 10) - 1;
    if (catalogKeys[idx]) return checkStock(catalogKeys[idx]);
    return 'Please reply with a valid item number from the menu. Type "hii" to see the menu again.';
  }

  // 2. Dynamic matching against current inventory
  let matchedKey = catalogKeys.find(k => lower.includes(k.toLowerCase()));

  // Slang aliases
  if (!matchedKey) {
    if (lower.includes('tel') || lower.includes('nune')) matchedKey = 'oil';
    if (lower.includes('biscuit') || lower.includes('parle')) matchedKey = 'parle-g';
    if (lower.includes('surf')) matchedKey = 'surf excel';
  }

  // 3. Intent detection
  const isOrder = ['order', 'buy', 'chahiye', 'pack', 'bhej', 'send', 'give', 'want'].some(k => lower.includes(k)) && !lower.includes('return');
  const isReturn = ['return', 'damage', 'expired', 'kharab', 'broken', 'wapas'].some(k => lower.includes(k));

  if (isReturn) {
    const idMatch = text.match(/ORD-?\d+/i);
    return initiateReturn(idMatch ? idMatch[0] : 'ORD-9901', 'Customer requested return');
  }

  if (matchedKey) {
    if (isOrder) return placeOrder(matchedKey);
    return checkStock(matchedKey);
  }

  return 'Namaste! 🙏 I am KiranaAI. You can ask me to:\n📦 Check stock (e.g. "Do you have Maggi?")\n🛍️ Order (e.g. "Send 1 Maggi")\n🔄 Return (e.g. "Return ORD-1234")\n\nOr just type "hii" to see the full menu.';
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
app.listen(PORT, () => console.log(`KiranaAI OS v2.6 Running: http://localhost:${PORT}`));