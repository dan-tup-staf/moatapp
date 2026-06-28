# MOATION — backlog deweloperski (do zbudowania przez Claude)

> To jest pamięć między sesjami. Claude w nowym oknie **nie pamięta** poprzednich
> rozmów — jedyne co przetrwa to pliki w repo. Ten plik = lista rzeczy do
> zbudowania. Zadania wymagające pracy/decyzji **użytkownika** (klucze API itp.)
> są w `TODO_USER.md`. Czytaj też `HANDOFF.md` i `UX_PLAN.md`.

Status: 🔜 do zrobienia · 🏗️ w toku · ✅ zrobione

---

## Integracje wzbogacania danych (enrichment) — 🏗️ szkielet GOTOWY, czeka na klucze
Cel: prawdziwe e-maile/telefony do firm i osób znalezionych filtrami (jak Lusha).
Trzy dostawcy, użytkownik **dostarczy klucze API później**:
1. **Apollo.io** — people/company search + email enrichment.
2. **Lusha** — contact enrichment (email/phone) po nazwisku+firmie / LinkedIn.
3. **Prospeo** — email finder (domena+imię/nazwisko, LinkedIn URL → email).

✅ Zrobione (szkielet):
- Model `EnrichmentIntegration` (klucz szyfrowany Fernet) + migracja 0032.
- API `/enrichment`: providers/connect/patch/disconnect/test.
- Service `app/services/enrichment.py` — katalog dostawców + connect/get_api_key;
  `enrich_contact()` to STUB rzucający `EnrichmentNotReady`.
- Front: strona `/enrichment` („Wzbogacanie danych”, nav w Pozyskiwaniu) — karty
  3 dostawców, podłączanie klucza, status, maskowanie klucza.

🔜 Do dokończenia (gdy będą klucze):
- [ ] Implementacja realnych wywołań HTTP per-dostawca w `enrich_contact()`.
- [ ] Akcja „Wzbogać” na liście obserwowanej / w wynikach wyszukiwarki prospektów
      (uzupełnia email/telefon; osoby z mailem → ładowalne jako leady).
- [ ] Fallback (Prospeo → Apollo → Lusha) + licznik kredytów.
> Klucze: patrz `TODO_USER.md`.

## Landing page MOATION + freemium signup — 🔜
- [ ] Publiczna strona `/` (dla niezalogowanych): hero, value prop, sekcje funkcji
      (sygnały, sekwencje, listy obserwowane, deliverability), social proof, FAQ,
      CTA „Załóż konto za darmo”.
- [ ] Flow freemium: rejestracja → automatycznie plan **Free** → onboarding (/start).
- [ ] Spójny branding z appką (MOATION). RWD, szybkie ładowanie.

## Płatności (Stripe) — 🏗️ szkielet, czeka na klucze
- [ ] Plany: **Free / Pro / Scale** (limity: leady, wysyłki/dzień, AI, miejsca,
      źródła sygnałów, wzbogacenia). Definicje planów w kodzie (jedno źródło prawdy).
- [ ] Stripe Checkout (subskrypcja) + Customer Portal (zmiana karty, faktury).
- [ ] Webhook Stripe → aktualizacja `User.plan` / statusu subskrypcji.
- [ ] Egzekwowanie limitów planu w backendzie (np. limit leadów/wysyłek).
> Klucze Stripe: patrz `TODO_USER.md`. Bez nich billing = tryb podglądu.

## Tryb nocny + język EN — 🏗️ infrastruktura gotowa, rollout per-ekran
Zrobione: przełączniki w górnym pasku (PL/EN + jasny/nocny), zapis w
localStorage, `PreferencesProvider`, `darkMode:"class"`, `useT()` + słownik
(`src/lib/i18n.ts`). Powłoka (sidebar, topbar, nav) i landing mają `dark:` + EN nav.
Do zrobienia progresywnie (duże, mechaniczne):
- [ ] Dodać `dark:` warianty na WSZYSTKICH ekranach (karty bg-white→dark, teksty,
      bordery) — sekcja po sekcji.
- [ ] Przetłumaczyć treść ekranów na EN (rozszerzać słownik + owijać stringi `t()`).
> Status: powłoka działa, treść ekranów dochodzi etapami.

## „Cel sekwencji” + CRM (Livespace/HubSpot/Pipedrive/Salesforce) — 🏗️ ZBUDOWANE (scaffold)
✅ Zrobione:
- Integracje CRM: model `CrmIntegration` (klucz szyfr.) + migracja 0033 + API
  `/crm-integrations` + sekcja na stronie Integracje (4 dostawcy: Livespace,
  HubSpot, Pipedrive, Salesforce; connect klucz+domena).
