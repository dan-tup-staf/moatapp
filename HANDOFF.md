# MOATION — kontekst do kontynuacji (handoff)

Czytaj to na start w nowym oknie. Plus `MOATION_BACKLOG.md` (aktualne zadania do
zbudowania), `TODO_USER.md` (co musi zrobić user) i `UX_PLAN.md` (specyfikacja).

## Czym jest MOATION
B2B SaaS do outreachu opartego o sygnały zakupowe (intent data). Stack:
- **Backend:** FastAPI (Python), SQLAlchemy async, Alembic. Folder `backend/`.
- **Frontend:** Next.js 15 (App Router, TS, Tailwind). Folder `frontend/`.
- **Baza:** Postgres na **Neon**. **Hosting:** **Render** (2 usługi).
- **AI:** Google **Gemini** (darmowy, `GEMINI_API_KEY`) z grounding; warstwa
  `backend/app/llm.py` (Gemini albo Anthropic — pierwszy skonfigurowany wygrywa).

## 🛑 PUŁAPKA DEPLOYU (z 2026-06) — front OOM na Render free
- `moation-web` jest na planie **free (512 MB)**, build = `npm install && npm run
  build`. Gdy appka urosła, **`next build` zaczął padać na OOM** (killed) — Render
  zostawał na STARYM buildzie, a backend (Docker) deployował się dalej → user
  „widzi stare" i mismatch shape (np. /people). Naprawa: w `package.json`
  `NODE_OPTIONS=--max-old-space-size=448` + `next.config.mjs`
  `experimental.webpackMemoryOptimizations`. Jeśli dalej pada — **bump `moation-web`
  na Starter** (więcej RAM na build) albo dalej odchudzaj build. ZAWSZE, gdy user
  mówi „nie widzę zmian na froncie", sprawdź NAJPIERW status deployu `moation-web`
  (Events/Logs), nie zakładaj że to cache.

## ⚠️ Workflow gita/deployu (KLUCZOWE)
- Pracujemy na branchu **`claude/awesome-babbage-hjyva9`** (zmienia się per sesja),
  ALE **Render buduje `main`**. Dlatego **po KAŻDEJ zmianie: commit → merge
  --ff-only do `main` → push `main` i push brancha**. Inaczej user nie zobaczy
  zmian.
- Render: **`moation-api`** (backend) i **`moation-web`** (frontend). Deploy
  `moation-api` odpala `alembic upgrade head` (migracje w `backend/alembic/versions/`).
- Po zmianach user robi „Deploy latest commit" (lub ma Auto-Deploy: Yes).
- Migracje są addytywne (0008–0017). Najnowsza migracja: `0017`.

## Konta / dostęp
- Login do appki: `daniel.tupczynski@staffly.pl`, hasło ustawione na `Moation2026!`
  (reset robiony SQL-em w Neon; w razie potrzeby UPDATE users.hashed_password bcrypt).
- Env na `moation-api` (Render → Environment): `DATABASE_URL` (Neon),
  `GEMINI_API_KEY`, `SMTP_HOST/PORT/USERNAME/PASSWORD/STARTTLS/USE_TLS/FROM_EMAIL/
  FROM_NAME/DAILY_LIMIT`, `SCHEDULER_*`, `CRON_SECRET`, `TRACKING_BASE_URL`
  (= `https://moation-api.onrender.com`), `JWT_SECRET`, `CORS_ALLOW_ALL=true`.
- Env na `moation-web`: `NEXT_PUBLIC_API_URL=https://moation-api.onrender.com`
  (BEZ końcowego `/`!), `NODE_VERSION=20`.
- Z mojego sandboxa proxy blokuje `*.onrender.com` i `dns.google` (403) — nie
  da się testować deployu „od środka". Build sprawdzam lokalnie:
  `cd frontend && NEXT_PUBLIC_API_URL=https://moation-api.onrender.com npm run build`,
  backend: `python3 -m py_compile ...`.

## ⭐ NAJWAŻNIEJSZE — oczekiwania użytkownika
User chce **1:1 jak Saleshandy/lemlist** (wysyłał screeny) — **wygląd ORAZ
funkcje**. NIE „surowe tabelki po swojemu". Był sfrustrowany, gdy dowoziłem
funkcjonalne-ale-brzydkie UI. **Każdą sekcję dopieszczaj wizualnie do poziomu
screenów** (karty, kolory, ikony lucide, ładne stany). Uwaga: ikony brandowe
(`Linkedin` itd.) usunięto z `lucide-react` v1.x — używaj generycznych.

