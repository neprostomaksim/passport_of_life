"""
chart_engine.py — детерминированный расчёт натальной карты для «Паспорта жизни».

Принимает данные формы и возвращает проверенный JSON в формате HTML-шаблона.
Все астрономические расчёты программные (Swiss Ephemeris через kerykeion).
ИИ в расчётах не участвует — только на этапе интерпретации (interpret.py).

Зависимости: pip install kerykeion timezonefinder geopy
"""
from __future__ import annotations
import datetime as _dt
from dataclasses import dataclass, field
from typing import Optional
from kerykeion import AstrologicalSubject, NatalAspects
from timezonefinder import TimezoneFinder

SIGN_RU = {"Ari":"Овен","Tau":"Телец","Gem":"Близнецы","Can":"Рак","Leo":"Лев",
    "Vir":"Дева","Lib":"Весы","Sco":"Скорпион","Sag":"Стрелец","Cap":"Козерог",
    "Aqu":"Водолей","Pis":"Рыбы"}
PLANET_RU = {"Sun":"Солнце","Moon":"Луна","Mercury":"Меркурий","Venus":"Венера",
    "Mars":"Марс","Jupiter":"Юпитер","Saturn":"Сатурн","Uranus":"Уран",
    "Neptune":"Нептун","Pluto":"Плутон","True_North_Lunar_Node":"Сев. Узел",
    "Mean_North_Lunar_Node":"Сев. Узел","Chiron":"Хирон","Ascendant":"Асцендент",
    "Medium_Coeli":"Середина неба"}
PLANET_KEY = {"Sun":"sun","Moon":"moon","Mercury":"mercury","Venus":"venus",
    "Mars":"mars","Jupiter":"jupiter","Saturn":"saturn","Uranus":"uranus",
    "Neptune":"neptune","Pluto":"pluto","True_North_Lunar_Node":"north_node",
    "Mean_North_Lunar_Node":"north_node","Chiron":"chiron"}
HOUSE_NUM = {"First_House":1,"Second_House":2,"Third_House":3,"Fourth_House":4,
    "Fifth_House":5,"Sixth_House":6,"Seventh_House":7,"Eighth_House":8,
    "Ninth_House":9,"Tenth_House":10,"Eleventh_House":11,"Twelfth_House":12}
ASPECT_RU = {"conjunction":"СОЕДИНЕНИЕ","opposition":"ОППОЗИЦИЯ","trine":"ТРИГОН",
    "square":"КВАДРАТУРА","sextile":"СЕКСТИЛЬ"}
MAJOR_ASPECTS = ["conjunction","opposition","trine","square","sextile"]

@dataclass
class LifeEvent:
    date: str
    label: str

@dataclass
class ChartInput:
    name: str
    dob: str
    pob: str
    tob: Optional[str] = None
    time_unknown: bool = False
    events: list = field(default_factory=list)
    email: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    tz_str: Optional[str] = None

_tf = TimezoneFinder()

def resolve_location(pob, lat=None, lng=None, tz_str=None):
    if lat is None or lng is None:
        from geopy.geocoders import Nominatim
        geocoder = Nominatim(user_agent="life-passport")
        loc = geocoder.geocode(pob, language="ru")
        if loc is None:
            raise ValueError(f"Не удалось определить координаты места: {pob!r}")
        lat, lng = loc.latitude, loc.longitude
    if tz_str is None:
        tz_str = _tf.timezone_at(lat=lat, lng=lng)
        if tz_str is None:
            raise ValueError(f"Не удалось определить часовой пояс для {lat},{lng}")
    return float(lat), float(lng), tz_str

def _fmt_degree(position):
    deg = int(position); minutes = int(round((position-deg)*60))
    if minutes == 60: deg += 1; minutes = 0
    return f"{deg:02d}°{minutes:02d}'"

def _parse_dmy(s):
    return _dt.datetime.strptime(s.strip(), "%d.%m.%Y").date()

