import { useState, useEffect, useRef } from 'react';
import { P, mono } from '../../admin/theme';
import { supabase as SB } from '../../../lib/supabaseClient';
import { searchRoster, resolveRosterCadet } from '../../../lib/ballApi';
import { Field, TextInput, Btn, Radio, ErrorText } from './formUi';
import { Spinner } from '../ballUi';
import { isSchoolEmail } from '../../../lib/schoolEmail';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Step 3 — guest info. First: bringing a guest at all? Then the guest TYPE:
//   • DATE   — you attend as a couple. ONE ticket at the couple rate ($50)
//              covers both of you. The date may be a current SDHS JROTC cadet
//              (picked from the roster) OR anyone else (entered by hand).
//   • FRIEND — someone you bring who is NOT your date and NOT a current JROTC
//              cadet. You each buy your own ticket: you pay $35 for yourself,
//              the friend owes their own $35 separately (we record how that
//              payment reaches the school).
//   A current JROTC cadet who just wants to attend registers on their own —
//   never as anyone's date or friend.
//   Field trip form: required for every SDHS student attending — the cadet
//   always, and the guest too if they are a current cadet OR go to Soddy Daisy.
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
  const [priceCouple, setPriceCouple] = useState(null);
  const debounceRef = useRef(null);

  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value });
  const hasGuest = value.bringing_guest === true;
  const isDate = value.guest_type === 'date';
  const isFriend = value.guest_type === 'friend';
  const inProgramDate = isDate && value.is_sdhs_jrotc;
  const showManual = isFriend || (isDate && !value.is_sdhs_jrotc);

  useEffect(() => {
    SB.from('ball_config').select('price_cadet, price_couple').maybeSingle().then(({ data }) => {
      setPriceCadet(data?.price_cadet ?? null);
      setPriceCouple(data?.price_couple ?? null);
    });
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
  const guestEmail = (value.personal_email || '').trim();
  const guestEmailOk = EMAIL_RE.test(guestEmail) && !isSchoolEmail(guestEmail);
  const canContinue =
    value.bringing_guest === false ||
    (hasGuest && (isDate || isFriend) &&
      value.name && ageOk && value.gender && guestEmailOk &&
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
          <div style={{ border: `1px solid ${P.hair}`, background: P.navy, padding: '12px 14px', margin: '0 0 14px', fontFamily: mono, fontSize: 11, color: P.mute, lineHeight: 1.7 }}>
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: P.gold }}>DATE</span> — you're going together as a couple.
              One ticket{priceCouple != null ? ` (${money(priceCouple)})` : ''} at the couple rate covers both of you.
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: P.gold }}>FRIEND</span> — someone you're bringing who isn't your date.
              You each pay your own ticket: {priceCadet != null ? money(priceCadet) : 'your rate'} for you, and your friend owes their own {priceCadet != null ? money(priceCadet) : 'ticket'} separately.
            </div>
            <div>A current JROTC cadet can't be added either way — they sign up on their own.</div>
          </div>

          <Field label="IS THIS GUEST YOUR DATE, OR A FRIEND?">
            <Radio
              value={value.guest_type || ''}
              onChange={setGuestType}
              options={[{ value: 'date', label: 'MY DATE' }, { value: 'friend', label: 'A FRIEND' }]}
            />
          </Field>

          {isDate && (
            <Field label="IS YOUR DATE A CURRENT SDHS JROTC CADET?">
              <Radio
                value={value.is_sdhs_jrotc ? 'yes' : 'no'}
                onChange={(v) => onChange({ ...value, is_sdhs_jrotc: v === 'yes', sdhs_matched_cadet_id: null, name: '', age: '' })}
                options={[{ value: 'yes', label: 'YES' }, { value: 'no', label: 'NO' }]}
              />
              <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginTop: 6, lineHeight: 1.6 }}>
                Yes — pick them from the battalion roster below. No — you'll type their details in yourself.
              </div>
            </Field>
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
                <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginTop: 6, lineHeight: 1.6 }}>
                  If yes, they're an SDHS student, so they'll also need to sign a field trip permission form — we'll send it to their email. If no, no form is needed for them.
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
            <Field label={`${isFriend ? "FRIEND" : "DATE"}'S AGE`}>
              <TextInput type="number" min="1" max="99" inputMode="numeric" value={value.age} onChange={set('age')} placeholder="Their age" />
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
                Your guest will get an email here to finish their part (and the field trip form, if they go to Soddy Daisy). The signup isn't complete until they do. A school (@hcde.org) address will not work.
              </div>
              {guestEmail && !guestEmailOk && (
                <div style={{ fontFamily: mono, fontSize: 11, color: P.red, marginTop: 4 }}>
                  {isSchoolEmail(guestEmail) ? 'Use a personal email, not a school one.' : 'Enter a valid email address.'}
                </div>
              )}
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
