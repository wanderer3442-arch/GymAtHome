// Ad-hoc sanity test for selectNotification rules (run with: npx tsx <file>)
import { selectNotification, planSchedule, type NotifContext } from '../src/lib/notification-engine';

let pass = 0;
let fail = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}` + (ok ? '' : ` -> got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`));
}

const base: NotifContext = {
  now: new Date('2026-10-22T09:00:00'),
  name: 'Ravi',
  streak: 6,
  streakAtRisk: true,
  meals: [],
  exerciseCount: 0,
  waterMl: 0,
  targetWaterMl: 3000,
  targetCalories: 2200,
  weatherTempC: null,
};

function at(h: number, m = 0): NotifContext {
  return { ...base, now: new Date(2026, 9, 22, h, m) };
}

// 1. Morning at-risk streak wins over breakfast + hydration at 09:00
let msg = selectNotification(at(9), []);
check('09:00 at-risk: streak wins', msg?.key, 'streak_risk');

// 2. Not at risk -> breakfast window
msg = selectNotification({ ...at(9, 30), streakAtRisk: false }, []);
check('09:30 not at risk: breakfast', msg?.key, 'meal_breakfast');

// 3. Quiet hours block
msg = selectNotification(at(23), ['streak_risk']);
check('23:00 quiet hours: none', msg, null);
msg = selectNotification(at(3), []);
check('03:00 quiet hours: none', msg, null);

// 4. Daily cap
const fullDay = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
msg = selectNotification(at(9, 30), fullDay);
check('daily cap 8: none', msg, null);
msg = selectNotification(at(9, 30), ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
check('below cap still fires', msg?.key !== undefined, true);

// 5. Dedupe: streak already sent today
msg = selectNotification(at(9), ['streak_risk']);
check('streak dedupe -> breakfast', msg?.key, 'meal_breakfast');

// 6. Lunch window
msg = selectNotification(at(14), ['streak_risk', 'meal_breakfast']);
check('14:00 lunch', msg?.key, 'meal_lunch');

// 7. Lunch already logged -> no lunch nudge (snack only state)
const withLunch: NotifContext = { ...at(14), meals: [{ mealType: 'lunch' } as any] };
msg = selectNotification(withLunch, []);
check('lunch logged: no lunch nudge', msg?.key === 'meal_lunch' ? 'meal_lunch' : 'other-or-none', 'other-or-none');
// At 14:00 with lunch logged, hydration may still fire (0 water < 1500)
check('14:00 lunch logged: hydration allowed', msg?.key, 'hydration:13');

// 8. Hydration slot math: 09:00 -> hydration:9, 11:59 -> hydration:11, 19:59 -> hydration:19
msg = selectNotification({ ...at(9), streakAtRisk: false }, []);
check('09:00 hydration slot (breakfast first actually)', msg?.key, 'meal_breakfast');
msg = selectNotification({ ...at(11, 59), streakAtRisk: false, meals: [{ mealType: 'breakfast' } as any] }, []);
check('11:59 hydration slot 11', msg?.key, 'hydration:11');
const eveningWithDinner: NotifContext = {
  ...at(19, 59),
  streakAtRisk: false,
  exerciseCount: 1,
  meals: [
    { mealType: 'breakfast' } as any,
    { mealType: 'lunch' } as any,
    { mealType: 'dinner' } as any,
  ],
};
msg = selectNotification(eveningWithDinner, []);
check('19:59 hydration slot 19', msg?.key, 'hydration:19');

// 9. Hydration max 2/day
msg = selectNotification({ ...at(11, 59), streakAtRisk: false, meals: [{ mealType: 'breakfast' } as any] }, ['hydration:9', 'hydration:11']);
check('hydration cap 2: none', msg, null);

// 10. Hydration NOT sent when on pace
msg = selectNotification({ ...at(11, 59), streakAtRisk: false, waterMl: 2000, meals: [{ mealType: 'breakfast' } as any] }, []);
check('on pace: no hydration', msg, null);

// 11. Hot weather trigger 11-17
msg = selectNotification({ ...at(13), streakAtRisk: false, weatherTempC: 34, waterMl: 2500, meals: [{ mealType: 'breakfast' } as any, { mealType: 'lunch' } as any] }, []);
check('hot day: weather trigger', msg?.key, 'weather_hot');
msg = selectNotification({ ...at(13), streakAtRisk: false, weatherTempC: 24, waterMl: 2500, meals: [{ mealType: 'breakfast' } as any, { mealType: 'lunch' } as any] }, []);
check('mild day: no weather trigger', msg, null);

// 12. Evening workout tease
msg = selectNotification({ ...at(19), streakAtRisk: false, exerciseCount: 0, waterMl: 2500, meals: [{ mealType: 'breakfast' } as any, { mealType: 'lunch' } as any] }, []);
check('19:00 no workout: tease', msg?.key, 'workout_evening');
msg = selectNotification({ ...at(19), streakAtRisk: false, exerciseCount: 2, waterMl: 2500, meals: [{ mealType: 'breakfast' } as any, { mealType: 'lunch' } as any] }, []);
check('19:00 workout done, dinner window closed: none', msg, null);
msg = selectNotification({ ...at(20), streakAtRisk: false, exerciseCount: 2, waterMl: 2500, meals: [{ mealType: 'breakfast' } as any, { mealType: 'lunch' } as any] }, []);
check('20:00 workout done: dinner instead', msg?.key, 'meal_dinner');

// 13. Streak = 0: no streak or workout tease
msg = selectNotification({ ...at(9), streak: 0, streakAtRisk: false }, []);
check('new user 09:00: breakfast only', msg?.key, 'meal_breakfast');
msg = selectNotification({ ...at(20), streak: 0, streakAtRisk: false, waterMl: 2500, meals: [{ mealType: 'breakfast' } as any, { mealType: 'lunch' } as any] }, []);
check('new user 20:00: no workout tease', msg?.key, 'meal_dinner');

// 14. Dinner window boundary: 21:31+ dinner never fires (celebration may take the slot instead)
msg = selectNotification({ ...at(21, 31), streakAtRisk: false, waterMl: 2500, meals: [{ mealType: 'breakfast' } as any, { mealType: 'lunch' } as any] }, []);
check('21:31 dinner window closed', msg?.key === 'meal_dinner', false);

// --- planSchedule (ahead-of-time system alarms) ---------------------------
const dk = (d: Date) => d.toISOString().split('T')[0];
const plusDay = (d: Date) => new Date(d.getTime() + 24 * 3600 * 1000);

const planBase: NotifContext = {
  ...base,
  exerciseCount: 0,
  waterMl: 0,
  weatherTempC: null,
  todayActive: true,
  yesterdayActive: true,
};

const morning = new Date(2026, 9, 22, 7, 0);
const morningTodayKey = dk(morning);
const morningTmrKey = dk(plusDay(morning));

let plan = planSchedule(planBase, {}, morning);
const tmr = plan.filter((p) => p.dateKey === morningTmrKey);
const todayP = plan.filter((p) => p.dateKey === morningTodayKey);

check('plan: tomorrow first = morning motivation', tmr[0]?.key, 'morning_motivation');
check('plan: motivation at 07:00 local', tmr[0]?.at.getHours(), 7);
const tmrStreak = tmr.find((p) => p.key === 'streak_risk');
check('plan: tomorrow streak at 08:00 local', tmrStreak?.at.getHours(), 8);
check('plan: chronological order', plan.every((p, i) => i === 0 || plan[i - 1].at <= p.at), true);
check('plan: today cap <= 8', todayP.length <= 8, true);
check('plan: tomorrow cap <= 8', tmr.length <= 8, true);
check(
  'plan: hydration max 2 per day',
  todayP.filter((p) => p.key.startsWith('hydration:')).length <= 2 &&
    tmr.filter((p) => p.key.startsWith('hydration:')).length <= 2,
  true
);
const tmrKeys = tmr.map((p) => p.key);
check('plan: no duplicate keys/day', new Set(tmrKeys).size, tmrKeys.length);
check('plan: all entries in future', plan.every((p) => p.at.getTime() > morning.getTime()), true);
check('plan: all entries inside quiet-safe hours', plan.every((p) => p.at.getHours() >= 7 && p.at.getHours() < 22), true);
check(
  'plan: tomorrow includes meal windows',
  ['meal_breakfast', 'meal_lunch', 'meal_dinner'].every((k) => tmrKeys.includes(k)),
  true
);

// Dedupe: already-sent tomorrow streak is not re-planned
plan = planSchedule(planBase, { [morningTmrKey]: { keys: ['streak_risk'], lastAt: 0 } }, morning);
const tmr2 = plan.filter((p) => p.dateKey === morningTmrKey);
check('plan: dedupe skips planned-before key', tmr2.some((p) => p.key === 'streak_risk'), false);
check('plan: next up after dedupe', tmr2[1]?.key, 'meal_breakfast');

// Late night: nothing left today, only tomorrow
plan = planSchedule(planBase, {}, new Date(2026, 9, 22, 23, 10));
check('plan: 23:10 yields only future entries', plan.every((p) => p.at.getTime() > new Date(2026, 9, 22, 23, 10).getTime()), true);

// On-pace hydration + logged days: today's entries shrink (tomorrow's meals/
// water legitimately start unlogged, so they still plan).
const onPace: NotifContext = { ...planBase, waterMl: 2800, meals: [{ mealType: 'breakfast' } as any, { mealType: 'lunch' } as any], todayActive: true };
plan = planSchedule(onPace, {}, morning);
const todayOnPace = plan.filter((p) => p.dateKey === morningTodayKey);
check('plan: on-pace skips today hydration', todayOnPace.some((p) => p.key.startsWith('hydration:')), false);
check('plan: logged breakfast skipped today', todayOnPace.some((p) => p.key === 'meal_breakfast'), false);

// --- Engagement rules (motivation / celebration / badge tease) -------------
msg = selectNotification({ ...at(7, 30), streakAtRisk: false }, []);
check('07:30 motivation fires', msg?.key, 'morning_motivation');
msg = selectNotification(at(8, 0), []);
check('08:00 motivation window closed', msg?.key === 'morning_motivation', false);

const completeDay: NotifContext = {
  ...at(21, 10),
  streakAtRisk: false,
  exerciseCount: 1,
  waterMl: 2500,
  meals: [
    { mealType: 'breakfast' } as any,
    { mealType: 'lunch' } as any,
    { mealType: 'dinner' } as any,
  ],
};
msg = selectNotification(completeDay, []);
check('21:10 complete day: celebration', msg?.key, 'day_celebration');
msg = selectNotification({ ...at(21, 10), streakAtRisk: false }, []);
check('21:10 incomplete day: no celebration', msg?.key === 'day_celebration', false);

msg = selectNotification({ ...at(16, 30), streakAtRisk: false, streak: 6 }, []);
check('16:30 one day from badge: tease', msg?.key, 'badge_tease');
msg = selectNotification({ ...at(16, 30), streakAtRisk: false, streak: 2 }, []);
check('16:30 far from badge: no tease', msg?.key === 'badge_tease', false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
