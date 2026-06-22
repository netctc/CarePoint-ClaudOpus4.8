# CarePoint Patient Change Request — Phase 15

## Objective
Reimplement the Patient mobile **Profile page** and **Health Questionnaire page** to replace the unstable render path that was still producing blank-screen behavior.

## What was rebuilt

### 1) Profile page rebuilt
File:
- `apps/mobile/lib/features/profile/presentation/screens/profile_setup_page.dart`

Changes:
- Replaced the previous profile page implementation with a simpler, stable structure.
- Removed inline questionnaire rendering from the profile page.
- Profile page now contains only:
  - identity section for self profile
  - questionnaire summary card with open/edit action
  - reports section
  - end-of-page indicator
- Uses a plain `RefreshIndicator + ListView` structure to avoid hidden/blank lower-page sections.
- Loads medical profile safely and shows inline error state instead of rendering a blank page.
- Keeps support for:
  - self profile save
  - family/dependent medical profile save
  - reports metadata
  - doctor-sharing toggle

### 2) Questionnaire page rebuilt
File:
- `apps/mobile/lib/features/profile/presentation/screens/profile_questionnaire_page.dart`

Changes:
- Rebuilt as a dedicated standalone page.
- Uses a simple single-scroll layout instead of nested step/draft logic.
- Sections:
  - Vitals
  - Medical history
  - Lifestyle and safety
- Height and weight validation now shows a clear error message and never blocks rendering of the page itself.
- Save action returns a clean questionnaire payload back to the profile page.

## Why this rebuild is safer
- The old flow mixed long-page rendering, questionnaire restoration, autosave state, and lower-page transitions in one screen.
- The new flow separates responsibilities:
  - Profile page = stable overview + save point
  - Questionnaire page = isolated data entry page
- This reduces the chance of blank-page behavior caused by complex inline widget state.

## Files changed
- `apps/mobile/lib/features/profile/presentation/screens/profile_setup_page.dart`
- `apps/mobile/lib/features/profile/presentation/screens/profile_questionnaire_page.dart`

## Recommended local checks
1. Open Profile Setup.
2. Confirm the page renders fully without blank sections.
3. Open the questionnaire from the profile page.
4. Enter height and weight.
5. Confirm the questionnaire continues to render and save normally.
6. Return to profile and save.
7. Reopen the profile and confirm persisted data loads.
