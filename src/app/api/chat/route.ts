import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ═══════════════════════════════════════════════════════════════════════════
// ─── CONVERSATION STATE (multi-turn) ────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

interface PendingAction {
  action: string;
  args: Record<string, unknown>;
  missingFields: string[];
}

interface ConversationState {
  messages: Array<{ role: string; content: string }>;
  pendingAction: PendingAction | null;
}

const conversations = new Map<string, ConversationState>();

// ═══════════════════════════════════════════════════════════════════════════
// ─── INTENT DETECTION (Bengali + English) ───────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

interface DetectedIntent {
  action: string;
  args: Record<string, unknown>;
  missingFields: string[];
}

function detectIntent(message: string): DetectedIntent | null {
  const lower = message.toLowerCase().trim();

  // ── Create Bill (English + Bengali + Hinglish) ──
  const billPatterns = [
    /(create|make|generate|নতুন|তৈরি|বানাও|বানিয়ে|বানান|কর|দাও|করে)\s*(an?\s*)?(gst\s*)?(bill|invoice|বিল|চালান)/,
    /(bill|invoice|বিল|চালান)\s*(create|make|generate|নতুন|তৈরি|বানাও|বানিয়ে|দাও|কর|হবে|লাগবে|চাই)/,
    /(gst|non.?gst)\s*(bill|invoice|বিল|চালান)/,
    /বিল\s*(বানাও|বানিয়ে|কর|দাও|তৈরি|নতুন|লাগবে|চাই|হবে)/,
    /চালান\s*(বানাও|বানিয়ে|কর|দাও|তৈরি|নতুন|লাগবে|চাই|হবে)/,
    /bill\s*(banao|banao|baniye|koro|kare|dao|lagbe|chai|hobe)/,
  ];

  let isBillIntent = false;
  for (const p of billPatterns) {
    if (lower.match(p)) { isBillIntent = true; break; }
  }
  // Also catch standalone "bill" with context words
  if (!isBillIntent && (lower === 'bill' || lower === 'বিল' || lower === 'বিল বানাও' || lower === 'বিল দাও' || lower === 'bill banao' || lower === 'bill banaiye dao' || lower === 'bill baniye dao')) {
    isBillIntent = true;
  }

  if (isBillIntent) {
    const args: Record<string, unknown> = {};
    const missing: string[] = [];

    // Bill type
    if (lower.includes('non-gst') || lower.includes('non gst') || lower.includes('নন জিএসটি') || lower.includes('নন-জিএসটি')) {
      args.billType = 'non_gst';
    } else if (lower.includes('gst') || lower.includes('জিএসটি') || lower.includes('জিএসট')) {
      args.billType = 'gst';
    }
    // Default: no bill type specified - will ask

    // Amount
    const amountMatch = lower.match(/[₹rs\s]*([\d,]+(?:\.\d+)?)/);
    if (amountMatch) {
      const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
      if (amount > 0) {
        const itemDesc = extractItemDescription(message);
        args.items = [{ itemName: itemDesc || 'Service', rate: amount, quantity: 1, taxMode: 'excl' }];
      }
    }

    // Client name
    const clientName = extractClientName(message);
    if (clientName) args.clientName = clientName;

    // Check what's missing
    if (!args.billType) missing.push('billType');
    if (!args.items || (args.items as Array<Record<string, unknown>>).length === 0) missing.push('amount');
    if (!args.clientName) missing.push('clientName');

    return { action: 'create_bill', args, missingFields: missing };
  }

  // ── Add Client ──
  const clientPatterns = [
    /(add|create|নতুন|যোগ|তৈরি|যোগ\s*কর|add\s*kor)\s*(an?\s*)?(new\s*)?(client|customer|ক্লায়েন্ট|গ্রাহক)/,
    /(client|customer|ক্লায়েন্ট|গ্রাহক)\s*(add|create|নতুন|যোগ|তৈরি|যোগ\s*কর|add\s*kor|lagbe|chai)/,
    /ক্লায়েন্ট\s*(যোগ|নতুন|তৈরি|কর|দাও|লাগবে|চাই)/,
    /client\s*(add|banao|lagbe|chai)/,
  ];

  let isClientIntent = false;
  for (const p of clientPatterns) {
    if (lower.match(p)) { isClientIntent = true; break; }
  }

  if (isClientIntent) {
    const args: Record<string, unknown> = {};
    const missing: string[] = [];

    const nameMatch = message.match(/(?:named?|name[d]?\s*(?:is)?|নাম)\s*:?\s*([A-Za-z\s]+?)(?:\s*[,;.]|\s*(?:phone|ফোন|email|address|with)|$)/i);
    if (nameMatch) args.name = nameMatch[1].trim();

    const phoneMatch = message.match(/(?:phone|mobile|number|ফোন|নম্বর)\s*:?\s*([\d+\-\s]{8,15})/i);
    if (phoneMatch) args.phone = phoneMatch[1].trim().replace(/\s/g, '');

    const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch) args.email = emailMatch[0];

    if (!args.name) missing.push('name');
    if (!args.phone) missing.push('phone');

    return { action: 'create_client', args, missingFields: missing };
  }

  // ── Record Expense ──
  const expensePatterns = [
    /(add|record|log|create|যোগ|রেকর্ড|খরচ|কর)\s*(an?\s*)?(new\s*)?(expense|খরচ|expenditure)/,
    /(expense|খরচ)\s*(add|record|log|create|যোগ|রেকর্ড|কর|দাও|লেখ|লিখ)/,
    /খরচ\s*(যোগ|কর|দাও|রেকর্ড|হবে|লাগবে|চাই|লেখ|লিখ)/,
    /expense\s*(add|koro|dao|lagbe|chai|lekho)/,
  ];

  let isExpenseIntent = false;
  for (const p of expensePatterns) {
    if (lower.match(p)) { isExpenseIntent = true; break; }
  }

  if (isExpenseIntent) {
    const args: Record<string, unknown> = {};
    const missing: string[] = [];

    const amountMatch = lower.match(/[₹rs\s]*([\d,]+(?:\.\d+)?)/);
    if (amountMatch) args.amount = parseFloat(amountMatch[1].replace(/,/g, ''));

    const categories = ['rent', 'salary', 'travel', 'food', 'internet', 'marketing', 'software', 'utilities', 'office', 'transport', 'miscellaneous',
      'ভাড়া', 'বেতন', 'যাতায়াত', 'খাবার', 'অফিস'];
    for (const cat of categories) {
      if (lower.includes(cat)) { args.category = cat.charAt(0).toUpperCase() + cat.slice(1); break; }
    }
    if (!args.category) args.category = 'Miscellaneous';

    if (lower.includes('upi') || lower.includes('গুগল পে') || lower.includes('phonepe')) args.paymentMethod = 'UPI';
    else if (lower.includes('bank') || lower.includes('ব্যাংক')) args.paymentMethod = 'Bank Transfer';
    else if (lower.includes('cash') || lower.includes('ক্যাশ')) args.paymentMethod = 'Cash';
    else args.paymentMethod = 'Cash';

    args.description = message.replace(/[₹]/g, '').substring(0, 100);

    if (!args.amount || Number(args.amount) <= 0) missing.push('amount');

    return { action: 'create_expense', args, missingFields: missing };
  }

  // ── Record Payment ──
  if (lower.match(/(record|received?|got|পেয়েছি|পেলাম|জমা|পেমেন্ট)\s*(an?\s*)?(payment|পেমেন্ট|টাকা)/) ||
      lower.match(/(payment|পেমেন্ট)\s*(received?|from|record|জমা|পেয়েছি)/)) {
    const args: Record<string, unknown> = {};
    const missing: string[] = [];

    const amountMatch = lower.match(/[₹rs\s]*([\d,]+(?:\.\d+)?)/);
    if (amountMatch) args.amount = parseFloat(amountMatch[1].replace(/,/g, ''));

    const clientName = extractClientName(message);
    if (clientName) args.clientName = clientName;

    if (lower.includes('upi') || lower.includes('গুগল পে') || lower.includes('phonepe')) args.paymentMethod = 'UPI';
    else if (lower.includes('bank') || lower.includes('ব্যাংক')) args.paymentMethod = 'Bank Transfer';
    else if (lower.includes('cash') || lower.includes('ক্যাশ')) args.paymentMethod = 'Cash';
    else args.paymentMethod = 'Cash';

    if (!args.amount || Number(args.amount) <= 0) missing.push('amount');
    if (!args.clientName) missing.push('clientName');

    return { action: 'record_payment', args, missingFields: missing };
  }

  // ── Get Dues ──
  if (lower.match(/(show|check|what|list|দেখ|দেখাও|কত|বকেয়া|বাকি)\s*(are\s*)?(my\s*)?(dues|outstanding|unpaid|overdue|বকেয়া|বাকি)/) ||
      lower.match(/(dues|বকেয়া|বাকি)\s*(show|check|list|দেখ|দেখাও|কত)/) ||
      lower.includes('dues') || lower.includes('বকেয়া') || lower.includes('বাকি কত') ||
      lower === 'dues' || lower === 'বকেয়া') {
    const args: Record<string, unknown> = {};
    if (lower.includes('overdue') || lower.includes('মেয়াদোত্তীর্ণ')) args.filter = 'overdue';
    else if (lower.includes('upcoming') || lower.includes('আসন্ন')) args.filter = 'upcoming';
    else args.filter = 'all';
    return { action: 'get_dues', args, missingFields: [] };
  }

  // ── Dashboard ──
  if (lower.match(/(dashboard|summary|overview|সারসংক্ষেপ|ওভারভিউ|ড্যাশবোর্ড|how much|কত টাকা|earn|revenue|আয়|আয় কত)/) ||
      lower === 'dashboard' || lower === 'ড্যাশবোর্ড' || lower === 'summary') {
    const args: Record<string, unknown> = {};
    if (lower.includes('today') || lower.includes('আজ')) args.period = 'today';
    else if (lower.includes('week') || lower.includes('সপ্তাহ')) args.period = 'week';
    else if (lower.includes('year') || lower.includes('বছর')) args.period = 'year';
    else args.period = 'month';
    return { action: 'get_dashboard', args, missingFields: [] };
  }

  // ── List Clients ──
  if (lower.match(/(show|list|see|দেখ|দেখাও|তালিকা)\s*(all\s*)?(clients?|customers?|ক্লায়েন্ট|গ্রাহক)/) ||
      lower.match(/(clients?|ক্লায়েন্ট)\s*(show|list|see|দেখ|দেখাও|তালিকা)/) ||
      lower === 'clients' || lower === 'ক্লায়েন্ট' || lower === 'ক্লায়েন্ট দেখাও') {
    return { action: 'list_clients', args: {}, missingFields: [] };
  }

  // ── List Bills ──
  if (lower.match(/(show|list|see|দেখ|দেখাও|তালিকা)\s*(all\s*)?(bills?|invoices?|বিল|চালান)/) ||
      lower.match(/(bills?|invoices?|বিল)\s*(show|list|see|দেখ|দেখাও|তালিকা)/) ||
      lower === 'bills' || lower === 'বিল' || lower === 'বিল দেখাও' || lower === 'সব বিল') {
    const args: Record<string, unknown> = {};
    if (lower.includes('paid') || lower.includes('পরিশোধিত')) args.status = 'paid';
    else if (lower.includes('unpaid') || lower.includes('অপরিশোধিত')) args.status = 'unpaid';
    else args.status = 'all';
    return { action: 'list_bills', args, missingFields: [] };
  }

  return null;
}

