# Plan UX — MOATION (do realizacji później)

Cel: lewy panel w stylu lemlist (pogrupowany, spójny flow) + **domyślny ekran
startowy** typu „Get started" (jak zakładka *Resources* w lemlist), który
prowadzi użytkownika krok po kroku aż do wysłania kampanii.

> Status: SPISANE, czeka na realizację. Hasło do startu: „robimy UX".

---

## 1. Lewy panel (sidebar) — pogrupowany flow

Zamiast płaskiej listy — sekcje z nagłówkami (jak lemlist: *Find & Manage /
Engage / Analyze*). Plik do przebudowy: `frontend/src/app/(app)/layout.tsx`.

| Sekcja | Pozycje | Sens |
|---|---|---|
| 🎯 **Strategia** | ICP, Źródła sygnałów | kogo szukamy i jakie sygnały łapiemy |
| 🔍 **Pozyskiwanie** | Sygnały (feed), Firmy, Osoby, Listy | to, co wpada → leady |
| ✉️ **Zaangażowanie** | Kampanie | sekwencje do wybranych leadów |
| 📊 **Analiza** | Dashboard / Raporty | pipeline, wysłane, odpowiedzi |

Detale: nagłówki sekcji, stan aktywny, zwijany panel, ikony.

---

## 2. Domyślny ekran startowy „Zacznij tu" (jak *Resources* w lemlist)

