import { HarEntry } from 'har-format';
import { Cookie, CookieDependency, Session, SessionAnalysisResult } from './types';

export class SessionManager {
  /**
   * Analyzes the HAR entries to identify sessions and cookie dependencies.
   * @param entries The HAR entries to analyze.
   * @returns The session analysis result.
   */
  public analyze(entries: HarEntry[]): SessionAnalysisResult {
    const cookieToSetterMap = this.mapCookiesToSetters(entries);
    const dependencies = this.findCookieDependencies(entries, cookieToSetterMap);
    const sessions = this.groupCookiesIntoSessions(dependencies);

    const assignedCookies = new Set<string>();
    for (const session of sessions) {
      for (const cookie of session.cookies) {
        assignedCookies.add(this.getCookieIdentifier(cookie));
      }
    }

    const unassignedCookies = Array.from(cookieToSetterMap.values())
      .map(c => c.cookie)
      .filter(c => !assignedCookies.has(this.getCookieIdentifier(c)));

    return {
      sessions,
      unassignedCookies,
    };
  }

  private getCookieIdentifier(cookie: Cookie): string {
    return `${cookie.name};${cookie.domain};${cookie.path}`;
  }

  private mapCookiesToSetters(entries: HarEntry[]): Map<string, { cookie: Cookie; setter: HarEntry }> {
    const cookieMap = new Map<string, { cookie: Cookie; setter: HarEntry }>();
    for (const entry of entries) {
      const setCookieHeaders = entry.response.headers.filter(
        (h) => h.name.toLowerCase() === 'set-cookie'
      );
      for (const header of setCookieHeaders) {
        const parsedCookie = this.parseSetCookieHeader(header.value, entry.request.url);
        if (parsedCookie) {
          cookieMap.set(this.getCookieIdentifier(parsedCookie), { cookie: parsedCookie, setter: entry });
        }
      }
    }
    return cookieMap;
  }

  private findCookieDependencies(
    entries: HarEntry[],
    cookieMap: Map<string, { cookie: Cookie; setter: HarEntry }>
  ): CookieDependency[] {
    const dependencies: CookieDependency[] = [];
    for (const getter of entries) {
      const cookieHeader = getter.request.headers.find(
        (h) => h.name.toLowerCase() === 'cookie'
      );
      if (cookieHeader) {
        const usedCookies = this.parseCookieHeader(cookieHeader.value);
        for (const usedCookie of usedCookies) {
          for (const [id, { cookie, setter }] of cookieMap.entries()) {
            if (this.isCookieMatch(usedCookie, cookie, getter.request.url)) {
              dependencies.push({ cookie, setter, getter });
            }
          }
        }
      }
    }
    return dependencies;
  }

  private groupCookiesIntoSessions(dependencies: CookieDependency[]): Session[] {
    const sessions: Session[] = [];
    // This is a placeholder for a more sophisticated session grouping algorithm.
    // For now, we'll create a single session with all dependent cookies.
    if (dependencies.length > 0) {
        const allCookies = new Map<string, Cookie>();
        dependencies.forEach(dep => {
            const id = this.getCookieIdentifier(dep.cookie);
            if (!allCookies.has(id)) {
                allCookies.set(id, dep.cookie);
            }
        });

        const session: Session = {
            id: 'session-1',
            cookies: Array.from(allCookies.values()),
            dependencies: dependencies,
            startTime: dependencies.reduce((earliest, dep) => new Date(dep.setter.startedDateTime) < earliest ? new Date(dep.setter.startedDateTime) : earliest, new Date()),
            endTime: dependencies.reduce((latest, dep) => new Date(dep.getter.startedDateTime) > latest ? new Date(dep.getter.startedDateTime) : latest, new Date(0)),
        };
        sessions.push(session);
    }
    return sessions;
  }

  private parseCookieHeader(headerValue: string): { name: string; value: string }[] {
    return headerValue.split(';').map(p => {
      const [name, ...valueParts] = p.trim().split('=');
      return { name, value: valueParts.join('=') };
    });
  }

  private isCookieMatch(
    usedCookie: { name: string; value: string },
    storedCookie: Cookie,
    requestUrl: string
  ): boolean {
    if (usedCookie.name !== storedCookie.name) {
      return false;
    }

    const requestHost = new URL(requestUrl).hostname;
    if (storedCookie.domain) {
        // Domain matching according to RFC 6265
        const domain = storedCookie.domain.startsWith('.') ? storedCookie.domain.substring(1) : storedCookie.domain;
        if (!requestHost.endsWith(domain)) {
            return false;
        }
    }

    const requestPath = new URL(requestUrl).pathname;
    if (storedCookie.path && !requestPath.startsWith(storedCookie.path)) {
        return false;
    }

    return true;
  }

  /**
   * Parses a `Set-Cookie` header string into a `Cookie` object.
   * @param headerValue The value of the `Set-Cookie` header.
   * @returns A `Cookie` object, or `null` if parsing fails.
   */
  private parseSetCookieHeader(headerValue: string, requestUrl: string): Cookie | null {
    const parts = headerValue.split(';').map((p) => p.trim());
    if (parts.length === 0) {
      return null;
    }

    const [name, value] = parts[0].split('=');
    const cookie: Cookie = { name, value };

    for (let i = 1; i < parts.length; i++) {
      const [key, val] = parts[i].split('=');
      const lowerKey = key.toLowerCase();
      switch (lowerKey) {
        case 'expires':
          cookie.expires = new Date(val);
          break;
        case 'domain':
          cookie.domain = val;
          break;
        case 'path':
          cookie.path = val;
          break;
        case 'httponly':
          cookie.httpOnly = true;
          break;
        case 'secure':
          cookie.secure = true;
          break;
        case 'samesite':
          cookie.sameSite = val as 'Strict' | 'Lax' | 'None';
          break;
      }
    }

    return cookie;
  }
}
