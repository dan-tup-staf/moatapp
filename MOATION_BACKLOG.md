# MOATION — backlog deweloperski (do zbudowania przez Claude)

> To jest pamięć między sesjami. Claude w nowym oknie **nie pamięta** poprzednich
> rozmów — jedyne co przetrwa to pliki w repo. Ten plik = lista rzeczy do
> zbudowania. Zadania wymagające pracy/decyzji **użytkownika** (klucze API itp.)
> są w `TODO_USER.md`. Czytaj też `HANDOFF.md` i `UX_PLAN.md`.

Status: 🔜 do zrobienia · 🏗️ w toku · ✅ zrobione

---

## Integracje wzbogacania danych (enrichment) — 🏗️ szkielet, czeka na klucze
Cel: prawdziwe e-maile/telefony do firm i osób znalezionych filtrami (jak Lusha).
Trzy dostawcy, użytkownik **dostarczy klucze API później**:
1. **Apollo.io** — people/company search + email enrichment.
2. **Lusha** — contact enrichment (email/phone) po nazwisku+firmie / LinkedIn.
3. **Prospeo** — email finder (domena+imię/nazwisko, LinkedIn URL → email).

Zakres do zbudowania:
- [ ] Klucze API w ustawieniach (per-user, szyfrowane jak SMTP/cookies LinkedIn).
- [ ] Warstwa `app/services/enrichment/` z jednym interfejsem + 3 adaptery.
- [ ] „Wzbogać” na liście obserwowanej / w wynikach wyszukiwarki prospektów:
      uzupełnia email/telefon i (dla osób z mailem) pozwala załadować jako leady.
- [ ] Wybór dostawcy + fallback (np. Prospeo → Apollo → Lusha) i licznik kredytów.
- [ ] Gating: bez klucza pokazujemy CTA „podłącz dostawcę”, nie wywalamy błędu.
> Klucze: patrz `TODO_USER.md`. Bez nich integracje są nieaktywne (placeholder).

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
