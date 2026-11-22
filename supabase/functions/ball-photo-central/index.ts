import { getCaller, serviceClient } from '../_shared/supabase.ts';
import { streamArchive } from './archive.ts';

const BUCKET = 'ball-photo-central';
const MAX_ORIGINAL = 100 * 1024 * 1024;
const MAX_ZIP = 48 * 1024 * 1024;
const ZIP_FILES = 24;
const PAGE_SIZE = 48;
const GALLERY_PAGE_SIZE = 24;
const publicThumbnails = new Map<string,{url:string;refreshAt:number}>();
const ALLOWED_EXT = new Set(['jpg','jpeg','png','webp','gif','heic','heif','tif','tiff','cr2','cr3','nef','nrw','arw','dng','raf','orf','rw2','pef','srw']);
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const SESSION = /^[a-f0-9]{64}$/i;
const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ball-upload',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};
const FILE_FIELDS = 'id,filename,credit,status,extension,captured_at,photo_bytes,width,height';
type Service = ReturnType<typeof serviceClient>;
type FileRow = { id: string; filename: string; credit: string; status: string; extension: string; captured_at: string | null; photo_bytes: number | null; width: number | null; height: number | null };
type Uploader = { key: string; name: string; admin: boolean };

class Problem extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...HEADERS, 'Content-Type': 'application/json' },
});
const original = (row: Pick<FileRow, 'id' | 'extension'>) => `${row.id}/original.${row.extension}`;
const display = (id: string) => `${id}/photo.jpg`;
const thumb = (id: string) => `${id}/thumb.jpg`;
const safeName = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').slice(0, 70) || 'Ball-photo';
const encoding = new TextEncoder();
const hex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
async function tag(value: string) {
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const key = await crypto.subtle.importKey('raw', encoding.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoding.encode(value))));
}
function photographerName(value: unknown) {
  return typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/g,' ') : '';
}
function readId(value: unknown) {
  if (typeof value !== 'string' || !UUID.test(value)) throw new Problem(400,'Invalid photo or invitation.');
  return value.toLowerCase();
}
function readIds(values: unknown, max: number) {
  if (!Array.isArray(values) || !values.length || values.length > max) throw new Problem(400,`Choose between 1 and ${max} photos.`);
  return [...new Set(values.map(readId))];
}
function verify<T>(result: {data: T; error: unknown}): T {
  if (result.error) throw new Error('Service operation failed.');
  return result.data;
}
async function uploader(req: Request, db: Service): Promise<Uploader> {
  const session = req.headers.get('x-ball-upload');
  if (session) {
    if (!SESSION.test(session)) throw new Problem(401,'Sign in again to continue uploading.');
    const entry = verify(await db.from('ball_photo_sessions').select('invite_id')
      .eq('token_tag',await tag('session:'+session)).gt('expires_at',new Date().toISOString()).maybeSingle());
    const invite = entry && verify(await db.from('ball_photo_invites').select('id,name')
      .eq('id',entry.invite_id).eq('active',true).maybeSingle());
    if (!invite) throw new Problem(401,'This upload session expired or was disabled. Open your invitation again.');
    return {key:'invite:'+invite.id,name:invite.name,admin:false};
  }
  const caller = await getCaller(req);
  if (caller?.role !== 's6' || caller.mustChangePassword) throw new Problem(401,'Sign in with DISPATCH or use Photographer sign-in.');
  const staff = verify(await db.from('admin_roles').select('display_name').eq('email',caller.email).single());
  return {key:'staff:'+caller.email,name:staff.display_name||'Trojan Battalion',admin:true};
}
function requireAdmin(actor: Uploader) {
  if (!actor.admin) throw new Problem(403,'This action is available to Ball Photo Central staff.');
}
async function signedRows(db: Service, rows: FileRow[], privateRows: boolean) {
  const paths = rows.filter(row => row.photo_bytes).map(row => thumb(row.id));
  const now=Date.now();
  const urls=new Map<string,string>();
  if(!privateRows){
    for(const path of paths){
      const cached=publicThumbnails.get(path);
      if(cached&&cached.refreshAt>now) urls.set(path,cached.url);
    }
  }
  const missing=paths.filter(path=>!urls.has(path));
  const signed=missing.length?verify(await db.storage.from(BUCKET).createSignedUrls(missing,900)):[];
  if(publicThumbnails.size>500)publicThumbnails.clear();
  for(const {path,signedUrl} of signed){
    if(!path||!signedUrl) continue;
    urls.set(path,signedUrl);
    if(!privateRows)publicThumbnails.set(path,{url:signedUrl,refreshAt:now+180000});
  }
  return rows.map(row => ({
    id:row.id, credit:row.credit, captured_at:row.captured_at, width:row.width, height:row.height,
    bytes:row.photo_bytes, thumb:urls.get(thumb(row.id)) || '',
    ...(privateRows ? {filename:row.filename,status:row.status} : {}),
  }));
}
async function published(db: Service, id: string) {
  const row = verify(await db.from('ball_photo_items').select(FILE_FIELDS).eq('id',id).eq('status','published').maybeSingle());
  if (!row?.photo_bytes) throw new Problem(404,'This photo is unavailable.');
  return row;
}
function redirect(url: string) {
  return new Response(null,{status:302,headers:{...HEADERS,Location:url}});
}

