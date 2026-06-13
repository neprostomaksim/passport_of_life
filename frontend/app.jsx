const { useState, useEffect, useRef } = React;

/* ════════════════════════════════════════════════════════════
   STATE 2 — PROGRESS
   ════════════════════════════════════════════════════════════ */
const STAGES = [
  'Создаём Паспорт жизни...',
  'Анализируем данные...',
  'Формируем персональный профиль...',
  'Выполняем расчёты...',
  'Формируем результат...',
  'Генерируем PDF-документ...',
  'Подготавливаем файл к скачиванию...',
  'Готово.',
];

function Progress({ name, orderId, initError, onDone, onError }) {
  const [pct, setPct] = useState(0);
  const [serverStatus, setServerStatus] = useState('processing');
  const [errorMessage, setErrorMessage] = useState('');
  const [userName, setUserName] = useState(name || '');
  const pctRef = useRef(0);
  const statusRef = useRef('processing');
  const orderDataRef = useRef(null);

  useEffect(() => {
    statusRef.current = serverStatus;
  }, [serverStatus]);

  useEffect(() => {
    if (initError) {
      setServerStatus('fail');
      setErrorMessage(initError);
    }
  }, [initError]);

  useEffect(() => {
    if (!orderId || initError) return;

    let timerId;
    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        if (!res.ok) throw new Error('Не удалось получить статус заказа');
        const data = await res.json();

        if (data.name) {
          setUserName(data.name);
        }

        if (data.status === 'success') {
          setServerStatus('success');
          orderDataRef.current = data;
          if (timerId) clearInterval(timerId);
        } else if (data.status === 'fail') {
          setServerStatus('fail');
          setErrorMessage(data.error || 'Произошла ошибка при генерации документа.');
          if (timerId) clearInterval(timerId);
        } else if (data.status === 'pending_payment') {
          setServerStatus('pending_payment');
        } else if (data.status === 'processing') {
          setServerStatus('processing');
        }
      } catch (err) {
        console.error('Ошибка опроса статуса:', err);
      }
    };

    timerId = setInterval(checkStatus, 2000);
    checkStatus();

    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [orderId, initError]);

  useEffect(() => {
    const iv = setInterval(() => {
      let p = pctRef.current;
      const currentStatus = statusRef.current;

      if (currentStatus === 'fail' || currentStatus === 'pending_payment') {
        return;
      }

      if (p < 100) {
        const maxPct = currentStatus === 'success' ? 100 : 99;
        if (p < maxPct) {
          const step = p < 75 ? 1.4 + Math.random() * 1.6 : 0.5 + Math.random() * 0.9;
          p = Math.min(maxPct, p + step);
          pctRef.current = p;
          setPct(p);
        }
      } else {
        clearInterval(iv);
        setTimeout(() => onDone(orderDataRef.current), 900);
      }
    }, 45);
    return () => clearInterval(iv);
  }, [onDone]);

  const stageIdx = Math.min(STAGES.length - 1, Math.floor((pct / 100) * (STAGES.length - 1) + 0.0001));
  const ring = 2 * Math.PI * 86;

  const displayStage = serverStatus === 'pending_payment' 
    ? 'Ожидаем подтверждения оплаты...' 
    : STAGES[stageIdx];

  if (serverStatus === 'fail') {
    return (
      <div className="cosmic-bg relative min-h-screen overflow-hidden flex items-center justify-center px-6">
        <StarField count={110} />
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[640px] w-[640px] rounded-full bg-[radial-gradient(circle,rgba(220,38,38,.12),transparent_62%)]"></div>

        <div className="relative flex flex-col items-center text-center fade-up max-w-md">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-red-500/40 bg-red-500/[.08] text-red-400 text-[30px] shadow-[0_0_40px_-8px_rgba(239,68,68,.6)]">
            <Icon name="alert-triangle" />
          </div>
          <h2 className="font-serif text-[clamp(1.8rem,4vw,2.6rem)] text-lav">Произошла ошибка</h2>
          <p className="mt-4 font-sans text-[15px] text-lavmut leading-relaxed">
            {errorMessage || 'Не удалось сгенерировать Паспорт жизни. Пожалуйста, попробуйте снова.'}
          </p>
          <button onClick={onError} className="mt-8 gold-btn rounded-full px-8 py-3.5 font-sans font-semibold text-[#2A1C05]">
            Вернуться назад
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cosmic-bg relative min-h-screen overflow-hidden flex items-center justify-center px-6">
      <StarField count={110} />
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[640px] w-[640px] rounded-full bg-[radial-gradient(circle,rgba(124,82,200,.30),transparent_62%)]"></div>

      <div className="relative flex flex-col items-center text-center fade-up">
        {/* circular gauge */}
        <div className="relative h-[220px] w-[220px]">
          {/* pulsing halo */}
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(227,178,60,.28),transparent_60%)]"
            style={{ animation: 'pulseGlow 2.4s ease-in-out infinite' }}></div>
          {/* rotating dashed ring */}
          <svg className="absolute inset-0" viewBox="0 0 220 220" style={{ animation: 'spin 14s linear infinite', transformOrigin: 'center' }}>
            <circle cx="110" cy="110" r="102" fill="none" stroke="rgba(227,178,60,.22)" strokeWidth="1" strokeDasharray="2 10" />
          </svg>
          {/* progress ring */}
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 220 220">
            <circle cx="110" cy="110" r="86" fill="none" stroke="rgba(168,159,196,.16)" strokeWidth="6" />
            <circle cx="110" cy="110" r="86" fill="none" stroke="url(#gg)" strokeWidth="6" strokeLinecap="round"
              strokeDasharray={ring} strokeDashoffset={ring * (1 - pct / 100)}
              style={{ transition: 'stroke-dashoffset .12s linear' }} />
            <defs>
              <linearGradient id="gg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#F6E2A6" />
                <stop offset="100%" stopColor="#C8922B" />
              </linearGradient>
            </defs>
          </svg>
          {/* center */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="font-serif text-[52px] leading-none gold-text">{Math.round(pct)}<span className="text-[26px]">%</span></div>
            <Icon name="sparkles" className="mt-2 text-gold text-[20px]" style={{ animation: 'floaty 3s ease-in-out infinite' }} />
          </div>
        </div>

        <h2 className="mt-12 font-serif text-[clamp(1.8rem,4vw,2.6rem)] text-lav">
          Создаём <span className="gold-text italic">Паспорт</span>{userName ? <>, {userName}</> : ''}
        </h2>

        {/* linear bar */}
        <div className="mt-7 h-1.5 w-[min(440px,80vw)] overflow-hidden rounded-full bg-white/[.08]">
          <div className="h-full rounded-full bg-gradient-to-r from-goldlt via-gold to-golddk transition-[width] duration-150 shadow-[0_0_16px_rgba(227,178,60,.6)]"
            style={{ width: pct + '%' }}></div>
        </div>

        <div className="mt-6 h-6 font-sans text-[15px] tracking-wide text-lavmut">
          <span key={displayStage} className="fade-up inline-block">{displayStage}</span>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   STATE 3 — RESULT
   ════════════════════════════════════════════════════════════ */
function getZodiacSign(dateStr) {
  if (!dateStr) return { name: 'Космос', symbol: '✨' };
  const date = new Date(dateStr);
  const m = date.getMonth() + 1;
  const d = date.getDate();
  if ((m === 3 && d >= 21) || (m === 4 && d <= 19)) return { name: 'Овен', symbol: '♈' };
  if ((m === 4 && d >= 20) || (m === 5 && d <= 20)) return { name: 'Телец', symbol: '♉' };
  if ((m === 5 && d >= 21) || (m === 6 && d <= 20)) return { name: 'Близнецы', symbol: '♊' };
  if ((m === 6 && d >= 21) || (m === 7 && d <= 22)) return { name: 'Рак', symbol: '♋' };
  if ((m === 7 && d >= 23) || (m === 8 && d <= 22)) return { name: 'Лев', symbol: '♌' };
  if ((m === 8 && d >= 23) || (m === 9 && d <= 22)) return { name: 'Дева', symbol: '♍' };
  if ((m === 9 && d >= 23) || (m === 10 && d <= 22)) return { name: 'Весы', symbol: '♎' };
  if ((m === 10 && d >= 23) || (m === 11 && d <= 21)) return { name: 'Скорпион', symbol: '♏' };
  if ((m === 11 && d >= 22) || (m === 12 && d <= 21)) return { name: 'Стрелец', symbol: '♐' };
  if ((m === 12 && d >= 22) || (m === 1 && d <= 19)) return { name: 'Козерог', symbol: '♑' };
  if ((m === 1 && d >= 20) || (m === 2 && d <= 18)) return { name: 'Водолей', symbol: '♒' };
  return { name: 'Рыбы', symbol: '♓' };
}

function Result({ data, orderId, onBack }) {
  const name = data?.name;

  const handleDownload = () => {
    if (!orderId) {
      alert('Ошибка: идентификатор заказа не найден.');
      return;
    }
    const link = document.createElement('a');
    link.href = `/api/orders/${orderId}/pdf`;
    link.download = `Passport_of_Life_${name || 'User'}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="cosmic-bg relative min-h-screen overflow-hidden flex items-center justify-center px-6 py-16">
      <StarField count={90} />
      <div className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(124,82,200,.30),transparent_62%)]"></div>

      <div className="relative w-full max-w-lg text-center fade-up">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-gold/40 bg-gold/[.08] text-gold text-[30px] shadow-[0_0_40px_-8px_rgba(227,178,60,.6)]">
          <Icon name="check" />
        </div>
        <Eyebrow className="mb-4">Готово</Eyebrow>
        <h1 className="font-serif text-[clamp(2rem,5vw,3rem)] leading-tight text-lav">
          Твой <span className="gold-text italic">Паспорт жизни</span> готов{name ? <>, {name}</> : ''}!
        </h1>

        {/* preview slot */}
        <div className="relative mt-9 rounded-[28px] border border-gold/35 bg-gradient-to-b from-[#1A1338] to-[#0E0A1F] p-2 shadow-[0_50px_100px_-50px_rgba(0,0,0,.9)] overflow-hidden h-[450px]">
          {orderId ? (
            <iframe
              src={`/api/orders/${orderId}/preview?preview=1`}
              className="w-full h-full border-none rounded-[20px]"
              title="Natal Chart Preview"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-lavmut font-sans">
              Загрузка предпросмотра...
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-center">
          <GoldButton icon="download" className="text-[16px] px-9 py-4" onClick={handleDownload}>Скачать Паспорт</GoldButton>
        </div>
        <p className="mt-4 font-sans text-[12.5px] text-lavdim">Скачиваемый файл содержит вашу полную карту и интерпретации.</p>

        <button onClick={onBack} className="mt-9 inline-flex items-center gap-2 font-sans text-[14px] text-lavmut hover:text-gold transition-colors">
          <Icon name="arrow-left" className="text-[16px]" /> Вернуться на главную
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   APP — state machine
   ════════════════════════════════════════════════════════════ */
function App() {
  const [screen, setScreen] = useState('landing'); // landing | progress | result
  const [data, setData] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [error, setError] = useState(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // refresh lucide icons after every render
  useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  });

  // scroll to top on screen change
  useEffect(() => { window.scrollTo(0, 0); }, [screen]);

  // Handle URL payment status params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment_status');
    const orderIdParam = params.get('order_id');

    if (orderIdParam) {
      if (paymentStatus === 'success') {
        setOrderId(orderIdParam);
        setScreen('progress');
      } else if (paymentStatus === 'decline' || paymentStatus === 'fail') {
        setError('Платеж был отклонен или произошла ошибка при оплате. Пожалуйста, попробуйте снова.');
      }
      
      // Clean query parameters from URL without reloading page
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, []);

  const start = async (formData) => {
    setData(formData);
    setError(null);
    setIsRedirecting(true);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        throw new Error('Не удалось отправить форму на сервер. Пожалуйста, попробуйте ещё раз.');
      }

      const result = await res.json();
      if (!result.orderId || !result.paymentUrl) {
        throw new Error('Неверный ответ сервера (отсутствует ID заказа или ссылка на оплату).');
      }

      // Redirect user to the payment link
      window.location.href = result.paymentUrl;
    } catch (err) {
      console.error(err);
      setError(err.message || 'Ошибка сети при обращении к серверу.');
      setIsRedirecting(false);
    }
  };

  const finish = (orderData) => {
    if (orderData && orderData.name) {
      setData({ name: orderData.name });
    }
    setScreen('result');
  };

  const reset = () => {
    setScreen('landing');
    setData(null);
    setOrderId(null);
    setError(null);
    setIsRedirecting(false);
  };

  return (
    <div key={screen}>
      {isRedirecting && (
        <div className="cosmic-bg fixed inset-0 z-50 overflow-hidden flex items-center justify-center px-6">
          <StarField count={110} />
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[640px] w-[640px] rounded-full bg-[radial-gradient(circle,rgba(124,82,200,.25),transparent_62%)]"></div>
          <div className="relative flex flex-col items-center text-center fade-up">
            <div className="relative h-16 w-16 mb-8">
              <div className="absolute inset-0 rounded-full border-2 border-gold/20"></div>
              <div className="absolute inset-0 rounded-full border-2 border-gold border-t-transparent animate-spin"></div>
            </div>
            <h2 className="font-serif text-[24px] text-lav">Подготовка к оплате...</h2>
            <p className="mt-3 font-sans text-[14px] text-lavmut">Перенаправляем на защищенный платежный шлюз BePaid</p>
          </div>
        </div>
      )}
      {screen === 'landing' && <Landing onStart={start} error={error} />}
      {screen === 'progress' && (
        <Progress
          name={data?.name}
          orderId={orderId}
          initError={error}
          onDone={finish}
          onError={reset}
        />
      )}
      {screen === 'result' && <Result data={data} orderId={orderId} onBack={reset} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
