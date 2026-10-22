"use client";
import React, { useEffect, useState, useCallback, useRef } from 'react';
import './styles/participant-quiz.css';

interface QuizPlayProps {
  round: any;
  session: any;
  onComplete: () => void;
}

type QuestionPhase = 'entering' | 'active' | 'exiting';

// ── Confirm Modal ──
const ConfirmModal: React.FC<{
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ title, message, onConfirm, onCancel }) => (
  <div className="pq-modal-overlay" onClick={onCancel}>
    <div className="pq-modal" onClick={e => e.stopPropagation()}>
      <div className="pq-modal__title">{title}</div>
      <p className="pq-modal__message">{message}</p>
      <div className="pq-modal__actions">
        <button className="pq-btn pq-btn--cancel" onClick={onCancel}>Cancel</button>
        <button className="pq-btn pq-btn--confirm" onClick={onConfirm}>Confirm</button>
      </div>
    </div>
  </div>
);

export const QuizPlay: React.FC<QuizPlayProps> = ({ round, session, onComplete }) => {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Phase 2: Animation
  const [questionPhase, setQuestionPhase] = useState<QuestionPhase>('active');
  const [hasEntrance, setHasEntrance] = useState(false);
  const transitionLocked = useRef(false);

  // Phase 3: Interaction feedback
  const [validationMsg, setValidationMsg] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);
  const validationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reducedMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // Timer thresholds
  const TIMER_WARNING = 120; // 2 minutes
  const TIMER_CRITICAL = 60;  // 1 minute

  // ── Submit round (preserved) ──
  const doSubmitRound = useCallback(async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('participant_token') || '';
      const res = await fetch(`${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') || 'http://localhost:3001'}/api/participant/rounds/${round.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ roundId: round.id })
      });
      if (res.ok) {
        onComplete();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }, [round.id, onComplete]);

  // ── Fetch questions (preserved) ──
  useEffect(() => {
    const token = localStorage.getItem('participant_token') || '';
    const headers = { 'Authorization': `Bearer ${token}` };

    fetch(`${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') || 'http://localhost:3001'}/api/participant/rounds/${round.id}/questions`, {
      credentials: 'include',
      headers
    })
      .then(res => res.json())
      .then(data => {
        setQuestions(data.questions || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [round.id]);

  // ── Timer logic (preserved, NEVER paused) ──
  useEffect(() => {
    if (round.overallTimer) {
      const start = new Date(session.startTime).getTime();
      const now = new Date().getTime();
      const elapsed = Math.floor((now - start) / 1000);
      const remaining = Math.max(0, round.overallTimer - elapsed);

      setTimeLeft(remaining);

      if (remaining === 0) {
        doSubmitRound();
        return;
      }

      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev && prev <= 1) {
            clearInterval(timer);
            doSubmitRound();
            return 0;
          }
          return prev ? prev - 1 : 0;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [round.overallTimer, session.startTime, doSubmitRound]);

  // ── Phase 2: One-shot entrance ──
  useEffect(() => {
    if (!loading && questions.length > 0 && !hasEntrance) {
      setHasEntrance(true);
    }
  }, [loading, questions.length, hasEntrance]);

  // ── Phase 2: Question transition ──
  const navigateTo = useCallback((targetIdx: number) => {
    if (transitionLocked.current) return;
    if (targetIdx === currentIndex) return;
    if (targetIdx < 0 || targetIdx >= questions.length) return;

    // Clear any validation message
    setValidationMsg('');

    if (reducedMotion.current) {
      setCurrentIndex(targetIdx);
      return;
    }

    transitionLocked.current = true;
    setQuestionPhase('exiting');

    setTimeout(() => {
      setCurrentIndex(targetIdx);
      setQuestionPhase('entering');
      setTimeout(() => {
        setQuestionPhase('active');
        transitionLocked.current = false;
      }, 450);
    }, 350);
  }, [currentIndex, questions.length]);

  // ── Select option (preserved + clears validation) ──
  const handleSelectOption = async (questionId: string, optionId: string) => {
    if (transitionLocked.current) return;
    setValidationMsg(''); // Clear validation on selection
    setQuestions(prev => prev.map(q => q.id === questionId ? { ...q, selectedOptionId: optionId } : q));
    setSaving(true);
    try {
      const token = localStorage.getItem('participant_token') || '';
      await fetch(`${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') || 'http://localhost:3001'}/api/participant/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ questionId, selectedOptionId: optionId })
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Phase 3: Show validation feedback
  const showValidation = (msg: string) => {
    if (validationTimer.current) clearTimeout(validationTimer.current);
    setValidationMsg(msg);
    validationTimer.current = setTimeout(() => setValidationMsg(''), 3000);
  };

  // Phase 3: Enhanced submit with completion transition
  const handleSubmitRound = () => {
    if (transitionLocked.current) return;
    setShowConfirm(true);
  };

  const doConfirmSubmit = async () => {
    setShowConfirm(false);
    setIsCompleting(true);

    // Short completion pause for visual feedback
    await new Promise(r => setTimeout(r, reducedMotion.current ? 100 : 800));
    await doSubmitRound();
  };

  // ── Navigation with optional validation ──
  const goNext = () => {
    const currentQ = questions[currentIndex];
    // If the round requires answers and none selected, show validation
    if (round.requireAnswer && !currentQ?.selectedOptionId) {
      showValidation('Choose your course before continuing.');
      return;
    }
    navigateTo(currentIndex + 1);
  };
  const goPrev = () => navigateTo(currentIndex - 1);
  const goToQuestion = (idx: number) => navigateTo(idx);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const optionLetter = (idx: number) => String.fromCharCode(65 + idx);

  // Cleanup validation timer
  useEffect(() => {
    return () => {
      if (validationTimer.current) clearTimeout(validationTimer.current);
    };
  }, []);

  // ═══════════════════════════════════════
  // RENDER: Loading
  // ═══════════════════════════════════════
  if (loading) {
    return (
      <div className="pq-loading">
        <div className="pq-loading__marker" />
        <div className="pq-loading__text">CHARTING COURSE...</div>
        <div className="pq-loading__line">
          <div className="pq-loading__line-fill" />
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="pq-loading">
        <div className="pq-loading__text pq-loading__text--error">COURSE LOST</div>
        <div className="pq-loading__sub">Unable to chart this expedition.</div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const isTransitioning = transitionLocked.current;

  // Phase 3: Timer severity classes
  const timerClass = timeLeft !== null
    ? timeLeft <= TIMER_CRITICAL ? 'pq-chronometer--critical'
    : timeLeft <= TIMER_WARNING ? 'pq-chronometer--warning'
    : ''
    : '';

  // Question content phase class
  const qPhaseClass = questionPhase === 'entering' ? 'pq-q--entering'
    : questionPhase === 'exiting' ? 'pq-q--exiting'
    : '';

  return (
    <div className={`pq-stage ${isCompleting ? 'pq-stage--completing' : ''}`}>
      {/* ═══ BACKGROUND ═══ */}
      <div className="pq-bg" />
      <div className="pq-bg-overlay" />
      <div className="pq-fog">
        <div className="pq-fog__layer pq-fog__layer--1" />
        <div className="pq-fog__layer pq-fog__layer--2" />
      </div>

      {/* ═══ HEADER — PERMANENT ═══ */}
      <header className={`pq-hud ${hasEntrance ? 'pq-hud--entrance' : ''}`}>
        <div className="pq-hud__brand">ECHONA VOYAGE</div>
        <div className="pq-hud__round">{round.name.toUpperCase()}</div>

        {/* ═══ VOYAGE PROGRESS — PERMANENT ═══ */}
        <div className="pq-voyage-route">
          <div className="pq-voyage-line">
            <div
              className="pq-voyage-line-fill"
              style={{ width: `${(currentIndex / Math.max(questions.length - 1, 1)) * 100}%` }}
            />
          </div>
          <div className="pq-voyage-points">
            {questions.map((q, idx) => {
              let state = 'future';
              if (idx < currentIndex) state = 'past';
              if (idx === currentIndex) state = 'current';
              // Phase 3: show answered state on past markers
              const answered = q.selectedOptionId ? 'pq-voyage-point--answered' : '';
              const PointTag = round.allowQuestionNav ? 'button' : 'div';
              const pointProps = round.allowQuestionNav && !isTransitioning
                ? { onClick: () => goToQuestion(idx) } : {};
              return (
                <PointTag
                  key={idx}
                  className={`pq-voyage-point pq-voyage-point--${state} ${answered}`}
                  {...pointProps}
                >
                  {state === 'current' && <div className="pq-voyage-glow" />}
                </PointTag>
              );
            })}
          </div>
        </div>
      </header>

      {/* ═══ MAP STAGE — PERMANENT ═══ */}
      <main className="pq-table">
        <div className={`pq-map-container ${hasEntrance ? 'pq-map--entrance' : ''}`}>
          <img src="/captain-map.png" alt="Captain's Map" className="pq-map-img" />

          {/* ═══ MAP CONTENT ═══ */}
          <div className="pq-map-content">

            {/* QUESTION CONTENT — transitions */}
            <div className={`pq-question-inner ${qPhaseClass}`}>
              <div className="pq-question-number">
                QUESTION {String(currentIndex + 1).padStart(2, '0')}
              </div>
              <div className="pq-question-text">{currentQ.text}</div>

              <div className="pq-options">
                {currentQ.options.map((opt: any, idx: number) => {
                  const isSelected = currentQ.selectedOptionId === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleSelectOption(currentQ.id, opt.id)}
                      className={`pq-option ${isSelected ? 'pq-option--selected' : ''}`}
                      style={{ '--plaque-delay': `${idx * 70}ms` } as React.CSSProperties}
                      aria-pressed={isSelected}
                      disabled={isTransitioning || isCompleting}
                    >
                      <span className="pq-option__letter">{optionLetter(idx)}</span>
                      <span className="pq-option__text">{opt.text}</span>
                    </button>
                  );
                })}
              </div>

              {/* Phase 3: Validation message */}
              {validationMsg && (
                <div className="pq-validation" role="alert">
                  {validationMsg}
                </div>
              )}
            </div>

            {/* NAVIGATION — PERMANENT */}
            <div className="pq-actions">
              <button
                className="pq-btn pq-btn--prev"
                onClick={goPrev}
                disabled={currentIndex === 0 || !round.allowPrevQuestion || isTransitioning}
              >
                ← PREVIOUS
              </button>

              {currentIndex < questions.length - 1 ? (
                <button
                  className="pq-btn pq-btn--next"
                  onClick={goNext}
                  disabled={isTransitioning}
                >
                  NEXT →
                </button>
              ) : (
                <button
                  className="pq-btn pq-btn--submit"
                  onClick={handleSubmitRound}
                  disabled={isTransitioning || isCompleting}
                >
                  FINISH EXPEDITION
                </button>
              )}
            </div>
          </div>

          {/* ═══ CHRONOMETER — PERMANENT ═══ */}
          {timeLeft !== null && (
            <div className={`pq-chronometer ${timerClass}`}>
              <img src="/nautical-chronometer.png" alt="Chronometer" className="pq-chronometer__img" />
              <div className="pq-chronometer__time">{formatTime(timeLeft)}</div>
            </div>
          )}

          {/* ═══ COMPASS — PERMANENT ═══ */}
          <div className="pq-compass">
            <img src="/antique-compass.png" alt="Compass" className="pq-compass__img" />
          </div>
        </div>
      </main>

      {/* Saving Indicator */}
      {saving && <div className="pq-saving">RECORDING...</div>}

      {/* Completion overlay */}
      {isCompleting && (
        <div className="pq-completing">
          <div className="pq-completing__text">EXPEDITION COMPLETE</div>
        </div>
      )}

      {showConfirm && (
        <ConfirmModal
          title="ANCHOR YOUR ANSWERS"
          message="Are you sure you want to submit your answers? Once anchored, they cannot be changed."
          onConfirm={doConfirmSubmit}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
};
