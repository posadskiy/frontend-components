import type { RegisterProps } from '../types';
import { CredentialsForm } from './CredentialsForm';

export function Register(props: RegisterProps) {
  return <CredentialsForm {...props} mode="register" />;
}
