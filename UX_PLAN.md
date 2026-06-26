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

## Otwarte pytania do ustalenia później
- Z jakim CRM integrujemy w pierwszej kolejności?
- Progi tieringu: automatyczne (po score) czy ręcznie definiowane przez usera?
- Czy „Zacznij tu" znika po ukończeniu, czy zostaje jako zakładka?
