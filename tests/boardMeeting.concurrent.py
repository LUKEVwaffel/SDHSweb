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
 payload={'session_id':info['session'],'cadet_id':info['cadet'],'rank_before':'PVT','scores':{},'status':'draft'}
 save="set test.email='co.alpha@example.invalid';select board_practice_save($payload$"+json.dumps(payload)+"$payload$::jsonb);"
 with concurrent.futures.ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda _:query(save,False),range(2)))
 assert sum(r.returncode==0 for r in results)==1,'Concurrent saves overwrote each other'
 assert any('Another leader' in r.stderr for r in results),'Stale save did not explain conflict'
 sid=info['session']
 query("set test.s6='yes';select board_practice_end(round_id) from board_practice_sessions where id='"+sid+"';")
 def sign(email):return query("select board_practice_commit_signature('"+sid+"','"+email+"');",False)
 with concurrent.futures.ThreadPoolExecutor(3) as pool:results=list(pool.map(sign,['co.alpha@example.invalid','xo.alpha@example.invalid','1sg.alpha@example.invalid']))
 assert all(r.returncode==0 for r in results),[r.stderr for r in results]
 assert query("select status from board_practice_sessions where id='"+sid+"'").stdout.strip()=='signed','Concurrent signatures left partial state'
 assert query("select count(distinct seal) from board_practice_signatures where session_id='"+sid+"'").stdout.strip()=='1','Signers sealed different lists'
 print('PASS: concurrent start, conflicting saves, and three simultaneous signatures')
finally:
 query("delete from board_practice_signatures;delete from board_practice_sheets;delete from board_practice_sessions;delete from board_practice_rounds;delete from board_practice_presence;delete from board_members where email like '%@example.invalid';delete from cadet_consent where name like 'Fixture %';")
