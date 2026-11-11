import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { makeDeck, readDeck } from '../../../../../lib/ballPresentation';
import { supabase as SB } from '../../../../../lib/supabaseClient';
import { CLOUD_DECK_PREFIX as PREFIX, saveStudioCloud, createStudioSaveQueue } from '../../../../../lib/ballStudioCloud';
export function useStudioDecks(account) {
  const key = `ball-studio:v1:${account || 'staff'}`;
  const [initial] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (saved?.decks?.length) return { decks: saved.decks.map(d => ({ ...readDeck(d), id:d.id, cloudRevision:d.cloudRevision,cloudSavedVersion:d.cloudSavedVersion,cloudSavedAt:d.cloudSavedAt,updatedAt:d.updatedAt })), active:saved.active, error:'' };
    } catch { return {decks:[makeDeck()],error:'Browser recovery could not be read. Your old recovery data has not been overwritten; download a backup before continuing.'}; }
    return {decks:[makeDeck()],error:''};
  });
  const [decks, setDecks] = useState(initial.decks);
  const [activeId, setActiveId] = useState(initial.active || initial.decks[0].id);
  const [storageError, setStorageError] = useState(initial.error);
  const [localSaved, setLocalSaved] = useState(false);
  const [cloudSaving, setCloudSaving] = useState(0);
  const [cloudErrors, setCloudErrors] = useState({});
  const [retry, setRetry] = useState(0);
  const [history, setHistory] = useState({ past:[], future:[] });
  const decksRef = useRef(decks); decksRef.current = decks;
  const deck = decks.find(d => d.id === activeId) || decks[0];
  const deckRef = useRef(deck); deckRef.current = deck;
  const activeRef = useRef(activeId); activeRef.current = activeId;
  const saveBlocked = useRef(!!initial.error);
  useEffect(() => {
    setLocalSaved(false);
    const id = setTimeout(() => {
      if (saveBlocked.current) return;
      try { localStorage.setItem(key, JSON.stringify({decks,active:activeId})); setStorageError(''); setLocalSaved(true); }
      catch { setStorageError('Browser recovery is full or disabled. Save to cloud or download a deck backup now.'); }
    }, 350);
    return () => clearTimeout(id);
  }, [key, decks, activeId]);
  // Flush the latest edit when the admin switches panels before the debounce.
  useEffect(() => () => {
    if (saveBlocked.current) return;
    try { localStorage.setItem(key, JSON.stringify({decks:decksRef.current,active:activeRef.current})); } catch { /* The existing storage error directs the user to a backup. */ }
  }, [key]);
  // Warn on close while the short autosave debounce is still pending or failed.
  useEffect(() => {
    const warn = e => { if (!localSaved && deck.cloudSavedVersion !== deck.updatedAt) {e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [localSaved, deck.updatedAt, deck.cloudSavedVersion]);
  const edit = useCallback(updater => {
    const current = deckRef.current;
    const next = {...(typeof updater === 'function' ? updater(current) : updater), updatedAt:new Date(Math.max(Date.now(), (Date.parse(current.updatedAt) || 0) + 1)).toISOString()};
    setHistory(h => ({ past:[...h.past.slice(-59),current], future:[] }));
    setDecks(all => all.map(d => d.id === current.id ? next : d));
  }, []);
  function undo() { if (!history.past.length) return; const previous = history.past.at(-1); setHistory(h => ({past:h.past.slice(0,-1),future:[deck,...h.future]})); setDecks(all => all.map(d => d.id === deck.id ? {...previous,cloudRevision:d.cloudRevision,cloudSavedVersion:d.cloudSavedVersion,cloudSavedAt:d.cloudSavedAt,updatedAt:new Date().toISOString()} : d)); }
  function redo() { if (!history.future.length) return; const next=history.future[0]; setHistory(h=>({past:[...h.past,deck],future:h.future.slice(1)})); setDecks(all=>all.map(d=>d.id===deck.id?{...next,cloudRevision:d.cloudRevision,cloudSavedVersion:d.cloudSavedVersion,cloudSavedAt:d.cloudSavedAt,updatedAt:new Date().toISOString()}:d)); }
  function switchDeck(id) { setActiveId(id); setHistory({past:[],future:[]}); }
  function addDeck(next = makeDeck()) { setDecks(all => [...all,next]); switchDeck(next.id); }
  const saveQueue = useMemo(() => createStudioSaveQueue({
    getDeck: id => decksRef.current.find(d => d.id === id),
    save: current => saveStudioCloud(SB, current, account),
    saved: (id, version, revision) => {
      const next = decksRef.current.map(d => d.id === id ? {...d,cloudRevision:revision,cloudSavedVersion:version,cloudSavedAt:revision} : d);
      decksRef.current = next;
      setDecks(next);
      if (!saveBlocked.current) {
        try { localStorage.setItem(key, JSON.stringify({decks:next,active:activeRef.current})); setLocalSaved(true); setStorageError(''); }
        catch { setStorageError('Saved to the site, but browser recovery is unavailable.'); }
      }
    },
  }), [account,key]);
  const saveCloud = useCallback(async (id = deckRef.current.id) => {
    setCloudSaving(n => n + 1);
    try {
      const version = await saveQueue.request(id);
      setCloudErrors(errors => {const next={...errors};delete next[id];return next;});
      return version;
    } catch (error) {
      setCloudErrors(errors => ({...errors,[id]:error.message}));
      throw error;
    } finally { setCloudSaving(n => n - 1); }
  }, [saveQueue]);
  useEffect(() => {
    const timers = decks.filter(d => d.cloudSavedVersion !== d.updatedAt && !cloudErrors[d.id]).map(d =>
      setTimeout(() => {void saveCloud(d.id).catch(() => {});}, 1000));
    return () => timers.forEach(clearTimeout);
  }, [decks,cloudErrors,saveCloud,retry]);
  useEffect(() => {
    // Retry connection failures automatically; conflicts stay visible for review.
    const reconnect = () => setCloudErrors(errors => Object.fromEntries(Object.entries(errors).filter(([,message]) => /another device|already exists|duplicate key/i.test(message))));
    const timer=setInterval(()=>{reconnect();setRetry(n=>n+1);},15000);
    window.addEventListener('online',reconnect);
    return () => {clearInterval(timer);window.removeEventListener('online',reconnect);};
  }, []);
  async function listCloud() {
    const {data,error} = await SB.from('admin_settings').select('key,value,updated_at').like('key',PREFIX + '%').order('updated_at',{ascending:false});
    if (error) throw error;
    return data;
  }
  function openCloud(row) {
    const next = {...readDeck(row.value), id:row.key.slice(PREFIX.length),cloudRevision:row.updated_at,cloudSavedVersion:row.value.updatedAt,cloudSavedAt:row.updated_at,updatedAt:row.value.updatedAt};
    // Preserve local work as a separate recovery deck before replacing it.
    setDecks(all => { const local = all.find(d => d.id === next.id); const rest=all.filter(d=>d.id!==next.id); if (local && local.updatedAt !== row.value.updatedAt) rest.push({...local,id:crypto.randomUUID(),name:`${local.name} · local recovery`,cloudRevision:null,cloudSavedVersion:null,cloudSavedAt:null}); return [...rest,next]; });
    switchDeck(next.id);
  }
  return {decks,deck,edit,undo,redo,canUndo:!!history.past.length,canRedo:!!history.future.length,switchDeck,addDeck,saveCloud,listCloud,openCloud,storageError,localSaved,cloudSaving:cloudSaving>0,cloudError:cloudErrors[deck.id] || ''};
}
