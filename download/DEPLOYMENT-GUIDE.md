# 🚀 AAROHAN BUSINESS HUB - Deployment Guide
# Supabase + Vercel দিয়ে অ্যাপ ডেপ্লয় করার সম্পূর্ণ গাইড

---

## 📋 যা যা লাগবে (Prerequisites)

1. **GitHub Account** (free) - কোড রাখার জন্য
2. **Supabase Account** (free) - ক্লাউড ডাটাবেসের জন্য
3. **Vercel Account** (free) - হোস্টিং এর জন্য

> 💡 সব ফ্রি! কোনো টাকা লাগবে না।

---

## STEP 1: 🗄️ Supabase ডাটাবেস সেটআপ (5 মিনিট)

### 1.1 Supabase অ্যাকাউন্ট তৈরি
1. যান: **https://supabase.com**
2. "Start your project" ক্লিক করুন
3. GitHub দিয়ে সাইন ইন করুন

### 1.2 নতুন প্রজেক্ট তৈরি
1. "New Project" ক্লিক করুন
2. প্রজেক্টের তথ্য দিন:
   - **Name**: `aarohan-business-hub`
   - **Database Password**: একটি শক্তিশালী পাসওয়ার্ড দিন (এটি সংরক্ষণ করুন!)
   - **Region**: `Southeast Asia (Singapore)` — বাংলাদেশের সবচেয়ে কাছে
3. "Create new project" ক্লিক করুন
4. 2-3 মিনিট অপেক্ষা করুন, প্রজেক্ট তৈরি হবে

### 1.3 ডাটাবেস কানেকশন URL কপি করুন
1. প্রজেক্ট রেডি হলে **Settings** → **Database** যান
2. **Connection string** সেকশনে যান
3. **URI** ট্যাব সিলেক্ট করুন → URL কপি করুন
   - এটি হবে আপনার `DATABASE_URL`
   - দেখতে এমন হবে: 
     `postgresql://postgres.abcdefghijklm:YOUR-PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`
4. **JDBC** ট্যাব সিলেক্ট করুন → URL কপি করুন
   - `jdbc:postgresql://` অংশ `postgresql://` দিয়ে রিপ্লেস করুন
   - পোর্ট নম্বর `5432` রাখুন (6543 নয়)
   - এটি হবে আপনার `DIRECT_URL`
   - দেখতে এমন হবে:
     `postgresql://postgres.abcdefghijklm:YOUR-PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`

> ⚠️ দুটি URL সেভ করুন, পরে লাগবে!

---

## STEP 2: 📦 GitHub এ কোড আপলোড (3 মিনিট)

### 2.1 GitHub রিপোজিটরি তৈরি
1. যান: **https://github.com/new**
2. Repository name: `aarohan-business-hub`
3. Private সিলেক্ট করুন
4. "Create repository" ক্লিক করুন

### 2.2 কোড পুশ করুন
```bash
cd /home/z/my-project

git init
git add .
git commit -m "Initial commit - Aarohan Business Hub"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/aarohan-business-hub.git
git push -u origin main
```

---

## STEP 3: ▲ Vercel এ ডেপ্লয় (5 মিনিট)

### 3.1 Vercel অ্যাকাউন্ট ও প্রজেক্ট তৈরি
1. যান: **https://vercel.com**
2. GitHub দিয়ে সাইন আপ/ইন করুন
3. "Add New..." → "Project" ক্লিক করুন
4. আপনার `aarohan-business-hub` রিপো সিলেক্ট করুন
5. "Import" ক্লিক করুন

### 3.2 Environment Variables সেট করুন
1. "Environment Variables" সেকশনে যান
2. নিচের দুটি ভ্যারিয়েবল যোগ করুন:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Supabase থেকে কপি করা URI (পোর্ট 6543) |
| `DIRECT_URL` | Supabase থেকে কপি করা URI (পোর্ট 5432) |

3. "Deploy" ক্লিক করুন

### 3.3 ডেপ্লয়মেন্ট অপেক্ষা
- 2-3 মিনিট লাগবে
- সবুজ ✅ দেখলে বুঝবেন ডেপ্লয় হয়ে গেছে!
- আপনার অ্যাপের URL পাবেন (যেমন: `https://aarohan-business-hub.vercel.app`)

---

## STEP 4: 🗄️ ডাটাবেস মাইগ্রেশন (2 মিনিট)

ডেপ্লয় হয়ে গেলে ডাটাবেস টেবিল তৈরি করতে হবে:

### Option A: Vercel CLI দিয়ে
```bash
# Vercel CLI ইনস্টল
npm install -g vercel

# লগইন
vercel login

# প্রজেক্ট লিংক
vercel link

# Prisma মাইগ্রেশন
vercel env pull .env.production.local
npx prisma db push
```

### Option B: সরাসরি লোকাল থেকে
```bash
# .env ফাইলে Supabase URL বসান
# তারপর:
cp prisma/schema.supabase.prisma prisma/schema.prisma
npx prisma db push
```

---

## STEP 5: 📱 ফোনে অ্যাপ ইনস্টল (2 মিনিট)

### Android (Chrome):
1. আপনার অ্যাপের URL খুলুন
2. উপরে তিনটি ডট (⋮) ট্যাপ করুন
3. "Install app" বা "Add to Home Screen" সিলেক্ট করুন
4. "Install" ট্যাপ করুন
5. ✅ আপনার হোম স্ক্রিনে AAROHAN আইকন দেখবেন!

### iPhone (Safari):
1. আপনার অ্যাপের URL খুলুন
2. নিচে Share বাটন (↑) ট্যাপ করুন
3. "Add to Home Screen" সিলেক্ট করুন
4. "Add" ট্যাপ করুন
5. ✅ আপনার হোম স্ক্রিনে AAROHAN আইকন দেখবেন!

---

## 🔄 কোড আপডেট করলে রি-ডেপ্লয়

কোড পরিবর্তন করলে স্বয়ংক্রিয়ভাবে রি-ডেপ্লয় হবে:

```bash
git add .
git commit -m "Your update message"
git push
```

Vercel অটোমেটিক ডিটেক্ট করে রি-ডেপ্লয় করবে (1-2 মিনিট)।

---

## 🌐 কাস্টম ডোমেইন (ঐচ্ছিক)

আপনার নিজস্ব ডোমেইন যুক্ত করতে চাইলে:
1. Vercel Dashboard → Settings → Domains
2. ডোমেইন অ্যাড করুন (যেমন: `app.aarohan.com.bd`)
3. DNS রেকর্ড আপডেট করুন (Vercel গাইড দেবে)

---

## 🆘 সমস্যা হলে

| সমস্যা | সমাধান |
|---------|---------|
| ডেপ্লয়মেন্ট ফেইল | Vercel Dashboard → Deployments → এরর লগ দেখুন |
| ডাটাবেস কানেকশন এরর | DATABASE_URL ঠিক আছে কিনা চেক করুন |
| অ্যাপ লোড হচ্ছে না | Vercel Functions লগ চেক করুন |
| PWA ইনস্টল বাটন দেখা যাচ্ছে না | HTTPS তে হতে হবে (Vercel অটো HTTPS দেয়) |

---

## 💰 খরচের হিসাব

| সার্ভিস | ফ্রি টায়ার | পেইড |
|---------|------------|-------|
| Supabase | 500MB DB, 50K API calls/day | $25/মাস |
| Vercel | 100GB bandwidth, সীমিত Serverless | $20/মাস |
| **মোট** | **৳0/মাস** 🎉 | - |

ফ্রি টায়ারে ছোট-মিডিয়াম বিজনেস চালানো যাবে!
