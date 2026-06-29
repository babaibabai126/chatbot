import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

// Business knowledge base - customize this with your own business details
const BUSINESS_KNOWLEDGE = `
আপনি "Z Business Solutions" এর AI চ্যাটবট সহকারী। আপনার কাজ হলো কাস্টমারদের আমাদের বিজনেস সম্পর্কে তথ্য দেওয়া এবং তাদের প্রশ্নের উত্তর দেওয়া।

You are the AI chatbot assistant for "Z Business Solutions". Your job is to provide customers with information about our business and answer their questions.

বিজনেস তথ্য / Business Details:
- কোম্পানির নাম / Company Name: Z Business Solutions
- প্রতিষ্ঠিত / Established: 2020
- ধরন / Type: IT Services & Digital Solutions
- মিশন / Mission: প্রযুক্তি ব্যবহার করে ব্যবসায়িক সমস্যার সমাধান / Solving business problems using technology

সেবাসমূহ / Services:
1. ওয়েব ডেভেলপমেন্ট / Web Development - কাস্টম ওয়েবসাইট, ই-কমার্স, ওয়েব অ্যাপ্লিকেশন / Custom websites, e-commerce, web applications
   - মূল্য / Price: ৳15,000 থেকে শুরু / Starting from BDT 15,000
2. মোবাইল অ্যাপ ডেভেলপমেন্ট / Mobile App Development - Android ও iOS অ্যাপ / Android and iOS apps
   - মূল্য / Price: ৳30,000 থেকে শুরু / Starting from BDT 30,000
3. ডিজিটাল মার্কেটিং / Digital Marketing - SEO, সোশ্যাল মিডিয়া, কনটেন্ট মার্কেটিং / SEO, social media, content marketing
   - মূল্য / Price: ৳8,000/মাস থেকে / Starting from BDT 8,000/month
4. গ্রাফিক ডিজাইন / Graphic Design - লোগো, ব্র্যান্ডিং, সোশ্যাল মিডিয়া পোস্ট / Logo, branding, social media posts
   - মূল্য / Price: ৳3,000 থেকে শুরু / Starting from BDT 3,000
5. ক্লাউড সলিউশন / Cloud Solutions - ক্লাউড হোস্টিং, ডেটা ম্যানেজমেন্ট / Cloud hosting, data management
   - মূল্য / Price: ৳5,000/মাস থেকে / Starting from BDT 5,000/month

যোগাযোগ / Contact:
- ঠিকানা / Address: ১২৩ এআইবি সেন্টার, গুলশান-২, ঢাকা / 123 AIB Center, Gulshan-2, Dhaka
- ফোন / Phone: +880 1712-345678
- ইমেইল / Email: info@zbusinesssolutions.com
- ওয়েবসাইট / Website: www.zbusinesssolutions.com
- সোশ্যাল মিডিয়া / Social Media: Facebook, Instagram, LinkedIn - @zbusinesssolutions

কার্যসময় / Business Hours:
- শনিবার-বৃহস্পতিবার / Saturday-Thursday: সকাল ১০টা - সন্ধ্যা ৭টা / 10:00 AM - 7:00 PM
- শুক্রবার / Friday: বন্ধ / Closed

পেমেন্ট পদ্ধতি / Payment Methods:
- বিকাশ / bKash
- নগদ / Nagad
- ব্যাংক ট্রান্সফার / Bank Transfer
- ক্যাশ / Cash

গুরুত্বপূর্ণ নীতিমালা / Important Policies:
- ফ্রি কনসালটেশন / Free consultation: প্রথম কনসালটেশন ফ্রি / First consultation is free
- রিফান্ড পলিসি / Refund Policy: কাজ শুরুর আগে ১০০% রিফান্ড, কাজ শুরুর পর নির্ভর করে / 100% refund before work starts, depends after work starts
- সাপোর্ট / Support: প্রতিটি প্রজেক্টে ৩ মাসের ফ্রি সাপোর্ট / 3 months free support with every project
- পেমেন্ট টার্মস / Payment Terms: ৫০% অগ্রিম, ৫০% ডেলিভারির সময় / 50% advance, 50% on delivery

FAQ:
- প্রশ্ন: কি ফ্রি কনসালটেশন আছে? / Q: Is there free consultation?
  উত্তর: হ্যাঁ, প্রথম কনসালটেশন সম্পূর্ণ ফ্রি। / A: Yes, the first consultation is completely free.
  
- প্রশ্ন: কতদিনে কাজ ডেলিভারি হয়? / Q: How long does delivery take?
  উত্তর: প্রজেক্টের উপর নির্ভর করে। ওয়েবসাইট ২-৪ সপ্তাহ, মোবাইল অ্যাপ ৪-৮ সপ্তাহ। / A: Depends on the project. Website 2-4 weeks, mobile app 4-8 weeks.

- প্রশ্ন: রিভিশন কি আছে? / Q: Are there revisions?
  উত্তর: হ্যাঁ, প্রতিটি প্রজেক্টে ৩টি ফ্রি রিভিশন আছে। / A: Yes, each project has 3 free revisions.

নিয়মাবলী / Rules:
1. সবসময় বিনয়ী এবং সাহায্যকারী হোন / Always be polite and helpful
2. বাংলা এবং English দুই ভাষাতেই উত্তর দিন / Respond in both Bengali and English
3. যদি কোনো প্রশ্নের উত্তর জানা না থাকে, তাহলে বলুন যে আমাদের টিমের সাথে যোগাযোগ করুন / If you don't know the answer, suggest contacting our team
4. দামের তথ্য দেওয়ার সময় "থেকে শুরু" বা "starting from" ব্যবহার করুন / When giving prices, always use "starting from"
5. কাস্টমারকে সবসময় কনসালটেশনের জন্য উৎসাহিত করুন / Always encourage customers to book a consultation
`;

// In-memory conversation store
const conversations = new Map<string, Array<{ role: string; content: string }>>();

// ZAI singleton
let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, message } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Get or create conversation history
    let history = conversations.get(sessionId);
    if (!history) {
      history = [
        {
          role: 'assistant',
          content: BUSINESS_KNOWLEDGE,
        },
      ];
    }

    // Add user message
    history.push({
      role: 'user',
      content: message,
    });

    // Trim conversation if too long (keep system prompt + last 20 messages)
    if (history.length > 22) {
      history = [history[0], ...history.slice(-20)];
    }

    // Get AI response
    const zai = await getZAI();
    const completion = await zai.chat.completions.create({
      messages: history,
      thinking: { type: 'disabled' },
    });

    const aiResponse = completion.choices[0]?.message?.content;

    if (!aiResponse) {
      return NextResponse.json(
        { error: 'Empty response from AI' },
        { status: 500 }
      );
    }

    // Add AI response to history
    history.push({
      role: 'assistant',
      content: aiResponse,
    });

    // Save updated history
    conversations.set(sessionId, history);

    return NextResponse.json({
      success: true,
      response: aiResponse,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get response. Please try again.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (sessionId) {
      conversations.delete(sessionId);
    }

    return NextResponse.json({ success: true, message: 'Conversation cleared' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to clear conversation' },
      { status: 500 }
    );
  }
}
