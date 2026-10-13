'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Send, X, MessageCircle, Bot, User, Sparkles, Minimize2, Flag } from 'lucide-react';
import { getChatResponse, hasGeminiKey } from '@/lib/ai-service';
import { findResponse, getFollowUps } from '@/lib/chatbot-responses';
import { sumMealNutrition, estimateExerciseCalories } from '@/lib/calculations';
import { PLAN_DAY_NAMES } from '@/lib/exercise-planner';
import { useStore } from '@/lib/store-context';
import { useBackHandler } from '@/lib/back-handler';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  followUps?: string[];
}

interface ChatHistoryMessage {
  role: string;
  content: string;
}

interface ChatBotProps {
  mode?: 'floating' | 'inline';
  onClose?: () => void;
}

const AI_REPORT_HREF = `/report-problem?cat=${encodeURIComponent('AI chatbot issue')}&sub=${encodeURIComponent('Issue with an AI response')}`;

const FREE_DAILY_LIMIT = 30;

// The AI sometimes emits markdown (**bold**, * bullets) — the chat renders plain
// text, so convert it to real emphasis instead of showing raw asterisks.
function renderContent(content: string) {
  const normalized = content.replace(/^[\*\-]\s+/gm, '• ');
  return normalized.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function getChatCountKey(): string {
  const today = new Date().toISOString().split('T')[0];
  return `gymathome_chat_count_${today}`;
}

function getDailyCount(): number {
  if (typeof window === 'undefined') return 0;
  const key = getChatCountKey();
  return parseInt(localStorage.getItem(key) || '0', 10);
}

function incrementDailyCount(): number {
  const key = getChatCountKey();
  const current = getDailyCount();
  localStorage.setItem(key, String(current + 1));
  return current + 1;
}

export default function ChatBot({ mode = 'floating', onClose }: ChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: 'assistant',
      content: "Hey! I'm V 👋 — your gym buddy around here. What's on your mind today?",
      timestamp: '10:30 AM',
      followUps: ['Analyze my progress', 'Suggest a meal', 'Give me exercise tips'],
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [dailyCount, setDailyCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const {
    profile, meals, calculations, workoutPlan,
    foodPreferences,
    getExercisesForDate, getWaterForDate, getSleepForDate,
  } = useStore();

  // Greet by name once the profile is known
  useEffect(() => {
    if (!profile?.name) return;
    setMessages(prev =>
      prev.map(m =>
        m.id === 1 && m.role === 'assistant'
          ? { ...m, content: `Hey ${profile.name}! V here 👋 — good to see you! What are we working on today?` }
          : m
      )
    );
  }, [profile?.name]);

  // Build personalized context for AI (real data only)
  const chatContext = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayMeals = meals.filter(m => m.loggedAt.startsWith(today));
    const nutrition = sumMealNutrition(todayMeals);
    const todayExercises = getExercisesForDate(today);
    const todayWaterL = getWaterForDate(today) / 1000;
    const todaySleep = getSleepForDate(today);
    const burnedCalories = todayExercises.reduce((sum, e) => sum + estimateExerciseCalories(e), 0);

    const todayDayName = PLAN_DAY_NAMES[(new Date().getDay() + 6) % 7];
    const plannedToday = workoutPlan?.exercises.filter(e => e.day === todayDayName) || [];
    const fmtExercise = (e: { exerciseName: string; sets: number; reps: number; weight?: number; duration?: number }) =>
      e.duration && e.sets === 1 && e.reps === 1
        ? `${e.exerciseName} ${e.duration}min`
        : `${e.exerciseName} ${e.sets}x${e.reps}${e.weight !== undefined ? ` @${e.weight}kg` : ''}`;

    return {
      username: profile?.name || undefined,
      profile: profile
        ? {
            gender: profile.gender,
            bmi: calculations?.bmi || null,
            bmr: calculations?.bmr || null,
            tdee: calculations?.tdee || null,
            weight: profile.weight,
            height: profile.height,
            age: profile.age,
            activityLevel: profile.activityLevel || 'moderate',
            targetCalories: calculations?.targetCalories,
            protein: calculations?.protein,
            carbs: calculations?.carbs,
            fat: calculations?.fat,
            hydration: calculations?.hydration,
            healthProblems: profile.healthProblems?.length ? profile.healthProblems : undefined,
          }
        : null,
      recentMeals: todayMeals.map(m => m.foodName).join(', ') || undefined,
      healthGoal: profile?.goal || undefined,
      dailyCalories: nutrition.calories || undefined,
      dailyProtein: nutrition.protein || undefined,
      dailyCarbs: nutrition.carbs || undefined,
      dailyFat: nutrition.fat || undefined,
      dailyWater: todayWaterL || undefined,
      waterGoal: calculations?.hydration || undefined,
      sleepHours: todaySleep || undefined,
      burnedCalories: burnedCalories || undefined,
      todayWorkout: plannedToday.map(fmtExercise).join('; ') || undefined,
      loggedWorkout: todayExercises.map(fmtExercise).join('; ') || undefined,
      allergies: foodPreferences.allergies?.length ? foodPreferences.allergies : undefined,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, meals, calculations, workoutPlan, foodPreferences]);

  useEffect(() => {
    setDailyCount(getDailyCount());
  }, []);

  useBackHandler(mode === 'floating' && isOpen, () => setIsOpen(false));

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (text?: string) => {
    const sendText = text || message.trim();
    if (!sendText) return;

    const currentCount = getDailyCount();
    if (currentCount >= FREE_DAILY_LIMIT) {
      const limitMessage: Message = {
        id: messages.length + 1,
        role: 'assistant',
        content: `Whoa — you hit today's ${FREE_DAILY_LIMIT}-message limit! Even gym buddies need a rest day 😅 Come back tomorrow and we'll keep going.`,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        followUps: ['Workout tips', 'Health tips'],
      };
      setMessages(prev => [...prev, limitMessage]);
      return;
    }

    const now = new Date();
    const timestamp = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const userMessage: Message = {
      id: messages.length + 1,
      role: 'user',
      content: sendText,
      timestamp,
    };

    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setIsTyping(true);

    const nextCount = incrementDailyCount();
    setDailyCount(nextCount);

    try {
      let response: string;
      let followUps: string[] = [];

      if (hasGeminiKey()) {
        const history: ChatHistoryMessage[] = messages
          .slice(-6)
          .map(m => ({ role: m.role, content: m.content }));
        response = await getChatResponse(sendText, chatContext, history);
        followUps = getFollowUps(sendText);
      } else {
        response = findResponse(sendText);
        followUps = getFollowUps(sendText);
      }

      const aiMessage: Message = {
        id: messages.length + 2,
        role: 'assistant',
        content: response,
        timestamp,
        followUps,
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      const response = findResponse(sendText);
      const followUps = getFollowUps(sendText);

      const aiMessage: Message = {
        id: messages.length + 2,
        role: 'assistant',
        content: response,
        timestamp,
        followUps,
      };

      setMessages(prev => [...prev, aiMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (mode === 'inline') {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-outline-variant/30">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary-light rounded-lg flex items-center justify-center">
              <Bot className="w-4 h-4 text-on-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-on-surface">V</h3>
              <p className="text-[10px] text-on-surface-variant">
                {hasGeminiKey() ? 'Gemini AI • Online' : 'Offline'} · {dailyCount}/{FREE_DAILY_LIMIT} today
              </p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-1.5 hover:bg-surface-container rounded-lg">
              <X className="w-4 h-4 text-on-surface-variant" />
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
              )}
              <div className={`max-w-[80%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                <div
                  className={`p-3 rounded-2xl text-sm whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-primary text-on-primary rounded-tr-sm'
                      : 'bg-surface-container text-on-surface rounded-tl-sm'
                  }`}
                  >
                    {renderContent(msg.content)}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                  <p className="text-xs text-on-surface-variant">{msg.timestamp}</p>
                  {msg.role === 'assistant' && (
                    <Link
                      href={AI_REPORT_HREF}
                      aria-label="Report this AI response"
                      className="inline-flex items-center justify-center w-9 h-9 -my-1.5 text-on-surface-variant/50 hover:text-error transition-colors"
                    >
                      <Flag className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
                {msg.followUps && msg.followUps.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {msg.followUps.map((followUp, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(followUp)}
                        className="px-2.5 py-1 bg-surface-container hover:bg-surface-container-high rounded-full text-xs text-secondary font-medium transition-colors"
                      >
                        {followUp}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 bg-secondary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-secondary" />
                </div>
              )}
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div className="bg-surface-container rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-on-surface-variant rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-on-surface-variant rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-on-surface-variant rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions */}
        <div className="px-4 pb-2">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[
              'How much protein should I eat?',
              'Suggest a meal',
              'Full body workout',
              'Sleep tips',
              'How much water should I drink?',
              'Create a meal plan',
            ].map((action) => (
              <button
                key={action}
                onClick={() => handleSend(action)}
                className="px-3 py-1.5 bg-surface-container hover:bg-surface-container-high rounded-full text-xs text-on-surface-variant font-medium whitespace-nowrap transition-colors"
              >
                {action}
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="p-4 border-t border-outline-variant/30">
          <div className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask V anything..."
              className="flex-1 h-10 px-4 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
            <button
              onClick={() => handleSend()}
              disabled={!message.trim() || isTyping}
              className="h-10 px-4 bg-primary text-on-primary rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Floating mode
  return (
    <>
      {/* Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          isOpen
            ? 'bg-on-surface text-surface-container rotate-0'
            : 'bg-gradient-to-br from-primary to-primary-light text-on-primary hover:scale-110'
        }`}
      >
        {isOpen ? (
          <Minimize2 className="w-5 h-5 sm:w-6 sm:h-6" />
        ) : (
          <div className="relative">
            <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-tertiary rounded-full animate-pulse" />
          </div>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed inset-0 sm:inset-4 md:inset-8 z-50 bg-surface rounded-none sm:rounded-2xl shadow-elevated border-0 sm:border sm:border-outline-variant/20 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-primary-light px-3 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <Bot className="w-4 h-4 text-on-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-on-primary">V</h3>
                  <p className="text-[10px] text-on-primary/80">
                    {hasGeminiKey() ? 'Gemini AI • Online' : 'Offline'} · {dailyCount}/{FREE_DAILY_LIMIT} today
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-on-primary" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div className={`max-w-[85%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                  <div
                    className={`px-3 py-2 rounded-2xl text-xs whitespace-pre-wrap leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-primary text-on-primary rounded-tr-sm'
                        : 'bg-surface-container text-on-surface rounded-tl-sm'
                    }`}
                  >
                    {renderContent(msg.content)}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <p className="text-[10px] text-on-surface-variant">{msg.timestamp}</p>
                    {msg.role === 'assistant' && (
                      <Link
                        href={AI_REPORT_HREF}
                        aria-label="Report this AI response"
                        className="inline-flex items-center justify-center w-9 h-9 -my-2 text-on-surface-variant/50 hover:text-error transition-colors"
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                  {msg.followUps && msg.followUps.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {msg.followUps.map((followUp, i) => (
                        <button
                          key={i}
                          onClick={() => handleSend(followUp)}
                          className="px-2 py-0.5 bg-surface-container hover:bg-surface-container-high rounded-full text-[10px] text-secondary font-medium transition-colors"
                        >
                          {followUp}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-7 h-7 bg-secondary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-secondary" />
                  </div>
                )}
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-2">
                <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div className="bg-surface-container rounded-2xl rounded-tl-sm px-3 py-2">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-on-surface-variant rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-on-surface-variant rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-on-surface-variant rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          <div className="px-3 pb-1.5">
            <div className="flex gap-1.5 overflow-x-auto pb-1.5">
              {[
                'How much protein should I eat?',
                'Suggest a meal',
                'Full body workout',
                'Sleep tips',
              ].map((action) => (
                <button
                  key={action}
                  onClick={() => handleSend(action)}
                  className="px-2.5 py-1 bg-surface-container hover:bg-surface-container-high rounded-full text-[10px] text-on-surface-variant font-medium whitespace-nowrap transition-colors"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="p-3 border-t border-outline-variant/30">
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask V anything..."
                className="flex-1 h-9 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-xs text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
              <button
                onClick={() => handleSend()}
                disabled={!message.trim() || isTyping}
                className="h-9 px-3 bg-primary text-on-primary rounded-lg font-medium text-xs hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
