export default function MeetingGuide() {
  return <div className="bm-shell"><div className="bm-panel"><div className="tb-eyebrow">Company leadership · Workshop guide</div><h1 className="tb-h1">Run it together.</h1>
    <p className="bm-muted">This workshop uses your company’s cadet names. Scores, decisions, and signatures are practice records; they cannot change real ranks.</p>
    <ol style={{lineHeight:1.8,display:'grid',gap:18,paddingLeft:24}}>
      <li><b>Set up once.</b> Choose your name, confirm your date of birth, choose a four-digit PIN, and enter it again. Keep that PIN private. Next time, choose your name and use your PIN. A signed-in browser takes you straight back to the workshop.</li>
      <li><b>Wait for the presenter.</b> Keep the meeting page open. When the presenter starts practice, your company roster appears on every leader’s computer.</li>
      <li><b>Choose a cadet.</b> The three leaders decide who will begin. When a cadet enters, one leader clicks their name. All three screens immediately open that cadet’s questions and one shared grading sheet. Leaders take turns: each asks one JROTC question and one class question. All three grade collaboratively; cadets answer aloud.</li>
      <li><b>Practice the inspection.</b> Award the board-address point only when correct. Score facing movements out of 3; score the full creed pass/fail out of 1. Pauses and stutters do not fail the creed. Class A begins at 9; record deductions. Khakis/polo gets 9 only when the cadet has no issued uniform.</li>
      <li><b>Save deliberately.</b> Grade selections save and synchronize automatically. Different fields merge; conflicting edits to the same field are flagged for review. Share any local board note before completion. Agree on the final scores, then Complete cadet returns everyone to the roster. Pause retains shared grades for a later return.</li>
      <li><b>Make the practice decision.</b> The portal checks the 20-point standard, LET rank cap, one-rank limit, and evaluation-only leadership positions. Your practice rank changes stay inside this sheet.</li>
      <li><b>Review when practice ends.</b> The presenter closes meeting practice. Scoring stops on all computers, and each company receives its frozen review list, including clearly marked simulated examples using its own cadets. Click a cadet’s name to inspect the scores.</li>
      <li><b>Sign your position.</b> Confirm that you reviewed the list and enter your own PIN. CO, XO, and 1SG each sign from their own account. You can see when the other two have signed. The presenter can cancel an unfinished practice round and start a fresh one if someone is absent; this never fills in a missing signature. A session finishes only after all three signatures are recorded.</li>
    </ol>
    <p className="bm-muted">For independent company rehearsals, use <a href="/boards/practice">company practice</a>. A company leader can start that session and end it when all drafts are complete. Ending requests the other leaders’ signatures in the same way.</p>
    <p className="bm-small">If the connection drops, keep the page open. It reconnects and checks the session status again. An ended session cannot accept further saves.</p>
  </div></div>;
}
