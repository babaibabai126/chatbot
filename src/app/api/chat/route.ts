import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ─── System Prompt ──────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are the AI assistant for "AAROHAN BUSINESS HUB" - a multi-business management platform.

Business Details:
1. AAROHAN TECH SOLUTIONS (Marketing Agency)
   - GST NO: 19MKIPS8902F1ZG
   - Address: 24/27 A.K.M ROAD, BARANAGAR, KOLKATA - 700090
   - Contact: 6290717007 | contact@aarohantechsolutions.in

Rules:
1. Respond in Bengali + English (bilingual)
2. Use ₹ (INR) for all monetary amounts
3. GST: CGST 9% + SGST 9% = 18% total
4. Be concise and friendly
5. When actions are already executed, confirm the results naturally`;

// ─── Gemini API ─────────────────────────────────────────────────────────
const GEMINI_FUNCTIONS = [
  {
    name: 'create_bill',
    description: 'Create a new bill/invoice for a client.',
    parameters: {
      type: 'OBJECT',
      properties: {
        clientName: { type: 'STRING', description: 'Client name' },
        clientPhone: { type: 'STRING', description: 'Client phone (optional)' },
        clientAddress: { type: 'STRING', description: 'Client address (optional)' },
        clientGst: { type: 'STRING', description: 'Client GST number (optional)' },
        billType: { type: 'STRING', enum: ['gst', 'non_gst'], description: 'Bill type' },
        items: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              itemName: { type: 'STRING', description: 'Item name' },
              quantity: { type: 'NUMBER', description: 'Quantity' },
              rate: { type: 'NUMBER', description: 'Rate in INR' },
              taxMode: { type: 'STRING', enum: ['excl', 'incl'], description: 'Tax mode' },
            },
            required: ['itemName', 'rate'],
          },
        },
        notes: { type: 'STRING', description: 'Notes (optional)' },
      },
      required: ['billType', 'items'],
    },
  },
  {
    name: 'create_client',
    description: 'Add a new client.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Client name' },
        phone: { type: 'STRING', description: 'Phone number' },
        email: { type: 'STRING', description: 'Email (optional)' },
        address: { type: 'STRING', description: 'Address (optional)' },
        company: { type: 'STRING', description: 'Company (optional)' },
      },
      required: ['name', 'phone'],
    },
  },
  {
    name: 'create_expense',
    description: 'Record an expense.',
    parameters: {
      type: 'OBJECT',
      properties: {
        category: { type: 'STRING', description: 'Category' },
        description: { type: 'STRING', description: 'Description' },
        amount: { type: 'NUMBER', description: 'Amount in INR' },
        paymentMethod: { type: 'STRING', enum: ['Cash', 'bKash', 'Bank Transfer', 'UPI', 'Card', 'Other'], description: 'Payment method' },
      },
      required: ['category', 'description', 'amount'],
    },
  },
  {
    name: 'record_payment',
    description: 'Record a payment from a client.',
    parameters: {
      type: 'OBJECT',
      properties: {
        clientName: { type: 'STRING', description: 'Client name' },
        amount: { type: 'NUMBER', description: 'Amount in INR' },
        paymentMethod: { type: 'STRING', enum: ['Cash', 'bKash', 'Bank Transfer', 'UPI', 'Card', 'Other'], description: 'Payment method' },
      },
      required: ['clientName', 'amount', 'paymentMethod'],
    },
  },
  {
    name: 'get_dues',
    description: 'Get unpaid bills and dues.',
    parameters: { type: 'OBJECT', properties: { filter: { type: 'STRING', enum: ['all', 'overdue', 'upcoming'] } } },
  },
  {
    name: 'get_dashboard',
    description: 'Get business dashboard summary.',
    parameters: { type: 'OBJECT', properties: { period: { type: 'STRING', enum: ['today', 'week', 'month', 'year', 'all'] } } },
  },
  {
    name: 'list_clients',
    description: 'List clients.',
    parameters: { type: 'OBJECT', properties: { search: { type: 'STRING' } } },
  },
  {
    name: 'list_bills',
    description: 'List bills.',
    parameters: { type: 'OBJECT', properties: { status: { type: 'STRING', enum: ['all', 'paid', 'unpaid', 'partial'] }, limit: { type: 'NUMBER' } } },
  },
];

// ─── Conversation Store ─────────────────────────────────────────────────
const conversations = new Map<string, Array<{ role: string; content: string }>>();

// ─── Gemini with Function Calling ───────────────────────────────────────
async function callGemini(
  messages: Array<{ role: string; content: string }>,
  useTools: boolean = true
): Promise<{ text: string | null; functionCall: { name: string; args: Record<string, unknown> } | null }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { text: null, functionCall: null };

  try {
    const contents = [];
    for (let i = 1; i < messages.length; i++) {
      const m = messages[i];
      if (m.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: m.content }] });
      } else if (m.role === 'assistant') {
        contents.push({ role: 'model', parts: [{ text: m.content }] });
      } else if (m.role === 'function_response') {
        const parts = m.content.split('|||');
        contents.push({
          role: 'function',
          parts: [{ functionResponse: { name: parts[0] || 'unknown', response: { result: parts[1] || '' } } }],
        });
      } else if (m.role === 'function_call') {
        contents.push({ role: 'model', parts: [{ functionCall: JSON.parse(m.content) }] });
      }
    }

    if (contents.length === 0) return { text: null, functionCall: null };

    const body: Record<string, unknown> = {
      contents,
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
    };

    if (useTools) {
      body.tools = [{ functionDeclarations: GEMINI_FUNCTIONS }];
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal }
    );

    clearTimeout(timeout);
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('[Chat] Gemini HTTP error:', response.status, errText.substring(0, 200));
      return { text: null, functionCall: null };
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0];
    if (!candidate?.content?.parts) return { text: null, functionCall: null };

    let textResult: string | null = null;
    let fcResult: { name: string; args: Record<string, unknown> } | null = null;

    for (const part of candidate.content.parts) {
      if (part.text) textResult = (textResult || '') + part.text;
      if (part.functionCall) fcResult = { name: part.functionCall.name, args: part.functionCall.args || {} };
    }

    return { text: textResult, functionCall: fcResult };
  } catch (err) {
    console.error('[Chat] Gemini exception:', err);
    return { text: null, functionCall: null };
  }
}

// ─── ZAI SDK Fallback ───────────────────────────────────────────────────
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

async function callZAIForResponse(prompt: string, actionResult: string): Promise<string | null> {
  try {
    const zai = await getZAI();
    if (!zai) return null;
    const response = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
        { role: 'assistant', content: actionResult },
        { role: 'user', content: 'Please rewrite this in a friendly bilingual (Bengali + English) format. Keep it concise.' },
      ],
      thinking: { type: 'disabled' },
    });
    return response?.choices?.[0]?.message?.content || null;
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── INTENT DETECTION (works WITHOUT LLM) ──────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

interface DetectedIntent {
  action: string;
  args: Record<string, unknown>;
  confidence: number;
}

function detectIntent(message: string): DetectedIntent | null {
  const lower = message.toLowerCase().trim();

  // ── Create Bill / Invoice ──
  if (lower.match(/(create|make|generate|নতুন|তৈরি)\s*(a\s*)?(gst\s*)?(bill|invoice|বিল|চালান)/) ||
      lower.match(/(bill|invoice|বিল|চালান)\s*(create|make|generate|নতুন|তৈরি)/) ||
      lower.match(/(create|make|generate)\s*(a\s*)?(gst|non.?gst)\s*(bill|invoice)/)) {
    const args: Record<string, unknown> = {};

    // Detect bill type
    if (lower.includes('gst') && !lower.includes('non-gst') && !lower.includes('non gst')) {
      args.billType = 'gst';
    } else if (lower.includes('non-gst') || lower.includes('non gst')) {
      args.billType = 'non_gst';
    } else if (lower.includes('gst')) {
      args.billType = 'gst';
    } else {
      args.billType = 'non_gst'; // default
    }

    // Extract amount - look for ₹ or rs or inr patterns
    const amountMatch = lower.match(/[₹rs\s]*([\d,]+(?:\.\d+)?)/);
    if (amountMatch) {
      const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
      if (amount > 0) {
        // Create a single item with the amount
        const itemDesc = extractItemDescription(message);
        args.items = [{ itemName: itemDesc || 'Service', rate: amount, quantity: 1, taxMode: 'excl' }];
      }
    }

    // Extract client name
    const clientName = extractClientName(message);
    if (clientName) args.clientName = clientName;

    return { action: 'create_bill', args, confidence: 0.9 };
  }

  // ── Add / Create Client ──
  if (lower.match(/(add|create|নতুন|যোগ|তৈরি)\s*(a\s*)?(new\s*)?(client|customer|ক্লায়েন্ট|গ্রাহক)/) ||
      lower.match(/(client|customer|ক্লায়েন্ট|গ্রাহক)\s*(add|create|নতুন|যোগ|তৈরি)/)) {
    const args: Record<string, unknown> = {};

    // Extract name - look for "named X", "name X", "নাম X"
    const nameMatch = message.match(/(?:named?|name[d]?\s*(?:is)?|নাম)\s*:?\s*([A-Za-z\s]+?)(?:\s*[,;.]|\s*(?:phone|ফোন|email|address|with)|$)/i);
    if (nameMatch) args.name = nameMatch[1].trim();

    // Extract phone
    const phoneMatch = message.match(/(?:phone|mobile|number|ফোন|নম্বর)\s*:?\s*([\d+\-\s]{8,15})/i);
    if (phoneMatch) args.phone = phoneMatch[1].trim().replace(/\s/g, '');

    // Extract email
    const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch) args.email = emailMatch[0];

    return { action: 'create_client', args, confidence: 0.9 };
  }

  // ── Add / Record Expense ──
  if (lower.match(/(add|record|log|create|যোগ|রেকর্ড|খরচ)\s*(a\s*)?(new\s*)?(expense|খরচ|expenditure)/) ||
      lower.match(/(expense|খরচ)\s*(add|record|log|create|যোগ|রেকর্ড)/)) {
    const args: Record<string, unknown> = {};

    // Extract amount
    const amountMatch = lower.match(/[₹rs\s]*([\d,]+(?:\.\d+)?)/);
    if (amountMatch) args.amount = parseFloat(amountMatch[1].replace(/,/g, ''));

    // Extract category
    const categories = ['rent', 'salary', 'travel', 'food', 'internet', 'marketing', 'software', 'utilities', 'office', 'transport', 'miscellaneous'];
    for (const cat of categories) {
      if (lower.includes(cat)) { args.category = cat.charAt(0).toUpperCase() + cat.slice(1); break; }
    }
    if (!args.category) args.category = 'Miscellaneous';

    // Extract payment method
    if (lower.includes('cash')) args.paymentMethod = 'Cash';
    else if (lower.includes('bkash')) args.paymentMethod = 'bKash';
    else if (lower.includes('bank')) args.paymentMethod = 'Bank Transfer';
    else if (lower.includes('upi')) args.paymentMethod = 'UPI';
    else if (lower.includes('card')) args.paymentMethod = 'Card';

    // Description from the message
    args.description = message.replace(/[₹₹]/g, '').substring(0, 100);

    return { action: 'create_expense', args, confidence: 0.85 };
  }

  // ── Record Payment ──
  if (lower.match(/(record|received?|got|পেয়েছি|পেলাম|জমা)\s*(a\s*)?(payment|পেমেন্ট|টাকা)/) ||
      lower.match(/(payment|পেমেন্ট)\s*(received?|from|record|জমা)/)) {
    const args: Record<string, unknown> = {};

    const amountMatch = lower.match(/[₹rs\s]*([\d,]+(?:\.\d+)?)/);
    if (amountMatch) args.amount = parseFloat(amountMatch[1].replace(/,/g, ''));

    const clientName = extractClientName(message);
    if (clientName) args.clientName = clientName;

    if (lower.includes('cash')) args.paymentMethod = 'Cash';
    else if (lower.includes('bkash')) args.paymentMethod = 'bKash';
    else if (lower.includes('bank')) args.paymentMethod = 'Bank Transfer';
    else if (lower.includes('upi')) args.paymentMethod = 'UPI';
    else args.paymentMethod = 'Cash';

    return { action: 'record_payment', args, confidence: 0.8 };
  }

  // ── Get Dues ──
  if (lower.match(/(show|check|what|list|দেখ|দেখাও|কত)\s*(are\s*)?(my\s*)?(dues|outstanding|unpaid|overdue|বকেয়া|বকেয়া)/) ||
      lower.match(/(dues|বকেয়া)\s*(show|check|list|দেখ|দেখাও)/)) {
    const args: Record<string, unknown> = {};
    if (lower.includes('overdue') || lower.includes('past due')) args.filter = 'overdue';
    else if (lower.includes('upcoming')) args.filter = 'upcoming';
    else args.filter = 'all';
    return { action: 'get_dues', args, confidence: 0.9 };
  }

  // ── Dashboard / Summary ──
  if (lower.match(/(dashboard|summary|overview|সারসংক্ষেপ|ওভারভিউ|ড্যাশবোর্ড|how much|কত টাকা|earn|revenue|আয়)/)) {
    const args: Record<string, unknown> = {};
    if (lower.includes('today') || lower.includes('আজ')) args.period = 'today';
    else if (lower.includes('week') || lower.includes('সপ্তাহ')) args.period = 'week';
    else if (lower.includes('year') || lower.includes('বছর')) args.period = 'year';
    else args.period = 'month';
    return { action: 'get_dashboard', args, confidence: 0.85 };
  }

  // ── List Clients ──
  if (lower.match(/(show|list|see|দেখ|দেখাও|তালিকা)\s*(all\s*)?(clients?|customers?|ক্লায়েন্ট|গ্রাহক)/) ||
      lower.match(/(clients?|ক্লায়েন্ট)\s*(show|list|see|দেখ|দেখাও)/)) {
    return { action: 'list_clients', args: {}, confidence: 0.9 };
  }

  // ── List Bills ──
  if (lower.match(/(show|list|see|দেখ|দেখাও|তালিকা)\s*(all\s*)?(bills?|invoices?|বিল|চালান)/) ||
      lower.match(/(bills?|invoices?|বিল)\s*(show|list|see|দেখ|দেখাও)/)) {
    const args: Record<string, unknown> = {};
    if (lower.includes('paid')) args.status = 'paid';
    else if (lower.includes('unpaid')) args.status = 'unpaid';
    else args.status = 'all';
    return { action: 'list_bills', args, confidence: 0.9 };
  }

  return null;
}

function extractClientName(message: string): string {
  // Try patterns: "for X", "client X", "named X", "নাম X"
  const patterns = [
    /(?:for|client|customer|নাম)\s*:?\s*([A-Z][A-Za-z\s]{2,30}?)(?:\s*[,;.]|\s*(?:item|service|phone|email|with|amount|bill|create|add|₹)|$)/i,
    /(?:named?|name)\s*:?\s*([A-Z][A-Za-z\s]{2,30}?)(?:\s*[,;.]|\s*(?:phone|email|with|item|₹)|$)/i,
  ];

  for (const p of patterns) {
    const match = message.match(p);
    if (match) return match[1].trim();
  }
  return '';
}

function extractItemDescription(message: string): string {
  // Try to find item/service description
  const patterns = [
    /(?:item|service|product|আইটেম|সেবা)\s*(?:is|:)?\s*([A-Za-z\s&]{3,50}?)(?:\s*[,;. ]|$)/i,
    /(?:for)\s+(?:[\w\s]+\s+)?(?:₹|rs\.?)/i, // "for Digital Marketing ₹10,000"
  ];

  for (const p of patterns) {
    const match = message.match(p);
    if (match && match[1]) return match[1].trim();
  }

  // Try to extract description between "for" and the amount
  const forMatch = message.match(/for\s+(.+?)\s+(?:₹|rs\.?|of)/i);
  if (forMatch) return forMatch[1].trim();

  return '';
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── ACTION EXECUTORS ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

async function executeCreateBill(args: Record<string, unknown>, businessId: string): Promise<{ success: boolean; result: unknown; message: string }> {
  try {
    const billType = String(args.billType || 'non_gst');
    const items = (args.items as Array<Record<string, unknown>>) || [];
    const clientName = String(args.clientName || '');
    const GST_RATE = 0.18;

    // Find or create client
    let clientId = '';
    let clientObj = null;
    if (clientName) {
      clientObj = await db.client.findFirst({
        where: { businessId, name: { contains: clientName, mode: 'insensitive' } },
      });
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

    if (!clientId) {
      return { success: false, result: null, message: '❌ কোনো ক্লায়েন্ট পাওয়া যায়নি। অনুগ্রহ করে ক্লায়েন্টের নাম দিন। / No client found. Please provide a client name.' };
    }

    if (items.length === 0) {
      return { success: false, result: null, message: '❌ কোনো আইটেম পাওয়া যায়নি। অনুগ্রহ করে আইটেমের নাম ও মূল্য দিন। / No items found. Please provide item details.' };
    }

    let subtotal = 0;
    let totalGst = 0;
    const processedItems = items.map((item) => {
      const rate = Number(item.rate) || 0;
      const qty = Number(item.quantity) || 1;
      const taxMode = String(item.taxMode || 'excl');
      const baseRate = taxMode === 'incl' ? rate / (1 + GST_RATE) : rate;
      const itemGst = billType === 'gst' ? baseRate * GST_RATE * qty : 0;
      const amount = billType === 'gst'
        ? (taxMode === 'incl' ? rate * qty : baseRate * (1 + GST_RATE) * qty)
        : rate * qty;
      subtotal += baseRate * qty;
      totalGst += itemGst;
      return {
        description: String(item.itemName || ''),
        quantity: qty, rate, amount,
        itemName: String(item.itemName || ''),
        taxMode,
        cgst: billType === 'gst' ? baseRate * 0.09 * qty : 0,
        sgst: billType === 'gst' ? baseRate * 0.09 * qty : 0,
        baseRate,
      };
    });

    const total = billType === 'gst' ? subtotal + totalGst : subtotal;

    const bill = await db.bill.create({
      data: {
        businessId, clientId,
        billNumber: `ATS/${new Date().getFullYear().toString().slice(2)}-${String(new Date().getMonth() + 1).padStart(2, '0')}/${String(Math.floor(Math.random() * 900) + 100)}`,
        date: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        subtotal: billType === 'gst' ? subtotal : total,
        tax: totalGst, discount: 0, total, billType,
        clientGst: args.clientGst ? String(args.clientGst) : null,
        clientAddress: args.clientAddress ? String(args.clientAddress) : null,
        notes: args.notes ? String(args.notes) : null,
        items: { create: processedItems },
      },
      include: { items: true, client: true },
    });

    const itemSummary = processedItems.map(i => `  • ${i.itemName}: ₹${i.rate} × ${i.quantity} = ₹${i.amount.toFixed(2)}`).join('\n');

    return {
      success: true, result: bill,
      message: `✅ বিল তৈরি হয়েছে! / Bill Created!\n\n📄 Bill #${bill.billNumber}\n👤 Client: ${bill.client.name}\n📋 Items:\n${itemSummary}\n${billType === 'gst' ? `💰 Subtotal: ₹${subtotal.toFixed(2)}\n📊 GST (CGST 9% + SGST 9%): ₹${totalGst.toFixed(2)}\n` : ''}💵 Total: ₹${total.toFixed(2)}\n🏷️ Type: ${billType === 'gst' ? 'GST Bill' : 'Non-GST Bill'}`,
    };
  } catch (error) {
    console.error('[Chat] create_bill error:', error);
    return { success: false, result: null, message: `❌ বিল তৈরি করতে সমস্যা: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

async function executeCreateClient(args: Record<string, unknown>, businessId: string): Promise<{ success: boolean; result: unknown; message: string }> {
  try {
    if (!args.name) return { success: false, result: null, message: '❌ ক্লায়েন্টের নাম দিন। / Please provide client name.' };
    if (!args.phone) return { success: false, result: null, message: '❌ ফোন নম্বর দিন। / Please provide phone number.' };

    const client = await db.client.create({
      data: {
        businessId, name: String(args.name), phone: String(args.phone),
        email: args.email ? String(args.email) : null,
        address: args.address ? String(args.address) : null,
        company: args.company ? String(args.company) : null,
      },
    });
    return {
      success: true, result: client,
      message: `✅ ক্লায়েন্ট যোগ হয়েছে! / Client Added!\n\n👤 Name: ${client.name}\n📞 Phone: ${client.phone}${client.email ? `\n📧 Email: ${client.email}` : ''}${client.address ? `\n📍 Address: ${client.address}` : ''}${client.company ? `\n🏢 Company: ${client.company}` : ''}`,
    };
  } catch (error) {
    console.error('[Chat] create_client error:', error);
    return { success: false, result: null, message: `❌ ক্লায়েন্ট যোগ করতে সমস্যা: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

async function executeCreateExpense(args: Record<string, unknown>, businessId: string): Promise<{ success: boolean; result: unknown; message: string }> {
  try {
    if (!args.amount || Number(args.amount) <= 0) return { success: false, result: null, message: '❌ খরচের পরিমাণ দিন। / Please provide expense amount.' };

    const expense = await db.expense.create({
      data: {
        businessId,
        category: String(args.category || 'Miscellaneous'),
        description: String(args.description || ''),
        amount: Number(args.amount),
        date: new Date(),
        paymentMethod: args.paymentMethod ? String(args.paymentMethod) : null,
      },
    });
    return {
      success: true, result: expense,
      message: `✅ খরচ রেকর্ড হয়েছে! / Expense Recorded!\n\n💰 Amount: ₹${expense.amount}\n📂 Category: ${expense.category}\n📝 Description: ${expense.description}${expense.paymentMethod ? `\n💳 Payment: ${expense.paymentMethod}` : ''}`,
    };
  } catch (error) {
    console.error('[Chat] create_expense error:', error);
    return { success: false, result: null, message: `❌ খরচ রেকর্ড করতে সমস্যা: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

async function executeRecordPayment(args: Record<string, unknown>, businessId: string): Promise<{ success: boolean; result: unknown; message: string }> {
  try {
    const clientName = String(args.clientName || '');
    const amount = Number(args.amount) || 0;
    const paymentMethod = String(args.paymentMethod || 'Cash');

    if (!clientName) return { success: false, result: null, message: '❌ ক্লায়েন্টের নাম দিন। / Please provide client name.' };
    if (amount <= 0) return { success: false, result: null, message: '❌ পরিমাণ দিন। / Please provide amount.' };

    const client = await db.client.findFirst({ where: { businessId, name: { contains: clientName, mode: 'insensitive' } } });
    if (!client) return { success: false, result: null, message: `❌ "${clientName}" নামের ক্লায়েন্ট পাওয়া যায়নি। / Client not found.` };

    let billId: string | null = null;
    const unpaidBill = await db.bill.findFirst({ where: { businessId, clientId: client.id, status: { in: ['unpaid', 'partial'] } }, orderBy: { date: 'asc' } });
    if (unpaidBill) billId = unpaidBill.id;

    const payment = await db.payment.create({
      data: { businessId, clientId: client.id, billId, amount, date: new Date(), paymentMethod, receiptNumber: `RCP-${Date.now().toString().slice(-6)}`, notes: args.notes ? String(args.notes) : null },
    });

    if (billId) {
      const bill = await db.bill.findUnique({ where: { id: billId } });
      if (bill) {
        const newPaidAmount = bill.paidAmount + amount;
        await db.bill.update({ where: { id: billId }, data: { paidAmount: newPaidAmount, status: newPaidAmount >= bill.total ? 'paid' : 'partial' } });
      }
    }

    return {
      success: true, result: payment,
      message: `✅ পেমেন্ট রেকর্ড হয়েছে! / Payment Recorded!\n\n👤 Client: ${client.name}\n💰 Amount: ₹${amount}\n💳 Method: ${paymentMethod}\n🧾 Receipt: ${payment.receiptNumber}`,
    };
  } catch (error) {
    console.error('[Chat] record_payment error:', error);
    return { success: false, result: null, message: `❌ পেমেন্ট রেকর্ড করতে সমস্যা: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

async function executeGetDues(args: Record<string, unknown>, businessId: string): Promise<{ success: boolean; result: unknown; message: string }> {
  try {
    const filter = String(args.filter || 'all');
    const now = new Date();
    const where: Record<string, unknown> = { businessId, status: { in: ['unpaid', 'partial'] } };
    if (filter === 'overdue') where.dueDate = { lt: now };
    else if (filter === 'upcoming') where.dueDate = { gte: now };

    const bills = await db.bill.findMany({ where, include: { client: { select: { name: true } } }, orderBy: { dueDate: 'asc' }, take: 20 });
    if (bills.length === 0) return { success: true, result: [], message: '✅ কোনো বকেয়া নেই! / No dues found! 🎉' };

    const totalDue = bills.reduce((sum, b) => sum + (b.total - b.paidAmount), 0);
    const billList = bills.map(b => {
      const due = b.total - b.paidAmount;
      const isOverdue = b.dueDate < now;
      return `  ${isOverdue ? '🔴' : '🟡'} ${b.client.name} - ₹${due.toFixed(2)} (#${b.billNumber}, Due: ${b.dueDate.toLocaleDateString()})`;
    }).join('\n');

    return { success: true, result: bills, message: `⚠️ বকেয়া তালিকা / Dues:\n\n${billList}\n\n💰 মোট বকেয়া / Total Due: ₹${totalDue.toFixed(2)}` };
  } catch (error) {
    return { success: false, result: null, message: `❌ Error: ${error instanceof Error ? error.message : 'Unknown'}` };
  }
}

async function executeGetDashboard(args: Record<string, unknown>, businessId: string): Promise<{ success: boolean; result: unknown; message: string }> {
  try {
    const period = String(args.period || 'month');
    const now = new Date();
    let startDate = new Date(now);
    switch (period) {
      case 'today': startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
      case 'week': startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case 'month': startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
      case 'year': startDate = new Date(now.getFullYear(), 0, 1); break;
      default: startDate = new Date(2020, 0, 1);
    }

    const [bills, expenses, payments, clients] = await Promise.all([
      db.bill.findMany({ where: { businessId, date: { gte: startDate } } }),
      db.expense.findMany({ where: { businessId, date: { gte: startDate } } }),
      db.payment.findMany({ where: { businessId, date: { gte: startDate } } }),
      db.client.count({ where: { businessId } }),
    ]);

    const totalRevenue = bills.reduce((s, b) => s + b.total, 0);
    const totalPaid = bills.reduce((s, b) => s + b.paidAmount, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const totalPaymentsReceived = payments.reduce((s, p) => s + p.amount, 0);
    const totalDue = totalRevenue - totalPaid;
    const profit = totalPaid - totalExpenses;

    const periodLabel: Record<string, string> = { today: 'আজ / Today', week: 'এই সপ্তাহ / This Week', month: 'এই মাস / This Month', year: 'এই বছর / This Year', all: 'সব / All Time' };

    return {
      success: true, result: { totalRevenue, totalPaid, totalExpenses, totalDue, profit, clients },
      message: `📊 ${periodLabel[period] || periodLabel.month} সারসংক্ষেপ / Summary:\n\n💰 Revenue: ₹${totalRevenue.toFixed(2)}\n💵 Received: ₹${totalPaymentsReceived.toFixed(2)}\n📂 Expenses: ₹${totalExpenses.toFixed(2)}\n⚠️ Outstanding: ₹${totalDue.toFixed(2)}\n📈 Profit: ₹${profit.toFixed(2)}\n👥 Clients: ${clients}`,
    };
  } catch (error) {
    return { success: false, result: null, message: `❌ Error: ${error instanceof Error ? error.message : 'Unknown'}` };
  }
}

async function executeListClients(args: Record<string, unknown>, businessId: string): Promise<{ success: boolean; result: unknown; message: string }> {
  try {
    const search = String(args.search || '');
    const where: Record<string, unknown> = { businessId };
    if (search) where.OR = [{ name: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }];

    const clients = await db.client.findMany({ where, take: 20, orderBy: { createdAt: 'desc' } });
    if (clients.length === 0) return { success: true, result: [], message: search ? `🔍 "${search}" - কোনো ক্লায়েন্ট পাওয়া যায়নি।` : '👥 কোনো ক্লায়েন্ট নেই। / No clients yet.' };

    const list = clients.map(c => `  👤 ${c.name} | 📞 ${c.phone}${c.company ? ` | 🏢 ${c.company}` : ''}`).join('\n');
    return { success: true, result: clients, message: `👥 ক্লায়েন্ট তালিকা / Clients (${clients.length}):\n\n${list}` };
  } catch (error) {
    return { success: false, result: null, message: `❌ Error: ${error instanceof Error ? error.message : 'Unknown'}` };
  }
}

async function executeListBills(args: Record<string, unknown>, businessId: string): Promise<{ success: boolean; result: unknown; message: string }> {
  try {
    const status = String(args.status || 'all');
    const limit = Number(args.limit) || 10;
    const where: Record<string, unknown> = { businessId };
    if (status !== 'all') where.status = status;

    const bills = await db.bill.findMany({ where, include: { client: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: limit });
    if (bills.length === 0) return { success: true, result: [], message: '📄 কোনো বিল পাওয়া যায়নি। / No bills found.' };

    const list = bills.map(b => {
      const icon = b.status === 'paid' ? '✅' : b.status === 'partial' ? '🟡' : '🔴';
      return `  ${icon} #${b.billNumber} | ${b.client.name} | ₹${b.total.toFixed(2)} | ${b.billType.toUpperCase()}`;
    }).join('\n');
    return { success: true, result: bills, message: `📄 বিল তালিকা / Bills (${bills.length}):\n\n${list}` };
  } catch (error) {
    return { success: false, result: null, message: `❌ Error: ${error instanceof Error ? error.message : 'Unknown'}` };
  }
}

async function executeFunction(name: string, args: Record<string, unknown>, businessId: string): Promise<{ success: boolean; result: unknown; message: string }> {
  switch (name) {
    case 'create_bill': return executeCreateBill(args, businessId);
    case 'create_client': return executeCreateClient(args, businessId);
    case 'create_expense': return executeCreateExpense(args, businessId);
    case 'record_payment': return executeRecordPayment(args, businessId);
    case 'get_dues': return executeGetDues(args, businessId);
    case 'get_dashboard': return executeGetDashboard(args, businessId);
    case 'list_clients': return executeListClients(args, businessId);
    case 'list_bills': return executeListBills(args, businessId);
    default: return { success: false, result: null, message: `❌ Unknown function: ${name}` };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── MAIN HANDLER ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const { sessionId, message, context } = await request.json();
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const businessId = context?.businessId || '';

    // Build DB context
    let dbContext = '';
    if (businessId) {
      try {
        const [clients, recentBills] = await Promise.all([
          db.client.findMany({ where: { businessId }, take: 20, select: { id: true, name: true, phone: true } }),
          db.bill.findMany({ where: { businessId }, take: 5, include: { client: { select: { name: true } } }, orderBy: { createdAt: 'desc' } }),
        ]);
        dbContext = `\n\nCurrent Data:\nClients: ${JSON.stringify(clients.map(c => ({ id: c.id, name: c.name, phone: c.phone })))}\nRecent Bills: ${JSON.stringify(recentBills.map(b => ({ id: b.id, billNumber: b.billNumber, client: b.client.name, total: b.total, status: b.status, billType: b.billType })))}`;
      } catch { /* ignore */ }
    }

    // Get or create conversation
    let history = conversations.get(sessionId);
    if (!history) {
      history = [{ role: 'assistant', content: SYSTEM_PROMPT + dbContext }];
    } else {
      history[0] = { role: 'assistant', content: SYSTEM_PROMPT + dbContext };
    }
    history.push({ role: 'user', content: message });
    if (history.length > 22) history = [history[0], ...history.slice(-20)];

    let aiResponse: string | null = null;
    let actionExecuted = false;
    let actionData = null;

    // ── STEP 1: Try intent detection (works without LLM!) ──
    const intent = detectIntent(message);

    if (intent && businessId) {
      console.log(`[Chat] Detected intent: ${intent.action}`, JSON.stringify(intent.args));

      // Try Gemini function calling first (for more accurate parameter extraction)
      const geminiResult = await callGemini(history, true);

      if (geminiResult.functionCall) {
        // Gemini returned a function call - use it (more accurate params)
        const result = await executeFunction(geminiResult.functionCall.name, geminiResult.functionCall.args, businessId);
        actionExecuted = result.success;
        actionData = result.success ? result.result : null;

        if (result.success) {
          // Send result back to Gemini for natural language formatting
          history.push({ role: 'function_call', content: JSON.stringify({ name: geminiResult.functionCall.name, args: geminiResult.functionCall.args }) });
          history.push({ role: 'function_response', content: `${geminiResult.functionCall.name}|||${result.message}` });

          const followUp = await callGemini(history, false);
          aiResponse = followUp.text || result.message;
        } else {
          aiResponse = result.message;
        }
      } else if (geminiResult.text) {
        // Gemini responded with text but we have a detected intent
        // Execute the action anyway using our detected params
        const result = await executeFunction(intent.action, intent.args, businessId);
        actionExecuted = result.success;
        actionData = result.success ? result.result : null;

        if (result.success) {
          aiResponse = result.message;
        } else {
          aiResponse = geminiResult.text;
        }
      } else {
        // Gemini failed - use our detected intent
        const result = await executeFunction(intent.action, intent.args, businessId);
        actionExecuted = result.success;
        actionData = result.success ? result.result : null;
        aiResponse = result.message;
      }
    } else if (!intent) {
      // ── STEP 2: No intent detected - use LLM for conversation ──
      const geminiResult = await callGemini(history, false);

      if (geminiResult.text) {
        aiResponse = geminiResult.text;
      }

      // Fallback to ZAI SDK
      if (!aiResponse) {
        try {
          const zai = await getZAI();
          if (zai) {
            const zaiMessages = history
              .filter(m => m.role === 'user' || (m.role === 'assistant' && m !== history![0]))
              .slice(-10)
              .map(m => ({ role: m.role === 'user' ? 'user' as const : 'assistant' as const, content: m.content }));
            zaiMessages.unshift({ role: 'user', content: SYSTEM_PROMPT });

            const zaiResponse = await zai.chat.completions.create({
              messages: zaiMessages,
              thinking: { type: 'disabled' },
            });
            aiResponse = zaiResponse?.choices?.[0]?.message?.content || null;
          }
        } catch { /* ignore */ }
      }

      // Smart fallback
      if (!aiResponse) {
        const lower = message.toLowerCase();
        if (lower.match(/হ্যালো|হ্যাই|hello|hi|hey|নমস্কার|কেমন আছ/)) {
          aiResponse = `নমস্কার! / Hello! 👋\n\nআমি AAROHAN Business Hub এর AI সহকারী। আমি সরাসরি কাজ করতে পারি:\n\n• 📄 "Create a GST bill for ₹10,000 for [Client Name]"\n• 👥 "Add client named [Name], phone [number]"\n• 💰 "Record expense ₹500 for internet"\n• ⚠️ "Show my dues"\n• 📊 "Show dashboard"\n\nকী করতে চান? / What would you like to do?`;
        } else {
          aiResponse = `🙏 আমি AAROHAN Business Hub এর AI সহকারী।\n\nআমি সরাসরি কাজ করতে পারি - শুধু বলুন:\n• 📄 "Create a GST bill for ₹10,000 for [name]"\n• 👥 "Add client named Rahul, phone 9876543210"\n• 💰 "Record expense ₹500 for internet"\n• ⚠️ "Show my dues"\n• 📊 "Dashboard summary"\n\nকী করতে চান?`;
        }
      }
    } else {
      // Intent detected but no businessId
      aiResponse = '❌ ব্যবসা নির্বাচন করুন। / Please select a business first.';
    }

    history.push({ role: 'assistant', content: aiResponse });
    conversations.set(sessionId, history);

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
    return NextResponse.json({ error: 'Failed to clear conversation' }, { status: 500 });
  }
}
