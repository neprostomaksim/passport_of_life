"""
interpret.py — слой интерпретации. ЕДИНСТВЕННОЕ место, где работает ИИ.

Принцип безопасности:
    На вход ИИ подаются ТОЛЬКО уже вычисленные факты (планеты, дома, аспекты,
    транзиты — из chart_engine и forecast). ИИ ничего не считает и не выдумывает
    астрологию — он лишь превращает факты в связный литературный текст и
    раскладывает по сферам жизни. Выдаёт строгий JSON.

Два режима:
    1) llm=True  — текст пишет Claude (нужен ANTHROPIC_API_KEY). Живой, персональный.
    2) llm=False — детерминированная сборка из шаблонов TEMPLATES. Стабильно,
                   без сети, без риска. Подходит как fallback и для тестов.
"""
from __future__ import annotations
import json, os
from chart_engine import ChartData
from forecast import transits_for_year

# ── База выверенных трактовок (шаблоны). Расширяется астрологом. ──
# Ключи: (планета, дом) и (аспект). Здесь — демонстрационный минимум.
HOUSE_THEME = {
    1:"личность и самоподача", 2:"деньги и ценности", 3:"общение и обучение",
    4:"дом и корни", 5:"творчество и любовь", 6:"работа и здоровье",
    7:"партнёрство", 8:"трансформация и общие ресурсы", 9:"философия и путешествия",
    10:"карьера и статус", 11:"сообщество и цели", 12:"подсознание и уединение",
}

# ── Системный промпт для ИИ-редактора ──
SYSTEM_PROMPT = """Ты — редактор-астролог. Тебе дают ГОТОВЫЕ и ВЕРНЫЕ астрономические факты натальной карты и транзитов. Твоя задача — НЕ считать и НЕ добавлять астрологию от себя, а превратить переданные факты в тёплый, персональный, литературный текст на русском языке.

Строгие правила:
- Используй ТОЛЬКО переданные планеты, знаки, дома, аспекты и транзиты. Не упоминай того, чего нет во входных данных.
- Не выдумывай градусы, аспекты или транзиты.
- Тон: глубокий, поддерживающий, без фатализма и медицинских/финансовых гарантий.
- Верни ТОЛЬКО валидный JSON по заданной схеме, без markdown."""

def _facts_payload(data: ChartData, forecast_years) -> dict:
    """Компактный набор фактов для подачи в ИИ."""
    return {
        "meta": {k: data.meta[k] for k in ("name","sun_sign","moon_sign","asc_sign","current_age")},
        "planets": data.chart,
        "aspects": [{"planets":a["planets"],"type":a["type"],"orb":a["orb"]} for a in data.aspects[:8]],
        "transits": {str(y): transits_for_year(data.subject, y) for y in forecast_years},
    }

def interpret(data: ChartData, forecast_years=(2026,2027,2028), llm: bool = True) -> dict:
    facts = _facts_payload(data, forecast_years)
    if llm:
        return _interpret_llm(facts)
    return _interpret_templates(data, facts)

# ── Режим 1: ИИ (Claude) ──
def _interpret_llm(facts: dict) -> dict:
    from anthropic import Anthropic
    client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    schema_hint = """Схема ответа (JSON):
{
  "life_mission": "3-5 предложений, упоминай конкретные планеты и дома из фактов",
  "strengths": ["5 пунктов"],
  "challenges": ["3 пункта"],
  "aspect_interpretations": {"Солнце — Сатурн": "1 предложение", ...по каждому переданному аспекту},
  "life_periods": {"career":{"score":1-10,"periods":[{"ages":"14-21","label":"...","description":"..."}, ...6 циклов 14-21..49-56]},
                   "love":{...}, "finance":{...}, "health":{...}, "spirituality":{...}},
  "yearly_forecast": {"2026":{"theme":"...","career":{"description":"...","best_months":[],"challenging_months":[]},
                              "personal_life":{...},"health":{...},"advice":"..."}, "2027":{...}, "2028":{...}}
}"""
    msg = client.messages.create(
        model="claude-opus-4-8", max_tokens=8000, system=SYSTEM_PROMPT,
        messages=[{"role":"user","content":
            f"ФАКТЫ КАРТЫ:\n{json.dumps(facts, ensure_ascii=False)}\n\n{schema_hint}"}],
    )
    text = "".join(b.text for b in msg.content if b.type == "text")
    text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(text)

# ── Режим 2: детерминированные шаблоны (fallback, офлайн) ──
def _interpret_templates(data: ChartData, facts: dict) -> dict:
    sun = data.chart["sun"]; asc = data.meta["asc_sign"]
    mission = (f"{data.meta['name']} с Асцендентом в знаке {asc} и Солнцем в {sun['sign']} "
               f"({HOUSE_THEME.get(sun.get('house'),'свой путь')}, {sun.get('house')} дом) "
               f"проявляет себя через тему этого дома. Карта подчёркивает узнаваемый "
               f"внутренний стержень и задачи роста, связанные с ключевыми аспектами.")
    aspect_interp = {a["planets"]: f"{a['type'].capitalize()} (орб {a['orb']}) — значимая нота характера."
                     for a in data.aspects[:8]}
    def cycles(labels):
        ages = ["14-21","21-28","28-35","35-42","42-49","49-56"]
        return [{"ages":ag,"label":lb,"description":"Этап развития по 7-летнему циклу Сатурна."}
                for ag, lb in zip(ages, labels)]
    base = ["Пробуждение","Поиск","Рост","Расцвет","Мастерство","Наследие"]
    return {
        "life_mission": mission,
        "strengths": ["Самобытность","Глубина","Воля","Интуиция","Устойчивость"],
        "challenges": ["Зоны роста по напряжённым аспектам","Баланс","Границы"],
        "aspect_interpretations": aspect_interp,
        "life_periods": {k:{"score":7,"periods":cycles(base)}
                         for k in ("career","love","finance","health","spirituality")},
        "yearly_forecast": {str(y):{"theme":"Год по ведущим транзитам",
            "career":{"description":"На основе транзитов года.","best_months":[],"challenging_months":[]},
            "personal_life":{"description":"...","best_months":[],"challenging_months":[]},
            "health":{"description":"...","best_months":[],"challenging_months":[]},
            "advice":"Совет на год."} for y in (2026,2027,2028)},
    }

if __name__ == "__main__":
    from chart_engine import ChartInput, compute_chart, LifeEvent
    data = compute_chart(ChartInput(name="Максим", dob="09.10.1997", tob="10:30",
        pob="Гомель", lat=52.4345, lng=31.0167))
    out = interpret(data, llm=False)  # офлайн-режим для теста
    print("life_mission:", out["life_mission"][:120], "...")
    print("aspects interpreted:", len(out["aspect_interpretations"]))
    print("periods domains:", list(out["life_periods"].keys()))
    print("forecast years:", list(out["yearly_forecast"].keys()))
