"""
api.py — HTTP-эндпоинт для Antigravity / прода.

Принимает JSON с формы лендинга, возвращает готовый JSON для HTML-шаблона.
Запуск:  uvicorn api:app --reload
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
from chart_engine import ChartInput, LifeEvent
from build_passport import build_passport

app = FastAPI(title="Паспорт жизни — движок карты")

class EventIn(BaseModel):
    date: str
    label: str

class FormIn(BaseModel):
    name: str
    dob: str                      # "ДД.ММ.ГГГГ"
    pob: str
    tob: Optional[str] = None     # "ЧЧ:ММ"
    time_unknown: bool = False
    email: Optional[str] = None
    events: list[EventIn] = []
    # координаты опционально (если геокодинг на фронте)
    lat: Optional[float] = None
    lng: Optional[float] = None
    use_ai: bool = True

@app.post("/api/passport")
def make_passport(form: FormIn):
    try:
        inp = ChartInput(
            name=form.name, dob=form.dob, pob=form.pob, tob=form.tob,
            time_unknown=form.time_unknown, email=form.email,
            lat=form.lat, lng=form.lng,
            events=[LifeEvent(e.date, e.label) for e in form.events],
        )
        return build_passport(inp, use_ai=form.use_ai)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
