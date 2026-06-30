import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ─── Gemini Function Declarations ───────────────────────────────────────
const GEMINI_FUNCTIONS = [
  {
    name: 'create_bill',
    description: 'Create a new bill/invoice for a client. Use this when user asks to create a bill, invoice, or charge a client. GST bills include CGST+SGST tax. Non-GST bills have no tax.',
    parameters: {
      type: 'OBJECT',
      properties: {
        clientName: { type: 'STRING', description: 'Name of the client to bill. If not provided, ask the user.' },
        clientPhone: { type: 'STRING', description: 'Phone number of the client (optional)' },
        clientAddress: { type: 'STRING', description: 'Address of the client (optional)' },
        clientGst: { type: 'STRING', description: 'GST number of the client (optional, for GST bills)' },
        billType: { type: 'STRING', enum: ['gst', 'non_gst'], description: 'Type of bill: gst or non_gst. Default is non_gst.' },
        items: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              itemName: { type: 'STRING', description: 'Name/description of the item or service' },
              quantity: { type: 'NUMBER', description: 'Quantity. Default 1.' },
              rate: { type: 'NUMBER', description: 'Rate per unit in INR' },
              taxMode: { type: 'STRING', enum: ['excl', 'incl'], description: 'excl = GST exclusive rate, incl = GST inclusive rate. Default excl.' },
            },
            required: ['itemName', 'rate'],
          },
          description: 'List of items/services in the bill',
        },
        notes: { type: 'STRING', description: 'Additional notes for the bill (optional)' },
      },
      required: ['billType', 'items'],
    },
  },
  {
    name: 'create_client',
    description: 'Add a new client to the business. Use this when user asks to add, create, or register a new client.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Full name of the client' },
        phone: { type: 'STRING', description: 'Phone number of the client' },
        email: { type: 'STRING', description: 'Email address (optional)' },
        address: { type: 'STRING', description: 'Address (optional)' },
        company: { type: 'STRING', description: 'Company name (optional)' },
      },
      required: ['name', 'phone'],
    },
  },
  {
    name: 'create_expense',
    description: 'Record a new expense. Use this when user asks to add, record, or log an expense.',
    parameters: {
      type: 'OBJECT',
      properties: {
        category: { type: 'STRING', description: 'Category like Rent, Salary, Travel, Food, Internet, Marketing, Software, Utilities, Miscellaneous etc.' },
        description: { type: 'STRING', description: 'Description of the expense' },
        amount: { type: 'NUMBER', description: 'Amount in INR (₹)' },
        paymentMethod: { type: 'STRING', enum: ['Cash', 'bKash', 'Bank Transfer', 'UPI', 'Card', 'Other'], description: 'Payment method (optional)' },
      },
      required: ['category', 'description', 'amount'],
    },
  },
  {
    name: 'record_payment',
    description: 'Record a payment received from a client. Use this when user says they received payment from a client.',
    parameters: {
      type: 'OBJECT',
      properties: {
        clientName: { type: 'STRING', description: 'Name of the client who paid' },
        amount: { type: 'NUMBER', description: 'Amount received in INR (₹)' },
        paymentMethod: { type: 'STRING', enum: ['Cash', 'bKash', 'Bank Transfer', 'UPI', 'Card', 'Other'], description: 'Payment method' },
        billNumber: { type: 'STRING', description: 'Bill number if payment is for a specific bill (optional)' },
        notes: { type: 'STRING', description: 'Additional notes (optional)' },
      },
      required: ['clientName', 'amount', 'paymentMethod'],
    },
  },
  {
    name: 'get_dues',
    description: 'Get list of unpaid/partially paid bills and dues. Use this when user asks about dues, unpaid bills, or outstanding amounts.',
    parameters: {
      type: 'OBJECT',
      properties: {
        filter: { type: 'STRING', enum: ['all', 'overdue', 'upcoming'], description: 'Filter dues: all, overdue (past due date), or upcoming. Default all.' },
      },
    },
  },
  {
    name: 'get_dashboard',
    description: 'Get dashboard summary including total revenue, expenses, dues, and recent activity. Use this when user asks for summary, overview, or dashboard data.',
    parameters: {
      type: 'OBJECT',
      properties: {
        period: { type: 'STRING', enum: ['today', 'week', 'month', 'year', 'all'], description: 'Time period for summary. Default month.' },
      },
    },
  },
  {
    name: 'list_clients',
    description: 'List all clients of the business. Use this when user asks to see or list clients.',
    parameters: {
      type: 'OBJECT',
      properties: {
        search: { type: 'STRING', description: 'Search term to filter clients by name or phone (optional)' },
      },
    },
  },
  {
    name: 'list_bills',
    description: 'List recent bills. Use this when user asks to see or list bills/invoices.',
    parameters: {
      type: 'OBJECT',
      properties: {
        status: { type: 'STRING', enum: ['all', 'paid', 'unpaid', 'partial'], description: 'Filter by payment status. Default all.' },
        limit: { type: 'NUMBER', description: 'Number of bills to return. Default 10.' },
      },
    },
  },
];