function extractClientName(message: string): string {
  const patterns = [
    /(?:for|client|customer|নাম|নামের)\s*:?\s*([A-Z][A-Za-z\s]{2,30}?)(?:\s*[,;.]|\s*(?:item|service|phone|email|with|amount|bill|create|add|₹)|$)/i,
    /(?:named?|name)\s*:?\s*([A-Z][A-Za-z\s]{2,30}?)(?:\s*[,;.]|\s*(?:phone|email|with|item|₹)|$)/i,
  ];
  for (const p of patterns) {
    const match = message.match(p);
    if (match) return match[1].trim();
  }
  return '';
}

function extractItemDescription(message: string): string {
  const patterns = [
    /(?:item|service|product|আইটেম|সেবা|কাজ)\s*(?:is|:|হলো)?\s*([A-Za-z\s&]{3,50}?)(?:\s*[,;. ]|$)/i,
  ];
  for (const p of patterns) {
    const match = message.match(p);
    if (match && match[1]) return match[1].trim();
  }
  const forMatch = message.match(/for\s+(.+?)\s+(?:₹|rs\.?|of)/i);
  if (forMatch) return forMatch[1].trim();
  return '';
}

// ─── Process user's reply to a pending question ──
function processPendingReply(message: string, pending: PendingAction): DetectedIntent | null {
  const lower = message.toLowerCase().trim();

  // If user is answering about bill type
  if (pending.missingFields.includes('billType')) {
    if (lower.includes('gst') && !lower.includes('non') && !lower.includes('নন')) {
      pending.args.billType = 'gst';
      pending.missingFields = pending.missingFields.filter(f => f !== 'billType');
    } else if (lower.includes('non') || lower.includes('নন') || lower === '1' || lower === 'non gst') {
      pending.args.billType = 'non_gst';
      pending.missingFields = pending.missingFields.filter(f => f !== 'billType');
    }
  }

  // If user is answering about amount
  if (pending.missingFields.includes('amount')) {
    const amountMatch = lower.match(/[₹rs\s]*([\d,]+(?:\.\d+)?)/);
    if (amountMatch) {
      const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
      if (amount > 0) {
        if (pending.action === 'create_bill') {
          pending.args.items = [{ itemName: 'Service', rate: amount, quantity: 1, taxMode: 'excl' }];
        } else if (pending.action === 'create_expense' || pending.action === 'record_payment') {
          pending.args.amount = amount;
        }
        pending.missingFields = pending.missingFields.filter(f => f !== 'amount');
      }
    }
  }

  // If user is answering about client name
  if (pending.missingFields.includes('clientName')) {
    // Try to extract a name - must be actual name, not "GST bill" etc
    const nameMatch = message.match(/^([A-Z][A-Za-z\s]{1,30})$/);
    if (nameMatch && !nameMatch[1].toLowerCase().match(/^(gst|bill|non|service|expense)/)) {
      pending.args.clientName = nameMatch[1].trim();
      pending.missingFields = pending.missingFields.filter(f => f !== 'clientName');
    } else {
      // Try "for X" or "name X" patterns
      const forName = message.match(/(?:for|name[ds]?|নাম)\s*:?\s*([A-Z][A-Za-z\s]{1,30}?)(?:\s*[,;.]|$)/i);
      if (forName) {
        pending.args.clientName = forName[1].trim();
        pending.missingFields = pending.missingFields.filter(f => f !== 'clientName');
      }
    }
  }

  // If user is answering about name (for client creation)
  if (pending.missingFields.includes('name')) {
    const nameMatch = message.match(/^([A-Z][A-Za-z\s]{1,30})$/);
    if (nameMatch) {
      pending.args.name = nameMatch[1].trim();
      pending.missingFields = pending.missingFields.filter(f => f !== 'name');
    } else {
      const forName = message.match(/(?:name[ds]?|নাম)\s*:?\s*([A-Z][A-Za-z\s]{1,30}?)(?:\s*[,;.]|$)/i);
      if (forName) {
        pending.args.name = forName[1].trim();
        pending.missingFields = pending.missingFields.filter(f => f !== 'name');
      }
    }
  }

  // If user is answering about phone
  if (pending.missingFields.includes('phone')) {
    const phoneMatch = message.match(/([\d+\-\s]{8,15})/);
    if (phoneMatch) {
      pending.args.phone = phoneMatch[1].trim().replace(/\s/g, '');
      pending.missingFields = pending.missingFields.filter(f => f !== 'phone');
    }
  }

  return { action: pending.action, args: pending.args, missingFields: pending.missingFields };
}

