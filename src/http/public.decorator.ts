import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route or controller as reachable without a session (ADR-0012).
 * Everything else is denied by default by the global access-token guard.
 * Lives in shared HTTP infrastructure so non-domain modules (e.g. health)
 * don't depend on the identity module (ADR-0003).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
