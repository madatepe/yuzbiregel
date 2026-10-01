import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// No StrictMode: double-mounted effects would re-subscribe the same realtime topic.
createRoot(document.getElementById('root')!).render(<App />)