// ─── Ask for missing information ──
function askForMissing(pending: PendingAction): string {
  const field = pending.missingFields[0];
  const action = pending.action;

  switch (field) {
    case 'billType':
      return `📋 কোন ধরনের বিল চান? / What type of bill?\n\n1️⃣ GST Bill (জিএসটি বিল)\n2️⃣ Non-GST Bill (নন-জিএসটি বিল)\n\nউত্তর দিন: GST বা Non-GST`;

    case 'amount':
      if (action === 'create_bill') {
        return `💰 বিলের পরিমাণ কত? / What's the bill amount?\n\nউদাহরণ: "₹10,000" বা "5000"`;
      }
      return `💰 পরিমাণ কত? / How much?\n\nউদাহরণ: "₹500" বা "1000"`;

    case 'clientName':
      return `👤 ক্লায়েন্টের নাম কী? / Client's name?\n\nউদাহরণ: "Rahul Sharma" বা "প্রিয়া সেন"`;

    case 'name':
      return `👤 ক্লায়েন্টের নাম কী? / Client's name?\n\nউদাহরণ: "Rahul Sharma"`;

    case 'phone':
      return `📞 ফোন নম্বর কী? / Phone number?\n\nউদাহরণ: "9876543210"`;

    default:
      return `আরও তথ্য দিন / Please provide more details.`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── GEMINI API ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `You are the AI assistant for "AAROHAN BUSINESS HUB" - a multi-business management platform.

Business Details:
1. AAROHAN TECH SOLUTIONS (Marketing Agency) - GST NO: 19MKIPS8902F1ZG, Address: 24/27 A.K.M ROAD, BARANAGAR, KOLKATA - 700090, Contact: 6290717007
2. ASTRONAUT STIKERZ (Notebook & Mousepad)
3. AAROHAN WEB ACADEMY (Institute)

Rules:
1. Respond in Bengali + English (bilingual)
2. Use ₹ (INR) for all amounts
3. GST: CGST 9% + SGST 9% = 18%
4. Be concise and friendly`;

async function callGemini(messages: Array<{ role: string; content: string }>): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const contents = [];
    for (let i = 1; i < messages.length; i++) {
      const m = messages[i];
      if (m.role === 'user') contents.push({ role: 'user', parts: [{ text: m.content }] });
      else if (m.role === 'assistant') contents.push({ role: 'model', parts: [{ text: m.content }] });
    }

    if (contents.length === 0) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          generationConfig: { temperature: 0.5, maxOutputTokens: 1024 },
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);
    if (!response.ok) return null;

    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── ZAI SDK FALLBACK ───────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

let zaiInstance: any = null;
let zaiInitPromise: Promise<any> | null = null;

async function getZAI(): Promise<any> {
  if (zaiInstance) return zaiInstance;
  if (zaiInitPromise) return zaiInitPromise;
  zaiInitPromise = (async () => {
    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      zaiInstance = await ZAI.create();
      return zaiInstance;
    } catch { zaiInitPromise = null; return null; }
  })();
  return zaiInitPromise;
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── ACTION EXECUTORS ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

async function executeCreateBill(args: Record<string, unknown>, businessId: string) {
  try {
    const billType = String(args.billType || 'non_gst');
    const items = (args.items as Array<Record<string, unknown>>) || [];
    const clientName = String(args.clientName || '');
    const GST_RATE = 0.18;

    let clientId = '';
    let clientObj = null;
    if (clientName) {
      clientObj = await db.client.findFirst({ where: { businessId, name: { contains: clientName, mode: 'insensitive' } } });
      if (!clientObj) {
        clientObj = await db.client.create({
          data: { businessId, name: clientName, phone: String(args.clientPhone || '0000000000'), address: args.clientAddress ? String(args.clientAddress) : null },
        });
      }
      clientId = clientObj.id;
    } else {
      const firstClient = await db.client.findFirst({ where: { businessId } });
      if (firstClient) { clientId = firstClient.id; clientObj = firstClient; }
    }

    if (!clientId) return { success: false, result: null, message: '❌ কোনো ক্লায়েন্ট পাওয়া যায়নি। ক্লায়েন্টের নাম দিন। / No client found. Please provide a client name.' };
    if (items.length === 0) return { success: false, result: null, message: '❌ কোনো আইটেম পাওয়া যায়নি। পরিমাণ দিন। / No items found. Please provide amount.' };

    let subtotal = 0, totalGst = 0;
    const processedItems = items.map((item) => {
      const rate = Number(item.rate) || 0;
      const qty = Number(item.quantity) || 1;
      const taxMode = String(item.taxMode || 'excl');
      const baseRate = taxMode === 'incl' ? rate / (1 + GST_RATE) : rate;
      const itemGst = billType === 'gst' ? baseRate * GST_RATE * qty : 0;
      const amount = billType === 'gst' ? (taxMode === 'incl' ? rate * qty : baseRate * (1 + GST_RATE) * qty) : rate * qty;
      subtotal += baseRate * qty;
      totalGst += itemGst;
      return { description: String(item.itemName || ''), quantity: qty, rate, amount, itemName: String(item.itemName || ''), taxMode, cgst: billType === 'gst' ? baseRate * 0.09 * qty : 0, sgst: billType === 'gst' ? baseRate * 0.09 * qty : 0, baseRate };
    });

    const total = billType === 'gst' ? subtotal + totalGst : subtotal;
    const bill = await db.bill.create({
      data: { businessId, clientId, billNumber: `ATS/${new Date().getFullYear().toString().slice(2)}-${String(new Date().getMonth() + 1).padStart(2, '0')}/${String(Math.floor(Math.random() * 900) + 100)}`, date: new Date(), dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), subtotal: billType === 'gst' ? subtotal : total, tax: totalGst, discount: 0, total, billType, clientGst: args.clientGst ? String(args.clientGst) : null, clientAddress: args.clientAddress ? String(args.clientAddress) : null, notes: args.notes ? String(args.notes) : null, items: { create: processedItems } },
      include: { items: true, client: true },
    });

    const itemSummary = processedItems.map(i => `  • ${i.itemName}: ₹${i.rate} × ${i.quantity} = ₹${i.amount.toFixed(2)}`).join('\n');
    return { success: true, result: bill, message: `✅ বিল তৈরি হয়েছে! / Bill Created!\n\n📄 Bill #${bill.billNumber}\n👤 Client: ${bill.client.name}\n📋 Items:\n${itemSummary}\n${billType === 'gst' ? `💰 Subtotal: ₹${subtotal.toFixed(2)}\n📊 GST (CGST 9% + SGST 9%): ₹${totalGst.toFixed(2)}\n` : ''}💵 Total: ₹${total.toFixed(2)}\n🏷️ Type: ${billType === 'gst' ? 'GST Bill' : 'Non-GST Bill'}` };
  } catch (error) {
    return { success: false, result: null, message: `❌ বিল তৈরি করতে সমস্যা: ${error instanceof Error ? error.message : 'Unknown'}` };
  }
}

