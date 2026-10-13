'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import { useState, useEffect } from 'react';
import {
  Share2,
  ChevronDown,
  Eye,
  Activity,
  TrendingUp,
  Dumbbell,
  Utensils,
  Heart,
  Droplets,
  Flame,
  Calendar,
  User,
  FileText,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { useStore } from '@/lib/store-context';
import { allFoods } from '@/lib/food-database';
import { saveOrShareFile, textToBase64 } from '@/lib/file-export';
import jsPDF from 'jspdf';

const timePeriods = ['Last 7 Days', 'Last 30 Days', 'Last 3 Months', 'Year to Date'];

const sections = [
  { id: 'exercise', label: 'Exercise Plan', icon: Dumbbell, defaultChecked: true },
  { id: 'nutrition', label: 'Meal Plan & Macros', icon: Utensils, defaultChecked: true },
  { id: 'health', label: 'Health Statistics', icon: Activity, defaultChecked: true },
  { id: 'body', label: 'Body Metrics', icon: TrendingUp, defaultChecked: true },
  { id: 'habits', label: 'Habits & Consistency', icon: CheckCircle, defaultChecked: true },
];

const dayLabels: Record<string, string> = {
  Monday: 'Push',
  Tuesday: 'Pull',
  Wednesday: 'Legs',
  Thursday: 'Upper',
  Friday: 'Lower',
  Saturday: 'Full Body',
  Sunday: 'Rest',
};

export default function ExportReportsPage() {
  const { profile, meals, exercises: exerciseLogs, bodyMetrics, calculations, workoutPlan, habits, sleepLogs } = useStore();
  const [timePeriod, setTimePeriod] = useState('Last 30 Days');
  const [showDropdown, setShowDropdown] = useState(false);
  const [checkedSections, setCheckedSections] = useState<Record<string, boolean>>({
    exercise: true,
    nutrition: true,
    health: true,
    body: true,
    habits: true,
  });
  const [format, setFormat] = useState<'pdf' | 'csv'>('pdf');
  const [generating, setGenerating] = useState(false);
  const [exportError, setExportError] = useState('');
  const [includeMacros, setIncludeMacros] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [reportId, setReportId] = useState('');
  const [reportDate, setReportDate] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setReportId(Date.now().toString(36).toUpperCase().slice(-6));
    setReportDate(new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }));
    setHydrated(true);
  }, []);

  const profileComplete = Boolean(
    hydrated &&
      profile?.age &&
      profile?.height &&
      profile?.weight &&
      profile?.gender &&
      profile?.activityLevel &&
      profile?.goal
  );

  const toggleSection = (id: string) => {
    setCheckedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const mealCalories = (m: { foodId: string; quantity: number }) => {
    const food = allFoods.find((f) => f.id === m.foodId);
    return food ? food.nutrition.calories * (m.quantity || 1) : 0;
  };

  const periodDays = timePeriod === 'Last 7 Days' ? 7
    : timePeriod === 'Last 30 Days' ? 30
    : timePeriod === 'Last 3 Months' ? 90
    : Math.max(1, Math.ceil((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000));
  const periodStart = new Date(Date.now() - periodDays * 86400000).toISOString().split('T')[0];
  const inPeriod = (dateStr?: string) => !dateStr || dateStr >= periodStart;

  const periodMeals = meals.filter((m: any) => inPeriod(m.loggedAt?.split('T')[0]));
  const periodExercises = exerciseLogs.filter((e: any) => inPeriod(e.loggedAt?.split('T')[0]));
  const periodMetrics = bodyMetrics.filter((b: any) => inPeriod(b.date));
  const periodSleep = sleepLogs.filter((s: any) => inPeriod(s.date));
  const avgSleep = periodSleep.length > 0
    ? (periodSleep.reduce((sum: number, s: any) => sum + (s.hours || 0), 0) / periodSleep.length)
    : 0;

  const avgCalories = periodMeals.length > 0
    ? Math.round(periodMeals.reduce((sum: number, m: any) => sum + mealCalories(m), 0) / periodMeals.length)
    : 0;

  const macroPcts = (() => {
    const p = (calculations?.protein || 0) * 4;
    const c = (calculations?.carbs || 0) * 4;
    const f = (calculations?.fat || 0) * 9;
    const total = p + c + f;
    if (total === 0) return { protein: 30, carbs: 40, fat: 30 };
    return {
      protein: Math.round((p / total) * 100),
      carbs: Math.round((c / total) * 100),
      fat: Math.round((f / total) * 100),
    };
  })();

  const last7Calories = (() => {
    const out: { day: string; kcal: number }[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      const kcal = meals
        .filter((m: any) => m.loggedAt?.split('T')[0] === ds)
        .reduce((sum: number, m: any) => sum + mealCalories(m), 0);
      out.push({ day: dayNames[d.getDay()], kcal: Math.round(kcal) });
    }
    return out;
  })();
  const maxDayKcal = Math.max(...last7Calories.map((d) => d.kcal), 1);

  // Group exercises by day for the plan
  const planDays = workoutPlan ? (() => {
    const grouped: Record<string, any[]> = {};
    workoutPlan.exercises.forEach((ex: any) => {
      if (!grouped[ex.day]) grouped[ex.day] = [];
      grouped[ex.day].push(ex);
    });
    return Object.entries(grouped).map(([day, exercises]) => ({
      day,
      label: dayLabels[day] || day,
      exercises,
    }));
  })() : [];

  const generatePDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 15;

    // === DOCUMENT HEADER ===
    doc.setFillColor(0, 108, 73);
    doc.rect(0, 0, pageWidth, 50, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    doc.text('Gym at Home', 20, 22);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('CLINICAL GRADE PLAN', 20, 30);
    doc.text(`Prepared: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`, 20, 37);
    doc.text('Based on your profile, goals, and tracked data', 20, 43);

    // Client info on right
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Client: ${profile?.name || 'N/A'}`, pageWidth - 20, 22, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Period: ${timePeriod}`, pageWidth - 20, 30, { align: 'right' });
    if (profile?.goal) {
      doc.text(`Goal: ${profile.goal === 'lose' ? 'Fat Loss' : profile.goal === 'gain' ? 'Muscle Growth' : 'General Fitness'}`, pageWidth - 20, 37, { align: 'right' });
    }
    doc.text(`Age: ${profile?.age || 'N/A'} | Height: ${profile?.height || 'N/A'}cm | Weight: ${profile?.weight || 'N/A'}kg`, pageWidth - 20, 44, { align: 'right' });

    y = 60;

    // === EXERCISE PLAN ===
    if (checkedSections.exercise) {
      doc.setFillColor(0, 108, 73);
      doc.rect(15, y - 5, 4, 12, 'F');
      doc.setTextColor(0, 108, 73);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Exercise Plan', 24, y + 4);
      y += 14;

      if (planDays.length > 0) {
        // Table
        doc.setFillColor(245, 247, 250);
        doc.rect(15, y, pageWidth - 30, 8, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(60, 60, 60);
        doc.text('DAY', 18, y + 5.5);
        doc.text('FOCUS', 45, y + 5.5);
        doc.text('EXERCISES', 75, y + 5.5);
        doc.text('SETS x REPS x KG', 145, y + 5.5);
        y += 9;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        planDays.forEach((dp, i) => {
          if (i % 2 === 0) {
            doc.setFillColor(250, 250, 255);
            doc.rect(15, y - 2, pageWidth - 30, 8, 'F');
          }
          doc.text(dp.day, 18, y + 4);
          doc.text(dp.label, 45, y + 4);
          const exNames = dp.exercises.slice(0, 3).map((e: any) => e.exerciseName).join(', ');
          doc.text(exNames.substring(0, 45), 75, y + 4);
          const w = dp.exercises[0]?.weight;
          doc.text(`${dp.exercises[0]?.sets || 3}x${dp.exercises[0]?.reps || 10}${w ? `x${w}` : ''}`, 145, y + 4);
          y += 8;
        });
        y += 5;

        // Workout Notes
        if (includeNotes) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(100, 100, 100);
          doc.text('Trainer Notes: Warm up 5-10 min before each session. Rest 60-90s between sets. Focus on form over weight.', 18, y);
          y += 12;
        }
      } else {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(150, 150, 150);
        doc.text('No workout plan generated yet. Visit Exercises page to create one.', 24, y);
        y += 12;
      }
    }

    // === MEAL PLAN & MACROS ===
    if (checkedSections.nutrition) {
      doc.setFillColor(0, 88, 190);
      doc.rect(15, y - 5, 4, 12, 'F');
      doc.setTextColor(0, 88, 190);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Meal Plan & Macros', 24, y + 4);
      y += 14;

      const targetCals = calculations?.targetCalories || 0;
      const targetProtein = calculations?.protein || 0;
      const targetCarbs = calculations?.carbs || 0;
      const targetFat = calculations?.fat || 0;
      const hydration = calculations?.hydration || 0;

      // Macro cards
      const cardWidth = (pageWidth - 50) / 3;
      doc.setFillColor(240, 243, 250);
      doc.roundedRect(15, y, cardWidth, 20, 3, 3, 'F');
      doc.roundedRect(20 + cardWidth, y, cardWidth, 20, 3, 3, 'F');
      doc.roundedRect(25 + cardWidth * 2, y, cardWidth, 20, 3, 3, 'F');

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('TARGET CALORIES', 18, y + 8);
      doc.text('PROTEIN GOAL', 23 + cardWidth, y + 8);
      doc.text('HYDRATION', 28 + cardWidth * 2, y + 8);

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 108, 73);
      doc.text(`${targetCals.toLocaleString()} kcal`, 18, y + 16);
      doc.setTextColor(0, 88, 190);
      doc.text(`${targetProtein}g`, 23 + cardWidth, y + 16);
      doc.setTextColor(133, 83, 0);
      doc.text(`${hydration}L/day`, 28 + cardWidth * 2, y + 16);
      y += 28;

      // Macro breakdown
      if (includeMacros) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);

        // Pie chart representation
        doc.setFillColor(0, 108, 73);
        doc.circle(35, y + 10, 10, 'F');
        doc.setFillColor(0, 88, 190);
        doc.circle(35, y + 10, 6, 'F');
        doc.setFillColor(133, 83, 0);
        doc.circle(35, y + 10, 3, 'F');

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`${macroPcts.carbs}% Carbs`, 55, y + 6);
        doc.text(`(${targetCarbs}g)`, 85, y + 6);
        doc.text(`${macroPcts.protein}% Protein`, 55, y + 12);
        doc.text(`(${targetProtein}g)`, 90, y + 12);
        doc.text(`${macroPcts.fat}% Fats`, 55, y + 18);
        doc.text(`(${targetFat}g)`, 80, y + 18);

        // Color dots
        doc.setFillColor(0, 108, 73);
        doc.circle(50, y + 4.5, 2, 'F');
        doc.setFillColor(0, 88, 190);
        doc.circle(50, y + 10.5, 2, 'F');
        doc.setFillColor(133, 83, 0);
        doc.circle(50, y + 16.5, 2, 'F');
        y += 25;
      }

      // Weekly Nutrition Overview
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(133, 83, 0);
      doc.text('Weekly Nutrition Overview', 24, y);
      y += 8;

      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const dayWidth = (pageWidth - 40) / 7;
      days.forEach((day, i) => {
        const x = 15 + i * dayWidth;
        const dayData = last7Calories.find((d) => d.day === day);
        const barW = Math.max(0.05, (dayData?.kcal || 0) / maxDayKcal);
        doc.setFillColor(245, 247, 250);
        doc.roundedRect(x, y, dayWidth - 3, 15, 2, 2, 'F');
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 100, 100);
        doc.text(day, x + (dayWidth - 3) / 2, y + 5, { align: 'center' });
        doc.setFillColor(0, 108, 73);
        doc.rect(x + 3, y + 9, (dayWidth - 9) * barW, 3, 'F');
        doc.setFontSize(5);
        doc.setTextColor(100, 100, 100);
        doc.text(`${dayData?.kcal || 0}`, x + (dayWidth - 3) / 2, y + 14.5, { align: 'center' });
      });
      y += 20;

      // Recent logged meals
      if (periodMeals.length > 0) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 88, 190);
        doc.text('Recently Logged Meals:', 18, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        periodMeals.slice(-8).reverse().forEach((m: any) => {
          doc.setFontSize(8);
          doc.text(`${m.loggedAt?.split('T')[0] || ''}`, 18, y);
          doc.text(`${m.foodName || 'N/A'}`, 45, y);
          doc.text(`${m.mealType || ''}`, 110, y);
          doc.text(`${Math.round(mealCalories(m))} kcal`, 140, y);
          y += 5;
        });
        y += 5;
      } else {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(150, 150, 150);
        doc.text('No meals logged in this period.', 18, y);
        y += 8;
      }
    }

    // === HEALTH STATISTICS ===
    if (checkedSections.health) {
      doc.setFillColor(0, 108, 73);
      doc.rect(15, y - 5, 4, 12, 'F');
      doc.setTextColor(0, 108, 73);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Health Statistics Overview', 24, y + 4);
      y += 14;

      const stats = [
        { label: 'Average Sleep', value: avgSleep > 0 ? `${avgSleep.toFixed(1)} hrs` : '--', color: [0, 88, 190] },
      ];

      const statWidth = (pageWidth - 50) / 3;
      stats.forEach((stat, i) => {
        const x = 15 + i * (statWidth + 5);
        doc.setFillColor(245, 247, 250);
        doc.roundedRect(x, y, statWidth, 22, 3, 3, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(stat.label.toUpperCase(), x + 5, y + 8);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(stat.color[0], stat.color[1], stat.color[2]);
        doc.text(stat.value, x + 5, y + 17);
      });
      y += 30;
    }

    // === HABITS ===
    if (checkedSections.habits) {
      doc.setFillColor(0, 108, 73);
      doc.rect(15, y - 5, 4, 12, 'F');
      doc.setTextColor(0, 108, 73);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Habits & Consistency', 24, y + 4);
      y += 14;

      // Table header
      doc.setFillColor(245, 247, 250);
      doc.rect(15, y, pageWidth - 30, 8, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(60, 60, 60);
      doc.text('HABIT', 18, y + 5.5);
      doc.text('COMPLETED', 100, y + 5.5);
      doc.text('STREAK', 145, y + 5.5);
      y += 9;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      habits.forEach((habit, i) => {
        if (i % 2 === 0) {
          doc.setFillColor(250, 250, 255);
          doc.rect(15, y - 2, pageWidth - 30, 8, 'F');
        }
        doc.setFontSize(9);
        doc.text(habit.name.substring(0, 30), 18, y + 4);
        doc.text(`${habit.completedDates.length} days`, 100, y + 4);

        // Calculate current streak
        let streak = 0;
        const today = new Date();
        for (let d = 0; d < 365; d++) {
          const dateStr = new Date(today);
          dateStr.setDate(today.getDate() - d);
          const ds = dateStr.toISOString().split('T')[0];
          if (habit.completedDates.includes(ds)) {
            streak++;
          } else {
            break;
          }
        }
        doc.text(`${streak} days`, 145, y + 4);
        y += 8;
      });
      y += 5;
    }

    // === BODY METRICS ===
    if (checkedSections.body && periodMetrics.length > 0) {
      doc.setFillColor(0, 108, 73);
      doc.rect(15, y - 5, 4, 12, 'F');
      doc.setTextColor(0, 108, 73);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Body Metrics Trends', 24, y + 4);
      y += 14;

      // Table
      doc.setFillColor(245, 247, 250);
      doc.rect(15, y, pageWidth - 30, 8, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(60, 60, 60);
      doc.text('DATE', 18, y + 5.5);
      doc.text('WEIGHT', 55, y + 5.5);
      doc.text('HEIGHT', 90, y + 5.5);
      doc.text('BMI', 125, y + 5.5);
      y += 9;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      periodMetrics.slice(-7).forEach((b: any, i) => {
        if (i % 2 === 0) {
          doc.setFillColor(250, 250, 255);
          doc.rect(15, y - 2, pageWidth - 30, 7, 'F');
        }
        doc.text(b.date || '', 18, y + 3);
        doc.text(`${b.weight || 0} kg`, 55, y + 3);
        doc.text(`${b.height || 0} cm`, 90, y + 3);
        const bmi = b.weight && profile?.height ? (b.weight / ((profile.height / 100) ** 2)).toFixed(1) : '--';
        doc.text(bmi, 125, y + 3);
        y += 7;
      });
      y += 5;
    }

    // === DOCUMENT FOOTER ===
    const footerY = pageHeight - 15;
    doc.setDrawColor(200, 200, 200);
    doc.line(15, footerY - 5, pageWidth - 15, footerY - 5);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('Generated by Gym at Home Analytics Engine', 15, footerY);
    doc.text('Confidential - For personal use only', pageWidth / 2, footerY, { align: 'center' });
    doc.text('Page 1 of 1', pageWidth - 15, footerY, { align: 'right' });

    const filename = `gym-at-home-plan-${profile?.name || 'user'}-${new Date().toISOString().split('T')[0]}.pdf`;
    const dataUri = doc.output('datauristring');
    await saveOrShareFile(filename, 'application/pdf', dataUri.substring(dataUri.indexOf(',') + 1));
  };

  const generateCSV = async () => {
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const toRow = (arr: string[]) => arr.map(escape).join(',');
    const rows: string[] = [];
    rows.push(toRow(['Gym at Home - Clinical Grade Plan']));
    rows.push(toRow(['Client', profile?.name || 'N/A', '', '', '']));
    rows.push(toRow(['Generated', new Date().toLocaleDateString(), '', '', '']));
    rows.push(toRow(['Period', timePeriod, '', '', '']));
    rows.push(toRow(['', '', '', '', '']));

    if (checkedSections.exercise && planDays.length > 0) {
      rows.push(toRow(['EXERCISE PLAN', '', '', '', '']));
      rows.push(toRow(['Day', 'Focus', 'Exercises', 'Sets x Reps x Kg', '']));
      planDays.forEach((dp) => {
        const w = dp.exercises[0]?.weight;
        rows.push(toRow([
          dp.day,
          dp.label,
          dp.exercises.map((e: any) => e.exerciseName).join(', '),
          `${dp.exercises[0]?.sets || 3}x${dp.exercises[0]?.reps || 10}${w ? `x${w}` : ''}`,
          '',
        ]));
      });
      rows.push(toRow(['', '', '', '', '']));
    }

    if (checkedSections.nutrition) {
      rows.push(toRow(['MEAL PLAN & MACROS', '', '', '', '']));
      rows.push(toRow(['Target Calories', `${calculations?.targetCalories } kcal`, '', '', '']));
      rows.push(toRow(['Protein', `${calculations?.protein || 0}g`, '', '', '']));
      rows.push(toRow(['Carbs', `${calculations?.carbs || 0}g`, '', '', '']));
      rows.push(toRow(['Fats', `${calculations?.fat || 0}g`, '', '', '']));
      rows.push(toRow(['', '', '', '', '']));
      rows.push(toRow(['Recent Meals', '', '', '', '']));
      periodMeals.slice(-10).forEach((m: any) => {
        rows.push(toRow([m.loggedAt?.split('T')[0] || '', m.foodName || '', `${Math.round(mealCalories(m))} kcal`, '', '']));
      });
      rows.push(toRow(['', '', '', '', '']));
    }

    if (checkedSections.habits) {
      rows.push(toRow(['HABITS & CONSISTENCY', '', '', '', '']));
      rows.push(toRow(['Habit', 'Completed Days', 'Current Streak', '', '']));
      const today = new Date();
      habits.forEach((h) => {
        let streak = 0;
        for (let d = 0; d < 365; d++) {
          const dateStr = new Date(today);
          dateStr.setDate(today.getDate() - d);
          const ds = dateStr.toISOString().split('T')[0];
          if (h.completedDates.includes(ds)) {
            streak++;
          } else {
            break;
          }
        }
        rows.push(toRow([h.name, `${h.completedDates.length} days`, `${streak} days`, '', '']));
      });
      rows.push(toRow(['', '', '', '', '']));
    }

    if (checkedSections.body && periodMetrics.length > 0) {
      rows.push(toRow(['BODY METRICS', '', '', '', '']));
      rows.push(toRow(['Date', 'Weight (kg)', 'Height (cm)', '', '']));
      periodMetrics.forEach((b: any) => {
        rows.push(toRow([b.date || '', String(b.weight || ''), String(b.height || ''), '', '']));
      });
    }

    const csv = rows.join('\n');
    const filename = `gym-at-home-plan-${profile?.name || 'user'}-${new Date().toISOString().split('T')[0]}.csv`;
    await saveOrShareFile(filename, 'text/csv', textToBase64(csv));
  };

  const handleExport = async () => {
    if (!profileComplete) {
      setExportError('Complete your profile in Essentials first.');
      return;
    }
    setGenerating(true);
    setExportError('');
    try {
      if (format === 'csv') {
        await generateCSV();
      } else {
        await generatePDF();
      }
    } catch {
      setExportError('Could not save the file. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <DashboardLayout title="Download Hub" subtitle="Export your personalized fitness and nutrition protocol">
      <div className="max-w-7xl mx-auto pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 xl:col-span-9 order-2 lg:order-1">
            <div className="bg-surface-container-low rounded-xl p-2 sm:p-4 md:p-6 flex items-center justify-center min-h-[400px] md:min-h-[800px] overflow-x-auto relative">
              <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#6c7a71 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

              {!hydrated ? (
                <div
                  className="bg-white w-full max-w-3xl aspect-[1/1.414] rounded-sm relative z-10 animate-pulse p-8 sm:p-10 space-y-5"
                  style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)' }}
                >
                  <div className="h-6 w-40 bg-gray-200 rounded" />
                  <div className="h-3 w-56 bg-gray-100 rounded" />
                  <div className="h-24 w-full bg-gray-100 rounded" />
                  <div className="h-4 w-1/3 bg-gray-200 rounded" />
                  <div className="grid grid-cols-4 gap-3">
                    <div className="h-16 bg-gray-100 rounded-lg" />
                    <div className="h-16 bg-gray-100 rounded-lg" />
                    <div className="h-16 bg-gray-100 rounded-lg" />
                    <div className="h-16 bg-gray-100 rounded-lg" />
                  </div>
                </div>
              ) : profileComplete ? (
              <div className="bg-white w-full max-w-3xl aspect-[1/1.414] rounded-sm relative z-10 flex flex-col scale-95 md:scale-100 transform origin-top transition-transform hover:scale-[1.01] duration-300 overflow-hidden min-w-[320px]" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)' }}>

                {/* Report Header */}
                <div className="bg-gradient-to-r from-[#006C49] to-[#004D33] text-white px-6 sm:px-10 py-6 sm:py-8">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
                        <span className="text-xl sm:text-2xl font-black">V</span>
                      </div>
                      <div>
                        <h3 className="text-lg sm:text-xl font-bold tracking-tight">Gym at Home</h3>
                        <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-white/70 mt-0.5">Health & Fitness Protocol</p>
                      </div>
                    </div>
                    <div className="text-right text-white/80 text-[10px] sm:text-[11px] space-y-1">
                      <p className="text-white font-semibold">{reportDate}</p>
                      <p>Report ID: GAH-{reportId}</p>
                    </div>
                  </div>
                </div>

                {/* Client Info Bar */}
                <div className="bg-gray-50 border-b border-gray-200 px-6 sm:px-10 py-3 sm:py-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-[#006C49]" />
                      <div>
                        <p className="text-gray-400 uppercase tracking-wider text-[9px]">Client</p>
                        <p className="font-semibold text-gray-800">{profile?.name || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-[#006C49]" />
                      <div>
                        <p className="text-gray-400 uppercase tracking-wider text-[9px]">Period</p>
                        <p className="font-semibold text-gray-800">{timePeriod}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-3.5 h-3.5 text-[#006C49]" />
                      <div>
                        <p className="text-gray-400 uppercase tracking-wider text-[9px]">Goal</p>
                        <p className="font-semibold text-gray-800">{profile?.goal === 'lose' ? 'Fat Loss' : profile?.goal === 'gain' ? 'Muscle Gain' : profile?.goal === 'maintain' ? 'Maintain Weight' : 'General Fitness'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5 text-[#006C49]" />
                      <div>
                        <p className="text-gray-400 uppercase tracking-wider text-[9px]">BMI</p>
                        <p className="font-semibold text-gray-800">{profile?.weight && profile?.height ? (profile.weight / ((profile.height / 100) ** 2)).toFixed(1) : '--'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Report Body */}
                <div className="flex-1 px-10 py-8 space-y-8 overflow-y-auto">

                  {/* Executive Summary */}
                  {checkedSections.nutrition && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-5 bg-[#006C49] rounded-full" />
                        <h4 className="text-[13px] font-bold text-gray-900 uppercase tracking-wider">Nutritional Targets</h4>
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        <div className="bg-gradient-to-br from-[#006C49]/5 to-[#006C49]/10 rounded-lg p-3 border border-[#006C49]/10">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Flame className="w-3.5 h-3.5 text-[#006C49]" />
                            <span className="text-[9px] uppercase tracking-wider text-gray-500 font-medium">Calories</span>
                          </div>
                          <p className="text-lg font-bold text-[#006C49]">{(calculations?.targetCalories || 0).toLocaleString()}</p>
                          <p className="text-[9px] text-gray-400">kcal / day</p>
                        </div>
                        <div className="bg-gradient-to-br from-[#0058BE]/5 to-[#0058BE]/10 rounded-lg p-3 border border-[#0058BE]/10">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Dumbbell className="w-3.5 h-3.5 text-[#0058BE]" />
                            <span className="text-[9px] uppercase tracking-wider text-gray-500 font-medium">Protein</span>
                          </div>
                          <p className="text-lg font-bold text-[#0058BE]">{calculations?.protein || 0}g</p>
                          <p className="text-[9px] text-gray-400">{calculations?.protein || 0}g / day</p>
                        </div>
                        <div className="bg-gradient-to-br from-[#855300]/5 to-[#855300]/10 rounded-lg p-3 border border-[#855300]/10">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Droplets className="w-3.5 h-3.5 text-[#855300]" />
                            <span className="text-[9px] uppercase tracking-wider text-gray-500 font-medium">Hydration</span>
                          </div>
                          <p className="text-lg font-bold text-[#855300]">{calculations?.hydration || '--'}L</p>
                          <p className="text-[9px] text-gray-400">liters / day</p>
                        </div>
                        <div className="bg-gradient-to-br from-[#BA1A1A]/5 to-[#BA1A1A]/10 rounded-lg p-3 border border-[#BA1A1A]/10">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Heart className="w-3.5 h-3.5 text-[#BA1A1A]" />
                            <span className="text-[9px] uppercase tracking-wider text-gray-500 font-medium">Fat</span>
                          </div>
                          <p className="text-lg font-bold text-[#BA1A1A]">{calculations?.fat || 0}g</p>
                          <p className="text-[9px] text-gray-400">{calculations?.fat || 0}g / day</p>
                        </div>
                      </div>

                      {includeMacros && (
                        <div className="mt-4 bg-gray-50 rounded-lg p-4 border border-gray-100">
                          <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-3 font-medium">Macro Distribution</p>
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <div className="flex items-center justify-between text-[10px] mb-1">
                                <span className="text-gray-600">Carbs</span>
                                <span className="font-semibold text-gray-800">{macroPcts.carbs}% — {calculations?.carbs || 0}g</span>
                              </div>
                              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div className="h-full bg-[#006C49] rounded-full" style={{ width: `${macroPcts.carbs}%` }} />
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between text-[10px] mb-1">
                                <span className="text-gray-600">Protein</span>
                                <span className="font-semibold text-gray-800">{macroPcts.protein}% — {calculations?.protein || 0}g</span>
                              </div>
                              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div className="h-full bg-[#0058BE] rounded-full" style={{ width: `${macroPcts.protein}%` }} />
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between text-[10px] mb-1">
                                <span className="text-gray-600">Fats</span>
                                <span className="font-semibold text-gray-800">{macroPcts.fat}% — {calculations?.fat || 0}g</span>
                              </div>
                              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div className="h-full bg-[#855300] rounded-full" style={{ width: `${macroPcts.fat}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Exercise Plan */}
                  {checkedSections.exercise && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-5 bg-[#0058BE] rounded-full" />
                        <h4 className="text-[13px] font-bold text-gray-900 uppercase tracking-wider">Exercise Protocol</h4>
                      </div>
                      {planDays.length > 0 ? (
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          <table className="w-full text-[11px]">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-4 py-2.5 text-left font-semibold text-gray-600 uppercase tracking-wider text-[9px]">Day</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-gray-600 uppercase tracking-wider text-[9px]">Focus</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-gray-600 uppercase tracking-wider text-[9px]">Exercises</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-gray-600 uppercase tracking-wider text-[9px]">Volume</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {planDays.map((dp, i) => (
                                <tr key={dp.day} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                  <td className="px-4 py-2.5 font-medium text-gray-800">{dp.day}</td>
                                  <td className="px-4 py-2.5">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-semibold bg-[#0058BE]/10 text-[#0058BE]">{dp.label}</span>
                                  </td>
                                  <td className="px-4 py-2.5 text-gray-600">{dp.exercises.slice(0, 2).map((e: any) => e.exerciseName).join(', ')}{dp.exercises.length > 2 ? ` +${dp.exercises.length - 2} more` : ''}</td>
                                  <td className="px-4 py-2.5 text-gray-500 font-mono text-[10px]">{dp.exercises[0]?.sets || 3}x{dp.exercises[0]?.reps || 10}{dp.exercises[0]?.weight ? `x${dp.exercises[0].weight}kg` : ''}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="bg-gray-50 rounded-lg p-6 text-center border border-dashed border-gray-200">
                          <Dumbbell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                          <p className="text-[11px] text-gray-400 italic">No workout plan generated yet</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Weekly Meal Overview */}
                  {checkedSections.nutrition && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-5 bg-[#855300] rounded-full" />
                        <h4 className="text-[13px] font-bold text-gray-900 uppercase tracking-wider">Last 7 Days — Calories</h4>
                      </div>
                      <div className="grid grid-cols-7 gap-1.5 mb-4">
                        {last7Calories.map((d) => (
                          <div key={d.day} className="text-center">
                            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-1">{d.day}</p>
                            <div className="bg-gray-50 rounded p-1.5 border border-gray-100 flex flex-col items-center justify-end h-16">
                              <div className="w-full bg-[#006C49]/80 rounded-full" style={{ height: `${Math.max(4, (d.kcal / maxDayKcal) * 48)}px` }} />
                              <span className="text-[8px] font-semibold text-gray-600 mt-1">{d.kcal}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-1.5">
                        {periodMeals.length === 0 ? (
                          <p className="text-[10px] text-gray-400 italic">No meals logged in this period</p>
                        ) : (
                          [...periodMeals].reverse().slice(0, 6).map((m: any, i: number) => (
                            <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                              <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#006C49]" />
                                <span className="text-[11px] font-semibold text-gray-800">{m.foodName || 'N/A'}</span>
                                <span className="text-[10px] text-gray-400 capitalize">— {m.mealType || ''}</span>
                                <span className="text-[10px] text-gray-500">{m.loggedAt?.split('T')[0] || ''}</span>
                              </div>
                              <span className="text-[10px] font-mono text-gray-400">{Math.round(mealCalories(m))} kcal</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* Body Metrics */}
                  {checkedSections.body && periodMetrics.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-5 bg-[#BA1A1A] rounded-full" />
                        <h4 className="text-[13px] font-bold text-gray-900 uppercase tracking-wider">Body Metrics Log</h4>
                      </div>
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              <th className="px-4 py-2.5 text-left font-semibold text-gray-600 uppercase tracking-wider text-[9px]">Date</th>
                              <th className="px-4 py-2.5 text-left font-semibold text-gray-600 uppercase tracking-wider text-[9px]">Weight</th>
                              <th className="px-4 py-2.5 text-left font-semibold text-gray-600 uppercase tracking-wider text-[9px]">Height</th>
                              <th className="px-4 py-2.5 text-left font-semibold text-gray-600 uppercase tracking-wider text-[9px]">BMI</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {periodMetrics.slice(-5).map((b: any, i: number) => {
                              const bmi = b.weight && profile?.height ? (b.weight / ((profile.height / 100) ** 2)).toFixed(1) : '--';
                              return (
                                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                  <td className="px-4 py-2.5 font-medium text-gray-800">{b.date || 'N/A'}</td>
                                  <td className="px-4 py-2.5 text-gray-600">{b.weight || '--'} kg</td>
                                  <td className="px-4 py-2.5 text-gray-600">{b.height || '--'} cm</td>
                                  <td className="px-4 py-2.5">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-semibold ${
                                      bmi !== '--' && parseFloat(bmi) < 25 ? 'bg-[#006C49]/10 text-[#006C49]' :
                                      bmi !== '--' && parseFloat(bmi) < 30 ? 'bg-[#855300]/10 text-[#855300]' :
                                      'bg-[#BA1A1A]/10 text-[#BA1A1A]'
                                    }`}>{bmi}</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Health Statistics */}
                  {checkedSections.health && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-5 bg-[#BA1A1A] rounded-full" />
                        <h4 className="text-[13px] font-bold text-gray-900 uppercase tracking-wider">Health Overview</h4>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: 'Avg Sleep', value: avgSleep > 0 ? `${avgSleep.toFixed(1)} hrs` : '--', sub: 'Target: 7-9 hrs', color: '#0058BE' },
                          { label: 'Avg kcal / meal', value: avgCalories > 0 ? `${avgCalories} kcal` : '--', sub: `${periodMeals.length} meals in period`, color: '#006C49' },
                          { label: 'Workouts Logged', value: String(periodExercises.length), sub: timePeriod, color: '#855300' },
                        ].map((stat) => (
                          <div key={stat.label} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                            <p className="text-[9px] uppercase tracking-wider text-gray-400 mb-1">{stat.label}</p>
                            <p className="text-base font-bold" style={{ color: stat.color }}>{stat.value}</p>
                            <p className="text-[9px] text-gray-400 mt-0.5">{stat.sub}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Habits */}
                  {checkedSections.habits && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-5 bg-[#006C49] rounded-full" />
                        <h4 className="text-[13px] font-bold text-gray-900 uppercase tracking-wider">Habits & Consistency</h4>
                      </div>
                      {habits.length === 0 ? (
                        <p className="text-[10px] text-gray-400 italic">No habits tracked yet</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {habits.map((h) => {
                            let streak = 0;
                            const today = new Date();
                            for (let d = 0; d < 365; d++) {
                              const dateStr = new Date(today);
                              dateStr.setDate(today.getDate() - d);
                              const ds = dateStr.toISOString().split('T')[0];
                              if (h.completedDates.includes(ds)) streak++;
                              else break;
                            }
                            const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
                            const completedThisMonth = h.completedDates.filter(d => {
                              const dt = new Date(d);
                              return dt.getMonth() === today.getMonth() && dt.getFullYear() === today.getFullYear();
                            }).length;
                            const progress = Math.min((completedThisMonth / daysInMonth) * 100, 100);
                            const level = streak >= 30 ? '🔥' : streak >= 7 ? '⭐' : streak >= 3 ? '✅' : '○';

                            return (
                              <div key={h.id} className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-[10px] font-semibold text-gray-800 truncate">{h.name}</span>
                                  <span className="text-[9px]">{level}</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1 mb-1.5">
                                  <div className="bg-[#006C49] h-1 rounded-full transition-all" style={{ width: `${progress}%` }} />
                                </div>
                                <div className="flex justify-between text-[8px] text-gray-500">
                                  <span>{completedThisMonth}/{daysInMonth} days</span>
                                  <span className={`font-semibold ${streak >= 7 ? 'text-[#006C49]' : 'text-gray-500'}`}>{streak} streak</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                </div>

                {/* Report Footer */}
                <div className="border-t border-gray-200 px-10 py-4 bg-gray-50">
                  <div className="flex justify-between items-center text-[9px] text-gray-400">
                    <div className="flex items-center gap-4">
                      <span>Generated by Gym at Home Analytics Engine</span>
                      <span className="text-gray-300">|</span>
                      <span>Confidential — For personal use only</span>
                    </div>
                    <span>Page 1 of 1</span>
                  </div>
                </div>

              </div>
              ) : (
                <div
                  className="bg-white w-full max-w-3xl aspect-[1/1.414] rounded-sm relative z-10 flex flex-col items-center justify-center text-center px-8 sm:px-10"
                  style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)' }}
                >
                  <div className="w-14 h-14 rounded-2xl bg-[#006C49]/10 flex items-center justify-center mb-5">
                    <FileText className="w-7 h-7 text-[#006C49]" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2">
                    Complete your profile to generate your report
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-500 max-w-sm mb-6 leading-relaxed">
                    Your nutrition targets, workout plan and health metrics are calculated from your Essentials stats.
                    Fill them in once and your personalized protocol will appear here.
                  </p>
                  <Link
                    href="/calculator"
                    className="inline-flex items-center gap-2 bg-[#006C49] text-white text-xs sm:text-sm font-bold px-5 py-3 rounded-lg hover:bg-[#004D33] transition-colors"
                  >
                    Open Essentials
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-4 xl:col-span-3 order-1 lg:order-2">
            <div className="bg-surface-container-low border border-outline-variant/40 rounded-xl p-6 pb-24 sticky top-24 shadow-sm max-h-[calc(100vh-8rem)] overflow-y-auto">
              <h3 className="text-headline-md font-bold text-on-surface mb-6 border-b border-outline-variant/30 pb-4">Export Settings</h3>
              <div className="space-y-6">
                <div>
                  <label className="text-label-md text-on-surface-variant block mb-3">Format</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setFormat('pdf')}
                      className={`border-2 rounded-lg py-3 px-4 flex flex-col items-center justify-center gap-1 transition-colors ${
                        format === 'pdf'
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-outline-variant/50 text-on-surface-variant hover:border-secondary hover:text-secondary'
                      }`}
                    >
                      <span className="text-label-md font-bold">PDF</span>
                    </button>
                    <button
                      onClick={() => setFormat('csv')}
                      className={`border-2 rounded-lg py-3 px-4 flex flex-col items-center justify-center gap-1 transition-colors ${
                        format === 'csv'
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-outline-variant/50 text-on-surface-variant hover:border-secondary hover:text-secondary'
                      }`}
                    >
                      <span className="text-label-md font-bold">CSV</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-4 border-t border-outline-variant/20 pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-label-md font-bold text-on-surface">Include Macros</p>
                      <p className="text-xs text-on-surface-variant">Detailed daily breakdown</p>
                    </div>
                    <button
                      onClick={() => setIncludeMacros(!includeMacros)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${includeMacros ? 'bg-primary' : 'bg-gray-300'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow ${includeMacros ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-label-md font-bold text-on-surface">Workout Notes</p>
                      <p className="text-xs text-on-surface-variant">Trainer cues & warmups</p>
                    </div>
                    <button
                      onClick={() => setIncludeNotes(!includeNotes)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${includeNotes ? 'bg-primary' : 'bg-gray-300'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow ${includeNotes ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                </div>

                <div className="border-t border-outline-variant/20 pt-6">
                  <label className="text-label-md text-on-surface-variant block mb-3">Sections</label>
                  <div className="space-y-2">
                    {sections.map((s) => (
                      <label key={s.id} className="flex items-center justify-between p-2 hover:bg-surface-container-low rounded-lg cursor-pointer">
                        <div className="flex items-center gap-2">
                          <s.icon className="w-4 h-4 text-outline-variant" />
                          <span className="text-body-md text-on-surface">{s.label}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={checkedSections[s.id]}
                          onChange={() => toggleSection(s.id)}
                          className="w-4 h-4 rounded text-primary focus:ring-primary"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="pt-6 mt-2 border-t border-outline-variant/20">
                  <button
                    onClick={handleExport}
                    disabled={generating || !profileComplete}
                    className="w-full bg-primary hover:bg-primary/90 text-on-primary text-label-md font-bold py-4 rounded-lg shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generating ? (
                      <span className="w-5 h-5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                    ) : (
                      <Share2 className="w-5 h-5" />
                    )}
                    {generating ? 'Generating...' : 'Download / Share'}
                  </button>
                  <p className="text-center text-xs text-on-surface-variant mt-3">
                    {!profileComplete
                      ? 'Complete your profile in Essentials to enable export'
                      : format === 'pdf'
                        ? 'PDF document'
                        : 'CSV spreadsheet'}
                  </p>
                  {exportError && (
                    <p className="text-center text-xs text-error mt-2">{exportError}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
