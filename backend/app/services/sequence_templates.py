"""Built-in sequence templates — ready-to-use multi-step sequences a user can
apply with one click. Polish B2B context, merge tags included.

Each template is a dict: id, name, description, category, steps[].
Each step: subject, body_template, delay_days, channel.
"""

TEMPLATES: list[dict] = [
    {
        "id": "cold_3touch",
        "name": "Cold outreach 3-touch (PL)",
        "description": "Klasyczna sekwencja na zimno: zaczepienie, dowód wartości, "
        "delikatny follow-up. 3 maile w 7 dni.",
        "category": "Cold outreach",
        "steps": [
            {
                "subject": "Szybkie pytanie, {{first_name}}",
                "body_template": (
                    "Cześć {{first_name}},\n\n"
                    "piszę, bo {{company}} działa w obszarze, w którym często "
                    "pomagamy ograniczyć {{firma_branza}} koszty i czas.\n\n"
                    "Czy warto, żebym pokazał w 10 minut jak to robimy u podobnych "
                    "firm?\n\nPozdrawiam"
                ),
                "delay_days": 0,
                "channel": "email",
            },
            {
                "subject": "Re: Szybkie pytanie, {{first_name}}",
                "body_template": (
                    "Dorzucam konkret, {{first_name}} — firmy wielkości {{company}} "
                    "zwykle zyskują na tym, że automatyzują powtarzalne kroki.\n\n"
                    "Mam 2-3 pomysły akurat dla Was. Złapiemy 15 minut w tym tygodniu?"
                ),
                "delay_days": 3,
                "channel": "email",
            },
            {
                "subject": "Domykam temat, {{first_name}}",
                "body_template": (
                    "Nie chcę zasypywać skrzynki — to mój ostatni mail w tym wątku.\n\n"
                    "Jeśli temat jest nietrafiony, daj znać, a odpuszczę. Jeśli "
                    "ciekawi — odpowiedz „ok”, podeślę szczegóły.\n\nDzięki!"
                ),
                "delay_days": 4,
                "channel": "email",
            },
        ],
    },
    {
        "id": "hr_hiring_signal",
        "name": "Rekrutacja / HR — sygnał z oferty pracy",
        "description": "Pod sygnał „firma rekrutuje”. Nawiązanie do otwartej "
        "rekrutacji + propozycja wsparcia. 2 maile + zadanie LinkedIn.",
        "category": "Sygnał zakupowy",
        "steps": [
            {
                "subject": "Rekrutujecie w {{company}}?",
                "body_template": (
                    "Cześć {{first_name}},\n\n"
                    "zauważyłem, że {{company}} prowadzi rekrutacje — u firm z "
                    "{{firma_rekrutacje}} procesami rocznie często pomagamy skrócić "
                    "czas zatrudnienia.\n\nWarto pogadać 10 minut?"
                ),
                "delay_days": 0,
                "channel": "email",
            },
            {
                "subject": "Zaproszenie na LinkedIn",
                "body_template": (
                    "Wyślij zaproszenie do {{first_name}} z notką: „Cześć, widzę "
                    "że rekrutujecie w {{company}} — chętnie podzielę się jak "
                    "przyspieszyć proces.”"
                ),
                "delay_days": 2,
                "channel": "linkedin_invite",
            },
            {
                "subject": "Re: Rekrutujecie w {{company}}?",
                "body_template": (
                    "{{first_name}}, podsyłam krótki case z firmy o podobnej skali. "
                    "Jeśli pasuje, umówmy 15 minut — pokażę jak to wygląda u Was."
                ),
                "delay_days": 3,
                "channel": "email",
            },
        ],
    },
    {
        "id": "event_followup",
        "name": "Follow-up po evencie / webinarze",
        "description": "Dla leadów z konferencji lub webinaru: nawiązanie do "
        "spotkania + CTA na rozmowę. 2 maile.",
        "category": "Follow-up",
        "steps": [
            {
                "subject": "Miło było, {{first_name}}!",
                "body_template": (
                    "Cześć {{first_name}},\n\n"
                    "dzięki za rozmowę / obecność. Obiecałem wrócić z konkretem — "
                    "oto jak pomagamy firmom takim jak {{company}}.\n\n"
                    "Znajdziemy 15 minut na krótkie demo?"
                ),
                "delay_days": 1,
                "channel": "email",
            },
            {
                "subject": "Re: Miło było, {{first_name}}!",
                "body_template": (
                    "Wracam, żeby temat nie umarł 🙂 Mam wolne sloty w tym "
                    "tygodniu — odpowiedz, który dzień Ci pasuje, a podeślę link."
                ),
                "delay_days": 3,
                "channel": "email",
            },
        ],
    },
    {
        "id": "reengage",
        "name": "Re-engagement (uśpione leady)",
        "description": "Odgrzanie kontaktów, które kiedyś nie odpisały. "
        "Lekki, „break-up” ton. 2 maile.",
        "category": "Re-engagement",
        "steps": [
            {
                "subject": "Wciąż aktualne, {{first_name}}?",
                "body_template": (
                    "Cześć {{first_name}},\n\n"
                    "rozmawialiśmy jakiś czas temu i temat ucichł. Czy "
                    "{{firma_branza}} priorytety w {{company}} zmieniły się na tyle, "
                    "że warto wrócić?\n\nJedno zdanie odpowiedzi w zupełności "
                    "wystarczy."
                ),
                "delay_days": 0,
                "channel": "email",
            },
            {
                "subject": "Zamykam temat?",
                "body_template": (
                    "Jeśli nie teraz — bez problemu, dam spokój. Napisz tylko „nie "
                    "teraz”, a odezwę się za kwartał. Jeśli jednak warto — "
                    "odpowiedz „ok”."
                ),
                "delay_days": 4,
                "channel": "email",
            },
        ],
    },
]


def list_templates() -> list[dict]:
    """Templates without full step bodies — for the picker list."""
    out = []
    for t in TEMPLATES:
        channels = sorted({s["channel"] for s in t["steps"]})
        out.append(
            {
                "id": t["id"],
                "name": t["name"],
                "description": t["description"],
                "category": t["category"],
                "steps_count": len(t["steps"]),
                "channels": channels,
            }
        )
    return out


def get_template(template_id: str) -> dict | None:
    for t in TEMPLATES:
        if t["id"] == template_id:
            return t
    return None
