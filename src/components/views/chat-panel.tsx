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
        // If action was executed, show notification
        if (data.actionExecuted) {
          setTimeout(() => {
            setMessages(prev => [...prev, {
              id: `sys-${Date.now()}`, role: 'assistant',
              content: '✅ Action completed! Check the relevant section to see the changes.',
              timestamp: new Date()
            }]);
          }, 500);
        }
      } else {
        setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'assistant', content: 'Sorry, something went wrong. Please try again.', timestamp: new Date() }]);
      }
    } catch {
      setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'assistant', content: 'Network error. Please try again.', timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const quickActions = [
    'Create a GST bill for ₹10,000',
    'Add a new expense',
    'Show all clients',
  ];

  return (
    <>
      {/* Mobile: Full screen overlay */}
      <div className="md:hidden fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col">
        {/* Header */}
        <div className="p-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8 bg-blue-600">
              <AvatarFallback className="bg-blue-600 text-white text-xs"><Bot className="h-4 w-4" /></AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">AI Assistant</p>
              <p className="text-[10px] text-gray-400">{businessName}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-10 w-10 dark:text-gray-400" onClick={() => { setMessages([]); }}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-10 w-10 dark:text-gray-400" onClick={() => setChatOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="text-center py-8">
              <Sparkles className="h-10 w-10 text-blue-500 mx-auto mb-3" />
              <p className="text-base text-gray-700 dark:text-gray-300 font-semibold">Hello! / নমস্কার!</p>
              <p className="text-sm text-gray-400 mt-2">I can help you create bills, manage clients, track expenses and more. Just ask!</p>
              <div className="mt-4 space-y-2">
                {quickActions.map((q, i) => (
                  <button key={i} onClick={() => sendMessage(q)} className="block w-full text-left text-sm px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors min-h-[48px]">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <Avatar className="h-7 w-7 mt-1 shrink-0">
                  <AvatarFallback className="bg-blue-600 text-white text-[10px]"><Bot className="h-3.5 w-3.5" /></AvatarFallback>
                </Avatar>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-md'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-md'
              }`}>
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 dark:prose-invert">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
              {msg.role === 'user' && (
                <Avatar className="h-7 w-7 mt-1 shrink-0">
                  <AvatarFallback className="bg-gray-600 text-white text-[10px]"><User className="h-3.5 w-3.5" /></AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-2">
              <Avatar className="h-7 w-7 mt-1 shrink-0">
                <AvatarFallback className="bg-blue-600 text-white text-[10px]"><Bot className="h-3.5 w-3.5" /></AvatarFallback>
              </Avatar>
              <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-md px-4 py-3">
                <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-3 border-t border-gray-100 dark:border-gray-800 shrink-0 safe-bottom">
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything..."
              disabled={isLoading}
              className="h-12 text-base rounded-xl"
              style={{ fontSize: '16px' }}
            />
            <Button type="submit" disabled={!input.trim() || isLoading} className="h-12 w-12 bg-blue-600 hover:bg-blue-700 shrink-0 rounded-xl">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
          </form>
        </div>
      </div>

      {/* Desktop: Side panel */}
      <div className="hidden md:flex w-80 lg:w-96 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex-col shrink-0 h-screen">
        {/* Header */}
        <div className="p-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7 bg-blue-600">
              <AvatarFallback className="bg-blue-600 text-white text-xs"><Bot className="h-3.5 w-3.5" /></AvatarFallback>
            </Avatar>
            <div>
              <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">AI Assistant</p>
              <p className="text-[10px] text-gray-400">{businessName}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 dark:text-gray-400" onClick={() => { setMessages([]); }}>
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 dark:text-gray-400" onClick={() => setChatOpen(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-3" ref={scrollRef}>
          <div className="space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-6">
                <Sparkles className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">Hello! / নমস্কার!</p>
                <p className="text-xs text-gray-400 mt-1">I can create bills, add clients, track expenses and more.</p>
                <div className="mt-3 space-y-1.5">
                  {quickActions.map((q, i) => (
                    <button key={i} onClick={() => sendMessage(q)} className="block w-full text-left text-xs px-3 py-2.5 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors">
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
                    <AvatarFallback className="bg-blue-600 text-white text-[9px]"><Bot className="h-3 w-3" /></AvatarFallback>
                  </Avatar>
                )}
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-sm'
                }`}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-xs max-w-none prose-p:my-0.5 prose-ul:my-0.5 prose-ol:my-0.5 prose-li:my-0 dark:prose-invert">
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
                  <AvatarFallback className="bg-blue-600 text-white text-[9px]"><Bot className="h-3 w-3" /></AvatarFallback>
                </Avatar>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-xl rounded-bl-sm px-3 py-2">
                  <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-3 border-t border-gray-100 dark:border-gray-800 shrink-0">
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything..."
              disabled={isLoading}
              className="h-9 text-xs dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
              style={{ fontSize: '16px' }}
            />
            <Button type="submit" disabled={!input.trim() || isLoading} className="h-9 w-9 bg-blue-600 hover:bg-blue-700 shrink-0">
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