async function executeCreateClient(args: Record<string, unknown>, businessId: string) {
  try {
    if (!args.name) return { success: false, result: null, message: '❌ ক্লায়েন্টের নাম দিন।' };
    if (!args.phone) return { success: false, result: null, message: '❌ ফোন নম্বর দিন।' };
    const client = await db.client.create({
      data: { businessId, name: String(args.name), phone: String(args.phone), email: args.email ? String(args.email) : null, address: args.address ? String(args.address) : null, company: args.company ? String(args.company) : null },
    });
    return { success: true, result: client, message: `✅ ক্লায়েন্ট যোগ হয়েছে! / Client Added!\n\n👤 Name: ${client.name}\n📞 Phone: ${client.phone}${client.email ? `\n📧 Email: ${client.email}` : ''}${client.address ? `\n📍 Address: ${client.address}` : ''}${client.company ? `\n🏢 Company: ${client.company}` : ''}` };
  } catch (error) {
    return { success: false, result: null, message: `❌ ক্লায়েন্ট যোগ করতে সমস্যা: ${error instanceof Error ? error.message : 'Unknown'}` };
  }
}

async function executeCreateExpense(args: Record<string, unknown>, businessId: string) {
  try {
    if (!args.amount || Number(args.amount) <= 0) return { success: false, result: null, message: '❌ খরচের পরিমাণ দিন।' };
    const expense = await db.expense.create({
      data: { businessId, category: String(args.category || 'Miscellaneous'), description: String(args.description || ''), amount: Number(args.amount), date: new Date(), paymentMethod: args.paymentMethod ? String(args.paymentMethod) : null },
    });
    return { success: true, result: expense, message: `✅ খরচ রেকর্ড হয়েছে! / Expense Recorded!\n\n💰 Amount: ₹${expense.amount}\n📂 Category: ${expense.category}\n📝 Description: ${expense.description}${expense.paymentMethod ? `\n💳 Payment: ${expense.paymentMethod}` : ''}` };
  } catch (error) {
    return { success: false, result: null, message: `❌ খরচ রেকর্ড করতে সমস্যা: ${error instanceof Error ? error.message : 'Unknown'}` };
  }
}

