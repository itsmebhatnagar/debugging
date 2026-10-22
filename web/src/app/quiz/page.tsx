"use client";
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { QuizPlay } from './QuizPlay';
import './styles/participant-voyage.css';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

type AppPhase = 'loading' | 'loading-complete' | 'loading-exit' | 'ready';
type ToastType = { id: number; text: string; variant: 'warn' | 'ok' | 'error'; exiting?: boolean };

// ═══════════════════════════════════════════════════════
// COMPASS (SVG + CSS loading animation)
// ═══════════════════════════════════════════════════════

const CompassLoader: React.FC<{ complete: boolean }> = ({ complete }) => {
  const ticks = useMemo(() => {
    return Array.from({ length: 36 }, (_, i) => i * 10);
  }, []);

  const chartLines = useMemo(() => {
    return [0, 45, 90, 135].map(angle => ({
      angle,
      width: angle % 90 === 0 ? 120 : 80,
    }));
  }, []);

  return (
    <div className={`voyage-compass ${complete ? 'voyage-loading--complete' : ''}`}>
      {/* Rings */}
      <div className="voyage-compass__ring voyage-compass__ring--outer" />
      <div className="voyage-compass__ring" />
      <div className="voyage-compass__ring voyage-compass__ring--inner" />

      {/* Ticks */}
      {ticks.map(deg => (
        <div
          key={deg}
          className="voyage-compass__tick"
          style={{ transform: `rotate(${deg}deg)` }}
        />
      ))}

      {/* Cardinals */}
      <span className="voyage-compass__cardinal voyage-compass__cardinal--n">N</span>
      <span className="voyage-compass__cardinal voyage-compass__cardinal--s">S</span>
      <span className="voyage-compass__cardinal voyage-compass__cardinal--e">E</span>
      <span className="voyage-compass__cardinal voyage-compass__cardinal--w">W</span>

      {/* Needle */}
      <div className="voyage-compass__needle">
        <div className="voyage-compass__needle-shape">
          <div className="voyage-compass__needle-n" />
          <div className="voyage-compass__needle-s" />
        </div>
        <div className="voyage-compass__needle-center" />
      </div>

      {/* Chart lines */}
      <div className="voyage-compass__chartlines">
        {chartLines.map(({ angle, width }) => (
          <div
            key={angle}
            className="voyage-compass__chartline"
            style={{
              transform: `rotate(${angle}deg)`,
              width: `${width}px`,
              marginLeft: `-${width / 2}px`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// AMBIENT PARTICLES (lightweight)
// ═══════════════════════════════════════════════════════

const AmbientParticles: React.FC = () => {
  const particles = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      dx: `${(Math.random() - 0.5) * 60}px`,
      dy: `${-30 - Math.random() * 80}px`,
      duration: `${8 + Math.random() * 12}s`,
      delay: `${Math.random() * 10}s`,
      size: `${1 + Math.random() * 1.5}px`,
    }));
  }, []);

  return (
    <div className="voyage-particles">
      {particles.map(p => (
        <div
          key={p.id}
          className="voyage-particle"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            '--dx': p.dx,
            '--dy': p.dy,
            animationDuration: p.duration,
            animationDelay: p.delay,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// CONNECTION TOAST
// ═══════════════════════════════════════════════════════

const ConnectionToast: React.FC<{ toast: ToastType | null }> = ({ toast }) => {
  if (!toast) return null;
  return (
    <div className={`voyage-toast ${toast.exiting ? 'voyage-toast--exit' : ''}`} key={toast.id}>
      <div className={`voyage-toast__dot voyage-toast__dot--${toast.variant}`} />
      <span className="voyage-toast__text">{toast.text}</span>
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════

export default function QuizParticipantPage() {
  const router = useRouter();
  const navigate = (path: string) => router.push(path);

  // ── Core state (preserved from original) ──
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [roundState, setRoundState] = useState<any>(null);
  const [_, setSocket] = useState<Socket | null>(null);

  // ── Cinematic state ──
  const [phase, setPhase] = useState<AppPhase>('loading');
  const [toast, setToast] = useState<ToastType | null>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<number | null>(null);

  // ── Cookie helper (preserved) ──
  const getCookie = (name: string) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
    return null;
  };

  // ── Show toast ──
  const showToast = useCallback((text: string, variant: ToastType['variant']) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    const id = Date.now();
    setToast({ id, text, variant });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(prev => prev ? { ...prev, exiting: true } : null);
      window.setTimeout(() => setToast(null), 350);
    }, 3000);
  }, []);

  // ── Fetch status (preserved logic) ──
  const fetchStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem('participant_token') || getCookie('participant_token');
      const headers = { 'Authorization': `Bearer ${token}` };

      // 1. Profile
      const pRes = await fetch(`${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') || 'http://localhost:3001'}/api/participant/me`, {
        credentials: 'include',
        headers
      });
      if (!pRes.ok) {
        if (pRes.status === 401) {
          localStorage.removeItem('participant_token');
          navigate('/login');
        }
        return;
      }
      const pData = await pRes.json();
      setProfile(pData);

      if (pData.status === 'ELIMINATED') {
        setLoading(false);
        return;
      }

      // 2. Active Round State
      const rRes = await fetch(`${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') || 'http://localhost:3001'}/api/participant/active-round`, {
        credentials: 'include',
        headers
      });
      if (rRes.ok) {
        setRoundState(await rRes.json());
      }
    } catch (err) {
      console.error(err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // ── Socket setup (preserved logic + connection toasts) ──
  useEffect(() => {
    fetchStatus();

    const token = localStorage.getItem('participant_token') || getCookie('participant_token');
    if (!token) {
      navigate('/login');
      return;
    }

    const newSocket = io(`${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') || 'http://localhost:3001'}/participant`, {
      auth: { token },
      withCredentials: true
    });

    newSocket.on('connect', () => {
      console.log('Participant socket connected');
      showToast('Fleet Connection Restored', 'ok');
    });

    newSocket.on('round:started', fetchStatus);
    newSocket.on('round:paused', fetchStatus);
    newSocket.on('round:resumed', fetchStatus);
    newSocket.on('round:ended', fetchStatus);

    newSocket.on('quiz:abandoned', () => {
      localStorage.removeItem('participant_token');
      document.cookie = 'participant_token=; Max-Age=0; path=/;';
      window.location.href = '/login';
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      showToast('Connection Lost', 'error');
    });

    newSocket.on('reconnecting', () => {
      showToast('Reconnecting to the Fleet', 'warn');
    });

    // Heartbeat
    const interval = setInterval(() => {
      newSocket.emit('heartbeat');
    }, 30000);

    setSocket(newSocket);

    return () => {
      clearInterval(interval);
      newSocket.disconnect();
    };
  }, [navigate, fetchStatus, showToast]);

  // ── Cinematic phase sequencing ──
  useEffect(() => {
    if (loading) return;

    if (phase === 'loading') {
      setPhase('loading-complete');
    } else if (phase === 'loading-complete') {
      const timer = setTimeout(() => setPhase('loading-exit'), 200);
      return () => clearTimeout(timer);
    } else if (phase === 'loading-exit') {
      const timer = setTimeout(() => setPhase('ready'), 300); // 500 - 200 = 300
      return () => clearTimeout(timer);
    }
  }, [loading, phase]);

  // ── Parallax on mouse move (desktop only) ──
  useEffect(() => {
    if (phase !== 'ready') return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;
    const isMobile = window.matchMedia('(max-width: 768px)').matches || 'ontouchstart' in window;
    if (isMobile) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!sceneRef.current) return;
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const dx = (e.clientX - cx) / cx;
      const dy = (e.clientY - cy) / cy;

      const bg = sceneRef.current.querySelector('.voyage-bg') as HTMLElement;
      if (bg) {
        bg.style.transform = `translate(${dx * -3}px, ${dy * -2}px)`;
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [phase]);

  // ── Logout handler (preserved) ──
  const handleLogout = async () => {
    try {
      await fetch(`${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') || 'http://localhost:3001'}/api/participant/logout`, { method: 'POST', credentials: 'include' });
    } catch {}
    navigate('/dashboard');
  };

  // ── Retry handler ──
  const handleRetry = () => {
    setLoadError(false);
    setLoading(true);
    setPhase('loading');
    fetchStatus();
  };

  // ═══════════════════════════════════════════════════════
  // RENDER: Loading Error
  // ═══════════════════════════════════════════════════════

  if (loadError && !loading) {
    return (
      <div className="voyage-error">
        <div className="voyage-error__title">The Charts Could Not Be Loaded</div>
        <p className="voyage-error__message">
          The navigation instruments failed to connect to headquarters.
          Please check your connection and try again.
        </p>
        <button className="voyage-error__retry" onClick={handleRetry}>
          Retry Voyage
        </button>
        <ConnectionToast toast={toast} />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // RENDER: Loading Screen
  // ═══════════════════════════════════════════════════════

  if (phase !== 'ready') {
    return (
      <>
        <div className={`voyage-loading ${phase === 'loading-exit' ? 'voyage-loading--exit' : ''}`}>
          <div className="voyage-loading__texture" />

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 10 }}>
            <CompassLoader complete={phase === 'loading-complete' || phase === 'loading-exit'} />

            <div className="voyage-loading__text">
              <div className="voyage-loading__title">Loading the Charts...</div>
              <div className="voyage-loading__progress">
                <div className="voyage-loading__progress-fill" />
              </div>
            </div>
          </div>
        </div>
        <ConnectionToast toast={toast} />
      </>
    );
  }

  // ═══════════════════════════════════════════════════════
  // RENDER: Post-loading states (profile loaded)
  // ═══════════════════════════════════════════════════════

  if (!profile) return null;

  // ── Eliminated ──
  if (profile.status === 'ELIMINATED') {
    return (
      <div className="voyage-waiting">
        <div className="voyage-scene">
          <div className="voyage-bg" style={{ filter: 'brightness(0.25) saturate(0.4) sepia(0.3)' }} />
          <div className="voyage-vignette" />
        </div>

        <div className="voyage-parchment-wrap">
          <div className="voyage-parchment" style={{ animationDelay: '0.2s' }}>
            <div className="voyage-parchment__frame">
              <div className="voyage-parchment__content">
                <div className="voyage-parchment__label">Echona Voyage</div>
                <h2 className="voyage-parchment__heading" style={{ color: '#5A1712' }}>
                  You Walked<br />The Plank
                </h2>
                <div className="voyage-divider">
                  <div className="voyage-divider__line" />
                  <div className="voyage-divider__diamond" style={{ background: 'rgba(90, 23, 18, 0.4)' }} />
                  <div className="voyage-divider__line" />
                </div>
                <p className="voyage-parchment__message">
                  The sea is unforgiving, and your journey ends here.
                  The crew thanks you for your service, {profile.name}.
                </p>
                <button
                  className="voyage-header__logout"
                  onClick={handleLogout}
                  style={{ marginTop: '8px' }}
                >
                  Abandon Ship
                </button>
              </div>
            </div>
          </div>
        </div>
        <ConnectionToast toast={toast} />
      </div>
    );
  }

  // ── Submitted ──
  if (roundState?.status === 'SUBMITTED') {
    return (
      <div className="voyage-waiting">
        <div className="voyage-scene">
          <div className="voyage-bg" />
          <div className="voyage-vignette" />
          <div className="voyage-fog">
            <div className="voyage-fog__layer voyage-fog__layer--1" />
            <div className="voyage-fog__layer voyage-fog__layer--2" />
          </div>
        </div>

        <header className="voyage-header">
          <div className="voyage-header__left">
            <div className="voyage-header__brand">
              ECHONA VOYAGE
              <svg className="voyage-header__brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 2L15 12L22 15L15 18L12 22L9 18L2 15L9 12L12 2Z" />
              </svg>
            </div>
            <div className="voyage-header__crew-label">Crew Member</div>
            <div className="voyage-header__crew-name">{profile.name}</div>
          </div>
          <button className="voyage-header__logout" onClick={handleLogout}>
            DISEMBARK
          </button>
        </header>

        <div className="voyage-parchment-wrap">
          <div className="voyage-parchment" style={{ animationDelay: '0.2s' }}>
            <div className="voyage-parchment__frame">
              <div className="voyage-parchment__content">
                <div className="voyage-parchment__label">Echona Voyage</div>
                <h2 className="voyage-parchment__heading">
                  Answers<br />Anchored
                </h2>
                <div className="voyage-divider">
                  <div className="voyage-divider__line" />
                  <div className="voyage-divider__diamond" />
                  <div className="voyage-divider__line" />
                </div>
                <p className="voyage-parchment__message">
                  Your answers have been securely logged.
                  The captains are evaluating the scores.
                  Please await further instructions.
                </p>
                
                <div className="voyage-status-embedded">
                  <div className="voyage-status-embedded__dot" />
                  <span className="voyage-status-embedded__text">EVALUATING SCORES</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <ConnectionToast toast={toast} />
      </div>
    );
  }

  // ── Active Quiz (preserved — no redesign) ──
  if (roundState?.status === 'ACTIVE' && roundState?.round) {
    return (
      <QuizPlay
        round={roundState.round}
        session={roundState.session}
        onComplete={fetchStatus}
      />
    );
  }

  // ═══════════════════════════════════════════════════════
  // RENDER: Waiting Room (the main cinematic experience)
  // ═══════════════════════════════════════════════════════

  return (
    <div className="voyage-waiting voyage-waiting--entering">
      {/* ── Scene layers ── */}
      <div className="voyage-scene" ref={sceneRef}>
        <div className="voyage-bg" />
        <div className="voyage-vignette" />

        {/* Atmospheric layers */}
        <div className="voyage-clouds" />
        <div className="voyage-fog">
          <div className="voyage-fog__layer voyage-fog__layer--1" />
          <div className="voyage-fog__layer voyage-fog__layer--2" />
          <div className="voyage-fog__layer voyage-fog__layer--3" />
        </div>
        <div className="voyage-ocean-shimmer" />
        <div className="voyage-lantern-glow" />
        <div className="voyage-lantern-glow" style={{ top: '30%', left: '65%', width: '150px', height: '150px' }} />

        {/* Particles */}
        <AmbientParticles />
      </div>

      {/* ── Header ── */}
      <header className="voyage-header">
        <div className="voyage-header__left">
          <div className="voyage-header__brand">
            ECHONA VOYAGE
            <svg className="voyage-header__brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 2L15 12L22 15L15 18L12 22L9 18L2 15L9 12L12 2Z" />
            </svg>
          </div>
          <div className="voyage-header__crew-label">Crew Member</div>
          <div className="voyage-header__crew-name">{profile.name}</div>
        </div>
        <button className="voyage-header__logout" onClick={handleLogout}>
          DISEMBARK
        </button>
      </header>

      {/* ── Parchment ── */}
      <div className="voyage-parchment-wrap">
        <div className="voyage-parchment">
          <div className="voyage-parchment__frame">
            <div className="voyage-parchment__content">
              <div className="voyage-parchment__label">Echona Voyage</div>

              <h2 className="voyage-parchment__heading" style={profile.status === 'QUALIFIED' ? { color: '#284C14', textShadow: '0 1px 0 rgba(232,208,154,0.5)' } : {}}>
                {profile.status === 'QUALIFIED' ? (
                  <>Congratulations!<br />You Qualified!</>
                ) : (
                  <>The Calm Before<br />The Storm</>
                )}
              </h2>

              <div className="voyage-divider">
                <div className="voyage-divider__line" />
                <div className="voyage-divider__diamond" style={profile.status === 'QUALIFIED' ? { background: 'rgba(40, 76, 20, 0.6)' } : {}} />
                <div className="voyage-divider__line" />
              </div>

              <p className="voyage-parchment__captain">
                {profile.status === 'QUALIFIED' ? 'Excellent work' : 'Hold fast'}, Captain <strong>{profile.name}</strong>.
              </p>

              <p className="voyage-parchment__message">
                {profile.status === 'QUALIFIED'
                  ? "You have successfully advanced to the next stage of the voyage! Brace yourself for the upcoming challenge. The debugging challenge will appear here when the fleet gives the signal."
                  : "The next round has not yet commenced. Keep your eyes on the horizon. The debugging challenge will appear here when the fleet gives the signal."
                }
              </p>
              
              <div className="voyage-status-embedded">
                <div className="voyage-status-embedded__dot" />
                <span className="voyage-status-embedded__text">WAITING FOR SIGNAL</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Connection Toast ── */}
      <ConnectionToast toast={toast} />
    </div>
  );
};