## Co już zrobione (dziś)
- **Profil klienta** (było „ICP", przemianowane): generuje firmę + komitet
  zakupowy (persony: pain/gain/cele) — `ClientProfileView` (ładne karty,
  merge-tagi kopiowalne). Backend: `IcpFields` rozszerzony (company, personas),
  `merge_tags()`, `render_template(extra=...)` podstawia tagi w copy
  (email_sender + preview + test). Parser AI zrobiony tolerancyjny (`_coerce_list`).
- **Sekwencje (builder) 1:1 Saleshandy:** `frontend/src/components/sequence-steps.tsx`
  — pionowe karty kroków z „Dzień X", Sent/Opened/Otwarcia, „Generuj wariant AI",
  modal **kompozytora** z toolbarem (merge-tagi/spintax), **Content Guide**
  (długość tematu/słowa/personalizacja/linki/spam) + **Email Preview** z „Wyślij
  testowy mail", warianty A/B w modalu, „+ Dodaj krok" z menu kanałów
  (Email/LinkedIn/Telefon/WhatsApp/Zadanie). Widok sekwencji ma górne zakładki
  **Kroki/Odbiorcy/Ustawienia** + kołowy **Sequence Score** + „Uruchom sekwencję".
- **Kampanie (parasol) + Sekwencje:** `campaign_groups` grupują sekwencje
  (= dawne kampanie). Menu: „Kampanie" → `/groups`, „Sekwencje" → `/campaigns`.
- **Wysyłka maili (Milestone 1):** SMTP auth+TLS, From=skrzynka, List-Unsubscribe,
  dzienny limit; `/email/test`, karta skrzynki w Integracjach.
- **Scheduler:** in-process tick w `main.py` (auto-send) + `/api/v1/tick` (sekret)
  dla zewnętrznego crona (darmowy Render śpi).
- **Planowanie startu** (data/godz), **okno wysyłki** (godz+dni), **stopka wypisu**,
  **spintax** `{spin A|B endspin}`, **warianty A/B** + „Generuj AI",
  **open tracking** (pixel + `track_opens`), **test-send z kroku**.
- **Domeny** (`/domains`): realny health SPF/DKIM/DMARC/MX przez DoH Google.
- Sidebar: grupy STRATEGIA/POZYSKIWANIE/ZAANGAŻOWANIE/INFRASTRUKTURA/ANALIZA/KONTO.
- Strony-rusztowania (do dopieszczenia 1:1): Rozgrzewanie, Dostarczalność,
  Konto→Użytkownicy, Konto→Płatności (komponent `ComingSoon`).

## Backlog (do zrobienia, 1:1 ze screenami) — szczegóły w UX_PLAN.md
1. ✅ **Prospects (Odbiorcy) 1:1 — ZROBIONE.** `frontend/src/components/prospects.tsx`
   (`ProspectsTab`): pasek statusów (Wszyscy/Bez kontaktu/Skontaktowani/Otwarcia/
   Kliknięcia/Odpowiedzi/Zainteresowani/Spotkania/Zamknięci/Poza biurem) jako
   klikane filtry, kolumna **Outcome** (dropdown: interested/meeting_booked/
   closed_won/not_interested/out_of_office), **Tagi** (inline add/remove),
   per-prospect statystyki (wysłane/otwarcia/kliknięcia), Last activity, toolbar
   masowy (taguj, outcome, pauza/wznów, usuń, eksport CSV) + search. Backend:
   migracja `0014` (`campaign_enrollments.outcome` + `tags`), `EnrollmentRead`
   wzbogacony (sent/opened/clicked/last_activity_at), `PATCH .../enrollments/{id}`,
   `POST .../enrollments/bulk`, `CampaignStats.funnel` (ProspectFunnel).
   TODO dalej: weryfikacja maila (ikona), reply tracking realny (IMAP).
2. ✅ **Email Accounts / Dostarczalność 1:1 — ZROBIONE.** `/deliverability`:
   tabela skrzynek (Nadawca, **Setup Score** ring 0-100, badge'e DNS SPF/DKIM/
   DMARC/MX, **Warm-up Status** klikalny pill, edytowalny dzienny limit, tagi,
   usuń) + formularz „Dodaj skrzynkę" + karta globalnego transportu SMTP. Backend:
   model `EmailAccount` (migracja `0016`), CRUD `/email-accounts`, endpoint
   `/email-accounts/{id}/setup` (Setup Score = DoH SPF/DKIM/DMARC/MX + SMTP host
   + from_name). TODO dalej: rotacja nadawców (account_id na Message), realny
   warmup (Mailreach/Instantly), Deliverability % per skrzynka (bounce/spam).
3. ✅ **Domeny: score ring — ZROBIONE.** Kołowy wskaźnik zdrowia (%) per domena
   w `/domains` (spójny ze ScoreRing w Dostarczalności).
4. **Konto:** Użytkownicy+role (model org/zespół), Płatności (Stripe, plany, limity).
5. ✅ **Settings sekwencji 1:1 — ZROBIONE (sekcje Saleshandy).** `SettingsPanel`
   w `campaigns/[id]/page.tsx`: sekcje Ogólne / Konto wysyłkowe / Harmonogram /
   Priorytet wysyłki / Bezpieczeństwo i śledzenie (toggle'e) / Cc&Bcc / Wartość
   deala / Wypis. Migracja `0015` (campaigns: stop_on_reply, track_clicks,
   text_only, same_thread, cc, bcc, sending_priority, deal_value). Funkcjonalnie
   wpięte już: **Cc/Bcc** i **text_only** (w `email_sender._send_via_smtp`).
   TODO (persist jest, działanie później): stop_on_reply (po IMAP reply tracking),
   track_clicks (po przepisywaniu linków), same_thread (nagłówki References),
   sending_priority (kolejność w workerze), ESP Matching, Email Verification.
6. ✅ **Sequence Score realny — ZROBIONE.** `compute_sequence_score` (9
   czynników) + `GET /campaigns/{id}/score`; klikalny badge → panel z rozbiciem.
   ✅ **Subsequence — ZROBIONE (definicje + UI 1:1).** Zakładka „Subsequence"
   (`frontend/src/components/subsequence.tsx`): reguły „po kroku N, jeśli
   [otworzył/kliknął/odpowiedział/neg.] → [stop/ustaw outcome/dodaj tag]". Model
   `SequenceBranch` (migr. `0017`), CRUD `/campaigns/{id}/branches`. TODO:
   wykonywanie reguł w workerze (dziś wysyłka liniowa) — wymaga rozszerzenia
   `email_sender._process_one` o ewaluację warunków po wysyłce kroku.
7. **Reply tracking (IMAP)** → stop-on-reply + kolumna Replied. **Click tracking.**
8. ⏳ **Listy — CZĘŚCIOWO.** `/lists` przebudowane na siatkę kart + modal
   „Dodaj prospektów" z zakładkami **Import CSV** (realnie: tworzy listę i
   importuje plik jednym flow) / **Pusta lista** / **Integracje** (kafelki
   LinkedIn/Sales Navigator/Recruiter/Reakcje/HubSpot/Salesforce = „wkrótce",
   CSV = aktywne). `frontend/src/components/contacts.tsx` (ListsPanel +
   AddProspectsModal). TODO: zakładka „Z sygnałów" (audience builder → zapis
   nowej listy) — wymaga uogólnienia `audience/preview` na zapis listy (backend).
9. **Rozgrzewanie:** integracja z Mailreach/Instantly; multi-mailbox.

## Sprzątanie (TODO)
- `frontend/src/app/(app)/campaigns/[id]/page.tsx`: zostały NIEUŻYWANE stare
  komponenty (`StepCardCompact`, `AddStepButton`, `StepEditor`, `VariantsSection`)
  i stany `selectedStepId`/`selectedStep` — można usunąć (teraz tylko warningi).

## Mapa kodu (skrót)
- Backend routery: `backend/app/api/v1/` (auth, campaigns, campaign_groups, icp,
  email, domains, track, ops, signals, signal_sources, lists, leads, crm, dashboard).
- Serwisy: `backend/app/services/` (campaigns, email_sender, icp, signals, domain_health,
  tracking, auth, ...). Modele: `backend/app/models/`. Schematy: `backend/app/schemas/`.
- Frontend strony: `frontend/src/app/(app)/` (start, icp, signal-sources, signals,
  companies, people, lists, campaigns, campaigns/[id], groups, domains, warmup,
  deliverability, account/users, account/billing, integrations, dashboard).
- Klient API: `frontend/src/lib/api-client.ts`. Sidebar: `frontend/src/app/(app)/layout.tsx`.
