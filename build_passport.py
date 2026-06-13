"""
build_passport.py — оркестратор. Главная функция для Antigravity.

    данные формы → build_passport() → готовый JSON (формат HTML-шаблона)

Соединяет: chart_engine (факты) + forecast (транзиты) + interpret (тексты).
"""
from __future__ import annotations
from chart_engine import ChartInput, LifeEvent, compute_chart
from forecast import transits_for_year
from interpret import interpret

# Иконки сфер для шаблона
DOMAIN_ICON = {"career":"◈","love":"♥","finance":"◆","health":"✿","spirituality":"★"}

def build_passport(inp: ChartInput, use_ai: bool = True) -> dict:
    """ChartInput → финальный JSON, готовый к подстановке в HTML-шаблон (DATA)."""
    data = compute_chart(inp)
    texts = interpret(data, llm=use_ai)

    # tz-нота с честным DST (смещение места рождения берём из pytz на дату)
    import datetime as _dt, pytz as _pytz
    _d = _dt.datetime.strptime(data.meta["dob"], "%d.%m.%Y")
    _off = _pytz.timezone(data.meta["tz_str"]).utcoffset(_d)
    _h = int(_off.total_seconds() // 3600)
    tz_note = (f"{data.meta['tz_str']} (UTC{_h:+d} на дату рождения, "
               f"DST учтён автоматически)")

    # аспекты: факт (движок) + трактовка (interpret)
    aspects = []
    for a in data.aspects[:6]:
        aspects.append({"planets":a["planets"],"type":a["type"],"orb":a["orb"],
            "interpretation": texts["aspect_interpretations"].get(a["planets"], "")})

    # периоды: добавляем иконки
    periods = {}
    for k, v in texts["life_periods"].items():
        periods[k] = {"score":v["score"],"icon":DOMAIN_ICON.get(k,"◈"),"periods":v["periods"]}

    # прогноз: транзиты (факт) + тексты (ИИ)
    forecast = []
    for y in (2026, 2027, 2028):
        yt = texts["yearly_forecast"][str(y)]
        ktr = [{"transit":t["label"],"influence":""} for t in transits_for_year(data.subject, y)]
        forecast.append({"year":y,"theme":yt["theme"],"key_transits":ktr,
            "career":yt["career"],"personal_life":yt["personal_life"],
            "health":yt["health"],"advice":yt["advice"]})

    return {
        "meta": {**{k:data.meta[k] for k in
            ("name","dob","tob","pob","asc_sign","sun_sign","moon_sign","rectification_done")},
            "timezone_note": tz_note},
        "chart": data.chart,
        "key_aspects": aspects,
        "life_mission": texts["life_mission"],
        "strengths": texts["strengths"],
        "challenges": texts["challenges"],
        "life_periods": periods,
        "key_events": data.key_events,
        "yearly_forecast_next3": forecast,
    }

if __name__ == "__main__":
    import json
    inp = ChartInput(name="Максим", dob="09.10.1997", tob="10:30", pob="Гомель, Беларусь",
        lat=52.4345, lng=31.0167,
        events=[LifeEvent("01.09.2015","Поступление в университет"),
                LifeEvent("15.06.2019","Отношения"),
                LifeEvent("10.03.2022","Переезд")])
    result = build_passport(inp, use_ai=False)  # офлайн-тест
    print(json.dumps(result, ensure_ascii=False, indent=2)[:1500])
    print("\n...\nКлючи верхнего уровня:", list(result.keys()))