Ekran-checklist z paskiem postępu („X z N kroków ukończone"). Każdy krok:
status (zrobione/do zrobienia), opis, przycisk-CTA prowadzący do właściwego
miejsca. To ma być **domyślny widok po zalogowaniu**, dopóki onboarding nie jest
ukończony.

Kroki do wysłania kampanii:

1. **Określ ICP** — automatycznie po wpisaniu strony www klienta (patrz §3).
2. **Podział firm na Tier 1 / 2 / 3 / niekwalifikowane** (patrz §4).
3. **Wybór sygnałów** — aktywacja źródeł (presety / pracuj.pl / RSS / web).
4. **Ustawienie kampanii** — sekwencja kroków + treści.
5. **Integracja z CRM** (opcjonalna).

---

## 3. Auto-ICP z adresu www (przez Gemini AI)

Użytkownik wkleja URL strony klienta → ICP generuje się automatycznie.

**Stan: ~80% gotowe w backendzie.** Istnieje pełny przepływ:
- `POST /api/v1/icp/analyze-url` → `research_company_with_llm(url)` —
  research firmy z web search (teraz na **Gemini**, grounding Google Search)
  → `scraped_summary` + sugerowane pytania.
- `POST /api/v1/icp/synthesize` → ustrukturyzowane pola ICP.
- `POST /api/v1/icp/suggest-sources` → propozycje źródeł sygnałów pod ICP.

**Do zrobienia (frontend):** w onboardingu pole „Wklej stronę www klienta" →
wywołanie `analyze-url` → pokazanie wygenerowanego ICP do akceptacji/edycji,
bez ręcznego wypełniania. Reszta pipeline'u (pytania → synteza → źródła) już
jest.

---

## 4. Tiering firm (Tier 1 / 2 / 3 / niekwalifikowane)

**Stan: częściowo jest.** Backend ma scoring i pojęcie tier (np. `tier` w
audience preview i w widoku pipeline). Do zrobienia: ekran/krok klasyfikacji,
który na bazie ICP + score'u dzieli firmy na Tier 1/2/3 i „niekwalifikowane",
oraz reguły progów.

---

## Kolejność realizacji (proponowana)

1. Przebudowa sidebara (§1) — szybkie, czysto frontend.
2. Ekran „Zacznij tu" z checklistą (§2) — szkielet + stany kroków.
3. Wpięcie auto-ICP z URL w onboarding (§3) — backend gotowy, robimy UI.
4. Krok tieringu (§4).
5. Krok integracji z CRM (do ustalenia: jaki CRM).

## Roadmapa Email (wysyłka kampanii)

- **Milestone 1 — realna wysyłka z podłączonej skrzynki (ZROBIONE).**
  - SMTP z autoryzacją + TLS (STARTTLS/implicit), poprawny From = adres
    uwierzytelnionej skrzynki, nagłówek `List-Unsubscribe`.
  - Dzienny limit bezpieczeństwa (`SMTP_DAILY_LIMIT`, domyślnie 50).
  - Konfiguracja przez env na `moation-api` (SMTP_HOST/PORT/USERNAME/PASSWORD/
    STARTTLS/USE_TLS/FROM_EMAIL/FROM_NAME).
  - UI: karta „Skrzynka wysyłkowa (SMTP)" w Integracjach + przycisk „Wyślij
    testowy mail" (`GET /email/status`, `POST /email/test`).
  - ⚠️ Wysyłka leci przez ręczny przycisk „Wyślij należne teraz" — automatyczny
    harmonogram (worker arq + Redis) NIE jest wdrożony na darmowym Renderze.
- **Milestone 1.5 — automatyczny harmonogram:** worker + Redis na Render
  (lub lekki cron w API), żeby sekwencje słały się same.
- **Milestone 2 — deliverability:** prawdziwy unsubscribe (token + strona),
  per-skrzynkowe limity i pauzy, SPF/DKIM/DMARC (poradnik), bounce handling.
- **Milestone 3 — wiele skrzynek + rozgrzewanie:** podłączanie wielu skrzynek
  (OAuth/SMTP), rotacja, ramp wysyłek; rozgrzewanie najpierw przez gotowe API
  (Mailreach/Instantly) zamiast własnej sieci peer-to-peer.
- **Milestone 4 (opcjonalnie) — auto-zakładanie skrzynek/domen:** Google
  Workspace/Microsoft + rejestrator DNS; wymaga stałych kosztów.

## Rozbudowa lewego panelu — Infrastruktura e-mail + Konto (do zrobienia)

Docelowy układ sidebara (dwie nowe grupy):

```
🏠 Zacznij tu
STRATEGIA        · ICP · Źródła sygnałów
POZYSKIWANIE     · Sygnały · Firmy · Osoby · Listy
ZAANGAŻOWANIE    · Kampanie
INFRASTRUKTURA   · Domeny · Rozgrzewanie · Dostarczalność   ← NOWA grupa (pod Kampaniami)
ANALIZA          · Dashboard
─────────────────────────────────────
KONTO            · Użytkownicy i dostępy · Płatności i plan   ← NOWA grupa (sam dół)
🔌 Integracje / CRM
👤 konto · Wyloguj
```

### Grupa „INFRASTRUKTURA" (pod ZAANGAŻOWANIE/Kampanie)

- **Domeny** — podłączanie domeny wysyłkowej i zarządzanie wieloma domenami:
  weryfikacja DNS (SPF/DKIM/DMARC) ze statusem ✓/✗, lista domen, dodawanie/
  usuwanie, przypisanie skrzynek do domen. (łączy się z Milestone 2–3 e-mail).
- **Rozgrzewanie** — panel rozgrzewania skrzynek: status warmupu, ramp wysyłek,
  wynik „reputacji". Start: odesłanie/integracja z gotowym rozgrzewaczem
  (Mailreach/Instantly) zamiast własnej sieci (zgodnie z roadmapą e-mail).
- **Dostarczalność** — zdrowie skrzynek i statystyki: % dostarczeń, bounce
  rate, spam rate, open/reply, placement test (inbox vs spam), per-skrzynka.

> Backend pod to powstaje etapami w roadmapie e-mail (Milestone 1.5–3):
> wiele skrzynek, DNS, warmup, bounce/deliverability.

### Grupa „KONTO" (sam dół panelu) — typowy B2B SaaS

- **Użytkownicy i dostępy** — zapraszanie userów, role/uprawnienia (owner /
  admin / member), zarządzanie dostępem, usuwanie.
- **Płatności i plan** — plan i funkcje (co włączone/wyłączone, feature flags
  per plan), formy płatności (karta), faktury (historia + pobieranie), zużycie
  kredytów/limity (AI, wysyłki), upgrade/downgrade. Integracja billingowa
  (np. Stripe) do ustalenia.

> To wymaga: modeli organizacji/zespołu + ról, modelu subskrypcji/planu,
> integracji płatności, oraz egzekwowania limitów (kredyty AI / wysyłki).
> Duży obszar — robimy etapami, zaczynając od użytkowników i ról.

## Listy — budowanie z filtrów + import (do zrobienia)

W zakładce **Listy** dodać kreator listy z trzech źródeł:

- **Z sekcji Sygnały / Źródła — klikane filtry.** Budowanie listy przez
  klikalne filtry (jak audience builder w kampaniach): wybór źródeł sygnałów,
  fraza w tytule sygnału, tier 1/2/3, min. siła sygnału, zakres dat → podgląd
  pasujących firm/osób → „Zapisz jako listę". (Backend ma już zbliżoną logikę
  w `audience/preview` — do uogólnienia na zapis listy.)
- **Import z CSV.** Wgrywanie pliku CSV z leadami (mapowanie kolumn: email,
  imię, firma, stanowisko…). Endpoint importu już istnieje
  (`/lists/{id}/leads/import`) — dodać UI kreatora i mapowanie.
- **Integracje (jak na screenie Saleshandy).** Lista metod importu: LinkedIn
  Search / Sales Navigator / Recruiter / Event / Post reactors, Import z CSV,
  HubSpot itd. Na start: CSV realnie + reszta jako „coming soon" wpięte w
  istniejący system integracji.

> Zakres: kreator „Nowa lista" z zakładkami [Z sygnałów] [CSV] [Integracje],
> reużywając audience-filtrów i istniejącego importu CSV.

## Kampanie → podsekcja „Sekwencje" (jak Saleshandy) — do zrobienia