async function executeRecordPayment(args: Record<string, unknown>, businessId: string) {
  try {
    const clientName = String(args.clientName || '');
    const amount = Number(args.amount) || 0;
    const paymentMethod = String(args.paymentMethod || 'Cash');
    if (!clientName) return { success: false, result: null, message: '❌ ক্লায়েন্টের নাম দিন।' };
    if (amount <= 0) return { success: false, result: null, message: '❌ পরিমাণ দিন।' };

    const client = await db.client.findFirst({ where: { businessId, name: { contains: clientName, mode: 'insensitive' } } });
    if (!client) return { success: false, result: null, message: `❌ "${clientName}" নামের ক্লায়েন্ট পাওয়া যায়নি।` };

    let billId: string | null = null;
    const unpaidBill = await db.bill.findFirst({ where: { businessId, clientId: client.id, status: { in: ['unpaid', 'partial'] } }, orderBy: { date: 'asc' } });
    if (unpaidBill) billId = unpaidBill.id;

    const payment = await db.payment.create({ data: { businessId, clientId: client.id, billId, amount, date: new Date(), paymentMethod, receiptNumber: `RCP-${Date.now().toString().slice(-6)}`, notes: args.notes ? String(args.notes) : null } });

    if (billId) {
      const bill = await db.bill.findUnique({ where: { id: billId } });
      if (bill) { const newPaid = bill.paidAmount + amount; await db.bill.update({ where: { id: billId }, data: { paidAmount: newPaid, status: newPaid >= bill.total ? 'paid' : 'partial' } }); }
    }
    return { success: true, result: payment, message: `✅ পেমেন্ট রেকর্ড হয়েছে! / Payment Recorded!\n\n👤 Client: ${client.name}\n💰 Amount: ₹${amount}\n💳 Method: ${paymentMethod}\n🧾 Receipt: ${payment.receiptNumber}` };
  } catch (error) {
    return { success: false, result: null, message: `❌ Error: ${error instanceof Error ? error.message : 'Unknown'}` };
  }
}

