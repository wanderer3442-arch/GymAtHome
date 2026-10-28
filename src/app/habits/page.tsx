'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Check, Clock, Trash2, ListTodo, Sparkles } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useStore } from '@/lib/store-context';
import Heatmap from '@/components/Heatmap';
import { buildHeatDays, type HeatKind, type HeatRange } from '@/lib/heatmap';
import { localDateKey } from '@/lib/date';

// ─── To-Do persistence (standalone localStorage, same privacy model) ───────
interface Todo {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
}

const TODOS_KEY = 'gymathome_todos';

function loadTodos(): Todo[] {
  try {
    const raw = localStorage.getItem(TODOS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Todo[]) : [];
  } catch {
    return [];
  }
}

function saveTodos(todos: Todo[]): void {
  try {
    localStorage.setItem(TODOS_KEY, JSON.stringify(todos));
  } catch {
    // best-effort
  }
}

/**
 * Consecutive completed days ending today. Today may still be unchecked —
 * the streak then counts back from yesterday instead of reporting 0.
 */
function habitStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const set = new Set(dates);
  const d = new Date();
  let key = localDateKey(d);
  if (!set.has(key)) {
    d.setDate(d.getDate() - 1);
    key = localDateKey(d);
  }
  let count = 0;
  while (set.has(key)) {
    count++;
    d.setDate(d.getDate() - 1);
    key = localDateKey(d);
  }
  return count;
}

/**
 * Habits & To-Do — one home for daily habit check-offs, the consistency
 * calendar, and a simple task list.
 */
