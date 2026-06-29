'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Send,
  Bot,
  User,
  RotateCcw,
  MessageCircle,
  Clock,
  Phone,
  Mail,
  MapPin,
  Sparkles,
  Loader2,
  Globe,
  ChevronDown,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const QUICK_ACTIONS = [
  { id: '1', label: 'সেবাসমূহ / Services', labelBn: 'সেবাসমূহ', labelEn: 'Services', message: 'আপনাদের কি কি সেবা আছে? / What services do you offer?' },
  { id: '2', label: 'মূল্য / Pricing', labelBn: 'মূল্য', labelEn: 'Pricing', message: 'সেবার মূল্য কত? / What are your prices?' },
  { id: '3', label: 'যোগাযোগ / Contact', labelBn: 'যোগাযোগ', labelEn: 'Contact', message: 'যোগাযোগের তথ্য দিন / Give me your contact details' },
  { id: '4', label: 'কার্যসময় / Hours', labelBn: 'কার্যসময়', labelEn: 'Hours', message: 'কার্যসময় কখন? / What are your business hours?' },
  { id: '5', label: 'ফ্রি কনসালটেশন', labelBn: 'ফ্রি কনসালটেশন', labelEn: 'Free Consultation', message: 'ফ্রি কনসালটেশন আছে কি? / Is there a free consultation?' },
  { id: '6', label: 'পেমেন্ট / Payment', labelBn: 'পেমেন্ট', labelEn: 'Payment', message: 'পেমেন্ট পদ্ধতি কি কি? / What payment methods do you accept?' },
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [showWelcome, setShowWelcome] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Generate session ID on mount
  useEffect(() => {
    setSessionId(
      `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    );
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = useCallback(
    async (messageText: string) => {
      if (!messageText.trim() || isLoading) return;

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: messageText.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setIsLoading(true);
      setShowWelcome(false);

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            message: messageText.trim(),
          }),
        });

        const data = await response.json();

        if (data.success && data.response) {
          const assistantMessage: Message = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: data.response,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
        } else {
          const errorMessage: Message = {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content:
              'দুঃখিত, একটি সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন অথবা আমাদের সরাসরি কল করুন: +880 1712-345678\n\nSorry, something went wrong. Please try again or call us directly: +880 1712-345678',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMessage]);
        }
      } catch {
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content:
            'নেটওয়ার্ক সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।\n\nNetwork error occurred. Please try again.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
        inputRef.current?.focus();
      }
    },
    [isLoading, sessionId]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleQuickAction = (message: string) => {
    sendMessage(message);
  };

  const resetChat = async () => {
    if (sessionId) {
      try {
        await fetch(`/api/chat?sessionId=${sessionId}`, { method: 'DELETE' });
      } catch {
        // ignore
      }
    }
    setMessages([]);
    setShowWelcome(true);
    setSessionId(
      `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    );
    inputRef.current?.focus();
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('bn-BD', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="h-10 w-10 bg-emerald-500 shadow-md">
                <AvatarFallback className="bg-emerald-500 text-white font-bold text-sm">
                  ZB
                </AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-emerald-400 border-2 border-white rounded-full" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">
                Z Business Solutions
              </h1>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-xs text-gray-500">
                  অনলাইন / Online
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200"
            >
              <Globe className="h-3 w-3 mr-1" />
              বাংলা | EN
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={resetChat}
              className="h-9 w-9 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              title="নতুন চ্যাট / New Chat"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-hidden">
        <div className="max-w-3xl mx-auto h-full flex flex-col">
          <ScrollArea className="flex-1 px-4" ref={scrollRef}>
            <div className="py-6 space-y-4">
              {/* Welcome Screen */}
              {showWelcome && messages.length === 0 && (
                <div className="space-y-6 animate-in fade-in duration-500">
                  {/* Welcome Hero */}
                  <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-emerald-50 mb-4 shadow-sm">
                      <Bot className="h-10 w-10 text-emerald-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                      স্বাগতম! / Welcome!
                    </h2>
                    <p className="text-gray-500 max-w-md mx-auto leading-relaxed">
                      আমি আপনার AI সহকারী। Z Business Solutions সম্পর্কে
                      যেকোনো প্রশ্ন করুন।
                      <br />
                      <span className="text-sm">
                        I&apos;m your AI assistant. Ask me anything about Z
                        Business Solutions.
                      </span>
                    </p>
                  </div>

                  {/* Info Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center hover:shadow-md transition-shadow">
                      <Phone className="h-5 w-5 text-emerald-500 mx-auto mb-1.5" />
                      <p className="text-xs font-medium text-gray-700">কল করুন</p>
                      <p className="text-[10px] text-gray-400">Call Us</p>
                    </div>
                    <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center hover:shadow-md transition-shadow">
                      <Mail className="h-5 w-5 text-blue-500 mx-auto mb-1.5" />
                      <p className="text-xs font-medium text-gray-700">ইমেইল</p>
                      <p className="text-[10px] text-gray-400">Email</p>
                    </div>
                    <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center hover:shadow-md transition-shadow">
                      <Clock className="h-5 w-5 text-amber-500 mx-auto mb-1.5" />
                      <p className="text-xs font-medium text-gray-700">সময়সূচি</p>
                      <p className="text-[10px] text-gray-400">Hours</p>
                    </div>
                    <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center hover:shadow-md transition-shadow">
                      <MapPin className="h-5 w-5 text-rose-500 mx-auto mb-1.5" />
                      <p className="text-xs font-medium text-gray-700">লোকেশন</p>
                      <p className="text-[10px] text-gray-400">Location</p>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div>
                    <p className="text-sm font-medium text-gray-400 mb-3 text-center">
                      <Sparkles className="h-4 w-4 inline mr-1" />
                      দ্রুত প্রশ্ন / Quick Questions
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {QUICK_ACTIONS.map((action) => (
                        <Card
                          key={action.id}
                          className="cursor-pointer hover:bg-emerald-50/50 hover:border-emerald-200 transition-all duration-200 py-2.5 px-3 border-gray-100 bg-white group"
                          onClick={() => handleQuickAction(action.message)}
                        >
                          <p className="text-sm font-medium text-gray-700 group-hover:text-emerald-700 transition-colors">
                            {action.labelBn}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {action.labelEn}
                          </p>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {/* Scroll hint */}
                  <div className="text-center pt-2">
                    <ChevronDown className="h-4 w-4 text-gray-300 mx-auto animate-bounce" />
                  </div>
                </div>
              )}

              {/* Messages */}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  } animate-in slide-in-from-bottom-2 duration-300`}
                >
                  {msg.role === 'assistant' && (
                    <Avatar className="h-8 w-8 mt-1 shrink-0">
                      <AvatarFallback className="bg-emerald-500 text-white text-xs">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-[80%] sm:max-w-[70%] ${
                      msg.role === 'user' ? '' : ''
                    }`}
                  >
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-emerald-600 text-white rounded-br-md'
                          : 'bg-white text-gray-800 border border-gray-100 shadow-sm rounded-bl-md'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-headings:text-gray-800">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                    <p
                      className={`text-[10px] text-gray-400 mt-1 ${
                        msg.role === 'user' ? 'text-right' : 'text-left'
                      }`}
                    >
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                  {msg.role === 'user' && (
                    <Avatar className="h-8 w-8 mt-1 shrink-0">
                      <AvatarFallback className="bg-gray-700 text-white text-xs">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}

              {/* Loading Indicator */}
              {isLoading && (
                <div className="flex gap-2.5 justify-start animate-in slide-in-from-bottom-2 duration-300">
                  <Avatar className="h-8 w-8 mt-1 shrink-0">
                    <AvatarFallback className="bg-emerald-500 text-white text-xs">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-1.5">
                      <Loader2 className="h-4 w-4 text-emerald-500 animate-spin" />
                      <span className="text-xs text-gray-400">
                        টাইপ করছে... / Typing...
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick actions in chat (after first response) */}
              {messages.length > 0 && !isLoading && (
                <div className="flex flex-wrap gap-1.5 justify-center pt-2">
                  {QUICK_ACTIONS.slice(0, 4).map((action) => (
                    <Button
                      key={action.id}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 rounded-full border-gray-200 text-gray-500 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
                      onClick={() => handleQuickAction(action.message)}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="border-t border-gray-100 bg-white/80 backdrop-blur-xl p-4">
            <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="আপনার প্রশ্ন লিখুন... / Type your question..."
                    disabled={isLoading}
                    className="w-full h-11 pl-4 pr-4 rounded-xl border-gray-200 bg-gray-50 focus:bg-white focus:border-emerald-300 focus:ring-emerald-200 transition-all text-sm"
                    style={{ fontSize: '16px' }}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="h-11 w-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg transition-all shrink-0"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-gray-400 text-center mt-2">
                <MessageCircle className="h-3 w-3 inline mr-0.5" />
                AI সহকারী আপনাকে সাহায্য করতে প্রস্তুত / AI assistant ready to
                help
              </p>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
