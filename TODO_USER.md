# MOATION — zadania wymagające Twojej pracy (Daniel)

> Lista rzeczy, których **nie da się dokończyć po stronie kodu** — wymagają
> Twoich kluczy, kont, danych logowania albo decyzji. Zaktualizowane przez
> asystenta; będę o nich przypominał.

Legenda: 🔴 blokuje realne działanie · 🟡 opcjonalne / poprawia jakość · ⚪ decyzja

---

## 🔴 Render — zmienne środowiskowe (usługa `moation-api`)

1. **`TRACKING_BASE_URL`** = publiczny URL API (np. `https://moation-api.onrender.com`)
   - Bez tego **nie działają linki śledzenia otwarć/kliknięć ani unsubscribe**
     (są generowane tylko gdy ustawione).
2. **`CRON_SECRET`** = dowolny sekret + ustaw zewnętrzny cron (np. cron-job.org)
   na `POST {API}/api/v1/tick?secret=<TWÓJ_SEKRET>` co kilka minut.
   - Bez tego wysyłka leci tylko gdy serwis nie śpi (darmowy Render usypia po
     ~15 min bezczynności). Cron gwarantuje rytm wysyłki + wykrywanie odpowiedzi.
3. **`GEMINI_API_KEY`** — generowanie Profilu klienta przez AI (masz; potwierdź
   że nadal ważny).
4. **(Migracje)** — przy każdym deployu musi się wykonać `alembic upgrade head`
   (migracje 0014–0027). Sprawdź, że start command / build na Render to robi.

## 🟡 Render — opcjonalne klucze

5. **`BRAVE_API_KEY`** (https://brave.com/search/api/, darmowe 2000/mies.) **lub**
   **`SERPAPI_KEY`** (https://serpapi.com) — pewniejsze wyszukiwanie sygnałów niż
   darmowy DuckDuckGo. Bez nich sygnały i tak działają (DDG + Google News RSS).

---

## 🔴 W aplikacji — podłączenia (robisz w UI)

6. **Skrzynka mailowa** → Dostarczalność → „Dodaj skrzynkę":
   - host/port/login + **hasło aplikacji** (Gmail: 2FA + apppasswords; Outlook
     podobnie). Bez tego kampanie nie wyjdą realnie z Twojego adresu.
   - Podaj też **host IMAP** (np. `imap.gmail.com`) — do wykrywania odpowiedzi
     i działania zakładki Skrzynka.
7. **Profil LinkedIn** → zakładka LinkedIn → „Podłącz profil":
   - cookie **`li_at`** + **`JSESSIONID`** z przeglądarki (instrukcja w UI),
     opcjonalnie proxy. Bez tego kroki LinkedIn w sekwencjach nie wyślą się auto.
   - ⚠️ ryzyko ograniczenia konta (ToS LinkedIn) — trzymaj niskie limity.
8. **Webhook CRM** (opcjonalnie) → Integracje → „Webhooki": podaj URL
   (Zapier/Make/n8n/własny) by pushować zdarzenia (odpowiedź/wynik/odbicie).

---

## ⚪ Decyzje do podjęcia

9. **OAuth Google/Microsoft** (logowanie skrzynki jednym kliknięciem zamiast
   hasła aplikacji) — NIE zbudowane. Wymaga rejestracji aplikacji OAuth
   (Google Cloud / Azure) + client id/secret i (dla Google) weryfikacji.
   Powiedz, jeśli chcesz — zbuduję flow, gdy będziesz mieć dane aplikacji.
10. **Płatne API wyszukiwania** vs darmowe — patrz pkt 5.
11. **CRM docelowy** do głębszej integracji (HubSpot/Pipedrive/Salesforce) —
    dziś działa generyczny webhook; natywna integracja = osobny temat.

---

## ℹ️ Działa bez Twojej pracy (dla kontekstu)
Sygnały (DuckDuckGo + Google News RSS), tiering, listy/CSV, sekwencje
(warunkowe, A/B, szablony), tracking, unsubscribe (gdy `TRACKING_BASE_URL`),
bounce handling, reply detection (gdy IMAP), unified inbox, wyniki + CSV,
rotacja skrzynek, warmup, scheduler (gdy nie śpi / cron).
