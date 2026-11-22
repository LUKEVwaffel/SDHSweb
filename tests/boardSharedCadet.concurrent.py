"""Concurrency checks against a disposable LOCAL fixture database only."""
import concurrent.futures,json,subprocess
from pathlib import Path
DB='boards_preparation_test'
def query(sql,check=True):
 r=subprocess.run(['psql','-X','-v','ON_ERROR_STOP=1','-At','-d',DB,'-c',sql],capture_output=True,text=True)
 if check and r.returncode:raise RuntimeError(r.stderr)
 return r
fixture=Path('tests/boardMeeting.integration.sql').read_text().split("set test.email='co.alpha@example.invalid';")[0]
query(fixture+'commit;')
try:
 start="set test.s6='yes';select board_practice_start('Concurrent fixture',null);"
 with concurrent.futures.ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda _:query(start,False),range(2)))
 assert sum(r.returncode==0 for r in results)==1,'Two concurrent meeting starts succeeded'
 info=json.loads(query("select json_build_object('session',id,'cadet',roster->0->>'id') from board_practice_sessions where company='alpha'").stdout)
 sid=info['session']
 focus=query("select active_cadet_revision from board_practice_sessions where id='"+sid+"'").stdout.strip()
 cadet=info['cadet']
 query(f"set test.email='co.alpha@example.invalid';select board_practice_open_cadet('{sid}','{cadet}','{focus}');")
 focus=query("select active_cadet_revision from board_practice_sessions where id='"+sid+"'").stdout.strip()
 def patch(edit):
  seat,field,value=edit
  return query(f"set test.email='{seat}.alpha@example.invalid';select board_practice_patch_field('{sid}','{cadet}','{focus}','{field}','{value}','null');",False)
 with concurrent.futures.ThreadPoolExecutor(3) as pool:results=list(pool.map(patch,[('co','score_facing',3),('xo','score_creed',1),('1sg','score_jrotc',3)]))
 assert all(r.returncode==0 for r in results),[r.stderr for r in results]
 grades=json.loads(query(f"select scores from board_practice_sheets where session_id='{sid}'").stdout)
 assert grades['score_facing']==3 and grades['score_creed']==1 and grades['score_jrotc']==3,'Concurrent categories lost grades'
 with concurrent.futures.ThreadPoolExecutor(2) as pool:results=list(pool.map(patch,[('co','score_class',3),('xo','score_class',1)]))
 assert sum(r.returncode==0 for r in results)==1,'Conflicting category overwritten'
 sid=info['session']
 query("set test.s6='yes';select board_practice_end(round_id) from board_practice_sessions where id='"+sid+"';")
 def sign(email):return query("select board_practice_commit_signature('"+sid+"','"+email+"');",False)
 with concurrent.futures.ThreadPoolExecutor(3) as pool:results=list(pool.map(sign,['co.alpha@example.invalid','xo.alpha@example.invalid','1sg.alpha@example.invalid']))
 assert all(r.returncode==0 for r in results),[r.stderr for r in results]
 assert query("select status from board_practice_sessions where id='"+sid+"'").stdout.strip()=='signed','Concurrent signatures left partial state'
 assert query("select count(distinct seal) from board_practice_signatures where session_id='"+sid+"'").stdout.strip()=='1','Signers sealed different lists'
 print('PASS: concurrent start, three shared grades, conflicting category, and simultaneous signatures')
finally:
 query("delete from board_practice_cadet_events;delete from board_practice_signatures;delete from board_practice_sheets;delete from board_practice_sessions;delete from board_practice_rounds;delete from board_practice_presence;delete from board_members where email like '%@example.invalid';delete from cadet_consent where name like 'Fixture %';")
