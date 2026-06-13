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
PLANET_THEMES = {
    "Юпитер": {
        "theme": "Год расширения возможностей, социального признания и роста.",
        "career": "Благоприятное время для расширения деятельности, новых должностей или начала обучения.",
        "love": "Период эмоциональной открытости. Благоприятно для укрепления союза или новых знакомств.",
        "health": "Энергетический подъем, однако важно избегать переедания и контролировать нагрузки.",
        "advice": "Будьте открыты новым возможностям, но не берите на себя слишком много обязательств."
    },
    "Сатурн": {
        "theme": "Год структурирования жизни, ответственности и проверки планов на прочность.",
        "career": "Период дисциплины и упорного труда. Хорошее время для наведения порядка в делах.",
        "love": "Время проверки отношений на зрелость. Благоприятно для осознанных совместных решений.",
        "health": "Рекомендуется уделить внимание костной системе, суставам и избегать переутомления.",
        "advice": "Наведите порядок в текущих делах, действуйте планомерно и без спешки."
    },
    "Уран": {
        "theme": "Год неожиданных перемен, стремления к личной свободе и обновлению.",
        "career": "Возможна смена направления, внедрение инноваций или переход к большей независимости в работе.",
        "love": "Период турбулентности. Возможна жажда свободы или неожиданные яркие увлечения.",
        "health": "Повышенная нервная возбудимость. Рекомендуется ограничить гаджеты и нормализовать сон.",
        "advice": "Не бойтесь пробовать новые подходы, но сохраняйте связь с реальностью."
    },
    "Нептун": {
        "theme": "Год усиления интуиции, творческого вдохновения и глубоких внутренних поисков.",
        "career": "Благоприятный период для творческой работы и психологии. В коммерции важна бдительность.",
        "love": "Время романтического вдохновения. Остерегайтесь избыточной идеализации партнера.",
        "health": "Повышенная чувствительность организма. Полезны водные процедуры, йога и медитация.",
        "advice": "Доверяйте внутреннему голосу и развивайте творческие таланты."
    },
    "Плутон": {
        "theme": "Год глубокой внутренней трансформации, переоценки ценностей и раскрытия силы.",
        "career": "Период перераспределения сил, закрытия старых проектов и реструктуризации дел.",
        "love": "Глубокие эмоциональные переживания. Время освобождения от изживших себя связей.",
        "health": "Хороший период для очищения организма, избавления от вредных привычек и регенерации.",
        "advice": "Освобождайтесь от старого и ненужного, расчищая место для новых начинаний."
    }
}

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

    yearly_forecast = {}
    for y in (2026, 2027, 2028):
        y_transits = transits_for_year(data.subject, y)
        
        theme = "Год стабилизации и накопления внутренних ресурсов."
        career_desc = "Спокойное развитие текущих проектов, хорошее время для укрепления профессионального фундамента."
        love_desc = "Период эмоционального равновесия и укрепления близких связей."
        health_desc = "Состояние здоровья стабильное, рекомендуется поддерживать баланс активности и отдыха."
        advice = "Сохраняйте верность своим долгосрочным целям и действуйте планомерно."
        best_months = ["Март", "Октябрь"]
        challenging_months = ["Январь", "Июнь"]
        
        if y_transits:
            prim = y_transits[0]
            p_name = prim["transit_planet"]
            aspect = prim["aspect"]
            
            if p_name in PLANET_THEMES:
                theme = f"Транзит {p_name} — {PLANET_THEMES[p_name]['theme']}"
                career_desc = PLANET_THEMES[p_name]["career"]
                love_desc = PLANET_THEMES[p_name]["love"]
                health_desc = PLANET_THEMES[p_name]["health"]
                advice = PLANET_THEMES[p_name]["advice"]
                
                if aspect in ("квадратура", "оппозиция"):
                    best_months = ["Май", "Ноябрь"]
                    challenging_months = ["Февраль", "Август"]
                else:
                    best_months = ["Апрель", "Сентябрь"]
                    challenging_months = ["Июль", "Декабрь"]
                    
        yearly_forecast[str(y)] = {
            "theme": theme,
            "career": {"description": career_desc, "best_months": best_months, "challenging_months": challenging_months},
            "personal_life": {"description": love_desc, "best_months": best_months, "challenging_months": challenging_months},
            "health": {"description": health_desc, "best_months": best_months, "challenging_months": challenging_months},
            "advice": advice
        }

    return {
        "life_mission": mission,
        "strengths": ["Самобытность","Глубина","Воля","Интуиция","Устойчивость"],
        "challenges": ["Зоны роста по напряжённым аспектам","Баланс","Границы"],
        "aspect_interpretations": aspect_interp,
        "life_periods": {k:{"score":7,"periods":cycles(base)}
                         for k in ("career","love","finance","health","spirituality")},
        "yearly_forecast": yearly_forecast,
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