// ─── System Prompt ──────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are the AI assistant for "AAROHAN BUSINESS HUB" - a multi-business management platform owned by AAROHAN TECH SOLUTIONS.

Business Details:
1. AAROHAN TECH SOLUTIONS (Marketing Agency)
   - Services: Digital Marketing, SEO, Social Media Management, Branding, Content Creation, Graphic Design
   - GST NO: 19MKIPS8902F1ZG
   - Address: 24/27 A.K.M ROAD, BARANAGAR, KOLKATA - 700090
   - Contact: 6290717007 | contact@aarohantechsolutions.in
   - Bank: SAMATA CO-OPERATIVE BANK, ACC: 003105000000153, IFSC: HDFC0CSAMAT

2. ASTRONAUT STIKERZ (Notebook & Mousepad)
   - Products: Custom Notebooks, Mousepads, Stickers

3. AAROHAN WEB ACADEMY (Institute)
   - Courses: Web Development, Digital Marketing, Graphic Design

CRITICAL RULES:
1. When the user asks you to DO something (create, add, record, show, list), use the available functions. DO NOT give manual instructions.
2. When user says "create a bill", CALL the create_bill function. Do NOT tell them the steps.
3. When user says "add a client", CALL the create_client function. Do NOT tell them the steps.
4. When user says "record expense", CALL the create_expense function. Do NOT tell them the steps.
5. If you are missing required information (like client name for a bill), ASK the user for it - do NOT give manual steps.
6. Always respond in Bengali + English (bilingual).
7. Use ₹ (INR) for all monetary amounts.
8. GST: CGST 9% + SGST 9% = 18% total.
9. Be concise but friendly.
10. After a function executes successfully, confirm the result to the user with the details.`;

// ─── Conversation Store ─────────────────────────────────────────────────
const conversations = new Map<string, Array<{ role: string; content: string }>>();

// ─── Gemini API with Function Calling ───────────────────────────────────
async function callGeminiWithFunctions(
  messages: Array<{ role: string; content: string }>,
  functionCall?: { name: string; args: Record<string, unknown> }
): Promise<{ text: string | null; functionCall: { name: string; args: Record<string, unknown> } | null }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { text: null, functionCall: null };

  try {
    // Build contents for Gemini
    const contents = [];
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (i === 0) continue; // Skip system message (handled separately)

      if (m.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: m.content }] });
      } else if (m.role === 'assistant') {
        contents.push({ role: 'model', parts: [{ text: m.content }] });
      } else if (m.role === 'function_response') {
        contents.push({
          role: 'function',
          parts: [{
            functionResponse: {
              name: m.content.split('|||')[0] || 'unknown',
              response: { result: m.content.split('|||')[1] || '' },
            },
          }],
        });
      } else if (m.role === 'function_call') {
        const parsed = JSON.parse(m.content);
        contents.push({
          role: 'model',
          parts: [{ functionCall: parsed }],
        });
      }
    }

    // If we have a pending function call result to send back
    if (functionCall) {
      // The model made a function call - we need to send the result back
      // This is handled by the caller adding function_response to messages
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const body: Record<string, unknown> = {
      contents,
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      tools: [{ functionDeclarations: GEMINI_FUNCTIONS }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('[Chat] Gemini error:', response.status, errText);
      return { text: null, functionCall: null };
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0];
    if (!candidate?.content?.parts) return { text: null, functionCall: null };

    let textResult: string | null = null;
    let fcResult: { name: string; args: Record<string, unknown> } | null = null;

    for (const part of candidate.content.parts) {
      if (part.text) textResult = (textResult || '') + part.text;
      if (part.functionCall) {
        fcResult = { name: part.functionCall.name, args: part.functionCall.args || {} };
      }
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
    } catch {
      zaiInitPromise = null;
      return null;
    }
  })();
  return zaiInitPromise;
}

async function callZAI(messages: Array<{ role: string; content: string }>): Promise<string | null> {
  try {
    const zai = await getZAI();
    if (!zai) return null;
    const response = await zai.chat.completions.create({
      messages,
      thinking: { type: 'disabled' },
    });
    return response?.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
}

// ─── Smart Fallback ─────────────────────────────────────────────────────
function generateSmartResponse(message: string): string {
  const lower = message.toLowerCase();
  if (lower.match(/হ্যালো|হ্যাই|hello|hi|hey|নমস্কার|কেমন আছ/)) {
    return `নমস্কার! / Hello! 👋\n\nআমি AAROHAN Business Hub এর AI সহকারী। আমি আপনাকে সাহায্য করতে পারি:\n\n• বিল তৈরি / Create bills (GST & Non-GST)\n• ক্লায়েন্ট যোগ / Add clients\n• খরচ রেকর্ড / Record expenses\n• বকেয়া দেখুন / Check dues\n• পেমেন্ট ট্র্যাক / Track payments\n\nকী সাহায্য চান? / How can I help?`;
  }
  return `🙏 আমি AAROHAN Business Hub এর AI সহকারী।\n\nআমি সরাসরি কাজ করতে পারি - শুধু বলুন:\n• 📄 "Create a GST bill for ₹10,000"\n• 👥 "Add client named Rahul, phone 9876543210"\n• 💰 "Record expense ₹500 for internet"\n• ⚠️ "Show my dues"\n\nকী করতে চান?`;
}

// ─── Action Executors ───────────────────────────────────────────────────
async function executeCreateBill(args: Record<string, unknown>, businessId: string): Promise<{ success: boolean; result: unknown; message: string }> {
  try {
    const billType = String(args.billType || 'non_gst');
    const items = (args.items as Array<Record<string, unknown>>) || [];
    const clientName = String(args.clientName || '');
    const GST_RATE = 0.18;

    // Find or create client
    let clientId = '';
    if (clientName) {
      let client = await db.client.findFirst({
        where: { businessId, name: { contains: clientName, mode: 'insensitive' } },
      });
      if (!client) {
        // Create client automatically
        client = await db.client.create({
          data: {
            businessId,
            name: clientName,
            phone: String(args.clientPhone || '0000000000'),
            address: args.clientAddress ? String(args.clientAddress) : null,
          },
        });
      }
      clientId = client.id;
    } else {
      // Use first client as fallback
      const firstClient = await db.client.findFirst({ where: { businessId } });
      if (firstClient) clientId = firstClient.id;
    }

    if (!clientId) {
      return { success: false, result: null, message: 'কোনো ক্লায়েন্ট পাওয়া যায়নি। অনুগ্রহ করে ক্লায়েন্টের নাম দিন। / No client found. Please provide a client name.' };
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
        quantity: qty,
        rate,
        amount,
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
        businessId,
        clientId,
        billNumber: `ATS/${new Date().getFullYear().toString().slice(2)}-${String(new Date().getMonth() + 1).padStart(2, '0')}/${String(Math.floor(Math.random() * 900) + 100)}`,
        date: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        subtotal: billType === 'gst' ? subtotal : total,
        tax: totalGst,
        discount: 0,
        total,
        billType,
        clientGst: args.clientGst ? String(args.clientGst) : null,
        clientAddress: args.clientAddress ? String(args.clientAddress) : null,
        notes: args.notes ? String(args.notes) : null,
        items: { create: processedItems },
      },
      include: { items: true, client: true },
    });

    const client = bill.client;
    const itemSummary = processedItems.map(i => `  - ${i.itemName}: ₹${i.rate} x ${i.quantity} = ₹${i.amount.toFixed(2)}`).join('\n');

    return {
      success: true,
      result: bill,
      message: `✅ বিল তৈরি হয়েছে! / Bill Created!\n\n📄 Bill #${bill.billNumber}\n👤 Client: ${client.name}\n📋 Items:\n${itemSummary}\n💰 Subtotal: ₹${billType === 'gst' ? subtotal.toFixed(2) : total.toFixed(2)}${billType === 'gst' ? `\n📊 GST (CGST 9% + SGST 9%): ₹${totalGst.toFixed(2)}` : ''}\n💵 Total: ₹${total.toFixed(2)}\n${billType === 'gst' ? '🏷️ Type: GST Bill' : '🏷️ Type: Non-GST Bill'}`,
    };
  } catch (error) {
    console.error('[Chat] create_bill error:', error);
    return { success: false, result: null, message: `❌ বিল তৈরি করতে সমস্যা হয়েছে: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

async function executeCreateClient(args: Record<string, unknown>, businessId: string): Promise<{ success: boolean; result: unknown; message: string }> {
  try {
    const client = await db.client.create({
      data: {
        businessId,
        name: String(args.name || ''),
        phone: String(args.phone || ''),
        email: args.email ? String(args.email) : null,
        address: args.address ? String(args.address) : null,
        company: args.company ? String(args.company) : null,
      },
    });
    return {
      success: true,
      result: client,
      message: `✅ ক্লায়েন্ট যোগ হয়েছে! / Client Added!\n\n👤 Name: ${client.name}\n📞 Phone: ${client.phone}${client.email ? `\n📧 Email: ${client.email}` : ''}${client.address ? `\n📍 Address: ${client.address}` : ''}${client.company ? `\n🏢 Company: ${client.company}` : ''}`,
    };
  } catch (error) {
    console.error('[Chat] create_client error:', error);
    return { success: false, result: null, message: `❌ ক্লায়েন্ট যোগ করতে সমস্যা: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

async function executeCreateExpense(args: Record<string, unknown>, businessId: string): Promise<{ success: boolean; result: unknown; message: string }> {
  try {
    const expense = await db.expense.create({
      data: {
        businessId,
        category: String(args.category || 'Miscellaneous'),
        description: String(args.description || ''),
        amount: Number(args.amount) || 0,
        date: new Date(),
        paymentMethod: args.paymentMethod ? String(args.paymentMethod) : null,
      },
    });
    return {
      success: true,
      result: expense,
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

    // Find client
    const client = await db.client.findFirst({
      where: { businessId, name: { contains: clientName, mode: 'insensitive' } },
    });
    if (!client) {
      return { success: false, result: null, message: `❌ "${clientName}" নামের ক্লায়েন্ট পাওয়া যায়নি। / Client "${clientName}" not found.` };
    }

    // Find bill if specified
    let billId = null;
    if (args.billNumber) {
      const bill = await db.bill.findFirst({
        where: { businessId, clientId: client.id, billNumber: String(args.billNumber) },
      });
      if (bill) billId = bill.id;
    }

    // If no bill specified, find the oldest unpaid bill
    if (!billId) {
      const unpaidBill = await db.bill.findFirst({
        where: { businessId, clientId: client.id, status: { in: ['unpaid', 'partial'] } },
        orderBy: { date: 'asc' },
      });
      if (unpaidBill) billId = unpaidBill.id;
    }

    const payment = await db.payment.create({
      data: {
        businessId,
        clientId: client.id,
        billId,
        amount,
        date: new Date(),
        paymentMethod,
        receiptNumber: `RCP-${Date.now().toString().slice(-6)}`,
        notes: args.notes ? String(args.notes) : null,
      },
    });

    // Update bill paid amount
    if (billId) {
      const bill = await db.bill.findUnique({ where: { id: billId } });
      if (bill) {
        const newPaidAmount = bill.paidAmount + amount;
        await db.bill.update({
          where: { id: billId },
          data: {
            paidAmount: newPaidAmount,
            status: newPaidAmount >= bill.total ? 'paid' : 'partial',
          },
        });
      }
    }

    return {
      success: true,
      result: payment,
      message: `✅ পেমেন্ট রেকর্ড হয়েছে! / Payment Recorded!\n\n👤 Client: ${client.name}\n💰 Amount: ₹${amount}\n💳 Method: ${paymentMethod}\n🧾 Receipt: ${payment.receiptNumber}${billId ? '\n📄 Applied to bill' : ''}`,
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

    const where: Record<string, unknown> = {
      businessId,
      status: { in: ['unpaid', 'partial'] },
    };

    if (filter === 'overdue') {
      where.dueDate = { lt: now };
    } else if (filter === 'upcoming') {
      where.dueDate = { gte: now };
    }

    const bills = await db.bill.findMany({
      where,
      include: { client: { select: { name: true } } },
      orderBy: { dueDate: 'asc' },
      take: 20,
    });

    if (bills.length === 0) {
      return { success: true, result: [], message: `✅ কোনো বকেয়া নেই! / No dues found! 🎉` };
    }

    const totalDue = bills.reduce((sum, b) => sum + (b.total - b.paidAmount), 0);
    const billList = bills.map(b => {
      const due = b.total - b.paidAmount;
      const isOverdue = b.dueDate < now;
      return `  ${isOverdue ? '🔴' : '🟡'} ${b.client.name} - ₹${due.toFixed(2)} (Bill #${b.billNumber}, Due: ${b.dueDate.toLocaleDateString()})`;
    }).join('\n');

    return {
      success: true,
      result: bills,
      message: `⚠️ বকেয়া তালিকা / Dues List:\n\n${billList}\n\n💰 মোট বকেয়া / Total Due: ₹${totalDue.toFixed(2)}`,
    };
  } catch (error) {
    console.error('[Chat] get_dues error:', error);
    return { success: false, result: null, message: `❌ বকেয়া দেখতে সমস্যা: ${error instanceof Error ? error.message : 'Unknown error'}` };
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
      default: startDate = new Date(2020, 0, 1); break;
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

    const periodLabel = { today: 'আজ / Today', week: 'এই সপ্তাহ / This Week', month: 'এই মাস / This Month', year: 'এই বছর / This Year', all: 'সব / All Time' }[period] || 'এই মাস / This Month';

    return {
      success: true,
      result: { totalRevenue, totalPaid, totalExpenses, totalDue, profit, clients },
      message: `📊 ${periodLabel} সারসংক্ষেপ / Summary:\n\n💰 Revenue: ₹${totalRevenue.toFixed(2)}\n💵 Received: ₹${totalPaymentsReceived.toFixed(2)}\n📂 Expenses: ₹${totalExpenses.toFixed(2)}\n⚠️ Outstanding: ₹${totalDue.toFixed(2)}\n📈 Profit: ₹${profit.toFixed(2)}\n👥 Clients: ${clients}`,
    };
  } catch (error) {
    console.error('[Chat] get_dashboard error:', error);
    return { success: false, result: null, message: `❌ ড্যাশবোর্ড দেখতে সমস্যা: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

async function executeListClients(args: Record<string, unknown>, businessId: string): Promise<{ success: boolean; result: unknown; message: string }> {
  try {
    const search = String(args.search || '');
    const where: Record<string, unknown> = { businessId };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    const clients = await db.client.findMany({ where, take: 20, orderBy: { createdAt: 'desc' } });

    if (clients.length === 0) {
      return { success: true, result: [], message: search ? `🔍 "${search}" নামে কোনো ক্লায়েন্ট পাওয়া যায়নি। / No clients found for "${search}".` : `👥 কোনো ক্লায়েন্ট নেই। / No clients yet.` };
    }

    const clientList = clients.map(c => `  👤 ${c.name} | 📞 ${c.phone}${c.company ? ` | 🏢 ${c.company}` : ''}`).join('\n');

    return {
      success: true,
      result: clients,
      message: `👥 ক্লায়েন্ট তালিকা / Clients (${clients.length}):\n\n${clientList}`,
    };
  } catch (error) {
    console.error('[Chat] list_clients error:', error);
    return { success: false, result: null, message: `❌ ক্লায়েন্ট দেখতে সমস্যা: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

async function executeListBills(args: Record<string, unknown>, businessId: string): Promise<{ success: boolean; result: unknown; message: string }> {
  try {
    const status = String(args.status || 'all');
    const limit = Number(args.limit) || 10;
    const where: Record<string, unknown> = { businessId };
    if (status !== 'all') where.status = status;

    const bills = await db.bill.findMany({
      where,
      include: { client: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    if (bills.length === 0) {
      return { success: true, result: [], message: `📄 কোনো বিল পাওয়া যায়নি। / No bills found.` };
    }

    const billList = bills.map(b => {
      const statusIcon = b.status === 'paid' ? '✅' : b.status === 'partial' ? '🟡' : '🔴';
      return `  ${statusIcon} #${b.billNumber} | ${b.client.name} | ₹${b.total.toFixed(2)} | ${b.billType.toUpperCase()}`;
    }).join('\n');

    return {
      success: true,
      result: bills,
      message: `📄 বিল তালিকা / Bills (${bills.length}):\n\n${billList}`,
    };
  } catch (error) {
    console.error('[Chat] list_bills error:', error);
    return { success: false, result: null, message: `❌ বিল দেখতে সমস্যা: ${error instanceof Error ? error.message : 'Unknown error'}` };
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

// ─── Main Handler ───────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const { sessionId, message, context } = await request.json();
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const businessId = context?.businessId || '';

    // Build DB context for system prompt
    let dbContext = '';
    if (businessId) {
      try {
        const [clients, recentBills] = await Promise.all([
          db.client.findMany({ where: { businessId }, take: 20, select: { id: true, name: true, phone: true } }),
          db.bill.findMany({ where: { businessId }, take: 5, include: { client: { select: { name: true } } }, orderBy: { createdAt: 'desc' } }),
        ]);
        dbContext = `\n\nCurrent DB Data:\nClients: ${JSON.stringify(clients)}\nRecent Bills: ${JSON.stringify(recentBills.map(b => ({ id: b.id, billNumber: b.billNumber, client: b.client.name, total: b.total, status: b.status, billType: b.billType })))}`;
      } catch { /* ignore */ }
    }

    // Get or create conversation history
    let history = conversations.get(sessionId);
    if (!history) {
      history = [{ role: 'assistant', content: SYSTEM_PROMPT + dbContext }];
    } else {
      history[0] = { role: 'assistant', content: SYSTEM_PROMPT + dbContext };
    }
    history.push({ role: 'user', content: message });
    if (history.length > 22) history = [history[0], ...history.slice(-20)];

    // ── Try Gemini with Function Calling ──
    let aiResponse: string | null = null;
    let actionResult = null;
    let actionExecuted = false;
    let actionData = null;

    const geminiResult = await callGeminiWithFunctions(history);

    if (geminiResult.functionCall) {
      // Gemini wants to call a function!
      const { name, args } = geminiResult.functionCall;

      if (businessId) {
        // Execute the function
        const result = await executeFunction(name, args, businessId);
        actionExecuted = result.success;
        actionData = result.success ? result.result : null;

        if (result.success) {
          // Send function result back to Gemini for a natural language response
          history.push({ role: 'function_call', content: JSON.stringify({ name, args }) });
          history.push({ role: 'function_response', content: `${name}|||${result.message}` });

          const followUp = await callGeminiWithFunctions(history);
          if (followUp.text) {
            aiResponse = followUp.text;
          } else {
            aiResponse = result.message;
          }
        } else {
          aiResponse = result.message;
        }
      } else {
        aiResponse = '❌ Business ID missing. Please select a business first.';
      }
    } else if (geminiResult.text) {
      // Gemini responded with text only
      aiResponse = geminiResult.text;
    }

    // ── Fallback to ZAI SDK ──
    if (!aiResponse) {
      const simpleMessages = history
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
      aiResponse = await callZAI(simpleMessages);
    }

    // ── Smart fallback ──
    if (!aiResponse) {
      aiResponse = generateSmartResponse(message);
    }

    history.push({ role: 'assistant', content: aiResponse });
    conversations.set(sessionId, history);

    return NextResponse.json({
      success: true,
      response: aiResponse,
      actionExecuted,
      actionData,
    });
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
