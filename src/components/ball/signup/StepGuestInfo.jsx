import { useState, useEffect, useRef } from 'react';
import { P, mono } from '../../admin/theme';
import { searchRoster, resolveRosterCadet } from '../../../lib/ballApi';
import { Field, TextInput, Btn, Radio, ErrorText } from './formUi';

// Step 3 — guest info. Not every cadet brings one, so the FIRST question is
// whether there's a guest at all — everything below only shows once that's
// "yes". "Is your guest in SDHS JROTC?" then drives a roster typeahead (list
// call, no age) → select → resolve call (age, one cadet only) using the same
// signupToken from Step 1. Otherwise: other-school JROTC follow-up, then
// school attended + POC name/email/phone, always required together whenever
// the guest isn't an SDHS cadet.
export default function StepGuestInfo({ signupToken, value, onChange, onBack, onNext }) {
  const [query, setQuery] = useState(value.is_sdhs_jrotc ? value.name : '');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState('');
  const debounceRef = useRef(null);

  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value });
  const hasGuest = value.bringing_guest === true;

  useEffect(() => {
    if (!hasGuest || !value.is_sdhs_jrotc || value.sdhs_matched_cadet_id) { setResults([]); return; }
    clearTimeout(debounceRef.current);
    if (query.trim().length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const { data, error } = await searchRoster(signupToken, query.trim());
      setSearching(false);
      if (!error) setResults(data);
    }, 300);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, hasGuest, value.is_sdhs_jrotc, value.sdhs_matched_cadet_id]);

  async function pickCadet(row) {
    setErr('');
    const { data, error } = await resolveRosterCadet(signupToken, row.cadet_id);
    if (error) { setErr('Session expired — go back and re-verify.'); return; }
    onChange({ ...value, name: data.name, age: data.age ?? '', sdhs_matched_cadet_id: row.cadet_id });
    setQuery(data.name);
    setResults([]);
  }

  function clearMatch() {
    onChange({ ...value, sdhs_matched_cadet_id: null, name: '', age: '' });
    setQuery('');
  }

  function setBringingGuest(v) {
    // Switching to "no" clears any guest fields already filled in, so a
    // later "yes" doesn't submit stale partial data.
    onChange(v ? { ...value, bringing_guest: true } : { ...emptyGuestKeepFlag(), bringing_guest: false });
  }

  const notSdhs = !value.is_sdhs_jrotc;
  const canContinue =
    value.bringing_guest === false ||
    (hasGuest &&
      value.name && value.age && Number(value.age) > 0 && value.gender && value.personal_email &&
      (!notSdhs || (value.school_attended && value.poc_name && value.poc_email && value.poc_phone)) &&
      (!value.other_jrotc || value.other_jrotc_school));

  return (
    <div>
      <p style={{ fontFamily: mono, fontSize: 12, color: P.mute, lineHeight: 1.6, marginBottom: 20 }}>
        Each cadet may bring exactly one guest, but a guest isn't required — if you're going alone, pick "No" below and skip straight to the last step.
      </p>

      <Field label="ARE YOU BRINGING A GUEST?">
        <Radio
          value={value.bringing_guest === true ? 'yes' : value.bringing_guest === false ? 'no' : ''}
          onChange={(v) => setBringingGuest(v === 'yes')}
          options={[{ value: 'yes', label: 'YES' }, { value: 'no', label: 'NO' }]}
        />
      </Field>

      {hasGuest && (
        <>
          <Field label="IS YOUR GUEST IN SDHS JROTC?">
            <Radio
              value={value.is_sdhs_jrotc ? 'yes' : 'no'}
              onChange={(v) => onChange({ ...value, is_sdhs_jrotc: v === 'yes', sdhs_matched_cadet_id: null, name: '', age: '' })}
              options={[{ value: 'yes', label: 'YES' }, { value: 'no', label: 'NO' }]}
            />
          </Field>

          {value.is_sdhs_jrotc ? (
            <Field label="GUEST NAME (search the roster)">
              {value.sdhs_matched_cadet_id ? (
                <div style={{ border: `1px solid ${P.gold}`, background: P.navy, padding: '11px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{value.name}</span>
                  <button onClick={clearMatch} style={{ background: 'none', border: 'none', color: P.mute, cursor: 'pointer', fontFamily: mono, fontSize: 11 }}>CHANGE</button>
                </div>
              ) : (
                <>
                  <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Start typing a name…" />
                  {searching && <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginTop: 6 }}>Searching…</div>}
                  {results.length > 0 && (
                    <div style={{ border: `1px solid ${P.hair}`, marginTop: 4 }}>
                      {results.map((r) => (
                        <button
                          key={r.cadet_id}
                          onClick={() => pickCadet(r)}
                          style={{ display: 'block', width: '100%', textAlign: 'left', background: P.navy, border: 'none', borderBottom: `1px solid ${P.hair}`, color: P.cream, fontFamily: mono, fontSize: 13, padding: '10px 12px', cursor: 'pointer' }}
                        >
                          {r.name} <span style={{ color: P.mute }}>· LET {r.let_level || '—'} · {(r.company || '').toUpperCase()}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </Field>
          ) : (
            <>
              <Field label="GUEST NAME">
                <TextInput value={value.name} onChange={set('name')} />
              </Field>
              <Field label="IS YOUR GUEST IN ANOTHER SCHOOL'S JROTC?">
                <Radio
                  value={value.other_jrotc ? 'yes' : 'no'}
                  onChange={(v) => onChange({ ...value, other_jrotc: v === 'yes' })}
                  options={[{ value: 'yes', label: 'YES' }, { value: 'no', label: 'NO' }]}
                />
              </Field>
              {value.other_jrotc && (
                <Field label="WHICH SCHOOL'S JROTC?">
                  <TextInput value={value.other_jrotc_school} onChange={set('other_jrotc_school')} />
                </Field>
              )}
              <Field label="SCHOOL ATTENDED">
                <TextInput value={value.school_attended} onChange={set('school_attended')} />
              </Field>
              <Field label="PARENT/GUARDIAN (POC) NAME">
                <TextInput value={value.poc_name} onChange={set('poc_name')} />
              </Field>
              <Field label="POC EMAIL">
                <TextInput type="email" value={value.poc_email} onChange={set('poc_email')} />
              </Field>
              <Field label="POC PHONE">
                <TextInput type="tel" value={value.poc_phone} onChange={set('poc_phone')} />
              </Field>
            </>
          )}

          {!value.is_sdhs_jrotc && (
            <Field label="GUEST AGE">
              <TextInput type="number" min="1" value={value.age} onChange={set('age')} />
            </Field>
          )}

          <Field label="GUEST GENDER">
            <Radio
              value={value.gender}
              onChange={(v) => onChange({ ...value, gender: v })}
              options={[{ value: 'male', label: 'MALE' }, { value: 'female', label: 'FEMALE' }]}
            />
          </Field>

          <Field label="GUEST PERSONAL (NON-SCHOOL) EMAIL">
            <TextInput type="email" value={value.personal_email} onChange={set('personal_email')} placeholder="Required — even if your guest is also a cadet" />
            <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginTop: 6 }}>
              Your guest will get an email here to finish their part — the signup isn't complete until they do.
            </div>
          </Field>
        </>
      )}

      <ErrorText>{err}</ErrorText>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: P.mute, fontFamily: mono, fontSize: 12, cursor: 'pointer' }}>‹ BACK</button>
        <Btn onClick={onNext} disabled={!canContinue}>CONTINUE →</Btn>
      </div>
    </div>
  );
}

function emptyGuestKeepFlag() {
  return {
    name: '', age: '', gender: '', is_sdhs_jrotc: false, sdhs_matched_cadet_id: null,
    other_jrotc: false, other_jrotc_school: '', school_attended: '',
    poc_name: '', poc_email: '', poc_phone: '', personal_email: '',
  };
}
