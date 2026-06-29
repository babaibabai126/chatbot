import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const BUSINESS_KNOWLEDGE = `
You are the AI assistant for "AAROHAN BUSINESS HUB" - a multi-business management platform. You help the business owner manage their businesses.

ব্যবসার তথ্য / Business Details:

1. AAROHAN TECH SOLUTIONS (Marketing Agency)
   - Services: Digital Marketing, SEO, Social Media Management, Branding, Content Creation, Graphic Design
   - সেবা: ডিজিটাল মার্কেটিং, SEO, সোশ্যাল মিডিয়া ম্যানেজমেন্ট, ব্র্যান্ডিং, কনটেন্ট ক্রিয়েশন, গ্রাফিক ডিজাইন

2. ASTRONAUT STIKERZ (Notebook & Mousepad)
   - Products: Custom Notebooks, Mousepads, Stickers
   - পণ্য: কাস্টম নোটবুক, মাউসপ্যাড, স্টিকার

3. AAROHAN WEB ACADEMY (Institute)
   - Courses: Web Development, Digital Marketing, Graphic Design
   - কোর্স: ওয়েব ডেভেলপমেন্ট, ডিজিটাল মার্কেটিং, গ্রাফিক ডিজাইন

Your capabilities:
- Help create bills/invoices for clients
- Help create quotations
- Add expenses to the expense list
- Manage client information
- Track payments and dues
- Provide business summaries and reports

Rules:
1. Always respond in Bengali + English (bilingual)
2. Be helpful, professional, and concise
3. When asked to create a bill/quotation/expense, guide the user step by step
4. Use proper formatting with clear sections
5. For financial amounts, always show in BDT (৳)
6. If the user asks you to do something (create bill, add expense etc.), confirm the details before creating
7. Help with calculations when needed
`;

const conversations = new Map<string, Array<{ role: string; content: string }>>();

interface ZAIConfig {
  baseUrl: string;
  apiKey: string;
  chatId?: string;
  userId?: string;
  token?: string;
}

function getZAIConfig(): ZAIConfig {
  const baseUrl = process.env.ZAI_BASE_URL || 'https://internal-api.z.ai/v1';
  const apiKey = process.env.ZAI_API_KEY || 'Z.ai';
  const chatId = process.env.ZAI_CHAT_ID;
  const userId = process.env.ZAI_USER_ID;
  const token = process.env.ZAI_TOKEN;

  return { baseUrl, apiKey, chatId, userId, token };
}

