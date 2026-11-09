import firebaseConfig from '../../firebase-applet-config.json';

export const GOOGLE_CLIENT_ID = 
    (firebaseConfig as any).oAuthClientId || 
    '503597516774-0pd393lig5sd0jda5i7jfofv3l37090c.apps.googleusercontent.com';
