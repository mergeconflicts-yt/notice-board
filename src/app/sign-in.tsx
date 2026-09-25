import { Redirect } from 'expo-router';

/** The old sign-in route now lives at /welcome; keep this alias so saved
 *  links and in-app pushes to /sign-in don't 404. */
export default function SignInScreen() {
  return <Redirect href="/welcome" />;
}
