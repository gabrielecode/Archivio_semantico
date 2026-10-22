import {createRoot} from 'react-dom/client';
import AuthGate from './AuthGate.tsx';
import './styles/tailwind.css';
import {inject} from '@vercel/analytics';

inject();

createRoot(document.getElementById('root')!).render(<AuthGate />);