async function executeGetDues(args: Record<string, unknown>, businessId: string) {
  try {
    const filter = String(args.filter || 'all');
    const now = new Date();
    const where: Record<string, unknown> = { businessId, status: { in: ['unpaid', 'partial'] } };
    if (filter === 'overdue') where.dueDate = { lt: now };
    else if (filter === 'upcoming') where.dueDate = { gte: now };
    const bills = await db.bill.findMany({ where, include: { client: { select: { name: true } } }, orderBy: { dueDate: 'asc' }, take: 20 });
    if (bills.length === 0) return { success: true, result: [], message: '✅ কোনো বকেয়া নেই! / No dues! 🎉' };
    const totalDue = bills.reduce((s, b) => s + (b.total - b.paidAmount), 0);
    const list = bills.map(b => `  ${b.dueDate < now ? '🔴' : '🟡'} ${b.client.name} - ₹${(b.total - b.paidAmount).toFixed(2)} (#${b.billNumber})`).join('\n');
    return { success: true, result: bills, message: `⚠️ বকেয়া তালিকা / Dues:\n\n${list}\n\n💰 মোট বকেয়া / Total: ₹${totalDue.toFixed(2)}` };
  } catch (error) { return { success: false, result: null, message: `❌ Error: ${error instanceof Error ? error.message : 'Unknown'}` }; }
}

