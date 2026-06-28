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
