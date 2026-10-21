import { useEffect, useRef, useState } from 'react';
import { WS_URL } from './lib/config.js';
import { PlayMotionSocket } from './lib/socket.js';
import { storage } from './lib/storage.js';
import CameraScreen from './screens/CameraScreen.jsx';
import JoinScreen from './screens/JoinScreen.jsx';
import PrivacyScreen from './screens/PrivacyScreen.jsx';

const codeFromUrl = () => {
  const code = new URLSearchParams(window.location.search).get('code');
  return code && /^\d{6}$/.test(code) ? code : '';
};

const CODE_ERRORS = ['BAD_CODE', 'CODE_NOT_FOUND', 'SESSION_FULL'];

export default function App() {
  const [code, setCode] = useState(codeFromUrl);
  const [link, setLink] = useState({ status: 'idle', error: null, joined: false, everJoined: false, tvConnected: false, userId: null, code: null });
  const [practice, setPractice] = useState(false);
  const [privacyOk, setPrivacyOk] = useState(() => storage.get('privacyOk') === '1');
  const socketRef = useRef(null);
  const eventHandlerRef = useRef(null);

  useEffect(() => {
    const socket = new PlayMotionSocket(WS_URL, {
      // Any change in the socket means we're not in the session until the server says "joined" again.
      onStatus: (status, error) => setLink((l) => ({ ...l, status, joined: false, error: error ?? null })),
      onMessage: (msg) => {
        if (msg.type === 'joined') {
          setLink((l) => ({ ...l, status: 'joined', joined: true, everJoined: true, tvConnected: true, error: null, code: msg.code, userId: msg.userId ?? l.userId }));
        } else if (msg.type === 'error') {
          if (CODE_ERRORS.includes(msg.code)) {
            socket.forgetCode();
            setCode('');
          }
          setLink((l) => ({ ...l, error: msg.message }));
        } else if (msg.type === 'peer.joined' && msg.role === 'tv') {
          setLink((l) => ({ ...l, tvConnected: true }));
        } else if (msg.type === 'peer.left' && msg.role === 'tv') {
          setLink((l) => ({ ...l, tvConnected: false }));
        } else if (msg.type === 'event') {
          if (msg.event === 'hello' && msg.payload?.userId) setLink((l) => ({ ...l, userId: msg.payload.userId }));
          eventHandlerRef.current?.(msg);
        }
      },
    });
    socketRef.current = socket;
    socket.connect();
    return () => socket.close();
  }, []);

  useEffect(() => {
    if (code) socketRef.current?.join(code);
  }, [code]);

  // Once paired, a dropped connection shows "Reconnecting…" on the camera screen instead of going back to the code screen.
  if (!link.everJoined && !practice) {
    const submit = (next) => {
      setLink((l) => ({ ...l, error: null }));
      setCode(next);
    };
    return <JoinScreen code={code} link={link} onSubmit={submit} onPractice={() => setPractice(true)} />;
  }
  if (!privacyOk) {
    return (
      <PrivacyScreen
        connected={link.joined}
        onAccept={() => {
          storage.set('privacyOk', '1');
          setPrivacyOk(true);
        }}
      />
    );
  }
  return <CameraScreen socketRef={socketRef} link={link} eventHandlerRef={eventHandlerRef} />;
}
