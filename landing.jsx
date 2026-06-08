const { useState: useStateL, useEffect: useEffectL, useRef: useRefL } = React;

/* ════════════════════════════════════════════════════════════
   HEADER
   ════════════════════════════════════════════════════════════ */
function Header({ onCta }) {
  const [open, setOpen] = useStateL(false);
  const links = [
    ['Что внутри', '#discover'],
    ['Как работает', '#how'],
    ['Отзывы', '#reviews'],
    ['Вопросы', '#faq'],
  ];
  return (
    <header className="sticky top-0 z-50 border-b border-white/[.06] bg-[#0C0820]/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 sm:px-8 h-[68px]">
        <a href="#top" className="font-serif text-[22px] sm:text-[24px] gold-text tracking-tight">Паспорт&nbsp;жизни</a>
        <nav className="hidden md:flex items-center gap-9">
          {links.map(([t, h]) => (
            <a key={h} href={h} className="font-sans text-[14px] text-lavmut hover:text-lav transition-colors">{t}</a>
          ))}
        </nav>
        <div className="hidden md:block">
          <button onClick={onCta} className="font-sans text-[14px] font-semibold text-gold hover:text-goldlt transition-colors flex items-center gap-1.5">
            Создать <Icon name="arrow-right" className="text-[15px]" />
          </button>
        </div>
        <button className="md:hidden text-lav text-[24px] p-1" onClick={() => setOpen(o => !o)} aria-label="Меню">
          <Icon name={open ? 'x' : 'menu'} />
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-white/[.06] bg-[#0C0820]/95 px-5 py-4 fade-up">
          <div className="flex flex-col gap-1">
            {links.map(([t, h]) => (
              <a key={h} href={h} onClick={() => setOpen(false)} className="py-2.5 font-sans text-[15px] text-lavmut hover:text-lav">{t}</a>
            ))}
            <button onClick={() => { setOpen(false); onCta(); }} className="mt-2 gold-btn rounded-full py-3 font-sans font-semibold text-[#2A1C05]">Создать Паспорт</button>
          </div>
        </div>
      )}
    </header>
  );
}

/* ════════════════════════════════════════════════════════════
   HERO + FORM
   ════════════════════════════════════════════════════════════ */
const EVENT_PLACEHOLDERS = ['Свадьба', 'Рождение ребёнка', 'Поступление в университет', 'Первое место работы', 'Переезд в другой город'];

/* ── Города для автоподсказок ───────────────────────────────── */
const CITIES = [
  'Москва, Россия', 'Санкт-Петербург, Россия', 'Новосибирск, Россия', 'Екатеринбург, Россия',
  'Казань, Россия', 'Нижний Новгород, Россия', 'Челябинск, Россия', 'Самара, Россия',
  'Омск, Россия', 'Ростов-на-Дону, Россия', 'Уфа, Россия', 'Красноярск, Россия',
  'Воронеж, Россия', 'Пермь, Россия', 'Волгоград, Россия', 'Краснодар, Россия',
  'Саратов, Россия', 'Тюмень, Россия', 'Тольятти, Россия', 'Ижевск, Россия',
  'Барнаул, Россия', 'Иркутск, Россия', 'Хабаровск, Россия', 'Владивосток, Россия',
  'Ярославль, Россия', 'Махачкала, Россия', 'Томск, Россия', 'Оренбург, Россия',
  'Кемерово, Россия', 'Калининград, Россия', 'Тула, Россия', 'Сочи, Россия',
  'Киев, Украина', 'Харьков, Украина', 'Одесса, Украина', 'Львов, Украина',
  'Минск, Беларусь', 'Гомель, Беларусь', 'Алматы, Казахстан', 'Астана, Казахстан',
  'Шымкент, Казахстан', 'Ташкент, Узбекистан', 'Самарканд, Узбекистан', 'Бишкек, Киргизия',
  'Душанбе, Таджикистан', 'Ереван, Армения', 'Тбилиси, Грузия', 'Баку, Азербайджан',
  'Кишинёв, Молдова', 'Рига, Латвия', 'Вильнюс, Литва', 'Таллин, Эстония',
];

