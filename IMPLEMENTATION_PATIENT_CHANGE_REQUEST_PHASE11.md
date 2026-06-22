# Patient Mobile Application – Phase 11

Applied changes:

1. Health questionnaire returned to the Profile page and placed immediately after the Personal Information section.
2. Removed the Profile-page note that said the questionnaire had been moved to Home.
3. Diagnostic History and Reports now supports selecting multiple files from the Add Report form.
4. Each selected file is stored as its own report entry while sharing the same category/date/provider metadata from the form.
5. Removed the Profile-page "no more information available" section.
6. Removed the quick action shortcut for Health Questionnaire from Home so the primary access is now the Profile page.

Notes:
- This patch adds the Flutter dependency `file_picker` for multi-file selection.
- Run `flutter pub get` after extracting the workspace before launching the app.
