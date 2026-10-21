import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// ?embed=1: running inside the TV app's laptop-camera panel, so use a compact layout.
if (new URLSearchParams(window.location.search).get('embed') === '1') document.documentElement.classList.add('embed');

createRoot(document.getElementById('root')).render(<App />);
