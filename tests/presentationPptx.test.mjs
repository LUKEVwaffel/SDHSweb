import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { makeDeck, makeSlide, LAYOUTS } from '../src/lib/ballPresentation.js';
import { createPresentationPptx, pptxPhotoBoxes } from '../src/lib/presentationPptx.js';
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';

test('PowerPoint contains editable text, photo spaces, slide order and speaker notes', async () => {
  const deck = { ...makeDeck(), slides: [makeSlide('title', {title:'Find your team',notes:'Ask the audience a question.'}),makeSlide('split',{title:'Raider Team',subtitle:'Rope bridge\nFinish together'})] };
  const pptx = await createPresentationPptx(deck);
  const zip = await JSZip.loadAsync(await pptx.write({outputType:'nodebuffer'}));
  const title = await zip.file('ppt/slides/slide1.xml').async('string');
  const raider = await zip.file('ppt/slides/slide2.xml').async('string');
  assert.match(title, /Find your team/);
  assert.match(raider, /Raider Team/);
  assert.match(raider, /Rope bridge/);
  assert.match(raider, /Add your photo here/);
  assert.match(raider, /<p:sp>/); // Native editable shapes/text, not a screenshot.
  assert.match(await zip.file('ppt/notesSlides/notesSlide1.xml').async('string'), /Ask the audience/);
  assert.equal(Object.keys(zip.files).filter(key=>/^ppt\/slides\/slide\d+\.xml$/.test(key)).length, 2);
});

test('all supported layouts have bounded photo boxes and export embedded images', async () => {
  const deck = {...makeDeck(),slides:LAYOUTS.map(layout=>makeSlide(layout.id,{photos:Array.from({length:layout.photos},()=>({url:'https://example.invalid/photo.jpg',caption:'Team photo',focalX:20,zoom:1.4}))}))};
  let prepared = 0;
  for (const slide of deck.slides) for (const box of pptxPhotoBoxes(slide)) {
    assert.ok(box.x>=0&&box.y>=0&&box.w>0&&box.h>0);
    assert.ok(box.x+box.w<=13.334&&box.y+box.h<=7.501);
  }
  const pptx = await createPresentationPptx(deck,{preparePhoto:async(photo,slide,box)=>{prepared++;assert.equal(photo.focalX,20);assert.ok(box.background);return png;}});
  const zip=await JSZip.loadAsync(await pptx.write({outputType:'nodebuffer'}));
  assert.equal(prepared,8);
  assert.ok(Object.keys(zip.files).some(key=>/^ppt\/media\/image.*\.png$/.test(key)));
  assert.match(await zip.file('ppt/slides/slide3.xml').async('string'), /<p:pic>/);
});

test('photo errors stop the export instead of silently dropping photos', async () => {
  const deck={...makeDeck(),slides:[makeSlide('photo',{photos:[{url:'https://example.invalid/failure.jpg'}]})]};
  await assert.rejects(createPresentationPptx(deck,{preparePhoto:async()=>{throw new Error('Photo unavailable');}}), /Photo unavailable/);
});
