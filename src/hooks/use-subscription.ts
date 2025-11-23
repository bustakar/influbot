'use client';

import { useCallback, useEffect, useState } from 'react';

export function useSubscription() {
  const [hasActiveSubscription, setHasActiveSubscription] = useState<
    boolean | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkSubscription = useCallback(async () => {
    try {
      const response = await fetch('/api/check-subscription');
      if (!response.ok) {
        setHasActiveSubscription(false);
        setIsLoading(false);
        return;
      }
      const data = await response.json();
      setHasActiveSubscription(data.hasActiveSubscription ?? false);
      setIsLoading(false);
    } catch (error) {
      console.error('Error checking subscription:', error);
      setHasActiveSubscription(false);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initialCheck() {
      await checkSubscription();
    }

    initialCheck();

    return () => {
      mounted = false;
    };
  }, [checkSubscription]);

  return {
    hasActiveSubscription: hasActiveSubscription ?? false,
    isLoading,
    refetch: checkSubscription,
  };
}
