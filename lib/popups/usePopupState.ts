'use client';

import { useEffect, useState } from 'react';
import { readPopupState, subscribePopupState } from '@/lib/popups/popupManager';

export function usePopupState() {
  const [snapshot, setSnapshot] = useState(() => readPopupState());

  useEffect(() => {
    return subscribePopupState(setSnapshot);
  }, []);

  return snapshot;
}