- Cel sekwencji: pola na `Campaign` (goal_type, goal_crm_action,
  goal_crm_provider, goal_task_note, goal_deal_value) + kafel „Cel sekwencji”
  na końcu kroków w detalu sekwencji (trigger + akcja CRM contact/task/deal).
- Wykonanie: `services/sequence_goal.execute_goal` → `crm_integrations.push`
  (na razie przez generyczny webhook event `crm_<action>`). Auto-trigger gdy
  outcome = meeting_booked/closed_won; + ręczny endpoint
  `POST /campaigns/{id}/enrollments/{eid}/reach-goal`.

🔜 Do dokończenia (gdy będą klucze API CRM):
- [ ] Realne wywołania API per-dostawca w `crm_integrations.push` (dziś webhook).
- [ ] Triggery zewnętrzne: Calendly webhook, Google Meet/Calendar, formularz Demo.
- [ ] Przycisk „Cel osiągnięty” w tabeli prospektów (dziś: zmiana outcome auto-pala).

## (poprzednia notatka projektowa) „Cel sekwencji” — domknięcie lejka do CRM
Spinamy sekwencję klamrą: **ostatni etap każdej sekwencji = „Cel sekwencji”**
(konwersja). Gdy cel zostanie osiągnięty, lead trafia do CRM jako jedno z (user
wybiera): **Kontakt**, **Zadanie dla handlowca**, albo **Szansa sprzedaży (deal)**.

Cel ma **typ/trigger** (co liczy się jako konwersja), np.:
- „Umówienie spotkania w **Calendly**” (webhook Calendly: invitee.created).
- „Potwierdzenie spotkania w **Google Meet/Calendar**” (event potwierdzony).
- „Przesłanie **formularza kontaktowego** ze strony na Demo produktowe”
  (hostowany formularz / embed → webhook do nas).
- (oraz proste: odpowiedź pozytywna / ręczne oznaczenie outcome = converted).

Każdy z tych triggerów → akcja w CRM: dodaj **kontakt** / **zadanie** / **deal**.

Do zbudowania:
- [ ] Pole celu na kampanii: `goal_type` (trigger) + `crm_action`
      (contact|task|deal) + `crm_target` (na razie generyczny webhook; natywne
      CRM = osobny temat) + opcje (np. nazwa zadania, wartość deala).
- [ ] UI w detalu sekwencji: stały „kafel” Cel sekwencji na końcu kroków
      (wygląd jak etap), z konfiguracją triggera i akcji CRM.
- [ ] Detekcja triggerów:
      - Calendly: endpoint webhooka + podpięcie konta (klucz/sygnatura).
      - Google Meet/Calendar: potwierdzenie eventu (OAuth Google — patrz decyzje).
      - Formularz Demo: hostowany formularz MOATION lub embed + webhook.
- [ ] Wykonanie akcji CRM przy osiągnięciu celu (reuse `services/webhooks.py`
      `fire(...)` z eventem `goal_reached`, payload contact/task/deal),
      aktualizacja enrollment.outcome → converted.
> Zależności/decyzje: docelowy CRM (HubSpot/Pipedrive/Salesforce natywnie vs
> webhook), OAuth Google, klucz Calendly — dopisać do `TODO_USER.md` gdy ruszymy.
> Dziś działa już generyczny webhook (lead_replied/outcome_changed) — to baza.

## Panel użytkownika (realny, nie placeholder) — 🔜
- [ ] **Profil**: zmiana imienia, e-maila, hasła; avatar (opcjonalnie).
- [ ] **Konto/plan**: aktualny plan, zużycie vs limity, upgrade/downgrade.
- [ ] **Płatności**: karta, historia faktur (przez Stripe Portal).
- [ ] **Użytkownicy i dostępy** (`/account/users`): zespół/role (jeśli plan zespołowy).
- [ ] Zastąpić `ComingSoon` na `/account/billing` i `/account/users` realnym UI.

---

## Zrobione ostatnio (kontekst)
- ✅ Listy obserwowane (CSV/manual/LinkedIn link/wyszukiwarka) + podpięcie do źródeł.
- ✅ Wyszukiwarka prospektów w stylu Lusha (builder kryteriów) na Firmy/Osoby/Listy.
- ✅ Paginacja /people (Osoby ładują się przy tysiącach leadów).
- ✅ Tolerancyjny import CSV (Apollo/Lusha nagłówki, BOM, średnik, batch).
- ✅ Zapis sekwencji jako szablon; fix wysyłki testowej (creds skrzynki).