async function executeGetDashboard(args: Record<string, unknown>, businessId: string) {
  try {
    const period = String(args.period || 'month');
    const now = new Date();
    let start = new Date(now);
    switch (period) { case 'today': start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break; case 'week': start = new Date(now.getTime() - 7*24*60*60*1000); break; case 'month': start = new Date(now.getFullYear(), now.getMonth(), 1); break; case 'year': start = new Date(now.getFullYear(), 0, 1); break; default: start = new Date(2020, 0, 1); }
    const [bills, expenses, payments, clients] = await Promise.all([
      db.bill.findMany({ where: { businessId, date: { gte: start } } }),
      db.expense.findMany({ where: { businessId, date: { gte: start } } }),
      db.payment.findMany({ where: { businessId, date: { gte: start } } }),
      db.client.count({ where: { businessId } }),
    ]);
    const rev = bills.reduce((s, b) => s + b.total, 0), paid = bills.reduce((s, b) => s + b.paidAmount, 0), exp = expenses.reduce((s, e) => s + e.amount, 0), recv = payments.reduce((s, p) => s + p.amount, 0);
    const pl: Record<string, string> = { today: 'আজ/Today', week: 'সপ্তাহ/Week', month: 'মাস/Month', year: 'বছর/Year', all: 'সব/All' };
    return { success: true, result: {}, message: `📊 ${pl[period] || pl.month} Summary:\n\n💰 Revenue: ₹${rev.toFixed(2)}\n💵 Received: ₹${recv.toFixed(2)}\n📂 Expenses: ₹${exp.toFixed(2)}\n⚠️ Outstanding: ₹${(rev - paid).toFixed(2)}\n📈 Profit: ₹${(paid - exp).toFixed(2)}\n👥 Clients: ${clients}` };
  } catch (error) { return { success: false, result: null, message: `❌ Error: ${error instanceof Error ? error.message : 'Unknown'}` }; }
}

async function executeListClients(args: Record<string, unknown>, businessId: string) {
  try {
    const clients = await db.client.findMany({ where: { businessId }, take: 20, orderBy: { createdAt: 'desc' } });
    if (clients.length === 0) return { success: true, result: [], message: '👥 কোনো ক্লায়েন্ট নেই। / No clients.' };
    const list = clients.map(c => `  👤 ${c.name} | 📞 ${c.phone}${c.company ? ` | 🏢 ${c.company}` : ''}`).join('\n');
    return { success: true, result: clients, message: `👥 ক্লায়েন্ট (${clients.length}):\n\n${list}` };
  } catch (error) { return { success: false, result: null, message: `❌ Error` }; }
}

