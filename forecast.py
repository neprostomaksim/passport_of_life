"""
forecast.py — программный расчёт транзитов на годы прогноза.

Транзиты детерминированы (та же астрономия). ИИ их НЕ выдумывает —
он только описывает уже вычисленные транзиты человеческим языком.
"""
from __future__ import annotations
from kerykeion import AstrologicalSubject, SynastryAspects

ASPECT_RU = {"conjunction":"соединение","opposition":"оппозиция","trine":"тригон",
    "square":"квадратура","sextile":"секстиль"}
PLANET_RU = {"Sun":"Солнце","Moon":"Луна","Mercury":"Меркурий","Venus":"Венера",
    "Mars":"Марс","Jupiter":"Юпитер","Saturn":"Сатурн","Uranus":"Уран",
    "Neptune":"Нептун","Pluto":"Плутон"}
SIGN_RU = {"Ari":"Овен","Tau":"Телец","Gem":"Близнецы","Can":"Рак","Leo":"Лев",
    "Vir":"Дева","Lib":"Весы","Sco":"Скорпион","Sag":"Стрелец","Cap":"Козерог",
    "Aqu":"Водолей","Pis":"Рыбы"}
SLOW = {"Jupiter","Saturn","Uranus","Neptune","Pluto"}  # планеты, задающие год
MAJOR = {"conjunction","opposition","trine","square","sextile"}

def transits_for_year(natal: AstrologicalSubject, year: int, max_orb: float = 2.5) -> list[dict]:
    """Сильнейшие транзиты медленных планет к наталу на середину года."""
    transit = AstrologicalSubject(name=f"T{year}", year=year, month=7, day=1,
        hour=12, minute=0, lng=natal.lng, lat=natal.lat,
        tz_str=natal.tz_str, city=natal.city, online=False)
    syn = SynastryAspects(transit, natal)
    out = []
    for a in syn.relevant_aspects:
        if a.p1_name not in SLOW or a.aspect not in MAJOR: continue
        if abs(a.orbit) > max_orb: continue
        tp, np_ = PLANET_RU.get(a.p1_name), PLANET_RU.get(a.p2_name)
        if not tp or not np_: continue
        out.append({
            "transit_planet": tp, "natal_planet": np_,
            "aspect": ASPECT_RU.get(a.aspect, a.aspect),
            "orb": round(abs(a.orbit), 2),
            "label": f"Транзитный {tp} — {ASPECT_RU.get(a.aspect,a.aspect)} к натальному {np_}",
        })
    out.sort(key=lambda x: x["orb"])
    return out[:5]

if __name__ == "__main__":
    import json
    natal = AstrologicalSubject(name="Максим", year=1997,month=10,day=9,hour=10,minute=30,
        lng=31.0167,lat=52.4345,tz_str="Europe/Minsk",city="G",online=False)
    for y in (2026, 2027, 2028):
        print(f"\n=== {y} ===")
        for t in transits_for_year(natal, y):
            print(f"  {t['label']}  (орб {t['orb']})")
