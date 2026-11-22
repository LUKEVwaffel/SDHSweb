import { supabase as SB } from './supabaseClient';
import { convertCameraRawToPng } from './cr2Convert';
import { isRawFile, resizeForUpload } from './imageResize';
import { captureTimestamp } from './ballPhotoTime';
import { PHOTO_BUCKET, photoDesk } from './ballPhotoApi';

export const SUPPORTED_PHOTO=/\.(jpe?g|png|webp|gif|heic|heif|tiff?|cr2|cr3|nef|nrw|arw|dng|raf|orf|rw2|pef|srw)$/i;
const RESUMABLE_SIZE=6*1024*1024;

async function photoDetails(file) {
  const { default: exifr } = await import('exifr');
  const metadata=await exifr.parse(file,{
    ifd0:true,exif:true,interop:false,makerNote:false,userComment:false,
    gps:false,reviveValues:false,
  }).catch(()=>null);
  return {exifr,captured_at:captureTimestamp(metadata && {
    DateTimeOriginal:metadata.DateTimeOriginal ?? metadata[36867],
    CreateDate:metadata.CreateDate ?? metadata[36868],
    SubSecTimeOriginal:metadata.SubSecTimeOriginal ?? metadata[37521],
    OffsetTimeOriginal:metadata.OffsetTimeOriginal ?? metadata[36881],
    OffsetTimeDigitized:metadata.OffsetTimeDigitized ?? metadata[36882],
  })};
}

async function derivatives(file, exifr) {
  let image=file;
  if(isRawFile(file)||/\.(nrw|tiff?)$/i.test(file.name)){
    try { image=await convertCameraRawToPng(file); }
    catch {
      const embedded=await exifr.thumbnail(file).catch(()=>null);
      if(!embedded?.length) return null;
      image=new File([embedded],'preview.jpg',{type:'image/jpeg'});
    }
  }else if(/\.hei[cf]$/i.test(file.name)){
    try {
      return await resizeForUpload(file,{fullMax:3200,quality:.89,thumbMax:640});
    } catch {
      const { default: heic2any }=await import('heic2any');
      const converted=await heic2any({blob:file,toType:'image/jpeg',quality:.92});
      image=Array.isArray(converted)?converted[0]:converted;
    }
  }
  const sizes={fullMax:3200,quality:.89,thumbMax:640};
  let result=await resizeForUpload(image,sizes);
  if(result.full.size>6000000)result=await resizeForUpload(image,{...sizes,fullMax:2400,quality:.82});
  return result.width>=320&&result.height>=240&&result.full.size<=6000000&&result.thumb.size<=600000?result:null;
}

async function sendPart(part, blob, contentType, progress, signal) {
  if(signal.aborted)throw new Error('Upload paused.');
  if(blob.size <= RESUMABLE_SIZE){
    const {error}=await SB.storage.from(PHOTO_BUCKET).uploadToSignedUrl(part.path,part.token,blob,{contentType});
    if(error)throw error;
    progress(1);
    return;
  }
  const { Upload }=await import('tus-js-client');
  const asset=new URL(import.meta.env.VITE_SUPABASE_URL);
  if(asset.hostname.endsWith('.supabase.co'))asset.hostname=asset.hostname.replace(/\.supabase\.co$/,'.storage.supabase.co');
  asset.pathname='/storage/v1/upload/resumable/sign';
  await new Promise((resolve,reject)=>{
    const done=callback=>value=>{signal.removeEventListener('abort',pause);callback(value);};
    const upload=new Upload(blob,{
      endpoint:asset.href,
      headers:{'x-signature':part.token},
      fingerprint:async()=>`ball-photo:${asset.host}:${PHOTO_BUCKET}:${part.path}`,
      chunkSize:RESUMABLE_SIZE,
      retryDelays:[0,1000,3000,5000,10000],
      uploadDataDuringCreation:true,
      removeFingerprintOnSuccess:true,
      metadata:{bucketName:PHOTO_BUCKET,objectName:part.path,contentType,cacheControl:'3600'},
      onProgress:(sent,total)=>progress(sent/total),
      onError:done(reject),
      onSuccess:done(resolve),
    });
    function pause(){void upload.abort().finally(()=>done(reject)(new Error('Upload paused.')));}
    if(signal.aborted){reject(new Error('Upload paused.'));return;}
    signal.addEventListener('abort',pause,{once:true});
    void upload.findPreviousUploads().then(previous=>{
      if(signal.aborted)return;
      if(previous.length)upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    }).catch(done(reject));
  });
}

export async function uploadBallPhoto(file, session, update, signal) {
  update('Reading metadata',0);
  const {exifr,captured_at}=await photoDetails(file);
  const bytes=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
  const digest=Array.from(new Uint8Array(bytes),value=>value.toString(16).padStart(2,'0')).join('');
  if(signal.aborted)throw new Error('Upload paused.');
  update('Preparing images',0);
  const preview=await derivatives(file,exifr).catch(()=>null);
  if(signal.aborted)throw new Error('Upload paused.');
  const prepared=await photoDesk('prepare',{filename:file.name,bytes:file.size,digest,captured_at,preview:Boolean(preview)},session);
  if(prepared.complete)return prepared;
  for(const part of prepared.uploads){
    const name=part.path.split('/').at(-1);
    const isOriginal=name.startsWith('original.');
    const blob=isOriginal?file:name==='thumb.jpg'?preview.thumb:preview.full;
    const progress=fraction=>update(isOriginal?'Uploading original':'Uploading previews',isOriginal ? .04+.80*fraction : .87+.12*fraction);
    await sendPart(part,blob,isOriginal?'application/octet-stream':'image/jpeg',progress,signal);
  }
  if(signal.aborted)throw new Error('Upload paused.');
  return photoDesk('finish',{id:prepared.id,preview:Boolean(preview),width:preview?.width,height:preview?.height},session);
}

export async function droppedPhotos(transfer) {
  const fallback=[...transfer.files];
  const entries=[...transfer.items].map(item=>item.webkitGetAsEntry?.()).filter(Boolean);
  if(!entries.length)return fallback;
  const result=[];
  async function walk(entry) {
    if(entry.isFile){
      result.push(await new Promise((resolve,reject)=>entry.file(resolve,reject)));
      return;
    }
    if(!entry.isDirectory)return;
    const reader=entry.createReader();
    while(true){
      const children=await new Promise((resolve,reject)=>reader.readEntries(resolve,reject));
      if(!children.length)return;
      for(const child of children)await walk(child);
    }
  }
  for(const entry of entries)await walk(entry);
  return result;
}