async function executeListBills(args: Record<string, unknown>, businessId: string) {
  try {
    const status = String(args.status || 'all');
    const where: Record<string, unknown> = { businessId };
    if (status !== 'all') where.status = status;
    const bills = await db.bill.findMany({ where, include: { client: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 10 });
    if (bills.length === 0) return { success: true, result: [], message: '📄 কোনো বিল নেই। / No bills.' };
    const list = bills.map(b => `  ${b.status === 'paid' ? '✅' : b.status === 'partial' ? '🟡' : '🔴'} #${b.billNumber} | ${b.client.name} | ₹${b.total.toFixed(2)} | ${b.billType.toUpperCase()}`).join('\n');
    return { success: true, result: bills, message: `📄 বিল (${bills.length}):\n\n${list}` };
  } catch (error) { return { success: false, result: null, message: `❌ Error` }; }
}

async function executeFunction(name: string, args: Record<string, unknown>, businessId: string) {
  switch (name) {
    case 'create_bill': return executeCreateBill(args, businessId);
    case 'create_client': return executeCreateClient(args, businessId);
    case 'create_expense': return executeCreateExpense(args, businessId);
    case 'record_payment': return executeRecordPayment(args, businessId);
    case 'get_dues': return executeGetDues(args, businessId);
    case 'get_dashboard': return executeGetDashboard(args, businessId);
    case 'list_clients': return executeListClients(args, businessId);
    case 'list_bills': return executeListBills(args, businessId);
    default: return { success: false, result: null, message: '❌ Unknown action' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── MAIN HANDLER ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const { sessionId, message, context } = await request.json();
    if (!message || typeof message !== 'string') return NextResponse.json({ error: 'Message is required' }, { status: 400 });

    const businessId = context?.businessId || '';

    // Get or create conversation state
    let state = conversations.get(sessionId);
    if (!state) {
      state = { messages: [{ role: 'assistant', content: SYSTEM_PROMPT }], pendingAction: null };
    }

    state.messages.push({ role: 'user', content: message });
    if (state.messages.length > 22) state.messages = [state.messages[0], ...state.messages.slice(-20)];

    let aiResponse: string | null = null;
    let actionExecuted = false;
    let actionData = null;

    // ── CHECK PENDING ACTION (multi-turn) ──
    if (state.pendingAction) {
      // Check if user is cancelling
      const lower = message.toLowerCase();
      if (lower.match(/cancel|বাতিল|না|no|stop|থাম/)) {
        state.pendingAction = null;
        aiResponse = '👌 বাতিল করা হয়েছে। অন্য কিছু বলুন! / Cancelled. What else can I help with?';
      } else {
        // Process the reply
        const updated = processPendingReply(message, state.pendingAction);

        if (updated && updated.missingFields.length === 0) {
          // All info collected - execute!
          if (businessId) {
            const result = await executeFunction(updated.action, updated.args, businessId);
            actionExecuted = result.success;
            actionData = result.success ? result.result : null;
            aiResponse = result.message;
          } else {
            aiResponse = '❌ ব্যবসা নির্বাচন করুন।';
          }
          state.pendingAction = null;
        } else if (updated && updated.missingFields.length > 0) {
          // Still missing info - ask again
          state.pendingAction = { action: updated.action, args: updated.args, missingFields: updated.missingFields };
          aiResponse = askForMissing(state.pendingAction);
        } else {
          // Couldn't parse reply - ask again
          aiResponse = askForMissing(state.pendingAction);
        }
      }
    } else {
      // ── NEW INTENT DETECTION ──
      const intent = detectIntent(message);

      if (intent) {
        if (intent.missingFields.length === 0) {
          // All info provided - execute immediately
          if (businessId) {
            const result = await executeFunction(intent.action, intent.args, businessId);
            actionExecuted = result.success;
            actionData = result.success ? result.result : null;
            aiResponse = result.message;
          } else {
            aiResponse = '❌ ব্যবসা নির্বাচন করুন।';
          }
        } else {
          // Missing info - ask user
          state.pendingAction = { action: intent.action, args: intent.args, missingFields: intent.missingFields };
          aiResponse = askForMissing(state.pendingAction);
        }
      } else {
        // No intent detected - use LLM for conversation
        const geminiText = await callGemini(state.messages);
        if (geminiText) {
          aiResponse = geminiText;
        } else {
          // Try ZAI
          try {
            const zai = await getZAI();
            if (zai) {
              const zaiMsgs = state.messages.filter(m => m.role === 'user' || (m.role === 'assistant' && m !== state!.messages[0])).slice(-8).map(m => ({ role: m.role === 'user' ? 'user' as const : 'assistant' as const, content: m.content }));
              zaiMsgs.unshift({ role: 'user', content: SYSTEM_PROMPT });
              const zaiResp = await zai.chat.completions.create({ messages: zaiMsgs, thinking: { type: 'disabled' } });
              aiResponse = zaiResp?.choices?.[0]?.message?.content || null;
            }
          } catch { /* ignore */ }
        }

        // Final fallback
        if (!aiResponse) {
          const lower = message.toLowerCase();
          if (lower.match(/হ্যালো|হ্যাই|hello|hi|hey|নমস্কার|কেমন আছ/)) {
            aiResponse = `নমস্কার! / Hello! 👋\n\nআমি AAROHAN Business Hub এর AI সহকারী। আমি সরাসরি কাজ করতে পারি:\n\n• 📄 "বিল বানাও" / "Create a bill"\n• 👥 "ক্লায়েন্ট যোগ কর" / "Add client"\n• 💰 "খরচ লেখ" / "Record expense ₹500"\n• ⚠️ "বকেয়া দেখাও" / "Show dues"\n• 📊 "ড্যাশবোর্ড" / "Dashboard"\n\nকী করতে চান?`;
          } else {
            aiResponse = `🙏 আমি AAROHAN Business Hub এর AI সহকারী।\n\nআমি সরাসরি কাজ করতে পারি:\n• 📄 "বিল বানাও" বা "Create a GST bill for ₹10,000 for Rahul"\n• 👥 "ক্লায়েন্ট যোগ কর" বা "Add client named Priya, phone 9876543210"\n• 💰 "খরচ লেখ ₹500 internet" বা "Record expense ₹500 for internet"\n• ⚠️ "বকেয়া দেখাও" / "Show dues"\n• 📊 "ড্যাশবোর্ড"\n\nকী করতে চান?`;
          }
        }
      }
    }

    state.messages.push({ role: 'assistant', content: aiResponse });
    conversations.set(sessionId, state);

    return NextResponse.json({ success: true, response: aiResponse, actionExecuted, actionData });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Failed to get response' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    if (sessionId) conversations.delete(sessionId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
