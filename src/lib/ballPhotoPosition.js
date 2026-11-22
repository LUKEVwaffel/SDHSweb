// Convert screen-direction nudges into object-position percentages for either fit.
export function nudgePhoto(photo, slide, key, bounds, fast = false) {
  const {width,height,naturalWidth,naturalHeight}=bounds;
  if (!width || !height || !naturalWidth || !naturalHeight) return {};
  const fit=photo.fit||slide.fit;
  const scale=(fit==='contain'?Math.min:Math.max)(width/naturalWidth,height/naturalHeight);
  const zoom=photo.zoom??1;
  const horizontal=key==='ArrowLeft'||key==='ArrowRight';
  const overflow=(horizontal?naturalWidth*scale*zoom-width:naturalHeight*scale*zoom-height);
  if(Math.abs(overflow)<1)return {};
  const field=horizontal?'focalX':'focalY';
  const delta=(horizontal?width:height)*(fast ? 0.03 : 0.008)*(key==='ArrowLeft'||key==='ArrowUp'?-1:1);
  return {[field]:Math.max(0,Math.min(100,(photo[field]??slide[field]??50)-delta/overflow*100))};
}
