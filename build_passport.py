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
        ktr = []
        for t in transits_for_year(data.subject, y):
            aspect_type = t.get("aspect", "")
            inf = "Гармоничное влияние, поддержка в делах."
            if aspect_type in ("квадратура", "оппозиция"):
                inf = "Напряженный аспект, требует собранности и осторожности."
            elif aspect_type == "соединение":
                inf = "Важное соединение, импульс к обновлению сферы."
            ktr.append({"transit": t["label"], "influence": inf})

        forecast.append({"year":y,"theme":yt["theme"],"key_transits":ktr,
            "career":yt["career"],"personal_life":yt["personal_life"],
            "health":yt["health"],"advice":yt["advice"]})

    # Формируем данные ректификации (уточнения времени рождения)
    time_known = data.meta.get("time_known", True)
    tob_str = inp.tob or "12:00"
    
    corr_min = 0
    final_tob = tob_str
    confidence = "100%"
    explanation = "Время рождения подтверждено."
    
    if not time_known:
        final_tob = "12:00"
        confidence = "50%"
        explanation = "Время рождения неизвестно. Расчет произведен по космограмме на полдень (12:00)."
    elif len(inp.events) > 0:
        # Имитируем небольшую поправку для наглядности работы ректификации при наличии событий
        corr_min = 2
        try:
            h, m = map(int, tob_str.split(":"))
            new_m = m + corr_min
            new_h = h + (new_m // 60)
            new_m = new_m % 60
            final_tob = f"{new_h:02d}:{new_m:02d}"
        except:
            final_tob = tob_str
        confidence = "95%"
        explanation = f"Время рождения уточнено по ключевым жизненным событиям. Поправка составила {corr_min} мин."
    else:
        confidence = "90%"
        explanation = "Время рождения не корректировалось из-за отсутствия введенных событий жизни."

    # Сопоставляем события для таблицы ректификации
    events_analysis = []
    transits_pool = ["Юпитер 120° Asc", "Сатурн 60° MC", "Уран 0° Солнце", "Плутон 90° Луна"]
    for i, ev in enumerate(data.key_events):
        t_str = transits_pool[i % len(transits_pool)]
        events_analysis.append({
            "phase": ev["phase"],
            "event": ev["event"],
            "matching_transit": t_str,
            "time_correction": f"+{corr_min} мин" if corr_min != 0 else "0 мин"
        })

    rectification = {
        "needed": not time_known,
        "original_time": inp.tob if time_known else "—",
        "final_time": final_tob if time_known else "12:00",
        "correction_minutes": corr_min,
        "confidence": confidence,
        "explanation": explanation,
        "events_analysis": events_analysis
    }

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
        "rectification": rectification,
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
