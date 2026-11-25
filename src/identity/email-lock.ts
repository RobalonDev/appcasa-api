/**
 * Advisory-lock namespace shared by every operation on an email in the identity
 * module (plan 001): requesting and completing a registration and signing in run one
 * after another for the same email (RF-29, RF-41, RNF-3; ADR-0010).
 */
export const EMAIL_LOCK = 'identity:email';
