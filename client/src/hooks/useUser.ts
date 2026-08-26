import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import type { UserIdentifyResponse, UserProfile } from '../types/uml';

const USER_STORAGE_KEY = 'uml_user_profile';

export function useUser() {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const stored = localStorage.getItem(USER_STORAGE_KEY);
      return stored ? (JSON.parse(stored) as UserProfile) : null;
    } catch {
      return null;
    }
  });

  const [knownUsers, setKnownUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchKnownUsers = useCallback(async () => {
    try {
      const data = await api.listUsers();
      setKnownUsers(data.users);
    } catch {
      // Backend may be offline or starting up
    }
  }, []);

  useEffect(() => {
    void fetchKnownUsers();
  }, [fetchKnownUsers]);

  const identify = useCallback(
    async (name: string): Promise<UserIdentifyResponse> => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.identifyUser(name);
        setUser(res.user);
        try {
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.user));
        } catch {
          /* private browsing */
        }
        void fetchKnownUsers();
        return res;
      } catch (err) {
        const msg = (err as Error).message || 'Failed to identify user';
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchKnownUsers],
  );

  const selectUser = useCallback((selected: UserProfile) => {
    setUser(selected);
    try {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(selected));
    } catch {
      /* private browsing */
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    try {
      localStorage.removeItem(USER_STORAGE_KEY);
    } catch {
      /* private browsing */
    }
  }, []);

  return {
    user,
    knownUsers,
    loading,
    error,
    identify,
    selectUser,
    logout,
    refreshKnownUsers: fetchKnownUsers,
  };
}