function CityAutocomplete({ value, onChange, error }) {
  const [suggestions, setSuggestions] = useStateL([]);
  const [loading, setLoading] = useStateL(false);
  const [open, setOpen] = useStateL(false);
  const [active, setActive] = useStateL(0);
  const boxRef = useRefL(null);

  // Track if search should run (true on user typing, false on city selection)
  const shouldSearchRef = useRefL(false);

  // Local state to track what the user actually typed
  const [inputValue, setInputValue] = useStateL(value || '');

  // Keep local state in sync if parent changes it directly
  useEffectL(() => {
    if (value !== inputValue) {
      setInputValue(value || '');
    }
  }, [value]);

  useEffectL(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Debounced search effect
  useEffectL(() => {
    const query = inputValue.trim();
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    // Skip search if flag is false (programmatic update or pick)
    if (!shouldSearchRef.current) {
      return;
    }

    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const controller = new AbortController();
      fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=6&accept-language=ru`, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'PassportOfLifeApp/1.0'
        }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            const formatted = data.map(item => {
              // Extract postal codes, double commas, and format nicely
              const cleanName = item.display_name
                .replace(/\d{6},?\s*/g, '') // Remove zip codes
                .replace(/,\s*\d+-\d+,?\s*/g, '') // Remove house ranges
                .replace(/\s*,\s*,/g, ',') // Fix duplicate commas
                .trim();
              return cleanName;
            });
            const unique = Array.from(new Set(formatted));
            setSuggestions(unique);
          }
          setLoading(false);
        })
        .catch(err => {
          if (err.name !== 'AbortError') {
            console.error(err);
            setLoading(false);
            // Fallback to local static filtering
            const q = query.toLowerCase();
            const starts = [], contains = [];
            for (const c of CITIES) {
              const city = c.split(',')[0].toLowerCase();
              if (city.startsWith(q)) starts.push(c);
              else if (city.includes(q)) contains.push(c);
            }
            setSuggestions([...starts, ...contains].slice(0, 6));
          }
        });

      return () => controller.abort();
    }, 450);

    return () => clearTimeout(delayDebounceFn);
  }, [inputValue]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    shouldSearchRef.current = true;
    setInputValue(val);
    onChange(val); // Update parent immediately for validation
    setOpen(true);
    setActive(0);
  };

  const pick = (city) => {
    shouldSearchRef.current = false;
    setInputValue(city);
    onChange(city);
    setOpen(false);
    setSuggestions([]);
  };

  const onKey = (e) => {
    const items = suggestions;
    if (!open || items.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => (a + 1) % items.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => (a - 1 + items.length) % items.length); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(items[active]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  // highlight query letters in suggestion
  const renderCity = (c) => {
    const q = inputValue.trim().toLowerCase();
    const lc = c.toLowerCase();
    const idx = lc.indexOf(q);
    if (q.length === 0 || idx === -1) return <span>{c}</span>;
    return (
      <span>
        {c.slice(0, idx)}
        <span className="text-gold font-medium">{c.slice(idx, idx + q.length)}</span>
        {c.slice(idx + q.length)}
      </span>
    );
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <input
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => inputValue.trim() && setOpen(true)}
          onKeyDown={onKey}
          autoComplete="off"
          className={`field w-full rounded-xl pl-10 pr-4 py-3 font-sans text-[15px] ${error ? 'err' : ''}`}
          placeholder="Деревня, город, область..." />
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lavmut text-[16px]">
          <Icon name="map-pin" />
        </span>
      </div>
      {open && (loading || suggestions.length > 0) && (
        <ul className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-gold/20 bg-[#140E2E]/95 backdrop-blur-md shadow-[0_24px_50px_-18px_rgba(0,0,0,.85)] fade-up max-h-[280px] overflow-y-auto">
          {loading && (
            <li className="flex items-center gap-2.5 px-4 py-3 text-lavmut font-sans text-[13.5px]">
              <Icon name="loader" className="animate-spin text-gold text-[15px]" />
              <span>Поиск населённого пункта...</span>
            </li>
          )}
          {!loading && suggestions.map((c, i) => (
            <li key={c}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(c)}
                className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left font-sans text-[14px] transition-colors ${i === active ? 'bg-gold/[.12] text-lav' : 'text-lavmut'}`}>
                <Icon name="map-pin" className="text-[14px] text-gold/70 shrink-0" />
                {renderCity(c)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FormField({ label, hint, children, error }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline gap-1.5">
        <label className="whitespace-nowrap font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-lavmut">{label}</label>
        {hint && <span className="whitespace-nowrap font-sans text-[10.5px] text-lavdim normal-case tracking-normal">{hint}</span>}
      </div>
      {children}
      {error && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-[#E89B9B] fade-up">
          <Icon name="alert-circle" className="text-[14px]" /> {error}
        </div>
      )}
    </div>
  );
}

function Hero({ onStart }) {
  const [name, setName] = useStateL('');
  const [email, setEmail] = useStateL('');
  const [bdate, setBdate] = useStateL('');
  const [btime, setBtime] = useStateL('');
  const [place, setPlace] = useStateL('');
  const [unknown, setUnknown] = useStateL(false);
  const [events, setEvents] = useStateL(EVENT_PLACEHOLDERS.map(() => ({ date: '', title: '' })));
  const [err, setErr] = useStateL({});

  const setEvent = (i, key, val) => setEvents(ev => ev.map((e, idx) => idx === i ? { ...e, [key]: val } : e));

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!name.trim()) next.name = 'Введите имя';
    if (!bdate) next.bdate = 'Укажите дату рождения';
    if (!place.trim()) next.place = 'Укажите место рождения';
    if (!unknown && !btime) next.btime = 'Укажите время рождения';
    setErr(next);
    if (Object.keys(next).length === 0) {
      onStart({ name, email, bdate, btime, place, unknown, events });
    } else {
      // scroll the form into view region softly
      const f = document.getElementById('form-hero');
      if (f) f.scrollIntoView ? null : null;
    }
  };

  return (
    <section id="top" className="relative overflow-hidden">
      <StarField count={90} />
      {/* faint zodiac watermark */}
      <div className="pointer-events-none absolute -right-24 top-10 hidden lg:block w-[640px] opacity-[0.07]">
        <ZodiacWheel size={640} faint />
      </div>
      <div className="relative mx-auto grid max-w-7xl grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 px-5 sm:px-8 pt-16 lg:pt-24 pb-20 lg:pb-28 items-center">
        {/* left */}
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/[.07] px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_8px_2px_rgba(227,178,60,.6)]"></span>
            <span className="whitespace-nowrap font-sans text-[12px] font-semibold uppercase tracking-[0.28em] text-gold">Паспорт жизни</span>
          </div>
          <h1 className="mt-6 font-serif text-[clamp(2.7rem,6vw,4.6rem)] leading-[1.04] tracking-[-0.015em] text-lav">
            Твоя жизнь,<br />написанная <span className="gold-text italic">звёздами</span>.
          </h1>
          <p className="mt-6 max-w-md font-sans text-[16px] sm:text-[17px] leading-relaxed text-lavmut">
            Глубоко личный разбор, построенный по моменту твоего рождения и важным событиям. Узнай, кто ты на самом деле — и куда ведёт твой путь.
          </p>
          <div className="mt-7 flex items-center gap-2 font-sans text-[12.5px] uppercase tracking-[0.22em] text-gold/90">
            <Icon name="sparkles" className="text-[15px]" /> Создано искусственным интеллектом
          </div>
        </div>

        {/* right — form */}
        <form id="form-hero" onSubmit={submit} className="glass-card rounded-[28px] p-6 sm:p-8 shadow-[0_40px_90px_-40px_rgba(0,0,0,.85)]">
          <div className="text-center">
            <h2 className="font-serif text-[26px] sm:text-[29px] text-lav">Создай свой <span className="gold-text">Паспорт жизни</span></h2>
            <p className="mt-1.5 font-sans text-[13.5px] text-lavmut">Один документ — вся твоя история</p>
          </div>

          <div className="mt-7 flex flex-col gap-4">
            <FormField label="Имя" error={err.name}>
              <input value={name} onChange={e => setName(e.target.value)}
                className={`field w-full rounded-xl px-4 py-3 font-sans text-[15px] ${err.name ? 'err' : ''}`}
                placeholder="Александр" />
            </FormField>

            <FormField label="Email" hint="для получения PDF">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="field w-full rounded-xl px-4 py-3 font-sans text-[15px]"
                placeholder="you@stars.com" />
            </FormField>

            <div className={`grid gap-4 ${unknown ? 'grid-cols-1' : 'grid-cols-2'}`}>
              <FormField label="Дата рождения" error={err.bdate}>
                <input type="date" value={bdate} onChange={e => setBdate(e.target.value)}
                  className={`field w-full rounded-xl px-4 py-3 font-sans text-[15px] ${err.bdate ? 'err' : ''}`} />
              </FormField>
              {!unknown && (
                <FormField label="Время рождения" error={err.btime}>
                  <input type="time" value={btime} onChange={e => setBtime(e.target.value)}
                    className={`field w-full rounded-xl px-4 py-3 font-sans text-[15px] ${err.btime ? 'err' : ''}`} />
                </FormField>
              )}
            </div>

            <FormField label="Место рождения" error={err.place}>
              <CityAutocomplete value={place} onChange={setPlace} error={err.place} />
            </FormField>

            <label className="flex items-start gap-3 cursor-pointer select-none group">
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all ${unknown ? 'bg-gold border-gold' : 'border-lavmut/50 bg-transparent group-hover:border-gold/60'}`}>
                {unknown && <Icon name="check" className="text-[13px] text-[#2A1C05]" />}
              </span>
              <input type="checkbox" checked={unknown} onChange={e => setUnknown(e.target.checked)} className="sr-only" />
              <span className="font-sans text-[14px] text-lavmut leading-snug">Не знаю точное время рождения</span>
            </label>

            {unknown && (
              <div className="fade-up rounded-2xl border border-gold/15 bg-ink/40 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Icon name="calendar-heart" className="text-[16px] text-gold" />
                  <span className="font-sans text-[13px] font-semibold uppercase tracking-[0.12em] text-lav">5 важных событий жизни</span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {events.map((ev, i) => (
                    <div key={i} className="grid grid-cols-[120px_1fr] gap-2.5">
                      <input type="date" value={ev.date} onChange={e => setEvent(i, 'date', e.target.value)}
                        className="field rounded-lg px-3 py-2.5 font-sans text-[13.5px]" />
                      <input value={ev.title} onChange={e => setEvent(i, 'title', e.target.value)}
                        className="field rounded-lg px-3 py-2.5 font-sans text-[13.5px]"
                        placeholder={EVENT_PLACEHOLDERS[i]} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button type="submit" className="gold-btn mt-6 flex w-full items-center justify-center gap-2.5 rounded-full px-6 py-4 font-sans font-semibold text-[#2A1C05] text-[15px]">
            <Icon name="sparkles" className="text-[18px]" /> Оплатить и создать Паспорт жизни
          </button>
          <p className="mt-3 text-center font-sans text-[12px] text-lavdim">Мы уважаем твою приватность. Твои данные — только твои.</p>
        </form>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   SECTION shell
   ════════════════════════════════════════════════════════════ */
function Section({ id, eyebrow, title, sub, children, className = '', center = true }) {
  return (
    <section id={id} className={`relative mx-auto max-w-7xl px-5 sm:px-8 py-20 lg:py-28 ${className}`}>
      <Reveal className={center ? 'text-center mx-auto max-w-3xl' : 'max-w-3xl'}>
        {eyebrow && <Eyebrow className="mb-4">{eyebrow}</Eyebrow>}
        <SerifTitle text={title} className="text-[clamp(2rem,4.4vw,3.3rem)]" />
        {sub && <p className={`mt-5 font-sans text-[16px] sm:text-[17px] leading-relaxed text-lavmut ${center ? 'mx-auto max-w-2xl' : ''}`}>{sub}</p>}
      </Reveal>
      {children}
    </section>
  );
}

/* ── 2. WHAT YOU'LL DISCOVER ─────────────────────────────────── */
const DISCOVER = [
  ['sun', 'Твоя истинная суть', 'Ядро личности и то, что делает тебя собой — за пределами ролей и масок.'],
  ['heart', 'Любовь и отношения', 'Как ты любишь, чего ищешь в близости и какие связи тебя по-настоящему питают.'],
  ['compass', 'Путь и предназначение', 'Направление, в котором раскрывается твой потенциал и приходит ощущение смысла.'],
  ['moon', 'Внутренние эмоции', 'Скрытый эмоциональный мир — то, что движет тобой в тишине и в моменты выбора.'],
  ['gem', 'Скрытые силы', 'Таланты и опоры, на которые можно опереться, особенно когда непросто.'],
  ['orbit', 'Космический ритм', 'Периоды роста и пауз — как время разворачивает твою историю шаг за шагом.'],
];
function Discover() {
  return (
    <Section id="discover" eyebrow="Что ты откроешь"
      title="Зеркало к твоему глубинному *«я»*."
      sub="Несколько измерений твоего внутреннего мира — собранные в один цельный и честный портрет.">
      <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {DISCOVER.map(([ic, t, d], i) => (
          <Reveal key={t} delay={i * 70} className="glass-card lift rounded-[24px] p-7">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-gold/30 bg-gold/[.08] text-gold text-[24px]">
              <Icon name={ic} />
            </div>
            <h3 className="mt-5 font-serif text-[22px] text-lav">{t}</h3>
            <p className="mt-2.5 font-sans text-[14.5px] leading-relaxed text-lavmut">{d}</p>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ── 3. HOW IT WORKS ─────────────────────────────────────────── */
const STEPS = [
  ['Поделись данными о себе', 'Дата, время и место — координаты твоего пути.'],
  ['Мы строим твою карту', 'Система анализирует твои данные и важные события жизни.'],
  ['Получи свой Паспорт', 'Глубоко личный PDF-документ, который останется с тобой.'],
];
function How() {
  return (
    <Section id="how" eyebrow="Как это работает" title="Три шага к твоей *правде*.">
      <div className="relative mt-16">
        <div className="pointer-events-none absolute left-0 right-0 top-7 hidden md:block">
          <div className="mx-auto h-px max-w-4xl bg-gradient-to-r from-transparent via-gold/35 to-transparent"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8 max-w-4xl mx-auto">
          {STEPS.map(([t, d], i) => (
            <Reveal key={t} delay={i * 110} className="relative text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-gold/40 bg-ink2 text-gold font-serif text-[22px] shadow-[0_0_30px_-6px_rgba(227,178,60,.5)]">
                {i + 1}
              </div>
              <h3 className="mt-6 font-serif text-[21px] text-lav">{t}</h3>
              <p className="mt-2.5 mx-auto max-w-[260px] font-sans text-[14.5px] leading-relaxed text-lavmut">{d}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ── 4. WHAT'S INCLUDED ──────────────────────────────────────── */
const INCLUDED = ['Портрет личности', 'Любовь и отношения', 'Путь и предназначение', 'Ключевые периоды и даты', 'Скрытые силы и зоны роста', 'Персональные рекомендации'];
function Included() {
  return (
    <Section id="included" eyebrow="Что внутри" title="Что входит в твой *Паспорт жизни*.">
      <div className="mt-12 mx-auto max-w-2xl">
        <div className="flex flex-col gap-3">
          {INCLUDED.map((t, i) => (
            <Reveal key={t} delay={i * 60} className="glass-card lift flex items-center gap-4 rounded-2xl px-6 py-4 text-left">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold text-[16px]">
                <Icon name="check" />
              </span>
              <span className="font-sans text-[16px] text-lav">{t}</span>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ── 5. LOOK INSIDE ──────────────────────────────────────────── */
const INSIDE_POINTS = [
  'Построено по моменту твоего рождения',
  'Несколько глубоких глав о твоей жизни',
  'Красивый PDF, который ты сохранишь навсегда',
  'Написано простым и близким языком — без сложных терминов',
];
function LookInside() {
  return (
    <section id="inside" className="relative mx-auto max-w-7xl px-5 sm:px-8 py-20 lg:py-28">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <Reveal>
          <div className="relative rounded-[28px] border border-gold/30 bg-gradient-to-b from-[#1A1338] to-[#0E0A1F] p-8 sm:p-10 shadow-[0_50px_100px_-50px_rgba(0,0,0,.9)]">
            <StarField count={28} />
            <div className="relative mx-auto max-w-[380px]">
              <ZodiacWheel size={380} />
            </div>
            <p className="relative mt-6 text-center font-sans text-[12.5px] uppercase tracking-[0.24em] text-gold/80">Пример страницы Паспорта</p>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <Eyebrow className="mb-4">Заглянуть внутрь</Eyebrow>
          <SerifTitle text="Создано с *точностью* и заботой." className="text-[clamp(1.9rem,4vw,3rem)]" />
          <p className="mt-5 font-sans text-[16px] sm:text-[17px] leading-relaxed text-lavmut">
            Каждый Паспорт — это больше, чем расчёт. Это нарратив, написанный на твоём языке: астрономическая точность встречается с настоящим вниманием к тебе.
          </p>
          <ul className="mt-7 flex flex-col gap-4">
            {INSIDE_POINTS.map((p) => (
              <li key={p} className="flex items-start gap-3.5">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold shadow-[0_0_8px_1px_rgba(227,178,60,.6)]"></span>
                <span className="font-sans text-[15.5px] leading-relaxed text-lav">{p}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

/* ── 6. REVIEWS ──────────────────────────────────────────────── */
function Stars() {
  return (
    <div className="flex gap-1 text-gold text-[15px]">
      {[0,1,2,3,4].map(i => <Icon key={i} name="star" style={{ fill: 'currentColor' }} />)}
    </div>
  );
}
const REVIEWS_DATA = [
  { text: "Этот документ перевернул мое представление о себе. Все ключевые периоды моей жизни совпали с точностью до месяца! Анализ помог принять важное решение о переезде.", author: "Мария, 29 лет" },
  { text: "Качество оформления на высоте. Скачал файл и распечатал как книгу. Читается на одном дыхании, без сложной терминологии, очень глубокий психологический анализ.", author: "Артем, 34 года" },
  { text: "Удивило, как точно ИИ связал 5 событий, которые я указала, с натальной картой. Получился очень личный и поддерживающий путеводитель. Огромная благодарность!", author: "Елена, 42 года" },
  { text: "Сначала скептически относился, но глубина анализа поражает. Раздел про скрытые силы и зоны роста заставил о многом задуматься. Отличный инструмент для самопознания.", author: "Михаил, 27 лет" }
];
function Reviews() {
  return (
    <Section id="reviews" eyebrow="Отзывы" title="Слова тех, кто уже *прошёл*.">
      <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-4xl mx-auto">
        {REVIEWS_DATA.map((rev, i) => (
          <Reveal key={i} delay={(i % 2) * 90} className="glass-card lift rounded-[24px] p-7 text-left">
            <Stars />
            <p className="mt-4 font-serif italic text-[18px] leading-relaxed text-lav/90">«{rev.text}»</p>
            <p className="mt-5 font-sans text-[13.5px] uppercase tracking-[0.16em] text-lavmut">{rev.author}</p>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ── 7. WHY US ───────────────────────────────────────────────── */
const WHY = [
  ['fingerprint', 'Глубоко и персонально', 'Разбор строится именно по твоим данным, а не по общим шаблонам.'],
  ['gem', 'Премиум,\nа не масс-маркет', 'PDF коллекционного качества, оформленный как книга.'],
  ['lock', 'Приватно и безопасно', 'Твои данные принадлежат только тебе, зашифрованы и не передаются третьим лицам.'],
];
function Why() {
  return (
    <Section id="why" eyebrow="Почему Паспорт жизни" title="Это не обычный *гороскоп*.">
      <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-5">
        {WHY.map(([ic, t, d], i) => (
          <Reveal key={t} delay={i * 90} className="glass-card lift rounded-[24px] p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-gold/30 bg-gold/[.08] text-gold text-[24px]">
              <Icon name={ic} />
            </div>
            <h3 className="mt-5 font-serif text-[21px] text-lav whitespace-pre-line">{t}</h3>
            <p className="mt-2.5 font-sans text-[14.5px] leading-relaxed text-lavmut">{d}</p>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ── 8. FINAL CTA ────────────────────────────────────────────── */
function FinalCTA({ onCta }) {
  return (
    <section className="relative overflow-hidden py-24 lg:py-32">
      <StarField count={60} />
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(124,82,200,.35),transparent_65%)]"></div>
      <Reveal className="relative mx-auto max-w-3xl px-5 sm:px-8 text-center">
        <Eyebrow className="mb-5">Космос ждёт</Eyebrow>
        <SerifTitle text="Встреться с тем, *о ком* писали звёзды." className="text-[clamp(2.2rem,5vw,3.8rem)]" />
        <p className="mt-6 mx-auto max-w-xl font-sans text-[16px] sm:text-[17px] leading-relaxed text-lavmut">
          Несколько минут — и в твоих руках документ, который написан только для тебя.
        </p>
        <div className="mt-9 flex justify-center">
          <GoldButton onClick={onCta} icon="sparkles" className="text-[16px] px-9 py-4">Создать мой Паспорт жизни</GoldButton>
        </div>
      </Reveal>
    </section>
  );
}

/* ── 9. FAQ ──────────────────────────────────────────────────── */
const FAQS = [
  ['А если я не знаю точное время рождения?', 'Разбор всё равно будет содержательным. Вместо времени рождения ты можешь указать 5 важных событий своей жизни — они помогут точнее настроить картину твоего пути.'],
  ['Сколько стоит Паспорт жизни?', 'Это единый платный продукт без скрытых подписок. Точную стоимость ты видишь на шаге оплаты — платишь один раз и получаешь документ навсегда.'],
  ['Мои данные в безопасности?', 'Да. Твои данные принадлежат только тебе, передаются по защищённому соединению, не продаются и не передаются третьим лицам.'],
  ['Можно ли подарить Паспорт?', 'Конечно. Паспорт жизни — продуманный персональный подарок: достаточно ввести данные того, кому он предназначен.'],
  ['Чем это отличается от бесплатных приложений?', 'Это не общий шаблон по знаку зодиака, а цельный документ, собранный по твоим данным и событиям — глубокий, премиальный и сохранённый в красивом PDF.'],
];
function FAQItem({ q, a, open, onClick }) {
  const ref = useRefL(null);
  return (
    <div className={`glass-card rounded-2xl overflow-hidden transition-colors ${open ? 'border-gold/35' : ''}`}>
      <button onClick={onClick} className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left">
        <span className="font-serif text-[18px] sm:text-[19px] text-lav">{q}</span>
        <span className={`shrink-0 text-gold text-[20px] transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>
          <Icon name="chevron-down" />
        </span>
      </button>
      <div style={{ maxHeight: open ? (ref.current ? ref.current.scrollHeight + 'px' : '300px') : '0px' }}
        className="overflow-hidden transition-[max-height] duration-400 ease-out">
        <div ref={ref} className="px-6 pb-6 -mt-1">
          <p className="font-sans text-[15px] leading-relaxed text-lavmut">{a}</p>
        </div>
      </div>
    </div>
  );
}
function FAQ() {
  const [open, setOpen] = useStateL(0);
  return (
    <Section id="faq" eyebrow="Вопросы" title="Ты не первый, кто *спрашивает*.">
      <div className="mt-12 mx-auto max-w-3xl flex flex-col gap-3.5">
        {FAQS.map(([q, a], i) => (
          <Reveal key={q} delay={i * 50}>
            <FAQItem q={q} a={a} open={open === i} onClick={() => setOpen(open === i ? -1 : i)} />
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ── 10. FOOTER ──────────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="border-t border-white/[.07] bg-[#0A0617]">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-14">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
            <div className="font-serif text-[30px] gold-text">Паспорт жизни</div>
            <div className="mt-2 font-sans text-[12px] uppercase tracking-[0.24em] text-lavmut">Написано звёздами · Сделано на Земле</div>
          </div>
          <nav className="flex flex-wrap gap-x-8 gap-y-3">
            {['FAQ', 'Приватность', 'Условия', 'Контакты'].map(t => (
              <a key={t} href="#faq" className="font-sans text-[12px] uppercase tracking-[0.18em] text-lavmut hover:text-gold transition-colors">{t}</a>
            ))}
          </nav>
        </div>
        <div className="mt-12 text-center font-sans text-[12px] text-lavdim">© 2026 Паспорт жизни. Все права защищены.</div>
      </div>
    </footer>
  );
}

/* ════════════════════════════════════════════════════════════
   LANDING
   ════════════════════════════════════════════════════════════ */
function Landing({ onStart }) {
  const scrollToForm = () => {
    const f = document.getElementById('top');
    if (f) window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  return (
    <div className="cosmic-bg min-h-screen">
      <Header onCta={scrollToForm} />
      <Hero onStart={onStart} />
      <Discover />
      <How />
      <Included />
      <LookInside />
      <Reviews />
      <Why />
      <FinalCTA onCta={scrollToForm} />
      <FAQ />
      <Footer />
    </div>
  );
}

window.Landing = Landing;
