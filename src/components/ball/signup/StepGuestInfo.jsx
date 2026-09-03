import { useState, useEffect, useRef } from 'react';
import { P, mono } from '../../admin/theme';
import { supabase as SB } from '../../../lib/supabaseClient';
import { searchRoster, resolveRosterCadet } from '../../../lib/ballApi';
import { Field, TextInput, Btn, Radio, ErrorText } from './formUi';
import { Spinner } from '../ballUi';

// Step 3 — guest info. First: bringing a guest at all? Then the guest TYPE:
//   • DATE   — couple rate ($50 total, host covers both). May be an in-program
//              SDHS cadet (roster tag) OR anyone else (manual entry).
//              Permission form only needed if the date is an in-program cadet.
//   • FRIEND — NOT a JROTC cadet. Usually still a Soddy Daisy student, just not
//              in the program; can also be from another school. A cadet who
//              wants to attend registers on their own, never as someone's
//              friend. Host pays only their own $35; the friend owes their own
//              $35 separately, and we record how that payment reaches the
//              school. No permission form.
// The manual-entry block (name / "goes to Soddy Daisy?" / school / POC) is
// shared by every non-roster guest (manual dates and all friends). "Goes to
// Soddy Daisy?" just auto-fills the school and hides the other-school fields.
function money(n) {
  return n == null ? null : `$${Number(n).toFixed(Number.isInteger(Number(n)) ? 0 : 2)}`;
}

