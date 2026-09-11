const inventory = {
  "colgate": { name: "Colgate 200g", stock: 12, price: 95.00 },
  "maggi": { name: "Maggi 2-Min (Pack of 4)", stock: 30, price: 56.00 },
  "parle-g": { name: "Parle-G 80g", stock: 0, price: 10.00 },
  "surf excel": { name: "Surf Excel 1kg", stock: 8, price: 140.00 },
  "atta": { name: "Aashirvaad Atta 5kg", stock: 10, price: 260.00 },
  "oil": { name: "Fortune Sunflower Oil 1L", stock: 15, price: 135.00 }
};

let returns = [
  { orderId: "ORD-9021", reason: "Damaged packaging on arrival", status: "Pending Review" },
  { orderId: "ORD-8812", reason: "Wrong item variant delivered", status: "Approved" }
];

function checkStock(itemName) {
  if (!itemName) return "Please state which product you are looking for.";
  const query = itemName.toLowerCase().trim();
  const matchedKey = Object.keys(inventory).find(k => k.includes(query) || query.includes(k));

  if (!matchedKey) {
    return `Sorry, we do not have ${itemName} in stock right now.`;
  }

  const item = inventory[matchedKey];
  if (item.stock === 0) {
    return `${item.name} is currently out of stock.`;
  }
  return `Yes! ${item.name} is available for ₹${item.price}. Stock remaining: ${item.stock} units.`;
}

function initiateReturn(orderId, reason) {
  if (!orderId || !reason) {
    return "Please specify both the Order ID and reason.";
  }
  const cleanId = orderId.toUpperCase().replace('#', '');
  returns.unshift({
    orderId: cleanId,
    reason: reason,
    status: "Pending Review"
  });
  return `Return request recorded for order #${cleanId}. The shopkeeper will verify it shortly.`;
}

module.exports = { checkStock, initiateReturn, inventory, returns };