# Daily English AI v1.4 — Warm journal conversations

## Practice flow

Default learning and review screens now use roleplay dialogues instead of sentence-copy or exact-match exercises. The screen shows who you are speaking with, their Chinese dialogue line, and a natural first-person Chinese line you want to express in English. Practice focuses on the suggested Chinese reply; free-response mode has been removed. English expressions are hidden unless you choose the small hint option beside the English response label.

Daily practice, new expressions, context transfer, individual expression review, historical paragraph practice, and mastery retests share this dialogue interface. New-expression groups combine several expressions in one conversation. Existing learning content and fixed targets remain in storage; dialogue checks accept natural wording rather than comparing against those targets.

Submit preserves the answer. Feedback considers meaning, completeness, grammar and conversational tone. Repair the same response and check again when needed. After a successful assessment, the partner's next Chinese line and the learner's next Chinese intent support another turn in the same conversation. Each turn and scenario keeps a separate draft and transcript.

The interface, navigation and controls use English. Chinese is reserved for practice scenes, roleplay dialogue and learning prompts. Every page except the home page includes a visible return-home button. Practice pages also offer previous-page navigation. Scenario controls distinguish returning to the original context, changing context, and changing the expression group.

## Data and upgrade

Export a JSON backup from Settings first. Stop the old app, extract this project, run `npm start`, and open http://localhost:3000 in the same browser profile and on the same origin as before. Node.js 20+ is required.

The localStorage keys remain unchanged. Existing expressions, paragraphs, mastery statuses, recall streaks, review schedules, practice records and old drafts are preserved. Old drafts remain under their original keys; new dialogue drafts use separate keys. JSON exports include new dialogue transcripts and attempts; imports merge missing sessions and records while keeping existing local sessions authoritative.

A passed due expression review can advance its review schedule, but a single AI judgment does not award memorization or mastery. Attempts are saved before AI is contacted, including on failure.

## AI configuration and limits

Set OPENAI_API_KEY in the server environment. The actual key is never included in the source. Credential and local configuration files are excluded by .gitignore. The default model is gpt-4o-mini; a custom OPENAI_MODEL must support strict JSON schema structured output.

The tutor receives up to six recent feedback records, common error-pattern counts, and the current conversation transcript. It cannot automatically access ChatGPT Pages or other chats. AI assessments may be imperfect. Initial contexts use a bundled bank grouped by learning topic; later conversational turns are AI-generated. The bank can repeat after its available variants. Custom material currently uses the closest available topic with the saved text supplied to AI as learning context.

## Verification

36 automated tests pass, covering existing learning behavior plus answer retention, contextual checks, multi-turn dialogue, failure handling, hidden English cues, nearby hint controls, and backup restoration. JavaScript syntax checks pass. Browser checks cover home navigation, overview navigation, Chinese dialogue prompts, nearby hint controls, submission retention, live feedback and successful continuation to the second dialogue turn. Full mobile/cross-browser coverage is not claimed.

## v1.4 home and material review

Home has one primary practice action: it resumes the last saved conversation when available, otherwise it starts today’s practice. Redundant top navigation has been removed. Add learning material, My Library, Review queue, Learning Overview and Settings appear above statistics.

Adding material now uses a separate AI review step. Up to 12,000 characters of writing are corrected and analyzed into candidate learning expressions. Originals, corrections and explanations can be reviewed; candidates can be edited and selected. Nothing is added until Save selected expressions is clicked. Duplicate expressions are merged without changing existing mastery. Original writing and the selected review are retained locally. AI review requires the existing server API-key configuration.

Browser validation for v1.4 confirmed the simplified home layout, resuming prior-version conversation progress, live AI correction/extraction, and saving only the selected corrected expression while preserving the original writing.

## Public source distribution

This repository includes generic starter examples with no learning progress and an empty history dataset. Personal imported history, browser storage, backups and API keys are excluded. Existing users retain their local data when updating on the same browser and origin; export a backup before upgrading.
