import { Redirect } from 'expo-router';
import { useSession } from '../store/session';
import { Welcome } from '../components/Welcome';

/** Identity entry point: first run, lost sessions, and sign-in alike. */
export default function WelcomeScreen() {
  const status = useSession((s) => s.status);
  if (status === 'ready') return <Redirect href="/" />;
  return <Welcome mode={status === 'signedout' ? 'resume' : 'fresh'} />;
}
