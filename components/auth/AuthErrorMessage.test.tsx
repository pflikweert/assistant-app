import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import AuthErrorMessage from './AuthErrorMessage';

describe('AuthErrorMessage', () => {
  it('toont juiste foutmelding voor verlopen link', () => {
    const { getByText } = render(
      <AuthErrorMessage code="otp_expired" onReset={jest.fn()} />
    );
    expect(getByText(/verlopen/i)).toBeTruthy();
    expect(getByText(/Vraag nieuw wachtwoord aan/i)).toBeTruthy();
  });

  it('toont custom error description', () => {
    const { getByText } = render(
      <AuthErrorMessage code="unknown" description="Testfout" onReset={jest.fn()} />
    );
    expect(getByText(/Testfout/)).toBeTruthy();
  });

  it('roept onReset aan bij knopdruk', () => {
    const onReset = jest.fn();
    const { getByText } = render(
      <AuthErrorMessage code="otp_expired" onReset={onReset} />
    );
    fireEvent.press(getByText(/Vraag nieuw wachtwoord aan/i));
    expect(onReset).toHaveBeenCalled();
  });
});
