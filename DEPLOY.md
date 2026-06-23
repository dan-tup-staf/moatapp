# Wdrożenie za darmo (Render + Neon)

Apka działa w przeglądarce na darmowych planach: **frontend + API na Render**,
**baza Postgres na Neon** (darmowy Postgres na Render kasuje się po ~30 dniach,
Neon nie — dlatego baza jest osobno).

Do działającego demo **nie potrzeba Redis ani workera** — sygnały odświeżasz
przyciskiem „Uruchom teraz", a maile kampanii przez „send-due-now".

## 1. Baza danych — Neon (2 min)

1. Wejdź na https://neon.tech → załóż darmowe konto → **Create project**.
2. Skopiuj **connection string** (wygląda tak:
   `postgresql://user:haslo@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`).
   Zostaw go na boku — wkleisz w kroku 2.

> Connection string z Neona wklejasz **dosłownie** — apka sama go znormalizuje
> pod asyncpg (zamiana schematu, obsługa SSL).

## 2. API + frontend — Render Blueprint (5 min)

1. Wejdź na https://render.com → załóż konto, podłącz GitHub.
2. **New → Blueprint** → wybierz repo `moatapp` i branch z plikiem `render.yaml`.
3. Render wykryje 2 usługi (`moation-api`, `moation-web`) i zapyta o sekrety:
   - **DATABASE_URL** → wklej connection string z Neona.
   - **ANTHROPIC_API_KEY** → klucz Anthropic (opcjonalny — patrz niżej).
4. **Apply / Deploy**. Pierwszy build to kilka minut (Docker + `npm build`).
   Migracje bazy (`alembic upgrade head`) odpalają się automatycznie przy starcie API.

Frontend sam podepnie się pod adres API (`NEXT_PUBLIC_API_URL` z `render.yaml`).

Po deployu otwórz adres usługi **moation-web**
(`https://moation-web.onrender.com`), zarejestruj konto i korzystaj.

> Darmowe usługi Render **usypiają po 15 min** bezczynności — pierwsze wejście
> po przerwie budzi je ~1 min (potem działa normalnie).

## 3. Funkcje AI (opcjonalnie)

ICP, „Wygeneruj plan sygnałów" oraz kanały **web_search** (LinkedIn / Google
News / X / SERP / funding / company_site) wymagają klucza Anthropic API.

- Klucz zdobędziesz na https://console.anthropic.com (osobny produkt od
  subskrypcji claude.ai — subskrypcji **nie da się** użyć jako API).
- Koszt testów jest minimalny: research/scraping używa modelu **Haiku**.
- Bez klucza apka działa — UI, presety, formularze, kanały **pracuj.pl** i
  **RSS**. Funkcje AI pokażą błąd zamiast wyników, dopóki klucza nie dodasz.

Klucz dodajesz/zmieniasz w Render → usługa `moation-api` → **Environment** →
`ANTHROPIC_API_KEY` → Save (usługa się przebuduje).

## Zmienne środowiskowe (API)

| Zmienna | Wymagana | Opis |
|---|---|---|
| `DATABASE_URL` | tak | Connection string Postgresa (Neon) |
| `JWT_SECRET` | tak | Generowany automatycznie przez Render |
| `CORS_ALLOW_ALL` | — | `true` w demo (frontend na innym originie) |
| `ANTHROPIC_API_KEY` | nie | Klucz dla funkcji AI |
| `ANTHROPIC_BASE_URL` | nie | Nadpisanie endpointu (gateway zgodny z Anthropic) |
