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

function placeOrder(itemName, qty = 1) {
  const target = itemName ? itemName.toLowerCase().trim() : lastQueriedItem;
  const matchedKey = Object.keys(inventory).find(k => k.includes(target) || target.includes(k)) || lastQueriedItem;
  const item = inventory[matchedKey];

  if (!item || item.stock < qty) return `Sorry, we cannot fulfill this order right now due to stock shortage.`;

  item.stock -= qty;
  const orderNum = "ORD-" + Math.floor(1000 + Math.random() * 9000);
  const totalAmount = item.price * qty;

  metrics.revenueRecovered += totalAmount;
  metrics.ordersSaved += 1;
  recentOrders.unshift({ orderId: orderNum, item: item.name, qty: qty, total: totalAmount, status: "Confirmed" });

  return `✅ Order Confirmed: #${orderNum}\n🛒 ${qty}x ${item.name}\n💰 Total: ₹${totalAmount}\n⚡ Delivery in 15 mins.\n📲 Pay via UPI: kirana@upi`;
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

module.exports = { checkStock, placeOrder, initiateReturn, approveReturn, addNewItem, inventory, returns, recentOrders, metrics };