async function callZAI(messages: Array<{ role: string; content: string }>): Promise<string | null> {
  const config = getZAIConfig();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`,
    'X-Z-AI-From': 'Z',
  };

  if (config.chatId) {
    headers['X-Chat-Id'] = config.chatId;
  }
  if (config.userId) {
    headers['X-User-Id'] = config.userId;
  }
  if (config.token) {
    headers['X-Token'] = config.token;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages,
        thinking: { type: 'disabled' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ZAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// Smart fallback when ZAI API is unavailable
function generateSmartResponse(message: string, dbContext: string): string {
  const lower = message.toLowerCase();

  // Greeting
  if (lower.match(/হ্যালো|হ্যাই|hello|hi|hey|নমস্কার|কেমন আছ/)) {
    return `নমস্কার! / Hello! 👋\n\nআমি AAROHAN Business Hub এর AI সহকারী। আমি আপনাকে সাহায্য করতে পারি:\n\n• বিল তৈরি / Create bills\n• কোটেশন তৈরি / Create quotations\n• খরচ যোগ / Add expenses\n• ক্লায়েন্ট ম্যানেজ / Manage clients\n• বকেয়া দেখুন / Check dues\n• পেমেন্ট ট্র্যাক / Track payments\n\nকী সাহায্য চান? / How can I help?`;
  }

  // Bill related
  if (lower.match(/বিল|bill|invoice|চালান/)) {
    return `📄 **বিল তৈরি / Create Bill**\n\nবিল তৈরি করতে:\n1. বাম মেনু থেকে **বিল/Bills** এ ক্লিক করুন\n2. **নতুন বিল** বাটনে ক্লিক করুন\n3. ক্লায়েন্ট সিলেক্ট করুন\n4. আইটেম যোগ করুন (বিবরণ, পরিমাণ, দাম)\n5. ট্যাক্স ও ডিসকাউন্ট যোগ করুন\n6. **সেভ** ক্লিক করুন\n\nবিল অটো-নম্বরিং হবে (BILL-0001, BILL-0002...)\n\nTo create a bill, go to Bills → New Bill → fill details → Save`;
  }

  // Quotation related
  if (lower.match(/কোটেশন|quotation|quote|প্রস্তাব/)) {
    return `📋 **কোটেশন তৈরি / Create Quotation**\n\nকোটেশন তৈরি করতে:\n1. **কোটেশন/Quotations** মেনুতে যান\n2. **নতুন কোটেশন** ক্লিক করুন\n3. ক্লায়েন্ট ও আইটেম যোগ করুন\n4. Valid Until তারিখ দিন\n5. সেভ করুন\n\nস্ট্যাটাস: Draft → Sent → Accepted/Rejected\n\nQuotations → New → fill details → set validity → Save`;
  }

  // Expense related
  if (lower.match(/খরচ|expense|cost|খরচা/)) {
    return `💰 **খরচ যোগ / Add Expense**\n\nখরচ যোগ করতে:\n1. **খরচ/Expenses** মেনুতে যান\n2. **নতুন খরচ** ক্লিক করুন\n3. ক্যাটাগরি সিলেক্ট করুন:\n   - Office Rent / অফিস ভাড়া\n   - Salary / বেতন\n   - Internet / ইন্টারনেট\n   - Software / সফটওয়্যার\n   - Marketing / মার্কেটিং\n   - Travel / ট্রাভেল\n   - Food / খাবার\n   - Equipment / সরঞ্জাম\n   - Utilities / ইউটিলিটি\n   - Miscellaneous / বিবিধ\n4. পরিমাণ ও পেমেন্ট মেথড দিন\n5. সেভ করুন`;
  }

  // Dues related
  if (lower.match(/বকেয়া|due|owe|বাকি|pending|unpaid/)) {
    return `⚠️ **বকেয়া / Upcoming Dues**\n\nবকেয়া দেখতে:\n1. **বকেয়া/Dues** মেনুতে যান\n2. সেখানে দেখবেন:\n   - 🔴 মেয়াদোত্তীর্ণ বকেয়া / Overdue\n   - 🟡 আসন্ন বকেয়া / Upcoming\n   - মোট বকেয়ার পরিমাণ\n   - ক্লায়েন্টের কন্টাক্ট তথ্য\n\nDues → check overdue & upcoming → follow up with clients`;
  }

  // Payment related
  if (lower.match(/পেমেন্ট|payment|pay|জমা|টাকা/)) {
    return `💳 **পেমেন্ট / Payments**\n\nপেমেন্ট রেকর্ড করতে:\n1. **পেমেন্ট/Payments** মেনুতে যান\n2. **নতুন পেমেন্ট** ক্লিক করুন\n3. ক্লায়েন্ট ও বিল সিলেক্ট করুন\n4. পরিমাণ ও মেথড দিন:\n   - Cash / নগদ\n   - bKash / বিকাশ\n   - Nagad / নগদ\n   - Bank / ব্যাংক\n5. রসিদ নম্বর দিন\n6. সেভ করুন\n\nবিলের paid amount অটো-আপডেট হবে!`;
  }

  // Client related
  if (lower.match(/ক্লায়েন্ট|client|customer|গ্রাহক/)) {
    return `👥 **ক্লায়েন্ট / Clients**\n\nক্লায়েন্ট যোগ করতে:\n1. **ক্লায়েন্ট/Clients** মেনুতে যান\n2. **নতুন ক্লায়েন্ট** ক্লিক করুন\n3. তথ্য দিন:\n   - নাম / Name\n   - ফোন / Phone\n   - ইমেইল / Email\n   - ঠিকানা / Address\n   - কোম্পানি / Company\n   - নোট / Notes\n4. সেভ করুন\n\nপ্রতিটি ক্লায়েন্টে বিল, কোটেশন, পেমেন্ট কাউন্ট দেখাবে`;
  }

  // Dashboard / summary
  if (lower.match(/সারাংশ|summary|dashboard|রিপোর্ট|report|overview/)) {
    return `📊 **ড্যাশবোর্ড / Dashboard Summary**\n\nড্যাশবোর্ডে দেখবেন:\n• মোট ক্লায়েন্ট / Total Clients\n• মোট বিল / Total Bills\n• মোট কোটেশন / Total Quotations\n• মোট খরচ / Total Expenses\n• আয়-খরচ সারাংশ / Income vs Expense\n• আসন্ন বকেয়া / Upcoming Dues\n• সাম্প্রতিক কার্যক্রম / Recent Activity\n• খরচের ক্যাটাগরি ব্রেকডাউন\n\nDashboard → সব তথ্য এক নজরে!`;
  }

  // Default
  return `🙏 আমি AAROHAN Business Hub এর AI সহকারী।\n\nআমি আপনাকে সাহায্য করতে পারি:\n\n• 📄 বিল তৈরি / Create Bill\n• 📋 কোটেশন তৈরি / Create Quotation\n• 💰 খরচ যোগ / Add Expense\n• 👥 ক্লায়েন্ট ম্যানেজ / Manage Clients\n• 💳 পেমেন্ট রেকর্ড / Record Payment\n• ⚠️ বকেয়া দেখুন / Check Dues\n• 📊 ড্যাশবোর্ড / Dashboard Summary\n\nকী বিষয়ে জানতে চান? / What would you like to know?`;
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, message, context } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Build context from database if businessId provided
    let dbContext = '';
    if (context?.businessId) {
      try {
        const [clients, bills, expenses] = await Promise.all([
          db.client.findMany({ where: { businessId: context.businessId }, take: 20 }),
          db.bill.findMany({
            where: { businessId: context.businessId },
            take: 20,
            include: { client: { select: { name: true } }, items: true },
          }),
          db.expense.findMany({ where: { businessId: context.businessId }, take: 20 }),
        ]);

        dbContext = `\n\nCurrent Data:\nClients: ${JSON.stringify(clients.map(c => ({ id: c.id, name: c.name, phone: c.phone, company: c.company })))}\nRecent Bills: ${JSON.stringify(bills.map(b => ({ id: b.id, billNumber: b.billNumber, client: b.client.name, total: b.total, status: b.status, items: b.items.map(i => i.description) })))}\nRecent Expenses: ${JSON.stringify(expenses.map(e => ({ id: e.id, category: e.category, description: e.description, amount: e.amount })))}`;
      } catch {
        // ignore db errors in chat
      }
    }

    let history = conversations.get(sessionId);
    if (!history) {
      history = [{ role: 'assistant', content: BUSINESS_KNOWLEDGE + dbContext }];
    } else {
      history[0] = { role: 'assistant', content: BUSINESS_KNOWLEDGE + dbContext };
    }

    history.push({ role: 'user', content: message });

    if (history.length > 22) {
      history = [history[0], ...history.slice(-20)];
    }

    // Try ZAI API first, fallback to smart response
    let aiResponse: string | null = null;
    try {
      aiResponse = await callZAI(history);
    } catch {
      // ZAI API unavailable - use smart fallback
      aiResponse = generateSmartResponse(message, dbContext);
    }

    if (!aiResponse) {
      aiResponse = generateSmartResponse(message, dbContext);
    }

    history.push({ role: 'assistant', content: aiResponse });
    conversations.set(sessionId, history);

    return NextResponse.json({ success: true, response: aiResponse });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to get response', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
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