export default function HabitsPage() {
  const { habits, addHabit, removeHabit, toggleHabitDate } = useStore();

  // Habits
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitFreq, setNewHabitFreq] = useState<'daily' | 'weekly'>('daily');
  const [showAddHabit, setShowAddHabit] = useState(false);

  // To-dos
  const [todos, setTodos] = useState<Todo[]>([]);
  const [draft, setDraft] = useState('');
  const todosLoadedRef = useRef(false);

  useEffect(() => {
    setTodos(loadTodos());
    todosLoadedRef.current = true;
  }, []);

  useEffect(() => {
    if (!todosLoadedRef.current) return;
    saveTodos(todos);
  }, [todos]);

  const addTodo = () => {
    const text = draft.trim();
    if (!text) return;
    setTodos(prev => [
      ...prev,
      { id: crypto.randomUUID(), text, done: false, createdAt: new Date().toISOString() },
    ]);
    setDraft('');
  };

  const toggleTodo = (id: string) => {
    setTodos(prev => prev.map(t => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const removeTodo = (id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id));
  };

  const clearCompleted = () => {
    setTodos(prev => prev.filter(t => !t.done));
  };

  const doneCount = todos.filter(t => t.done).length;
  const openTodos = todos.filter(t => !t.done);
  const finishedTodos = todos.filter(t => t.done);

  const today = localDateKey();

  const todayHabits = useMemo(() => {
    return habits.map((h) => ({
      ...h,
      completed: h.completedDates.includes(today),
    }));
  }, [habits, today]);

  const completedHabits = todayHabits.filter((h) => h.completed).length;
  const totalHabits = todayHabits.length;

  // ─── Consistency heatmap (range + calendar/grid selectable) ──────────────
  const [heatRange, setHeatRange] = useState<HeatRange>('month');
  const [heatKind, setHeatKind] = useState<HeatKind>('calendar');

  const habitHeat = useMemo(() => {
    const counts: Record<string, number> = {};
    habits.forEach((h) => {
      h.completedDates.forEach((d) => {
        counts[d] = (counts[d] || 0) + 1;
      });
    });
    return buildHeatDays(heatRange, (key) =>
      habits.length > 0 ? (counts[key] || 0) / habits.length : 0
    );
  }, [habits, heatRange]);

  const addNewHabit = () => {
    if (!newHabitName.trim()) return;
    addHabit({
      id: crypto.randomUUID(),
      name: newHabitName.trim(),
      frequency: newHabitFreq,
      completedDates: [],
    });
    setNewHabitName('');
    setNewHabitFreq('daily');
    setShowAddHabit(false);
  };

  return (
    <DashboardLayout title="Habits & To-Do" subtitle="Small daily actions, big results">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Habits */}
        <div className="bg-surface rounded-xl border border-outline-variant p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-headline-md font-semibold text-on-surface">Today&apos;s Habits</h2>
            <span className="text-sm text-on-surface-variant">{completedHabits}/{totalHabits}</span>
          </div>
          {totalHabits > 0 && (
            <div className="h-2 bg-surface-container rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
                style={{ width: `${(completedHabits / totalHabits) * 100}%` }}
              />
            </div>
          )}
          <div className="space-y-2">
            {todayHabits.length === 0 ? (
              <p className="text-label-md text-on-surface-variant py-4 text-center italic">
                No habits yet. Add your first one below!
              </p>
            ) : (
              todayHabits.map((habit) => (
                <div
                  key={habit.id}
                  onClick={() => toggleHabitDate(habit.id, today)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors text-left min-w-0 cursor-pointer ${
                    habit.completed ? 'bg-primary/5' : 'hover:bg-surface-container'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
                      habit.completed
                        ? 'bg-primary border-primary text-white'
                        : 'border-outline-variant hover:border-primary'
                    }`}
                  >
                    {habit.completed && <Check className="w-3 h-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${
                        habit.completed ? 'text-on-surface-variant line-through' : 'text-on-surface'
                      }`}
                    >
                      {habit.name}
                    </p>
                    <p className="text-xs text-on-surface-variant flex items-center gap-1">
                      <Clock className="w-3 h-3 shrink-0" /> {habit.frequency}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeHabit(habit.id);
                    }}
                    className="text-outline hover:text-error opacity-60 hover:opacity-100 transition-opacity shrink-0 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Add Habit */}
          {showAddHabit ? (
            <div className="mt-4 p-3 bg-surface-container rounded-lg">
              <input
                type="text"
                value={newHabitName}
                onChange={(e) => setNewHabitName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addNewHabit()}
                placeholder="Habit name (e.g., Meditation)"
                className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-surface text-body-md outline-none focus:border-primary mb-2"
                autoFocus
              />
              <div className="flex gap-2 mb-2">
                {(['daily', 'weekly'] as const).map((freq) => (
                  <button
                    key={freq}
                    onClick={() => setNewHabitFreq(freq)}
                    className={`flex-1 h-9 rounded-lg text-label-md font-medium capitalize transition-colors ${
                      newHabitFreq === freq
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    {freq}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addNewHabit}
                  className="flex-1 h-9 bg-primary text-on-primary rounded-lg text-label-md font-bold hover:bg-primary/90 transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowAddHabit(false);
                    setNewHabitName('');
                  }}
                  className="flex-1 h-9 bg-surface-container text-on-surface-variant rounded-lg text-label-md hover:bg-surface-container-high transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddHabit(true)}
              className="w-full mt-4 py-2.5 border border-dashed border-outline rounded-lg text-label-md text-on-surface-variant hover:bg-surface-container transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Habit
            </button>
          )}
        </div>

        {/* To-Do List */}
        <div className="lg:col-span-2 bg-surface rounded-xl border border-outline-variant p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-headline-md font-semibold text-on-surface flex items-center gap-2">
              <ListTodo className="w-5 h-5 text-primary" />
              To-Do List
            </h2>
            {todos.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-on-surface-variant">
                  <span className="font-bold text-on-surface">{doneCount}</span>/{todos.length} done
                </span>
                {doneCount > 0 && (
                  <button
                    onClick={clearCompleted}
                    className="text-label-md text-on-surface-variant hover:text-error transition-colors"
                  >
                    Clear completed
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Add input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTodo()}
              placeholder="Add a task (e.g., Buy protein powder)"
              className="flex-1 h-11 px-4 rounded-lg border border-outline-variant bg-surface text-body-md text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none min-w-0"
            />
            <button
              onClick={addTodo}
              disabled={!draft.trim()}
              className="h-11 px-4 bg-primary text-on-primary rounded-lg text-label-md font-bold hover:bg-primary/90 transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          {/* Progress bar */}
          {todos.length > 0 && (
            <div className="mt-3 h-2 bg-surface-container rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${(doneCount / todos.length) * 100}%` }}
              />
            </div>
          )}

          {/* List */}
          <div className="mt-3 space-y-2">
            {todos.length === 0 ? (
              <div className="py-10 flex flex-col items-center text-center">
                <ListTodo className="w-9 h-9 text-on-surface-variant/40 mb-3" />
                <p className="text-body-md text-on-surface-variant italic">
                  Nothing here yet — add your first task above.
                </p>
              </div>
            ) : (
              <>
                {openTodos.map(todo => (
                  <div
                    key={todo.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors"
                  >
                    <button
                      onClick={() => toggleTodo(todo.id)}
                      className="w-5 h-5 rounded-full border-2 border-outline-variant hover:border-primary flex items-center justify-center transition-colors shrink-0"
                      aria-label="Mark done"
                    />
                    <p className="flex-1 text-body-md text-on-surface min-w-0 break-words">{todo.text}</p>
                    <button
                      onClick={() => removeTodo(todo.id)}
                      className="text-outline hover:text-error opacity-60 hover:opacity-100 transition-opacity shrink-0 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {finishedTodos.length > 0 && (
                  <>
                    <p className="text-label-md text-on-surface-variant pt-2 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Completed
                    </p>
                    {finishedTodos.map(todo => (
                      <div key={todo.id} className="flex items-center gap-3 p-3 rounded-lg bg-primary/5">
                        <button
                          onClick={() => toggleTodo(todo.id)}
                          className="w-5 h-5 rounded-full bg-primary border-primary text-white flex items-center justify-center transition-colors shrink-0"
                          aria-label="Mark not done"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <p className="flex-1 text-body-md text-on-surface-variant line-through min-w-0 break-words">
                          {todo.text}
                        </p>
                        <button
                          onClick={() => removeTodo(todo.id)}
                          className="text-outline hover:text-error opacity-60 hover:opacity-100 transition-opacity shrink-0 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Habit Consistency — calendar or grid, any range */}
        <div className="lg:col-span-3 bg-surface rounded-xl border border-outline-variant p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-headline-md font-semibold text-on-surface">Habit Consistency</h2>
          </div>
          {habits.length === 0 ? (
            <p className="text-sm text-on-surface-variant text-center py-10 italic">
              Add habits to track consistency here
            </p>
          ) : (
            <div>
              <Heatmap
                days={habitHeat}
                range={heatRange}
                onRangeChange={setHeatRange}
                kind={heatKind}
                onKindChange={setHeatKind}
                unit="days"
              />

              {/* Habit Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-5 pt-4 border-t border-outline-variant/30">
                {habits.map((h) => {
                  const streak = habitStreak(h.completedDates);
                  const monthPrefix = today.slice(0, 7);
                  const elapsed = Math.max(Number(today.slice(8, 10)), 1);
                  const completedThisMonth = h.completedDates.filter((d) =>
                    d.startsWith(monthPrefix)
                  ).length;
                  const monthPct = Math.min((completedThisMonth / elapsed) * 100, 100);
                  const level = streak >= 30 ? '🔥' : streak >= 7 ? '⭐' : streak >= 3 ? '✅' : '○';

                  return (
                    <div key={h.id} className="bg-surface-container rounded-lg p-3 border border-outline-variant/30">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{level}</span>
                          <span className="text-xs font-semibold text-on-surface truncate">{h.name}</span>
                        </div>
                        <span
                          className={`text-xs font-bold ${streak >= 7 ? 'text-primary' : 'text-on-surface-variant'}`}
                        >
                          {streak}d
                        </span>
                      </div>
                      <div className="w-full bg-surface rounded-full h-1.5">
                        <div
                          className="bg-primary h-1.5 rounded-full transition-all"
                          style={{ width: `${monthPct}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-on-surface-variant mt-1.5">
                        {completedThisMonth}/{elapsed} days this month
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