async function get(req: Request, db: Service) {
  const params = new URL(req.url).searchParams;
  const action=params.get('action')||'gallery';
  if (action==='gallery') {
    const offset = Number(params.get('offset')||0);
    if (!Number.isInteger(offset)||offset<0||offset>100000) throw new Problem(400,'Invalid gallery page.');
    const q = await db.from('ball_photo_items').select(FILE_FIELDS,{count:'exact'}).eq('status','published')
      .order('captured_at',{ascending:true,nullsFirst:false}).order('id').range(offset,offset+GALLERY_PAGE_SIZE-1);
    return response({photos:await signedRows(db,verify(q),false),total:q.count??0});
  }
  if (action==='view'||action==='download') {
    const row=await published(db,readId(params.get('id')));
    const name=safeName(row.filename)+'.jpg';
    const result=verify(await db.storage.from(BUCKET).createSignedUrl(display(row.id),300,action==='download'?{download:name}:undefined));
    return redirect(result.signedUrl);
  }
  if (action==='zip') {
    const ids=readIds(params.get('ids')?.split(','),ZIP_FILES);
    const result=verify(await db.from('ball_photo_items').select(FILE_FIELDS).in('id',ids)
      .eq('status','published').order('captured_at',{ascending:true,nullsFirst:false}).order('id'));
    if (result.length!==ids.length) throw new Problem(404,'A selected photo is unavailable. Refresh the gallery.');
    if (result.reduce((sum,row)=>sum+Number(row.photo_bytes),0)>MAX_ZIP) throw new Problem(400,'This ZIP is too large. Select fewer photos.');
    const paths=result.map(row=>display(row.id));
    const urls=verify(await db.storage.from(BUCKET).createSignedUrls(paths,300));
    const byPath=new Map(urls.map(entry=>[entry.path,entry.signedUrl]));
    const files=result.map((row,index)=>{
      const url=byPath.get(display(row.id));
      if(!url)throw new Error('Could not prepare archive.');
      return {url,name:`${String(index+1).padStart(2,'0')}-${safeName(row.filename)}.jpg`};
    });
    const part=Number(params.get('part'));
    const suffix=Number.isInteger(part)&&part>0&&part<10000?`-part-${part}`:'';
    return new Response(streamArchive(files,req.signal),{headers:{
      ...HEADERS,'Content-Type':'application/zip','Content-Disposition':`attachment; filename="SDHS-Military-Ball-2026${suffix}.zip"`,
    }});
  }
  throw new Problem(404,'Page unavailable.');
}

