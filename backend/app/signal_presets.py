"""Curated catalog of Polish-enterprise buying-signal source templates.

These encode domain knowledge about the Polish B2B intent ecosystem: the
registry layer (KRS / RDF / MSiG / Rejestr Zastawów), the regulatory wave
(KSeF, NIS2/UKSC, DORA, AI Act, CSRD), supervisory decisions (KNF / UODO /
NIK), funding (VC rounds, NCBR/PARP grants), patents (UPRP/EPO), C-suite
hiring and foreign expansion.

Each preset is a ready-to-create SignalSource: a `type` (scraper channel) plus
a `config` carrying the tailored search query. The user picks the ones relevant
to their motion and activates them in one click — the normal worker then runs
them like any other source.

Most presets use the `serp` / `google_news` / `linkedin` web_search channels
because the underlying registers (prs.ms.gov.pl, rejestr-zastawow.ms.gov.pl,
BIP-y stref, KNF/UODO) block direct scraping but are reliably reachable through
Claude's server-side web_search.
"""

from typing import Any

# category -> human label (for grouping in the UI)
PRESET_CATEGORIES: dict[str, str] = {
    "registry": "Rejestry (KRS / RDF / MSiG / Zastawy)",
    "market": "Giełda (ESPI / EBI / ESEF)",
    "regulation": "Regulacje (KSeF / NIS2 / DORA / AI Act / CSRD)",
    "supervision": "Nadzór (KNF / UODO / NIK)",
    "funding": "Finansowanie (VC / NCBR / PARP)",
    "leadership": "C-suite i rekrutacja GTM",
    "expansion": "Ekspansja zagraniczna (DACH / UK / US)",
    "patents": "Patenty (UPRP / EPO)",
}


def _preset(
    key: str,
    category: str,
    name: str,
    type_: str,
    query: str,
    score_weight: int,
    description: str,
    max_results: int = 15,
) -> dict[str, Any]:
    return {
        "key": key,
        "category": category,
        "name": name,
        "type": type_,
        "score_weight": score_weight,
        "description": description,
        "config": {"query": query, "max_results": max_results},
    }