Pełny builder sekwencji z górnymi krokami: **Steps · Prospects · Settings ·
Subsequence**, „Sequence Score" i „Start Sequence". Sporo już mamy w
`campaigns/[id]` — poniżej co rozbudować.

### Steps (mamy oś + Day labels; do dodania)
- **Warianty A/B** per krok: „Create variant" (ręcznie) + **„Generate AI
  variant"** (Gemini tworzy alternatywną treść). Rotacja wariantów przy wysyłce.
- **Spintax** `{spin|opcja1|opcja2}` — losowanie fraz w jednym mailu
  (deliverability). Parser przy renderze + podgląd „rozwiniętej" wersji.
- **Statystyki per krok**: Sent / Opened / Replied (mamy sent/failed — dodać
  open/reply tracking: pixel otwarcia + wykrywanie odpowiedzi).
- **Typy kroków z menu „+ Add Step"**: Email (jest), LinkedIn Automation,
  LinkedIn Manual Task, Call, WhatsApp, Task. (LinkedIn/Call/WhatsApp jako
  zadania manualne na start — wysyłkę robi user; mamy już kanały LinkedIn.)
- **„Sending as same thread"** — kolejne kroki w tym samym wątku mailowym
  (In-Reply-To/References headers).

### Prospects
- Lista odbiorców sekwencji — mamy **audience builder** (filtry/tier/źródła).
  Do dopięcia jako osobna zakładka + statusy weryfikacji maila.
- **Pasek statusów (klikane liczniki/filtry)**: Total · Not Contacted ·
  Contacted · Opened · Replied · Clicked · Interested · Meeting Booked ·
  Closed · Out of Office (z kwotami $ przy Interested/Meeting/Closed dzięki
  Deal Value).
- **Kolumny wiersza**: Name + email (z ikoną weryfikacji), Current Step,
  Current step stats (wysłane/otwarte/kliknięte/odpowiedź — ikony), **Outcome**
  (dropdown: Interested / Meeting Booked / Closed / Not interested…), Tags,
  Last activity.
- **Toolbar masowy**: search, filtr, wyślij teraz, taguj, usuń z sekwencji,
  przenieś, blacklist, flaga, pauza/wznów, eksport CSV.
- **Aktywny/Inactive** per prospect + ręczne sterowanie.

### Settings (zakładki — nowe)
- **Email Account** — wybór skrzynki + **rotacja nadawców** (2+ skrzynki =
  rozkładanie wysyłki). Tabela: Sender Email, Tags, Signature (View),
  Active Sequence, Daily Limit (np. 15/15), Setup Score (np. 97/100), Owner.
  Dodawanie kolejnych skrzynek. (Łączy się z sekcją Domeny/Skrzynki.)
- **ESP Matching** — toggle „automatycznie dopasuj ESP nadawcy do ESP
  odbiorcy" + tabela: Microsoft / Google Workspace / Other → konta, limit,
  liczba prospektów.
- **Sending Schedule** — wybór harmonogramu (Default / własny): okna godzinowe,
  dni tygodnia, strefa czasowa (mamy datę startu — dodać harmonogram dzienny).
- **Safety Settings** — toggle'e: „Stop follow-ups gdy przyjdzie odpowiedź",
  „Track email opens", „Track link clicks", „Remove styling automatically",
  „Send emails as text only" (tylko pierwszy mail — recommended). Plus limity
  dzienne/odstępy (mamy dzienny limit).
- **Sending Priority** — Prioritise Follow-Ups / New Prospects / Balanced /
  Aggressive (rozkład wysyłek między krokami).
- **Deal Value** — szacowana wartość deala per prospect → pipeline revenue.
- **Email Verification** — weryfikacja adresów, toggle „wysyłaj do ryzykownych".
- **Cc & Bcc** — stałe Cc/Bcc dla całej sekwencji.
- **Unsubscribe** — tekst vs link, szablony wiadomości, nagłówek List-Unsubscribe
  (mamy nagłówek — dodać UI + stronę wypisu z tokenem).

### Subsequence
- Rozgałęzienia warunkowe (np. „jeśli otworzył → ścieżka A, jeśli nie → B").

### Sequence Score
- Ocena jakości sekwencji (liczba kroków, personalizacja, spam words, długość) —
  mamy Content Guide w planie composer'a; tu agregacja na całą sekwencję.

> Kolejność realizacji: (1) warianty + spintax + open/reply tracking,
> (2) zakładki Settings (Schedule, Priority, Cc/Bcc, Unsubscribe, Verification),
> (3) typy kroków multi-channel, (4) Subsequence, (5) Sequence Score.

## Otwarte pytania do ustalenia później
- Z jakim CRM integrujemy w pierwszej kolejności?
- Progi tieringu: automatyczne (po score) czy ręcznie definiowane przez usera?
- Czy „Zacznij tu" znika po ukończeniu, czy zostaje jako zakładka?
