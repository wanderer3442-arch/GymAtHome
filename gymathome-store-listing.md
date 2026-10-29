# Gym at Home - Store Listing Copy

## Google Play - Main Listing

### App name (30 characters max)

Gym at Home: Fitness & Meals

### Short description (80 characters max)

Meals, home workouts, habits and AI coaching - all in one app.

### Full description (4,000 characters max)

Gym at Home is your all-in-one fitness companion for training and eating right - no gym required, no subscription.

PLAN YOUR TRAINING
- Personalized home workout plan based on your body, goal and schedule
- Exercise library with guided routines you can do in your living room
- Home-friendly options for bodyweight training or the equipment you already have
- Progressive tracking so you always know your next step

EAT RIGHT
- Get your daily calorie and macro targets (TDEE, BMI, hydration) from a quick onboarding
- Smart meal plans built around your goal
- Huge food database with everyday Indian and global foods
- Simple food intake logger with gram-based portions

TRACK EVERYTHING
- Water, sleep, weight and habit tracking with clean charts
- Activity logger for daily metrics
- Weekly and monthly body metrics

YOUR AI COACH "V"
- Built-in health assistant that answers fitness, nutrition and workout questions
- Friendly gym-buddy tone, informed by guidance from WHO, USDA, ISSN and ICMR-NIN
- Save AI meal and workout plans straight to your plans, with grams for every countable food

REPORTS
- Export your full fitness and nutrition report to share with a coach or doctor

PRIVATE BY DESIGN
- Your profile, health data, photos and chat history are stored on your device
- No ads, no trackers, no subscriptions
- When you use AI features, relevant prompts and profile/log context are sent through our Cloudflare proxy to its configured AI provider (Groq or Google Gemini)
- Weather coordinates are sent to Open-Meteo when location-based weather is enabled
- Delete Gym at Home data stored on this device from inside the app; this does not delete information already processed by external providers

Whether you want to lose weight, build muscle or just build a healthy routine, Gym at Home keeps everything in one simple app.

Start today - your plan is ready in under a minute.

Note: Gym at Home provides general fitness and nutrition information, not medical advice. Consult a healthcare professional before starting a new exercise or diet program.

### Release notes - version 1.0.1 (500 characters max)

Gym at Home 1.0.1
- AI meal and workout plans now list every countable food in grams and save straight to your plans.
- New profile badge catalog and a streak card that levels up as you stay consistent.
- Heatmaps for the last 7 days, this month and this year, with calendar and grid views.
- PDF reports now use the Gym at Home logo and the current month's heatmap.
- Meal-plan days now use Save & next / Save & Complete.
- Stability and polish fixes.

---

## Alternative short descriptions

Use one of these for A/B testing:

1. Home workouts, gram-based meals and AI coaching in one app.
2. Your private home gym, meal planner and progress tracker.
3. Build habits that stick with workouts, meals and gentle AI help.

## Screenshot captions

1. Your whole day on one screen - calories, macros, water, sleep and today's plan.
2. Every portion in grams - meals you can actually follow.
3. Ask V for a plan - then save it to your meal or exercise plan in one tap.
4. See your consistency add up - heatmaps and one leveled badge.
5. Home workouts, no gym required - bodyweight or the equipment you already have.
6. A report worth keeping - export a branded monthly PDF with your current-month heatmap.

---

## Play Console metadata

- Category: Health & Fitness
- Tags: Fitness, Home workouts, Meal planning, Habit tracker, AI coach
- Contact email: gymathome.app@gmail.com
- Privacy policy: https://wanderer3442-arch.github.io/GymAtHome/privacy.html (publicly reachable and updated October 29, 2026)
- App access: No server login. If onboarding creates a local profile, state that all features are available after creating it. If a login screen exists, provide test credentials.
- Ads: No
- In-app purchases: No
- Content rating: Everyone (complete the questionnaire and verify)
- Target audience: 13+ (verify against your intended audience)
- Health apps declaration: Complete it; the app tracks fitness and health metrics.
- Location permissions: Complete the prominent-disclosure requirement for the weather lookup.
- Exact alarms: `SCHEDULE_EXACT_ALARM` is a restricted permission. If exact reminders are not essential, switch to inexact reminders or remove it before review.

## Data safety draft - verify every answer against the deployed Worker/provider in Play Console

The app stores most app data locally, but AI requests and weather lookups leave the device. This is a draft, not a confirmed Play Console declaration. The actual AI provider depends on the deployed Worker configuration.

- Health and fitness: profile metrics, health conditions, allergies, and relevant meal/workout/water/sleep details may be included in AI prompts when AI features are used.
- Personal info: the profile name and profile details may be included in AI prompts.
- Location: when granted and weather is used, coordinates are sent directly to Open-Meteo; location updates can trigger refreshed requests. The app does not persist a location history.
- App activity and user-generated content: recent chat history (up to 10 messages) and submitted CSV plan contents may be included in AI requests.
- Photos: profile photos are stored locally. Current app flows do not upload the profile photo for AI processing.
- Data sharing/processing: Cloudflare Workers processes the AI proxy request and uses the connecting IP for rate limiting; the configured AI provider (Groq or Google Gemini) processes AI prompts; Open-Meteo receives location coordinates for weather. No ads or analytics SDKs are included in the app.
- Data deletion: in-app Delete All Data clears Gym at Home data on the device. It cannot delete data already sent to external providers. No user account database exists.
- Encryption in transit: Yes.
- Optionality: AI and location-based weather are optional; core logging features work without them.
- Retention: do not claim a fixed provider retention period until you verify the active provider and account settings; providers may process or retain data under their current terms.

## Before publishing

- Host the privacy policy at a public URL and put that URL in Play Console.
- Complete the Data safety and Health apps declarations.
- Review the `SCHEDULE_EXACT_ALARM` permission; it can block or delay review.
- Upload the fresh signed AAB (`versionCode 4`, `versionName 1.0.2`) only if code 4 has not already been used for this Play app; otherwise increment the version code before building.
- Add the 512x512 icon, 1024x500 feature graphic and 2-8 phone screenshots. The ready-to-upload PNGs are in `gymathome-store-assets/` (or `gymathome-play-store-assets.zip`).
- Remember that `NEXT_PUBLIC_APP_CLIENT_SECRET` is extractable from the APK. It is an app identifier, not a true secret; add server-side quotas if you need stronger abuse protection.
