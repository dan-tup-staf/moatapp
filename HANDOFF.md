# MOATION — kontekst do kontynuacji (handoff)

Czytaj to na start w nowym oknie. Plus `UX_PLAN.md` (pełny backlog/specyfikacja).

## Czym jest MOATION
B2B SaaS do outreachu opartego o sygnały zakupowe (intent data). Stack:
- **Backend:** FastAPI (Python), SQLAlchemy async, Alembic. Folder `backend/`.
- **Frontend:** Next.js 15 (App Router, TS, Tailwind). Folder `frontend/`.
- **Baza:** Postgres na **Neon**. **Hosting:** **Render** (2 usługi).
- **AI:** Google **Gemini** (darmowy, `GEMINI_API_KEY`) z grounding; warstwa
  `backend/app/llm.py` (Gemini albo Anthropic — pierwszy skonfigurowany wygrywa).

## ⚠️ Workflow gita/deployu (KLUCZOWE)
- Pracujemy na branchu **`claude/awesome-babbage-hjyva9`**, ALE **Render buduje
  `main`**. Dlatego **po KAŻDEJ zmianie: commit → merge --ff-only do `main` →
  push `main` i push brancha**. Inaczej user nie zobaczy zmian.
- Render: **`moation-api`** (backend) i **`moation-web`** (frontend). Deploy
  `moation-api` odpala `alembic upgrade head` (migracje w `backend/alembic/versions/`).
- Po zmianach user robi „Deploy latest commit" (lub ma Auto-Deploy: Yes).
- Migracje są addytywne (0008–0013). Najnowsza migracja: `0013`.

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
1. **Prospects (Odbiorcy) 1:1:** pasek statusów (Total→Not Contacted→Contacted→
   Opened→Replied→Interested→Meeting→Closed→Out of Office), kolumny Outcome
   (dropdown), Tags, Last activity, toolbar masowy.
2. **Email Accounts / Dostarczalność 1:1:** tabela skrzynek (Setup Score, Inbox
   Score, Warm-up Status, Deliverability %, SPF/DKIM/DMARC/PTR), rotacja nadawców.
3. **Domeny:** dopieszczenie wizualne (score ring, kolory).
4. **Konto:** Użytkownicy+role (model org/zespół), Płatności (Stripe, plany, limity).
5. **Settings sekwencji (pozostałe zakładki):** ESP Matching, Sending Schedule UI,
   Sending Priority, Deal Value, Email Verification, Cc/Bcc, prawdziwy Unsubscribe.
6. **Subsequence** (rozgałęzienia warunkowe), **Sequence Score** realny scoring.
7. **Reply tracking (IMAP)** → stop-on-reply + kolumna Replied. **Click tracking.**
8. **Listy z filtrów** (audience builder → zapis listy) + **import CSV** +
   **integracje** (LinkedIn/HubSpot jak na screenie; CSV realnie, reszta coming soon).
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
