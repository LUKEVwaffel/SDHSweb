import { useState, useEffect } from 'react';
import { supabase as SB } from '../../../../../lib/supabaseClient';

import { loadStudioPhotos } from '../../../../../lib/ballStudioPhotos';
export function useStudioPhotos() {
  const [state, setState] = useState({ photos: [], events: [], warnings: [], loading: true });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    loadStudioPhotos(SB).then(data => { if (alive) setState({ ...data, loading: false }); }).catch(error => { if (alive) setState({ photos: [], events: [], warnings: [error.message], loading: false }); });
    return () => { alive = false; };
  }, [retry]);
  return { ...state, refresh: () => { setState(s => ({...s, loading:true})); setRetry(n => n + 1); } };
}
