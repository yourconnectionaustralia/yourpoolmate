// Ask Mate: pool questions answered by Claude, using the owner's pool
// details. Chats are saved (migration 022) and limited per month by the
// pool-chat edge function, which is the only thing that writes them.
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const STARTERS = [
  'Why is my pool cloudy?',
  'How long after adding chlorine can we swim?',
  'What does stabiliser actually do?',
];

async function readInvokeError(error) {
  const ctx = error?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = typeof ctx.clone === 'function' ? await ctx.clone().json() : await ctx.json();
      if (body && typeof body === 'object') return body;
    } catch { /* non-JSON error body */ }
  }
  return null;
}

async function callChat(body) {
  const { data, error } = await supabase.functions.invoke('pool-chat', { body });
  if (!error) return data;
  const parsed = await readInvokeError(error);
  const err = new Error(parsed?.error || "That didn't go through. Check your connection and try again.");
  err.details = parsed;
  throw err;
}

function whenText(iso) {
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' }).format(new Date(iso));
}

export default function AskMate({ userId, getContext, onOpenPlan }) {
  const [allowance, setAllowance] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [current, setCurrent] = useState(null); // { id, title } | null for a new chat
  const [messages, setMessages] = useState([]);
  const [questionsLeft, setQuestionsLeft] = useState(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const endRef = useRef(null);

  const loadSessions = useCallback(async () => {
    const { data } = await supabase
      .from('chat_sessions')
      .select('id, title, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(20);
    setSessions(data ?? []);
  }, [userId]);

  useEffect(() => {
    callChat({ action: 'status' }).then(setAllowance).catch((e) => setProblem(e.message));
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end', behavior: 'smooth' });
  }, [messages, busy]);

  const openChat = async (s) => {
    setProblem('');
    setCurrent(s);
    const { data } = await supabase
      .from('chat_messages')
      .select('id, role, content, created_at')
      .eq('session_id', s.id)
      .order('created_at', { ascending: true });
    const list = data ?? [];
    setMessages(list);
    if (allowance) setQuestionsLeft(Math.max(0, allowance.questions_per_chat - list.filter((m) => m.role === 'user').length));
  };

  const newChat = () => {
    setProblem('');
    setCurrent(null);
    setMessages([]);
    setQuestionsLeft(null);
    setDraft('');
  };

  const ask = async (text) => {
    const question = (text ?? draft).trim();
    if (!question || busy) return;
    setBusy(true);
    setProblem('');
    setMessages((m) => [...m, { id: `local-${Date.now()}`, role: 'user', content: question }]);
    setDraft('');
    try {
      const res = await callChat({ message: question, context: getContext?.() ?? '', session_id: current?.id ?? null });
      setMessages((m) => [...m, { id: `local-${Date.now()}-a`, role: 'assistant', content: res.reply }]);
      setQuestionsLeft(res.questions_left);
      setAllowance((a) => ({ ...(a ?? {}), ...res }));
      if (!current) {
        setCurrent({ id: res.session_id, title: question });
        loadSessions();
      }
    } catch (e) {
      // Not saved on the server, so take the question back off the screen.
      setMessages((m) => m.slice(0, -1));
      setDraft(question);
      setProblem(e.message);
      if (e.details?.chats_per_month) setAllowance((a) => ({ ...(a ?? {}), ...e.details }));
    } finally {
      setBusy(false);
    }
  };

  const chatsLeft = allowance ? Math.max(0, allowance.chats_per_month - allowance.chats_used) : null;
  const canStart = chatsLeft === null || chatsLeft > 0;
  const canAsk = current ? questionsLeft === null || questionsLeft > 0 : canStart;

  return (
    <div className="ask-mate">
      <h1 className="page-title">Ask Mate</h1>
      <p className="page-subtitle">Pool questions answered in plain English, using your pool's details.</p>

      {allowance && (
        <p className="ask-allowance" role="status">
          {chatsLeft} of {allowance.chats_per_month} chats left this month
          {chatsLeft < allowance.chats_per_month ? ` · more on ${allowance.resets_on}` : ''}
        </p>
      )}

      {current || messages.length ? (
        <div className="ask-thread-head">
          <button type="button" className="btn btn-ghost btn-sm" onClick={newChat}>← All chats</button>
          {questionsLeft != null && (
            <span className="ask-left">{questionsLeft} question{questionsLeft === 1 ? '' : 's'} left in this chat</span>
          )}
        </div>
      ) : null}

      <div className="ask-thread" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className={`ask-bubble ask-bubble-${m.role}`}>
            {m.role === 'assistant' && <span className="ask-who">Mate</span>}
            <p>{m.content}</p>
          </div>
        ))}
        {busy && (
          <div className="ask-bubble ask-bubble-assistant">
            <span className="ask-who">Mate</span>
            <p><span className="dot-loader"><span /><span /><span /></span> Thinking it over…</p>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {!current && !messages.length && canStart && (
        <div className="ask-starters">
          <p className="ask-starters-label">Try one of these</p>
          {STARTERS.map((s) => (
            <button key={s} type="button" className="ask-starter" onClick={() => ask(s)} disabled={busy}>{s}</button>
          ))}
        </div>
      )}

      {canAsk ? (
        <form className="ask-form" onSubmit={(e) => { e.preventDefault(); ask(); }}>
          <label htmlFor="ask-input" className="input-label">{current ? 'Ask a follow-up' : 'Your question'}</label>
          <textarea
            id="ask-input"
            className="input ask-input"
            rows={3}
            maxLength={1000}
            value={draft}
            placeholder={current ? 'e.g. How long until we can swim?' : "e.g. My water's gone green after the rain. What do I do first?"}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-block" disabled={busy || !draft.trim()}>
            {busy ? 'Asking…' : 'Ask Mate'}
          </button>
        </form>
      ) : (
        <div className="callout callout-info">
          <div className="callout-body">
            {current
              ? <>That chat has had all its questions. <button type="button" className="link-btn" onClick={newChat}>Start a new chat</button>{chatsLeft === 0 ? ` (more on ${allowance?.resets_on})` : ''}.</>
              : <>You've used this month's chats. More on {allowance?.resets_on}. Your Plan and the Problem fixer still work as normal.</>}
          </div>
        </div>
      )}

      {problem && <p role="alert" className="test-editor-problem">{problem}</p>}

      <p className="plan-small ask-note">
        Mate can get things wrong. For amounts, your <button type="button" className="link-btn" onClick={onOpenPlan}>Plan</button> works them out for your pool. Chats are saved to your account.
      </p>

      {!current && !messages.length && sessions.length > 0 && (
        <section className="card-section ask-history" aria-labelledby="ask-history-title">
          <h2 id="ask-history-title" className="plan-h2">Your chats</h2>
          <ul>
            {sessions.map((s) => (
              <li key={s.id}>
                <button type="button" className="ask-history-item" onClick={() => openChat(s)}>
                  <span className="ask-history-title">{s.title}</span>
                  <span className="ask-history-date">{whenText(s.updated_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