async function prepare(db: Service, actor: Uploader, body: Record<string,unknown>) {
  const filename=typeof body.filename==='string'?body.filename.trim().slice(0,200):'';
  const extension=filename.split('.').at(-1)?.toLowerCase() || '';
  if (!filename||!ALLOWED_EXT.has(extension)) throw new Problem(400,'This photo format is not supported.');
  const bytes=Number(body.bytes);
  if (!Number.isInteger(bytes)||bytes<1||bytes>MAX_ORIGINAL) throw new Problem(400,'Each original must be between 1 byte and 100 MB.');
  if (typeof body.digest!=='string'||!/^[a-f0-9]{64}$/.test(body.digest)) throw new Problem(400,'Invalid file fingerprint.');
  const captured=typeof body.captured_at==='string'?Date.parse(body.captured_at):NaN;
  const captured_at=Number.isFinite(captured)&&captured>0&&captured<=Date.now()+86400000?new Date(captured).toISOString():null;
  const entry={owner_key:actor.key,credit:actor.name,filename,extension,digest:body.digest,original_bytes:bytes,captured_at};
  const insert=await db.from('ball_photo_items').upsert(entry,{onConflict:'owner_key,digest',ignoreDuplicates:true});
  if (insert.error) throw new Error('Could not reserve photo.');
  const row=verify(await db.from('ball_photo_items').select(FILE_FIELDS+',original_bytes').eq('owner_key',actor.key).eq('digest',body.digest).single());
  if (row.original_bytes!==bytes) throw new Problem(409,'The uploaded file no longer matches the batch.');
  if (row.status!=='uploading') return response({id:row.id,complete:true,preview:Boolean(row.photo_bytes)});
  const storage=db.storage.from(BUCKET);
  const existing=verify(await storage.list(row.id));
  const paths=[original(row),...(body.preview?[display(row.id),thumb(row.id)]:[])];
  const uploads=await Promise.all(paths.filter(path=>!existing.some(item=>path===`${row.id}/${item.name}`)).map(async path=>{
    const {token}=verify(await storage.createSignedUploadUrl(path));
    return {path,token};
  }));
  return response({id:row.id,uploads});
}

async function finish(db: Service, actor: Uploader, body: Record<string,unknown>) {
  const id=readId(body.id);
  const row=verify(await db.from('ball_photo_items').select(FILE_FIELDS+',original_bytes').eq('id',id).eq('owner_key',actor.key).maybeSingle());
  if (!row) throw new Problem(404,'Upload not found.');
  if (row.status!=='uploading') return response({id,preview:Boolean(row.photo_bytes)});
  const objects=verify(await db.storage.from(BUCKET).list(id));
  const object=objects.find(item=>`${id}/${item.name}`===original(row));
  if (Number(object?.metadata?.size)!==Number(row.original_bytes)) throw new Problem(409,'Original upload is incomplete. Retry the file.');
  const photo=objects.find(item=>item.name==='photo.jpg');
  const thumbnail=objects.find(item=>item.name==='thumb.jpg');
  const validJpeg=(item: typeof photo, max: number)=>item?.metadata?.mimetype==='image/jpeg'&&Number(item.metadata.size)>0&&Number(item.metadata.size)<=max;
  const preview=validJpeg(photo,6000000)&&validJpeg(thumbnail,600000);
  if (body.preview && !preview) throw new Problem(409,'Preview upload is incomplete. Retry the file.');
  const dimension=(value: unknown)=>Number.isInteger(value)&&Number(value)>0&&Number(value)<=10000?value:null;
  verify(await db.from('ball_photo_items').update({
    status:'review',finished_at:new Date().toISOString(),photo_bytes:preview?Number(photo!.metadata.size):null,
    width:preview?dimension(body.width):null,height:preview?dimension(body.height):null,
  }).eq('id',id).eq('status','uploading'));
  return response({id,preview});
}

