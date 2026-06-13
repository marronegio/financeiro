import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

// Retorna 'loading' | 'active' | 'inactive'
export function useSubscription(user) {
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    if (!user) {
      setStatus('inactive');
      return;
    }

    let ignore = false;

    async function check() {
      const { data } = await supabase
        .from('profiles')
        .select('subscription_status')
        .eq('id', user.id)
        .single();

      if (!ignore) {
        setStatus(data?.subscription_status === 'active' ? 'active' : 'inactive');
      }
    }

    check();
    return () => { ignore = true; };
  }, [user]);

  return status;
}