export default function StepGuestInfo({ signupToken, value, onChange, onBack, onNext }) {
  const [query, setQuery] = useState(value.is_sdhs_jrotc ? value.name : '');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState('');
  const [priceCadet, setPriceCadet] = useState(null);
  const debounceRef = useRef(null);

  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value });
  const hasGuest = value.bringing_guest === true;
  const isDate = value.guest_type === 'date';
  const isFriend = value.guest_type === 'friend';
  const inProgramDate = isDate && value.is_sdhs_jrotc;
  const showManual = isFriend || (isDate && !value.is_sdhs_jrotc);

  useEffect(() => {
    SB.from('ball_config').select('price_cadet').maybeSingle().then(({ data }) => setPriceCadet(data?.price_cadet ?? null));
  }, []);

  useEffect(() => {
    if (!hasGuest || !inProgramDate || value.sdhs_matched_cadet_id) { setResults([]); return; }
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
  }, [query, hasGuest, inProgramDate, value.sdhs_matched_cadet_id]);

  async function pickCadet(row) {
    setErr('');
    const { data, error } = await resolveRosterCadet(signupToken, row.cadet_id);
    if (error) { setErr('Session expired. Go back and re-verify.'); return; }
    onChange({ ...value, name: data.name, age: data.age ?? '', sdhs_matched_cadet_id: row.cadet_id });
    setQuery(data.name);
    setResults([]);
  }

  function clearMatch() {
    onChange({ ...value, sdhs_matched_cadet_id: null, name: '', age: '' });
    setQuery('');
  }

  function setBringingGuest(v) {
    onChange(v ? { ...value, bringing_guest: true } : { ...emptyGuestKeepFlag(), bringing_guest: false });
  }

  function setGuestType(t) {
    if (t === 'friend') {
      // A friend is out-of-program: drop any in-program flags, and clear a
      // roster-picked name/age so a real cadet isn't carried into the friend path.
      const hadMatch = !!value.sdhs_matched_cadet_id;
      onChange({
        ...value, guest_type: 'friend', is_sdhs_jrotc: false, sdhs_matched_cadet_id: null,
        name: hadMatch ? '' : value.name, age: hadMatch ? '' : value.age,
      });
      setQuery('');
    } else {
      onChange({ ...value, guest_type: 'date', friend_payment_method: '' });
    }
  }

  const ageOk = value.age && Number(value.age) > 0;
  const sdhsAnswered = value.goes_to_sdhs === true || value.goes_to_sdhs === false;
  const manualOk = !showManual || (
    sdhsAnswered && value.poc_name && value.poc_email && value.poc_phone &&
    (value.goes_to_sdhs === true || (value.school_attended && (!value.other_jrotc || value.other_jrotc_school)))
  );
  const friendOk = !isFriend || value.friend_payment_method === 'host_delivers' || value.friend_payment_method === 'self_pays';
  const canContinue =
    value.bringing_guest === false ||
    (hasGuest && (isDate || isFriend) &&
      value.name && ageOk && value.gender && value.personal_email &&
      manualOk && friendOk);

  return (
    <div>
      <p style={{ fontFamily: mono, fontSize: 12, color: P.mute, lineHeight: 1.6, marginBottom: 20 }}>
        Each cadet may bring exactly one guest, but a guest isn't required. If you're going alone, pick "No" below and skip straight to the last step.
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
          <Field label="ARE THEY YOUR DATE OR A FRIEND?">
            <Radio
              value={value.guest_type || ''}
              onChange={setGuestType}
              options={[{ value: 'date', label: 'DATE' }, { value: 'friend', label: 'FRIEND' }]}
            />
            <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginTop: 6, lineHeight: 1.6 }}>
              {isFriend
                ? `Friend rate: you pay your own ticket, and your friend owes their own${priceCadet != null ? ` ${money(priceCadet)}` : ''} separately.`
                : isDate
                  ? 'Date rate: the couple ticket covers both of you.'
                  : 'Date = the couple ticket covers both of you. Friend = each of you pays your own ticket.'}
            </div>
          </Field>

          {isDate && (
            <Field label="IS YOUR DATE IN SDHS JROTC?">
              <Radio
                value={value.is_sdhs_jrotc ? 'yes' : 'no'}
                onChange={(v) => onChange({ ...value, is_sdhs_jrotc: v === 'yes', sdhs_matched_cadet_id: null, name: '', age: '' })}
                options={[{ value: 'yes', label: 'YES' }, { value: 'no', label: 'NO' }]}
              />
            </Field>
          )}

          {isFriend && (
            <div style={{ border: `1px solid ${P.hair}`, background: P.navy, padding: '12px 14px', margin: '4px 0 16px', fontFamily: mono, fontSize: 11, color: P.mute, lineHeight: 1.6 }}>
              A friend is anyone who isn't a JROTC cadet — a Soddy Daisy student or someone from another school. Any cadet who wants to attend signs up on their own.
            </div>
          )}

          {inProgramDate ? (
            <Field label="DATE'S NAME (search the roster)">
              {value.sdhs_matched_cadet_id ? (
                <div style={{ border: `1px solid ${P.gold}`, background: P.navy, padding: '11px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{value.name}</span>
                  <button onClick={clearMatch} style={{ background: 'none', border: 'none', color: P.mute, cursor: 'pointer', fontFamily: mono, fontSize: 11 }}>CHANGE</button>
                </div>
              ) : (
                <>
                  <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Start typing a name…" />
                  {searching && <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}><Spinner size={11} /> Searching…</div>}
                  {results.length > 0 && (
                    <div style={{ border: `1px solid ${P.hair}`, marginTop: 4 }}>
                      {results.map((r) => (
                        <button
                          key={r.cadet_id}
                          onClick={() => pickCadet(r)}
                          style={{ display: 'block', width: '100%', textAlign: 'left', background: P.navy, border: 'none', borderBottom: `1px solid ${P.hair}`, color: P.cream, fontFamily: mono, fontSize: 13, padding: '10px 12px', cursor: 'pointer' }}
                        >
                          {r.name} <span style={{ color: P.mute }}>· LET {r.let_level || '--'} · {(r.company || '').toUpperCase()}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </Field>
          ) : showManual ? (
            <>
              <Field label={isFriend ? "FRIEND'S NAME" : "DATE'S NAME"}>
                <TextInput value={value.name} onChange={set('name')} />
              </Field>

              <Field label={`DOES YOUR ${isFriend ? 'FRIEND' : 'DATE'} GO TO SODDY DAISY HIGH SCHOOL?`}>
                <Radio
                  value={value.goes_to_sdhs === true ? 'yes' : value.goes_to_sdhs === false ? 'no' : ''}
                  onChange={(v) => onChange({
                    ...value,
                    goes_to_sdhs: v === 'yes',
                    school_attended: v === 'yes' ? 'Soddy Daisy High School' : '',
                    other_jrotc: v === 'yes' ? false : value.other_jrotc,
                    other_jrotc_school: v === 'yes' ? '' : value.other_jrotc_school,
                  })}
                  options={[{ value: 'yes', label: 'YES' }, { value: 'no', label: 'NO' }]}
                />
                <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginTop: 6 }}>
                  No field trip form either way — that's only for JROTC cadets.
                </div>
              </Field>

              {value.goes_to_sdhs === false && (
                <>
                  <Field label={`IS YOUR ${isFriend ? 'FRIEND' : 'DATE'} IN ANOTHER SCHOOL'S JROTC?`}>
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
                </>
              )}

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
          ) : null}

          {(isFriend || (isDate && !value.is_sdhs_jrotc)) && (
            <Field label="GUEST AGE">
              <TextInput type="number" min="1" value={value.age} onChange={set('age')} />
            </Field>
          )}

          {(isDate || isFriend) && (
            <Field label="GUEST GENDER">
              <Radio
                value={value.gender}
                onChange={(v) => onChange({ ...value, gender: v })}
                options={[{ value: 'male', label: 'MALE' }, { value: 'female', label: 'FEMALE' }]}
              />
            </Field>
          )}

          {(isDate || isFriend) && (
            <Field label="GUEST PERSONAL (NON-SCHOOL) EMAIL">
              <TextInput type="email" value={value.personal_email} onChange={set('personal_email')} placeholder={isFriend ? 'A personal email, not a school one' : 'Required, even if your date is also a cadet'} />
              <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginTop: 6 }}>
                Your guest will get an email here to finish their part. The signup isn't complete until they do.
              </div>
            </Field>
          )}

          {isFriend && (
            <Field label={`HOW WILL YOUR FRIEND'S ${money(priceCadet) || 'PAYMENT'} REACH THE SCHOOL?`}>
              <Radio
                value={value.friend_payment_method || ''}
                onChange={(v) => onChange({ ...value, friend_payment_method: v })}
                options={[
                  { value: 'host_delivers', label: "I'LL BRING IT" },
                  { value: 'self_pays', label: 'THEY PAY DIRECTLY' },
                ]}
              />
              <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginTop: 6 }}>
                For 1SG Kaz / Chief's reference. This amount is NOT added to your own total.
              </div>
            </Field>
          )}
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
    guest_type: null, name: '', age: '', gender: '', is_sdhs_jrotc: false, sdhs_matched_cadet_id: null,
    goes_to_sdhs: null, other_jrotc: false, other_jrotc_school: '', school_attended: '',
    poc_name: '', poc_email: '', poc_phone: '', personal_email: '', friend_payment_method: '',
  };
}
