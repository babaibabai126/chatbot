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

async function callZAI(messages: Array<{ role: string; content: string }>) {
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
  const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

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
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('ZAI API request timed out after 30 seconds');
    }
    throw err;
  }
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
      // Update context on each request
      history[0] = { role: 'assistant', content: BUSINESS_KNOWLEDGE + dbContext };
    }

    history.push({ role: 'user', content: message });

    if (history.length > 22) {
      history = [history[0], ...history.slice(-20)];
    }

    const aiResponse = await callZAI(history);

    if (!aiResponse) {
      return NextResponse.json({ error: 'Empty response from AI' }, { status: 500 });
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