def _planet_dict(p):
    out = {"sign": SIGN_RU.get(p["sign"], p["sign"]), "degree": _fmt_degree(p["position"])}
    house = HOUSE_NUM.get(p.get("house",""))
    if house is not None: out["house"] = house
    return out

@dataclass
class ChartData:
    meta: dict
    chart: dict
    aspects: list
    key_events: list
    subject: object

def compute_chart(inp: ChartInput) -> ChartData:
    d = _parse_dmy(inp.dob)
    if inp.time_unknown or not inp.tob:
        hour, minute, time_known = 12, 0, False
    else:
        hour, minute = map(int, inp.tob.split(":")); time_known = True
    lat, lng, tz_str = resolve_location(inp.pob, inp.lat, inp.lng, inp.tz_str)
    subj = AstrologicalSubject(name=inp.name, year=d.year, month=d.month, day=d.day,
        hour=hour, minute=minute, lng=lng, lat=lat, tz_str=tz_str, city=inp.pob, online=False)

    chart = {}
    bodies = [subj.sun, subj.moon, subj.mercury, subj.venus, subj.mars,
              subj.jupiter, subj.saturn, subj.uranus, subj.neptune, subj.pluto]
    for attr in ("true_north_lunar_node","chiron"):
        if hasattr(subj, attr): bodies.append(getattr(subj, attr))
    for p in bodies:
        key = PLANET_KEY.get(p["name"])
        if key: chart[key] = _planet_dict(p)
    chart["ascendant"] = {"sign": SIGN_RU[subj.first_house["sign"]], "degree": _fmt_degree(subj.first_house["position"])}
    chart["mc"] = {"sign": SIGN_RU[subj.tenth_house["sign"]], "degree": _fmt_degree(subj.tenth_house["position"])}

    natal = NatalAspects(subj)
    aspects = []
    for a in natal.relevant_aspects:
        if a.aspect not in MAJOR_ASPECTS: continue
        p1, p2 = PLANET_RU.get(a.p1_name), PLANET_RU.get(a.p2_name)
        if not p1 or not p2: continue
        aspects.append({"p1":p1,"p2":p2,"planets":f"{p1} — {p2}",
            "type":ASPECT_RU.get(a.aspect,a.aspect.upper()),"aspect_key":a.aspect,
            "orb":_fmt_degree(abs(a.orbit)),"orb_value":round(abs(a.orbit),2)})
    aspects.sort(key=lambda x: x["orb_value"])

    key_events = []
    phases = ["◑","◕","●","◔","○"]
    for i, ev in enumerate(inp.events):
        if not ev.date or not ev.label: continue
        try: ed = _parse_dmy(ev.date)
        except ValueError: continue
        key_events.append({"phase":phases[i%len(phases)],"year":str(ed.year),"event":ev.label,"date":ev.date})

    birth_year = d.year
    meta = {"name":inp.name,"dob":d.strftime("%d.%m.%Y"),"tob":inp.tob or "—","pob":inp.pob,
        "lat":round(lat,4),"lng":round(lng,4),"tz_str":tz_str,"utc":subj.iso_formatted_utc_datetime,
        "time_known":time_known,"asc_sign":chart["ascendant"]["sign"],"sun_sign":chart["sun"]["sign"],
        "moon_sign":chart["moon"]["sign"],"birth_year":birth_year,
        "current_age":_dt.date.today().year-birth_year,"rectification_done":False}
    return ChartData(meta=meta, chart=chart, aspects=aspects, key_events=key_events, subject=subj)

if __name__ == "__main__":
    import json
    demo = ChartInput(name="Максим", dob="09.10.1997", tob="10:30", pob="Гомель, Беларусь",
        lat=52.4345, lng=31.0167,
        events=[LifeEvent("01.09.2015","Поступление в университет"),
                LifeEvent("15.06.2019","Первые серьёзные отношения"),
                LifeEvent("10.03.2022","Переезд в другой город")])
    data = compute_chart(demo)
    print(json.dumps({"meta":data.meta,"chart":data.chart,"aspects":data.aspects[:6],
        "key_events":data.key_events}, ensure_ascii=False, indent=2))
