import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const BUSINESS_KNOWLEDGE = `
You are the AI assistant for "AAROHAN BUSINESS HUB" - a multi-business management platform. You help the business owner manage their businesses.

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

IMPORTANT - You can perform actions! When user asks to create something, respond with action JSON:
{{"action": "create_bill", "data": {"clientId": "id", "billNumber": "001", "billType": "gst", "items": [...]}}}
{{"action": "create_client", "data": {"name": "...", "phone": "..."}}}
{{"action": "create_expense", "data": {"category": "...", "amount": 5000}}}

Rules:
1. Respond in Bengali + English (bilingual)
2. For financial amounts use ₹ (INR)
3. GST: CGST 9% + SGST 9% = 18%
4. Be helpful and professional
`;

const conversations = new Map<string, Array<{ role: string; content: string }>>();

// --- Provider 1: Gemini API ---
async function callGemini(messages: Array<{ role: string; content: string }>): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const contents = messages
      .filter(m => m.role !== 'system' && m.role !== 'assistant' || m === messages[0])
      .map(m => ({
        role: m.role === 'assistant' && m !== messages[0] ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const systemInstruction = messages[0]?.content || '';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
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

// --- Provider 2: ZAI SDK ---
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

// --- Provider 3: Smart Fallback ---
function generateSmartResponse(message: string): string {
  const lower = message.toLowerCase();

  if (lower.match(/হ্যালো|হ্যাই|hello|hi|hey|নমস্কার|কেমন আছ/)) {
    return `নমস্কার! / Hello! 👋\n\nআমি AAROHAN Business Hub এর AI সহকারী। আমি আপনাকে সাহায্য করতে পারি:\n\n• বিল তৈরি / Create bills (GST & Non-GST)\n• ক্লায়েন্ট যোগ / Add clients\n• খরচ রেকর্ড / Record expenses\n• বকেয়া দেখুন / Check dues\n• পেমেন্ট ট্র্যাক / Track payments\n\nকী সাহায্য চান? / How can I help?`;
  }
  if (lower.match(/বিল|bill|invoice/)) {
    return `📄 **বিল তৈরি / Create Bill**\n\n1. Bills → New Bill ক্লিক করুন\n2. GST / Non-GST সিলেক্ট করুন\n3. Existing / New Client সিলেক্ট করুন\n4. আইটেম যোগ করুন\n5. সেভ করুন → Invoice Preview → Print`;
  }
  if (lower.match(/খরচ|expense/)) {
    return `💰 **খরচ যোগ / Add Expense**\n\nExpenses মেনুতে যান → নতুন খরচ ক্লিক → ক্যাটাগরি ও পরিমাণ দিন → সেভ`;
  }
  if (lower.match(/ক্লায়েন্ট|client/)) {
    return `👥 **ক্লায়েন্ট / Clients**\n\nClients মেনুতে যান → নতুন ক্লায়েন্ট ক্লিক → তথ্য দিন → সেভ`;
  }
  return `🙏 আমি AAROHAN Business Hub এর AI সহকারী।\n\n• 📄 বিল তৈরি / Create Bill\n• 👥 ক্লায়েন্ট যোগ / Add Client\n• 💰 খরচ রেকর্ড / Record Expense\n• ⚠️ বকেয়া দেখুন / Check Dues\n\nকী বিষয়ে জানতে চান?`;
}

// Execute actions
async function executeAction(action: string, data: Record<string, unknown>, businessId: string): Promise<{ success: boolean; result: unknown }> {
  try {
    if (action === 'create_client') {
      const client = await db.client.create({
        data: {
          businessId,
          name: String(data.name || ''),
          phone: String(data.phone || ''),
          address: data.address ? String(data.address) : null,
          email: data.email ? String(data.email) : null,
          company: data.company ? String(data.company) : null,
        },
      });
      return { success: true, result: client };
    }

    if (action === 'create_bill') {
      const items = (data.items as Array<Record<string, unknown>>) || [];
      const billType = String(data.billType || 'non_gst');
      const GST_RATE = 0.18;
      let subtotal = 0;
      let totalGst = 0;

      const processedItems = items.map((item) => {
        const rate = Number(item.rate) || 0;
        const qty = Number(item.quantity) || 1;
        const taxMode = String(item.taxMode || 'excl');
        const baseRate = taxMode === 'incl' ? rate / (1 + GST_RATE) : rate;
        const itemGst = baseRate * GST_RATE * qty;
        const amount = taxMode === 'incl' ? rate * qty : baseRate * (1 + GST_RATE) * qty;
        subtotal += baseRate * qty;
        totalGst += itemGst;
        return {
          description: String(item.description || item.itemName || ''),
          quantity: qty, rate, amount,
          itemName: String(item.itemName || ''),
          taxMode,
          cgst: billType === 'gst' ? baseRate * 0.09 * qty : 0,
          sgst: billType === 'gst' ? baseRate * 0.09 * qty : 0,
          baseRate,
        };
      });

      const total = subtotal + totalGst;
      const bill = await db.bill.create({
        data: {
          businessId,
          clientId: String(data.clientId || ''),
          billNumber: String(data.billNumber || `ATS/${new Date().getFullYear().toString().slice(2)}-${String(new Date().getMonth() + 1).padStart(2, '0')}/${String(Math.floor(Math.random() * 900) + 100)}`),
          date: new Date(String(data.date || new Date().toISOString().split('T')[0])),
          dueDate: new Date(String(data.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])),
          subtotal, tax: totalGst, discount: 0, total,
          billType,
          clientGst: data.clientGst ? String(data.clientGst) : null,
          clientAddress: data.clientAddress ? String(data.clientAddress) : null,
          notes: data.notes ? String(data.notes) : null,
          items: { create: processedItems },
        },
        include: { items: true, client: true },
      });
      return { success: true, result: bill };
    }

    if (action === 'create_expense') {
      const expense = await db.expense.create({
        data: {
          businessId,
          category: String(data.category || 'Miscellaneous'),
          description: String(data.description || ''),
          amount: Number(data.amount) || 0,
          date: new Date(String(data.date || new Date().toISOString().split('T')[0])),
          paymentMethod: data.paymentMethod ? String(data.paymentMethod) : null,
        },
      });
      return { success: true, result: expense };
    }

    return { success: false, result: 'Unknown action' };
  } catch (error) {
    console.error('[Chat] Action error:', error);
    return { success: false, result: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, message, context } = await request.json();
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Build DB context
    let dbContext = '';
    const businessId = context?.businessId;
    if (businessId) {
      try {
        const [clients, bills, expenses] = await Promise.all([
          db.client.findMany({ where: { businessId }, take: 20 }),
          db.bill.findMany({ where: { businessId }, take: 10, include: { client: { select: { name: true } } } }),
          db.expense.findMany({ where: { businessId }, take: 10 }),
        ]);
        dbContext = `\n\nCurrent Data:\nClients: ${JSON.stringify(clients.map(c => ({ id: c.id, name: c.name, phone: c.phone })))}\nRecent Bills: ${JSON.stringify(bills.map(b => ({ id: b.id, billNumber: b.billNumber, client: b.client.name, total: b.total, billType: b.billType })))}\nRecent Expenses: ${JSON.stringify(expenses.map(e => ({ category: e.category, amount: e.amount })))}`;
      } catch { /* ignore */ }
    }

    let history = conversations.get(sessionId);
    if (!history) {
      history = [{ role: 'assistant', content: BUSINESS_KNOWLEDGE + dbContext }];
    } else {
      history[0] = { role: 'assistant', content: BUSINESS_KNOWLEDGE + dbContext };
    }
    history.push({ role: 'user', content: message });
    if (history.length > 22) history = [history[0], ...history.slice(-20)];

    // Try providers in order: Gemini → ZAI → Smart Fallback
    let aiResponse: string | null = null;

    // Try Gemini first
    aiResponse = await callGemini(history);

    // Try ZAI if Gemini failed
    if (!aiResponse) {
      aiResponse = await callZAI(history);
    }

    // Smart fallback
    if (!aiResponse) {
      aiResponse = generateSmartResponse(message);
    }

    // Check for action JSON in response
    let actionResult = null;
    const actionMatch = aiResponse.match(/\{\{"action":\s*"(\w+)",\s*"data":\s*(\{[\s\S]*?\})\}\}/);
    if (actionMatch && businessId) {
      try {
        const action = actionMatch[1];
        const data = JSON.parse(actionMatch[2]);
        actionResult = await executeAction(action, data, businessId);
        if (actionResult.success) {
          const actionMsg = action === 'create_bill'
            ? `✅ Bill created! #${(actionResult.result as Record<string, unknown>)?.billNumber || ''}`
            : action === 'create_client'
            ? `✅ Client added!`
            : action === 'create_expense'
            ? `✅ Expense recorded!`
            : `✅ Done!`;
          aiResponse = aiResponse.replace(actionMatch[0], '').trim() + '\n\n' + actionMsg;
        }
      } catch { /* action failed, still return text */ }
    }

    history.push({ role: 'user', content: aiResponse });
    conversations.set(sessionId, history);

    return NextResponse.json({
      success: true,
      response: aiResponse,
      actionExecuted: actionResult?.success || false,
      actionData: actionResult?.success ? actionResult.result : null,
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
