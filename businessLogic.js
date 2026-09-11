const inventory = {
  "colgate": { name: "Colgate 200g", stock: 12, price: 95.00 },
  "maggi": { name: "Maggi 2-Min (Pack of 4)", stock: 30, price: 56.00 },
  "parle-g": { name: "Parle-G 80g", stock: 0, price: 10.00 },
  "surf excel": { name: "Surf Excel 1kg", stock: 8, price: 140.00 },
  "atta": { name: "Aashirvaad Atta 5kg", stock: 10, price: 260.00 },
  "oil": { name: "Fortune Sunflower Oil 1L", stock: 15, price: 135.00 }
};

let returns = [
  { orderId: "ORD-9021", reason: "Damaged packaging on arrival", status: "Pending Review" }
];

let recentOrders = [];
let metrics = { revenueRecovered: 0, ordersSaved: 0 };
let lastQueriedItem = "maggi";

function addNewItem(id, name, price, stock) {
  inventory[id.toLowerCase().trim()] = { name: name, price: parseFloat(price), stock: parseInt(stock) };
}

// NEW: remove an item from the store entirely
function removeItem(id) {
  const key = (id || '').toLowerCase().trim();
  if (!inventory[key]) return false;
  delete inventory[key];
  if (lastQueriedItem === key) lastQueriedItem = Object.keys(inventory)[0] || null;
  return true;
}

function checkStock(itemName) {
  if (!itemName) return "Namaste! Please tell me which grocery item you are looking for.";
  const query = itemName.toLowerCase().trim();
  const matchedKey = Object.keys(inventory).find(k => k.includes(query) || query.includes(k));

  if (!matchedKey) return `Kshama karein, we don't have ${itemName}. Please check our dashboard for available items.`;

  lastQueriedItem = matchedKey;
  const item = inventory[matchedKey];

  if (item.stock === 0) return `⚠️ ${item.name} is currently out of stock. Restocking soon!`;
  return `Haanji! ${item.name} is available for ₹${item.price}. Current stock: ${item.stock} units. Type "order ${matchedKey}" to buy.`;
}

// accepts an array of { key, qty } so a single message can order multiple items
function placeOrder(orderItems) {
  if (!orderItems || orderItems.length === 0) {
    return `Sorry, I couldn't understand what you'd like to order. Try "order 2 maggi and 1 oil".`;
  }

  const problems = [];
  const resolved = [];

  for (const { key, qty } of orderItems) {
    const item = inventory[key];
    if (!item) {
      problems.push(`- ${key} not found`);
      continue;
    }
    if (item.stock < qty) {
      problems.push(`- ${item.name}: only ${item.stock} left, you asked for ${qty}`);
      continue;
    }
    resolved.push({ key, item, qty });
  }

  if (resolved.length === 0) {
    return `❌ Order failed:\n${problems.join('\n')}`;
  }

  let total = 0;
  const lines = [];
  for (const { item, qty } of resolved) {
    item.stock -= qty;
    const lineTotal = item.price * qty;
    total += lineTotal;
    lines.push(`${qty}x ${item.name} — ₹${lineTotal.toFixed(2)}`);
  }

  const orderNum = "ORD-" + Math.floor(1000 + Math.random() * 9000);
  metrics.revenueRecovered += total;
  metrics.ordersSaved += 1;
  recentOrders.unshift({
    orderId: orderNum,
    item: resolved.map(r => `${r.qty}x ${r.item.name}`).join(', '),
    qty: resolved.reduce((sum, r) => sum + r.qty, 0),
    total: total,
    status: "Confirmed"
  });

  const qrImageUrl = "/qr.jpeg";
  let reply = `✅ Order Confirmed: #${orderNum}\n🛒 ${lines.join('\n')}\n💰 Total: ₹${total.toFixed(2)}\n⚡ Delivery in 15 mins.`;

  if (problems.length > 0) {
    reply += `\n\n⚠️ Could not add:\n${problems.join('\n')}`;
  }

  reply += `\n\n📱 **Scan below to pay instantly via UPI:**\n<img src="${qrImageUrl}" width="160" alt="UPI QR Code" style="margin-top:8px; border-radius:8px;" />`;

  return reply;
}

function initiateReturn(orderId, reason) {
  if (!orderId || !reason) return "Please provide both the Order ID and reason.";
  const cleanId = orderId.toUpperCase().replace('#', '');
  returns.unshift({ orderId: cleanId, reason: reason, status: "Pending Review" });
  return `📋 Return request logged for Order #${cleanId}.\nShopkeeper will inspect it shortly!`;
}

function approveReturn(orderId) {
  const ret = returns.find(r => r.orderId === orderId);
  if (ret && ret.status !== "Approved") {
    ret.status = "Approved";
    const order = recentOrders.find(o => o.orderId === orderId);
    if (order) metrics.revenueRecovered = Math.max(0, metrics.revenueRecovered - order.total);
  }
}

module.exports = { checkStock, placeOrder, initiateReturn, approveReturn, addNewItem, removeItem, inventory, returns, recentOrders, metrics };