async function post(req: Request, db: Service) {
  let body: Record<string,unknown>;
  try { body=await req.json(); } catch { throw new Problem(400,'Invalid request.'); }
  if (!body || typeof body!=='object') throw new Problem(400,'Invalid request.');
  const action=String(body.action||'');
  if (action==='unlock') {
    const nameKey=photographerName(body.name).toLowerCase();
    const invalid='Enter the first and last name registered for this upload desk.';
    if (!nameKey || nameKey.length>100) throw new Problem(401,invalid);
    const token=hex(crypto.getRandomValues(new Uint8Array(32)));
    const name=verify(await db.rpc('ball_photo_sign_in_by_name',{
      p_name_key:nameKey,p_session_tag:await tag('session:'+token),
    }));
    if (!name) throw new Problem(401,invalid);
    return response({name,token});
  }
  if (action==='vote') {
    const voter=await tag('ball-photo-voter:'+readId(body.voter));
    const photoId=readId(body.photoId);
    const accepted=verify(await db.rpc('ball_photo_cast_vote',{p_voter_tag:voter,p_photo_id:photoId}));
    if (!accepted) throw new Problem(404,'This photo is no longer available for voting.');
    return response({photoId});
  }
  const actor=await uploader(req,db);
  if (action==='whoami') return response({name:actor.name,admin:actor.admin});
  if (action==='prepare') return prepare(db,actor,body);
  if (action==='finish') return finish(db,actor,body);
  requireAdmin(actor);

  if (action==='vote-results') {
    const counts=verify(await db.rpc('ball_photo_vote_results')) as {photo_id:string;votes:number}[];
    if (!counts.length) return response({results:[]});
    const items=verify(await db.from('ball_photo_items').select(FILE_FIELDS)
      .in('id',counts.map(entry=>entry.photo_id)).eq('status','published'));
    const byId=new Map((await signedRows(db,items,true)).map(item=>[item.id,item]));
    const results=counts.flatMap(entry=>{
      const item=byId.get(entry.photo_id);
      return item?[{...item,votes:entry.votes}]:[];
    });
    return response({results});
  }
  if (action==='invites') {
    const rows=verify(await db.from('ball_photo_invites').select('id,name,active').order('created_at',{ascending:false}));
    return response({invites:rows});
  }
  if (action==='create-invite') {
    const name=photographerName(body.name);
    if (!name.includes(' ')||name.length>100) throw new Problem(400,'Enter the photographer’s first and last name.');
    const id=crypto.randomUUID();
    const created=await db.from('ball_photo_invites').insert({id,name,sign_in_name:name.toLowerCase()});
    if (created.error?.code==='23505') throw new Problem(409,'That photographer already has an active account.');
    verify(created);
    return response({id,name,active:true});
  }
  if (action==='disable-invite') {
    verify(await db.from('ball_photo_invites').update({active:false}).eq('id',readId(body.id)));
    return response({ok:true});
  }
  if (action==='inbox') {
    const offset=Number(body.offset||0);
    if (!Number.isInteger(offset)||offset<0||offset>100000) throw new Problem(400,'Invalid inbox page.');
    const status=body.status==='published'?'published':'review';
    const r=await db.from('ball_photo_items').select(FILE_FIELDS,{count:'exact'}).eq('status',status)
      .order('created_at',{ascending:false}).order('id').range(offset,offset+PAGE_SIZE-1);
    return response({photos:await signedRows(db,verify(r),true),total:r.count??0});
  }
  if (action==='original'||action==='review-image') {
    const row=verify(await db.from('ball_photo_items').select(FILE_FIELDS).eq('id',readId(body.id)).neq('status','uploading').maybeSingle());
    if (!row) throw new Problem(404,'Original unavailable.');
    if(action==='review-image'&&!row.photo_bytes)throw new Problem(404,'Review the original file. A preview is unavailable.');
    const result=verify(await db.storage.from(BUCKET).createSignedUrl(
      action==='original'?original(row):display(row.id),300,
      action==='original'?{download:safeName(row.filename)+'.'+row.extension}:undefined,
    ));
    return response({url:result.signedUrl});
  }
  if (action==='publish'||action==='unpublish') {
    const ids=readIds(body.ids,60);
    if (action==='publish'&&body.confirm!==true) throw new Problem(400,'Confirm that the selected photos are cleared for public sharing.');
    const status=action==='publish'?'review':'published';
    const update=action==='publish'
      ? {status:'published',published_at:new Date().toISOString(),published_by:actor.key.slice(6)}
      : {status:'review',published_at:null,published_by:null};
    const query=db.from('ball_photo_items').update(update).in('id',ids).eq('status',status);
    if (action==='publish') query.not('photo_bytes','is',null);
    const rows=verify(await query.select('id'));
    return response({updated:rows.map(row=>row.id)});
  }
  throw new Problem(404,'Action unavailable.');
}

Deno.serve(async req=>{
  if (req.method==='OPTIONS') return new Response(null,{headers:HEADERS});
  try {
    const db=serviceClient();
    if (req.method==='GET') return await get(req,db);
    if (req.method==='POST') return await post(req,db);
    throw new Problem(405,'Method not allowed.');
  } catch (error) {
    if (error instanceof Problem) return response({error:error.message},error.status);
    return response({error:'Ball Photo Central could not complete this request. Try again.'},500);
  }
});
