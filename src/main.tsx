import {createRoot} from 'react-dom/client';
import AuthGate from './AuthGate.tsx';
import './styles/tailwind.css';

createRoot(document.getElementById('root')!).render(<AuthGate />);
