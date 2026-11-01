import { useState } from 'react';
import type { LoginProps } from '../types';
import { CredentialsForm } from './CredentialsForm';
import { ForgotPassword } from './ForgotPassword';

export function Login(props: LoginProps) {
  const [forgot, setForgot] = useState(false);
  const showForgot = props.showForgotPassword !== false;

  if (forgot && showForgot) {
    return (
      <ForgotPassword
        apiUrl={props.apiUrl}
        accountApiUrl={props.accountApiUrl}
        authApi={props.authApi}
        linkOrigin={props.linkOrigin}
        onError={props.onError}
        labels={props.labels}
        className={props.className}
        style={props.style}
        getCaptchaToken={props.getCaptchaToken}
        turnstileSiteKey={props.turnstileSiteKey}
        captcha={props.captcha}
        onBack={() => setForgot(false)}
      />
    );
  }

  return (
    <CredentialsForm
      {...props}
      mode="login"
      onForgotPassword={showForgot ? () => setForgot(true) : undefined}
    />
  );
}
