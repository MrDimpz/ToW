import { useCallback, useEffect, useRef, useState } from 'react';
import { soundEngine } from './audio/soundEngine';
import { BattlefieldCanvas } from './components/BattlefieldCanvas';
import { BottomDock } from './components/BottomDock';
import { HorizonCommandDeck } from './components/HorizonCommandDeck';
import { HostDrawer } from './components/HostDrawer';
import { TopHud } from './components/TopHud';
import { VictoryOverlay } from './components/VictoryOverlay';
import { gameEngine } from './engine/gameEngine';
import type { HudSnapshot, TikTokChatMessage, WsConnectionStatus } from './types';

function parseIncomingTikTokJson(raw: string): TikTokChatMessage | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    // Standard TikFinity / TikTok-Live-Connector wrapper: { event: 'chat', data: { nickname, uniqueId, profilePictureUrl, comment } }
    if (parsed.event && parsed.event !== 'chat') return null;
    const data = parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;

    const comment = typeof data.comment === 'string' ? data.comment : typeof data.text === 'string' ? data.text : '';
    const nickname =
      (typeof data.nickname === 'string' && data.nickname.trim()) ||
      (typeof data.uniqueId === 'string' && data.uniqueId.trim()) ||
      (typeof data.username === 'string' && data.username.trim()) ||
      '';
    const username =
      (typeof data.uniqueId === 'string' && data.uniqueId.trim()) ||
      (typeof data.username === 'string' && data.username.trim()) ||
      nickname;
    const avatarUrl =
      typeof data.profilePictureUrl === 'string'
        ? data.profilePictureUrl
        : typeof data.avatarUrl === 'string'
        ? data.avatarUrl
        : undefined;

    if (!username || !comment) return null;
    return { username, nickname, avatarUrl, comment };
  } catch {
    return null;
  }
}

export default function App() {
  const [hud, setHud] = useState<HudSnapshot>(() => gameEngine.getSnapshot());
  const [drawerOpen, setDrawerOpen] = useState(false);

  // TikTok Live WebSocket Bridge state
  const [wsUrl, setWsUrl] = useState('ws://localhost:21213');
  const [wsStatus, setWsStatus] = useState<WsConnectionStatus>('DISCONNECTED');
  const [wsError, setWsError] = useState<string | null>(null);
  const [wsMessageCount, setWsMessageCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);

  // Subscribe to game engine HUD snapshots
  useEffect(() => {
    return gameEngine.subscribe((snapshot) => {
      setHud(snapshot);
    });
  }, []);

  // Expose global window.onTikTokChatMessage({ username, avatarUrl, comment }) bridge
  useEffect(() => {
    window.onTikTokChatMessage = (payload: TikTokChatMessage) => {
      if (!payload || typeof payload !== 'object') return;
      gameEngine.processChatMessage(payload);
    };
    return () => {
      delete window.onTikTokChatMessage;
    };
  }, []);

  // Unlock Web Audio API on first user gesture anywhere in the window
  useEffect(() => {
    const unlock = () => {
      soundEngine.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Clean up WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const handleDisconnectWs = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setWsStatus('DISCONNECTED');
    setWsError(null);
  }, []);

  const handleConnectWs = useCallback(() => {
    const trimmed = wsUrl.trim();
    if (!/^wss?:\/\/.+/.test(trimmed)) {
      setWsError('URL must start with ws:// or wss://');
      return;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setWsError(null);
    setWsStatus('CONNECTING');

    try {
      const socket = new WebSocket(trimmed);
      wsRef.current = socket;

      socket.onopen = () => {
        setWsStatus('CONNECTED');
        setWsError(null);
      };

      socket.onmessage = (event) => {
        if (typeof event.data !== 'string') return;
        const msg = parseIncomingTikTokJson(event.data);
        if (msg) {
          setWsMessageCount((c) => c + 1);
          gameEngine.processChatMessage(msg);
        }
      };

      socket.onerror = () => {
        setWsError('Unable to reach local TikFinity / TikTok-Live-Connector bridge.');
        setWsStatus('ERROR');
      };

      socket.onclose = () => {
        setWsStatus((prev) => (prev === 'ERROR' ? 'ERROR' : 'DISCONNECTED'));
        if (wsRef.current === socket) {
          wsRef.current = null;
        }
      };
    } catch {
      setWsError('Failed to open WebSocket connection.');
      setWsStatus('ERROR');
    }
  }, [wsUrl]);

  return (
    <main className="w-screen h-[100dvh] bg-[#05060B] flex items-center justify-center overflow-hidden">
      {/* Centered 9:16 Vertical TikTok Live Frame (Full screen on mobile, 9:16 broadcast container on desktop) */}
      <div
        className="relative w-full h-full md:h-[min(100dvh,100%)] md:w-auto md:aspect-[9/16] max-w-[540px] bg-[#090B14] flex flex-col overflow-hidden md:border-x md:border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.9)]"
      >
        {/* 1. TOP STATUS HUD (10.5% height) */}
        <TopHud hud={hud} />

        {/* 2. TERRITORY BATTLEFIELD (72% height: 60fps HTML5 Canvas + Horizon Command Deck + Victory Podium) */}
        <div className="relative flex-1 min-h-0 w-full overflow-hidden bg-[#090B14]">
          <BattlefieldCanvas />
          <HorizonCommandDeck hud={hud} />
          <VictoryOverlay
            hud={hud}
            onStartNextMatch={() => gameEngine.startNextMatch()}
          />
        </div>

        {/* 3. BOTTOM USED-WORDS TICKER & STREAMER HOST DOCK (17.5% height) */}
        <BottomDock
          hud={hud}
          wsStatus={wsStatus}
          onTogglePause={() => gameEngine.togglePause()}
          onResetTeams={() => gameEngine.resetTeams()}
          onNextPhase={() => gameEngine.advancePhase()}
          onToggleMute={() => gameEngine.toggleMute()}
          onOpenDrawer={() => setDrawerOpen(true)}
        />

        {/* 4. HOST STUDIO DRAWER (Simulator / Manual Test / TikTok Live WebSocket Bridge) */}
        <HostDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          hud={hud}
          wsUrl={wsUrl}
          wsStatus={wsStatus}
          wsError={wsError}
          wsMessageCount={wsMessageCount}
          onWsUrlChange={setWsUrl}
          onConnectWs={handleConnectWs}
          onDisconnectWs={handleDisconnectWs}
          onToggleSim={(enabled) => gameEngine.setSimulatorEnabled(enabled)}
          onChangeIntensity={(intensity) => gameEngine.setSimIntensity(intensity)}
        />
      </div>
    </main>
  );
}
