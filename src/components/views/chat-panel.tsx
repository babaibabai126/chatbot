'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Bot, User, X, Send, RotateCcw, Sparkles, Loader2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import ReactMarkdown from 'react-markdown';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function ChatPanel({ businessId, businessName }: { businessId: string; businessName: string }) {
  const { setChatOpen } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(`chat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: text.trim(), context: { businessId } }),
      });
      const data = await res.json();
      if (data.success && data.response) {
        setMessages(prev => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: data.response, timestamp: new Date() }]);
      } else {
        setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'assistant', content: 'দুঃখিত, সমস্যা হয়েছে। আবার চেষ্টা করুন।\n\nSorry, something went wrong.', timestamp: new Date() }]);
      }
    } catch {
      setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'assistant', content: 'নেটওয়ার্ক সমস্যা। আবার চেষ্টা করুন।\n\nNetwork error.', timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const quickActions = [
    'একটি বিল তৈরি করুন / Create a bill',
    'খরচের তালিকা দেখুন / Show expenses',
    'বকেয়া কত? / How much is due?',
  ];

  return (
    <div className="w-80 md:w-96 border-l border-gray-200 bg-white flex flex-col shrink-0 h-screen md:h-auto">
      {/* Header */}
      <div className="p-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7 bg-emerald-500">
            <AvatarFallback className="bg-emerald-500 text-white text-xs"><Bot className="h-3.5 w-3.5" /></AvatarFallback>
          </Avatar>
          <div>
            <p className="text-xs font-semibold text-gray-900">AI সহকারী</p>
            <p className="text-[10px] text-gray-400">{businessName}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setMessages([]); }}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setChatOpen(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        <div className="space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-6">
              <Sparkles className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 font-medium">নমস্কার! / Hello!</p>
              <p className="text-xs text-gray-400 mt-1">আমি আপনার AI সহকারী। বিল, কোটেশন, খরচ সম্পর্কে জিজ্ঞাসা করুন।</p>
              <div className="mt-3 space-y-1.5">
                {quickActions.map((q, i) => (
                  <button key={i} onClick={() => sendMessage(q)} className="block w-full text-left text-xs px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <Avatar className="h-6 w-6 mt-0.5 shrink-0">
                  <AvatarFallback className="bg-emerald-500 text-white text-[9px]"><Bot className="h-3 w-3" /></AvatarFallback>
                </Avatar>
              )}
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                msg.role === 'user' ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              }`}>
                {msg.role === 'assistant' ? (
                  <div className="prose prose-xs max-w-none prose-p:my-0.5 prose-ul:my-0.5 prose-ol:my-0.5 prose-li:my-0">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
              {msg.role === 'user' && (
                <Avatar className="h-6 w-6 mt-0.5 shrink-0">
                  <AvatarFallback className="bg-gray-600 text-white text-[9px]"><User className="h-3 w-3" /></AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-2">
              <Avatar className="h-6 w-6 mt-0.5 shrink-0">
                <AvatarFallback className="bg-emerald-500 text-white text-[9px]"><Bot className="h-3 w-3" /></AvatarFallback>
              </Avatar>
              <div className="bg-gray-100 rounded-xl rounded-bl-sm px-3 py-2">
                <Loader2 className="h-3.5 w-3.5 text-emerald-500 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-gray-100">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="প্রশ্ন করুন... / Ask me..."
            disabled={isLoading}
            className="h-9 text-xs"
            style={{ fontSize: '16px' }}
          />
          <Button type="submit" disabled={!input.trim() || isLoading} className="h-9 w-9 bg-emerald-600 hover:bg-emerald-700 shrink-0">
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