PRESETS: list[dict[str, Any]] = [
    # ---------- Rejestry ----------
    _preset(
        "krs_board_change",
        "registry",
        "KRS — zmiana zarządu / prokury",
        "serp",
        'Portal Rejestrów Sądowych KRS nowy członek zarządu OR prokurent OR CFO OR COO "Head of Sales"',
        40,
        "Wpis nowej osoby w zarządzie/prokurze (prs.ms.gov.pl) — nowy budżet i "
        "nowy stack. Pojawia się 30-90 dni od decyzji wewnętrznej.",
    ),
    _preset(
        "rdf_financials",
        "registry",
        "RDF — sprawozdania finansowe (capex / przychód r/r)",
        "serp",
        "Repozytorium Dokumentów Finansowych RDF sprawozdanie finansowe wzrost przychodu capex inwestycje",
        25,
        "RDF jest darmowy i publiczny (XML). Wzrost capex 30%+ to sygnał "
        "ekspansji ~12 mies. przed raportami branżowymi.",
    ),
    _preset(
        "rejestr_zastawow",
        "registry",
        "Rejestr Zastawów — finansowanie dłużne",
        "serp",
        "rejestr-zastawow.ms.gov.pl zastaw rejestrowy zorganizowana część przedsiębiorstwa maszyny linia produkcyjna",
        35,
        "Wpis zastawu = właśnie wpłynęło finansowanie dłużne (lease / kredyt / "
        "mezzanine). Inwestycje pójdą za nim w ciągu 6 miesięcy.",
    ),
    _preset(
        "msig_mna",
        "registry",
        "MSiG — połączenia / podziały / przekształcenia",
        "serp",
        "Monitor Sądowy i Gospodarczy MSiG obwieszczenie połączenie podział przekształcenie spółki",
        35,
        "Pre-RFP signal w okresie integracji. Polski mid-market konsoliduje IT "
        "6-18 mies. po fuzji.",
    ),
    _preset(
        "sse_capex",
        "registry",
        "SSE — zezwolenia i capex (ERP/MES/WMS)",
        "serp",
        "specjalna strefa ekonomiczna zezwolenie nowa inwestycja budowa hali Katowicka Wałbrzyska Mielecka BIP",
        30,
        "Pozwolenie SSE / budowa hali = 12-miesięczne okno na wymianę ERP, MES "
        "lub WMS.",
    ),
    # ---------- Giełda ----------
    _preset(
        "espi_ebi_current",
        "market",
        "ESPI / EBI — raporty bieżące (zarząd, M&A, umowy)",
        "google_news",
        "raport bieżący ESPI EBI zmiana zarządu znacząca umowa przejęcie GPW NewConnect",
        35,
        "Funkcjonalny odpowiednik SEC 8-K. Reposted przez Bankier/Stooq/Strefę "
        "Inwestorów w ~minutę. Otwiera/zamyka okno zakupowe w dniach.",
    ),
    _preset(
        "esef_annual",
        "market",
        "ESEF / CSRD — sprawozdania roczne (XBRL)",
        "google_news",
        "sprawozdanie roczne ESEF XBRL CSRD ESG raport zrównoważony rozwój GPW",
        20,
        "Odpowiednik SEC 10-K. Zmiany capex i segmentacji przychodów; od 2025 "
        "rozszerzone o ujawnienia ESG (CSRD).",
    ),
    # ---------- Regulacje ----------
    _preset(
        "ksef",
        "regulation",
        "KSeF — e-fakturowanie (wymiana/rozbudowa ERP)",
        "google_news",
        "KSeF wdrożenie e-faktura ERP Comarch Asseco SAP Symfonia enova365 termin 2026",
        30,
        "Terminy: 1.02.2026 (>200 mln zł), 1.04.2026 (pozostali VAT). Szczyt "
        "zakupów XII.2025-III.2026: wymiana ERP, konsulting wdrożeniowy, audyt JPK.",
    ),
    _preset(
        "nis2_uksc",
        "regulation",
        "UKSC / NIS2 — cyberbezpieczeństwo",
        "google_news",
        "UKSC NIS2 audyt zgodności SZBI ISO 27001 SOC SIEM wykaz KSC podmiot kluczowy",
        35,
        "Wejście 3.04.2026; samorejestracja do 3.10.2026. Sygnały: audyt luk, "
        "wdrożenie SZBI, SOC/SIEM (Splunk/Sentinel/QRadar), TPRM. Okno <90 dni.",
    ),
    _preset(
        "dora",
        "regulation",
        "DORA — ICT risk (sektor finansowy)",
        "google_news",
        "DORA ICT risk management bank fintech ubezpieczyciel KNF rozporządzenie",
        25,
        "Stosowana od 17.01.2025. KNF jako organ; zarządzanie ryzykiem ICT dla "
        "banków, fintechów i ubezpieczycieli.",
    ),
    _preset(
        "ai_act",
        "regulation",
        "AI Act — zgodność systemów AI",
        "google_news",
        "AI Act zgodność system wysokiego ryzyka GPAI nadzór sztuczna inteligencja Polska",
        20,
        "Większość wymogów od 2.08.2026; high-risk (zał. III) od 2.08.2027. "
        "Polski organ nadzoru — projekt ustawy ~04.2026.",
    ),
    _preset(
        "csrd_whistleblowing",
        "regulation",
        "CSRD i sygnaliści — narzędzia compliance",
        "google_news",
        "CSRD raportowanie ESG ustawa o sygnalistach kanał zgłoszeń Sygnanet EQS Navex",
        18,
        "CSRD: raport za 2025 w 2026. Sygnaliści (Dz.U. 2024 poz. 928) — "
        "obowiązek kanałów dla pracodawców 50+.",
    ),
    # ---------- Nadzór ----------
    _preset(
        "knf_uodo_nik",
        "supervision",
        "Decyzje KNF / UODO / NIK",
        "google_news",
        "decyzja KNF kara UODO wystąpienie pokontrolne NIK spółka skarbu państwa",
        30,
        "Decyzje KNF → AML/cybersec vendors. Decyzje UODO → privacy-tech / DPO. "
        "Wystąpienia NIK (Orlen/PGE/KGHM) → konsulting i wymiana systemu FK.",
    ),
    # ---------- Finansowanie ----------
    _preset(
        "vc_round",
        "funding",
        "Runda VC ≥10 mln zł (PL)",
        "funding",
        "runda finansowania Series A B C polski startup mln zł inwestycja VC 2025 2026",
        40,
        "Okno od „sfinansowane” do pierwszego RFP na narzędzia sprzedażowe: "
        "60-120 dni. Łapane w dniu publikacji (mamstartup.pl, Puls Biznesu, ESPI).",
    ),
    _preset(
        "ncbr_parp_grants",
        "funding",
        "Granty NCBR / PARP (R&D → GTM)",
        "serp",
        "lista beneficjentów NCBR Szybka Ścieżka Bridge Alfa PARP SMART grant komercjalizacja",
        30,
        "Producent po grancie NCBR komercjalizuje 18-24 mies. po zgłoszeniu; "
        "fala rekrutacji GTM rusza pół roku wcześniej.",
    ),
    # ---------- C-suite ----------
    _preset(
        "csuite_ai_platform",
        "leadership",
        "Nowe role C-suite (Head of AI / FinOps / Platform)",
        "linkedin",
        '"Head of AI" OR "Chief AI Officer" OR "Head of Platform Engineering" OR "Head of FinOps" nowa rola Polska',
        35,
        "Każda nowa funkcja C-suite kupuje 3-7 narzędzi w pierwsze 90 dni. "
        "Banki i enterprise PL powołują Head of AI od 2024-2025.",
    ),
    _preset(
        "gtm_hiring_wave",
        "leadership",
        "Fala rekrutacji GTM (BDR / AE / Country Manager)",
        "linkedin",
        '"Account Executive" OR "BDR" OR "Country Manager" OR "Head of Sales" rekrutacja Polska startup scale-up',
        25,
        "Fala rekrutacji GTM w 90 dni po rundzie VC — sygnał budowy outboundu od "
        "zera i nadchodzącego RFP.",
    ),
    _preset(
        "cybersec_roles",
        "leadership",
        "Nowe role CISO / DPO",
        "linkedin",
        '"CISO" OR "Data Protection Officer" OR "DPO" OR "Inspektor Ochrony Danych" nowa rola Polska',
        25,
        "Nowa rola CISO/DPO w odpowiedzi na NIS2/UODO — okno zakupowe na "
        "narzędzia bezpieczeństwa i compliance.",
    ),
    # ---------- Ekspansja ----------
    _preset(
        "expansion_dach_uk_us",
        "expansion",
        "Ekspansja DACH / UK / US (DD, GmbH/Ltd, Country Manager)",
        "google_news",
        "polski software house ekspansja DACH UK US rejestracja GmbH Ltd due diligence Country Manager",
        35,
        "ESPI o DD zagranicznej spółki, rejestracja niemieckiej GmbH / UK Ltd, "
        "ogłoszenie Country Managera — sygnał na 6 miesięcy do przodu.",
    ),
    # ---------- Patenty ----------
    _preset(
        "patents_uprp_epo",
        "patents",
        "Zgłoszenia patentowe UPRP / EPO",
        "serp",
        "zgłoszenie patentowe UPRP EPO polski producent nowa klasa komercjalizacja",
        20,
        "Zgłoszenie w nowej klasie = komercjalizacja 18-24 mies. później; fala "
        "rekrutacji GTM rusza pół roku wcześniej.",
    ),
]


def list_presets() -> list[dict[str, Any]]:
    return PRESETS


def get_preset(key: str) -> dict[str, Any] | None:
    return next((p for p in PRESETS if p["key"] == key), None)
