import { HarEntry } from 'har-format';

/**
 * Represents a parsed cookie.
 */
export interface Cookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

/**
 * Represents a dependency between two requests based on a cookie.
 */
export interface CookieDependency {
  cookie: Cookie;
  setter: HarEntry;
  getter: HarEntry;
}

/**
 * Represents a session, which is a collection of related cookies and their dependencies.
 */
export interface Session {
  id: string; // A unique identifier for the session
  cookies: Cookie[];
  dependencies: CookieDependency[];
  startTime: Date;
  endTime: Date;
}

/**
 * The result of the session analysis.
 */
export interface SessionAnalysisResult {
  sessions: Session[];
  unassignedCookies: Cookie[];
}
