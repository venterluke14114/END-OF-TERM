// === Grid constants ===
const COLS = 3, ROWS = 5;
const CELL_W = 160, CELL_H = 120;
const GAP = 16, PAD = GAP;
const gridWidth  = () => PAD + COLS * CELL_W + (COLS - 1) * GAP + PAD;
const gridHeight = () => PAD + ROWS * CELL_H + (ROWS - 1) * GAP + PAD;
const cellX = (c) => PAD + c * (CELL_W + GAP);
const cellY = (r) => PAD + r * (CELL_H + GAP);

// === Helpers ===
function placeholder(x, y) { noFill(); stroke(80); rect(x, y, CELL_W, CELL_H); }

// === Classes ===
class VideoSource {
  constructor(w = 640, h = 480) {
    this.w = w; this.h = h;
    this.stream = createCapture(VIDEO);
    this.stream.size(this.w, this.h);
    this.stream.hide();
    this.ready = false;
    this.stream.elt.onloadedmetadata = () => { this.ready = true; };
  }
  isReady(){ return this.ready; }
  frame(){ return this.stream; }
}

class SnapshotBuffer {
  constructor(targetW = 160, targetH = 120) {
    this.img = null;
    this.targetW = targetW; this.targetH = targetH;
    this.version = 0;
  }
  setFromCanvas(x, y, w, h) {
    const temp = get(x, y, w, h);
    temp.resize(this.targetW, this.targetH);
    this.img = temp;
    this.version++;
  }
  has(){ return !!this.img; }
  save(){ if (this.img) this.img.save('snapshot', 'png'); }
}

class ImageOps {
  static clamp8(v){ return Math.min(255, Math.max(0, v|0)); }

  // Greyscale + 20% brightness (single nested loop)
  static greyPlus20(src) {
    const out = createImage(src.width, src.height);
    src.loadPixels(); out.loadPixels();
    const w = src.width, h = src.height;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = 4 * (y * w + x);
        const r = src.pixels[i], g = src.pixels[i+1], b = src.pixels[i+2], a = src.pixels[i+3];
        let grey = 0.2126*r + 0.7152*g + 0.0722*b;
        grey = this.clamp8(Math.round(grey * 1.2));
        out.pixels[i] = grey; out.pixels[i+1] = grey; out.pixels[i+2] = grey; out.pixels[i+3] = a;
      }
    }
    out.updatePixels(); return out;
  }

  static toGrey(src){
    const out=createImage(src.width,src.height);
    src.loadPixels(); out.loadPixels();
    const w=src.width,h=src.height;
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const i=4*(y*w+x);
        const r=src.pixels[i],g=src.pixels[i+1],b=src.pixels[i+2],a=src.pixels[i+3];
        const grey=this.clamp8(Math.round(0.2126*r+0.7152*g+0.0722*b));
        out.pixels[i]=grey; out.pixels[i+1]=grey; out.pixels[i+2]=grey; out.pixels[i+3]=a;
      }
    }
    out.updatePixels(); return out;
  }

  static splitRGB(src) {
    const rImg = createImage(src.width, src.height);
    const gImg = createImage(src.width, src.height);
    const bImg = createImage(src.width, src.height);
    src.loadPixels(); rImg.loadPixels(); gImg.loadPixels(); bImg.loadPixels();
    const w = src.width, h = src.height;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = 4 * (y * w + x);
        const r = src.pixels[i], g = src.pixels[i+1], b = src.pixels[i+2], a = src.pixels[i+3];
        rImg.pixels[i] = r; rImg.pixels[i+1] = 0; rImg.pixels[i+2] = 0; rImg.pixels[i+3] = a;
        gImg.pixels[i] = 0; gImg.pixels[i+1] = g; gImg.pixels[i+2] = 0; gImg.pixels[i+3] = a;
        bImg.pixels[i] = 0; bImg.pixels[i+1] = 0; bImg.pixels[i+2] = b; bImg.pixels[i+3] = a;
      }
    }
    rImg.updatePixels(); gImg.updatePixels(); bImg.updatePixels();
    return { rImg, gImg, bImg };
  }

  static thresholdRGB(src, tR, tG, tB) {
    const rOut = createImage(src.width, src.height);
    const gOut = createImage(src.width, src.height);
    const bOut = createImage(src.width, src.height);
    src.loadPixels(); rOut.loadPixels(); gOut.loadPixels(); bOut.loadPixels();
    const w = src.width, h = src.height;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = 4 * (y*w + x);
        const r = src.pixels[i], g = src.pixels[i+1], b = src.pixels[i+2], a = src.pixels[i+3];
        const rBW = (r >= tR) ? 255 : 0;
        const gBW = (g >= tG) ? 255 : 0;
        const bBW = (b >= tB) ? 255 : 0;
        rOut.pixels[i]=rBW; rOut.pixels[i+1]=rBW; rOut.pixels[i+2]=rBW; rOut.pixels[i+3]=a;
        gOut.pixels[i]=gBW; gOut.pixels[i+1]=gBW; gOut.pixels[i+2]=gBW; gOut.pixels[i+3]=a;
        bOut.pixels[i]=bBW; bOut.pixels[i+1]=bBW; bOut.pixels[i+2]=bBW; bOut.pixels[i+3]=a;
      }
    }
    rOut.updatePixels(); gOut.updatePixels(); bOut.updatePixels();
    return { rOut, gOut, bOut };
  }

  // --- Colour space conversions (HSV hue visual + YCbCr luma) ---
  static rgbToHsv(r,g,b){
    const rf=r/255,gf=g/255,bf=b/255;
    const max=Math.max(rf,gf,bf),min=Math.min(rf,gf,bf),d=max-min;
    let h=0; if(d!==0){
      if(max===rf) h=60*(((gf-bf)/d)%6);
      else if(max===gf) h=60*(((bf-rf)/d)+2);
      else h=60*(((rf-gf)/d)+4);
      if(h<0) h+=360;
    }
    const s=(max===0)?0:d/max, v=max;
    return {h,s,v};
  }
  static hsvToRgb(h,s,v){
    const c=v*s, x=c*(1-Math.abs(((h/60)%2)-1)), m=v-c;
    let rf=0,gf=0,bf=0;
    if(0<=h&&h<60){rf=c;gf=x;}
    else if(60<=h&&h<120){rf=x;gf=c;}
    else if(120<=h&&h<180){gf=c;bf=x;}
    else if(180<=h&&h<240){gf=x;bf=c;}
    else if(240<=h&&h<300){rf=x;bf=c;}
    else {rf=c;bf=x;}
    return {
      R:this.clamp8(Math.round((rf+m)*255)),
      G:this.clamp8(Math.round((gf+m)*255)),
      B:this.clamp8(Math.round((bf+m)*255))
    };
  }
  static hsvHueVisual(src){
    const out=createImage(src.width,src.height);
    src.loadPixels(); out.loadPixels();
    const w=src.width,h=src.height;
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const i=4*(y*w+x);
        const r=src.pixels[i], g=src.pixels[i+1], b=src.pixels[i+2], a=src.pixels[i+3];
        const {h:H}=this.rgbToHsv(r,g,b);
        const {R,G,B}=this.hsvToRgb(H,1,1);
        out.pixels[i]=R; out.pixels[i+1]=G; out.pixels[i+2]=B; out.pixels[i+3]=a;
      }
    }
    out.updatePixels(); return out;
  }
  static ycbcrY(src){
    const out=createImage(src.width,src.height);
    src.loadPixels(); out.loadPixels();
    const w=src.width,h=src.height;
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const i=4*(y*w+x);
        const R=src.pixels[i],G=src.pixels[i+1],B=src.pixels[i+2],A=src.pixels[i+3];
        const Y=this.clamp8(Math.round(0.299*R + 0.587*G + 0.114*B)); // BT.601
        out.pixels[i]=Y; out.pixels[i+1]=Y; out.pixels[i+2]=Y; out.pixels[i+3]=A;
      }
    }
    out.updatePixels(); return out;
  }

  
  // RGB -> YCbCr (BT.601 full-range)
static rgbToYCbCr(R, G, B){
  const Y  = 0.299*R + 0.587*G + 0.114*B;
  const Cb = 128 - 0.168736*R - 0.331264*G + 0.5*B;
  const Cr = 128 + 0.5*R      - 0.418688*G - 0.081312*B;
  return { Y, Cb, Cr };
}

// Threshold by HSV Hue *band* (one slider = band centre in degrees; width fixed)
static thresholdHSVHueBand(src, centerDeg, halfWidthDeg = 20){
  const out = createImage(src.width, src.height);
  src.loadPixels(); out.loadPixels();
  const w = src.width, h = src.height;
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      const i = 4*(y*w+x);
      const r=src.pixels[i], g=src.pixels[i+1], b=src.pixels[i+2], a=src.pixels[i+3];
      const {h: H} = this.rgbToHsv(r,g,b);
      // circular distance on [0,360)
      let d = Math.abs(H - centerDeg);
      if (d > 180) d = 360 - d;
      const bw = (d <= halfWidthDeg) ? 255 : 0;
      out.pixels[i] = bw; out.pixels[i+1] = bw; out.pixels[i+2] = bw; out.pixels[i+3] = a;
    }
  }
  out.updatePixels(); return out;
}

// Threshold by YCbCr chroma (Cr). High Cr ≈ “redness” / warm tones.
// Slider is a direct threshold on Cr in [0..255].
static thresholdYCbCrCr(src, t){
  const out = createImage(src.width, src.height);
  src.loadPixels(); out.loadPixels();
  const w = src.width, h = src.height;
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      const i = 4*(y*w+x);
      const R=src.pixels[i], G=src.pixels[i+1], B=src.pixels[i+2], A=src.pixels[i+3];
      const { Cr } = this.rgbToYCbCr(R,G,B);
      const bw = (Cr >= t) ? 255 : 0;
      out.pixels[i] = bw; out.pixels[i+1] = bw; out.pixels[i+2] = bw; out.pixels[i+3] = A;
    }
  }
  out.updatePixels(); return out;
}
  
  
  // --- Blur & Pixelate for face ---
  static boxBlur(src, radius=6){
    const w=src.width,h=src.height, ks=radius*2+1, area=ks*ks;
    const out=createImage(w,h); src.loadPixels(); out.loadPixels();
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        let rs=0,gs=0,bs=0,as=0;
        for(let dy=-radius; dy<=radius; dy++){
          const yy=Math.min(h-1, Math.max(0, y+dy));
          for(let dx=-radius; dx<=radius; dx++){
            const xx=Math.min(w-1, Math.max(0, x+dx));
            const ii=4*(yy*w+xx);
            rs+=src.pixels[ii]; gs+=src.pixels[ii+1]; bs+=src.pixels[ii+2]; as+=src.pixels[ii+3];
          }
        }
        const i=4*(y*w+x);
        out.pixels[i]=this.clamp8(rs/area);
        out.pixels[i+1]=this.clamp8(gs/area);
        out.pixels[i+2]=this.clamp8(bs/area);
        out.pixels[i+3]=this.clamp8(as/area);
      }
    }
    out.updatePixels(); return out;
  }
  static pixelate5x5Grey(src){
    const g=this.toGrey(src);
    const w=g.width,h=g.height, bs=5;
    const out=createImage(w,h);
    g.loadPixels(); out.loadPixels();
    for(let y=0; y<h; y+=bs){
      for(let x=0; x<w; x+=bs){
        let sum=0,count=0, yMax=Math.min(y+bs,h), xMax=Math.min(x+bs,w);
        for(let yy=y; yy<yMax; yy++){
          for(let xx=x; xx<xMax; xx++){
            const i=4*(yy*w+xx);
            sum += g.pixels[i]; count++;
          }
        }
        const avg=this.clamp8(Math.round(sum/count));
        for(let yy=y; yy<yMax; yy++){
          for(let xx=x; xx<xMax; xx++){
            const i=4*(yy*w+xx);
            out.pixels[i]=avg; out.pixels[i+1]=avg; out.pixels[i+2]=avg; out.pixels[i+3]=255;
          }
        }
      }
    }
    out.updatePixels(); return out;
  }

  // Composite: replace face ROI inside a COPY of the snapshot
  static replaceFaceInSnapshot(snapshotImg, rect, mode){
    if(!snapshotImg || !rect) return null;
    const x = Math.max(0, Math.floor(rect.x));
    const y = Math.max(0, Math.floor(rect.y));
    const w = Math.max(1, Math.min(snapshotImg.width  - x, Math.floor(rect.w)));
    const h = Math.max(1, Math.min(snapshotImg.height - y, Math.floor(rect.h)));

    const face = snapshotImg.get(x, y, w, h);
    let processed;
    switch(mode){
      case 1: processed = this.toGrey(face); break;
      case 2: processed = this.boxBlur(face, 6); break; // strong blur
      case 3: processed = this.hsvHueVisual(face); break; // reuse colour conversion
      case 4: processed = this.pixelate5x5Grey(face); break;
      default: processed = face;
    }
    const out = snapshotImg.get(); // copy full snapshot
    // Paste processed face back in place
    out.copy(processed, 0, 0, w, h, x, y, w, h);
    return out;
  }
}

class FaceDetector {
  constructor(w=160, h=120) {
    this.detector = new objectdetect.detector(w, h, 1.1, objectdetect.frontalface);
  }
  detectOnCanvas(canvasLike){
    const faces = this.detector.detect(canvasLike);
    if(!faces || faces.length===0) return null;
    // pick largest
    let best = faces[0], bestA = faces[0][2]*faces[0][3];
    for(let k=1;k<faces.length;k++){
      const a = faces[k][2]*faces[k][3];
      if(a>bestA){ best = faces[k]; bestA = a; }
    }
    return {x:best[0], y:best[1], w:best[2], h:best[3]};
  }
}

// === App state ===
let video, snap;
let pendingSnap = false;
let sliderR, sliderG, sliderB, sliderHSV, sliderY;
let faceDetector, faceRectLive=null, faceRectSnap=null;
let faceMode = 1; // 1=greyscale, 2=blur, 3=colour-converted, 4=pixelate

function setup() {
  createCanvas(gridWidth(), gridHeight());
  video = new VideoSource(640, 480);
  snap  = new SnapshotBuffer(160, 120);
  faceDetector = new FaceDetector(160, 120);

  // Channel threshold sliders below row 3
  sliderR = createSlider(0, 255, 128, 1);
  sliderG = createSlider(0, 255, 128, 1);
  sliderB = createSlider(0, 255, 128, 1);
  sliderHSV = createSlider(0, 360, 0, 1);
  sliderY = createSlider(0, 255, 128, 1);
  const yBase = cellY(2) + CELL_H + 8;
  const yBase2 = cellY(4) + CELL_H + 8;
  sliderR.position(cellX(0), yBase);
  sliderG.position(cellX(1), yBase);
  sliderB.position(cellX(2), yBase);
  sliderHSV.position(cellX(1), yBase2);
  sliderY.position(cellX(2), yBase2);

}

function draw() {
  background(0);

  // (0,0) Live webcam
  if (video.isReady()) {
    image(video.frame(), cellX(0), cellY(0), CELL_W, CELL_H);
    // detect on live 160x120 to draw green box
    const liveImg = get(cellX(0), cellY(0), CELL_W, CELL_H);
    const srcEl = liveImg.canvas || liveImg.elt || liveImg;
    faceRectLive = faceDetector.detectOnCanvas(srcEl);
    if (faceRectLive) {
      push(); noFill(); stroke(0,255,0); strokeWeight(2);
      rect(cellX(0)+faceRectLive.x, cellY(0)+faceRectLive.y, faceRectLive.w, faceRectLive.h);
      pop();
    }
  } else {
    placeholder(cellX(0), cellY(0));
  }

  // Capture snapshot from live cell if requested
  if (pendingSnap && video.isReady()) {
    snap.setFromCanvas(cellX(0), cellY(0), CELL_W, CELL_H);
    const srcEl = snap.img.canvas || snap.img.elt || snap.img;
    faceRectSnap = faceDetector.detectOnCanvas(srcEl);
    pendingSnap = false;
  }

  // If we have a snapshot, fill the other panels from it
  if (snap.has()) {
    // (1,0) Greyscale + 20% brightness
    image(ImageOps.greyPlus20(snap.img), cellX(1), cellY(0), CELL_W, CELL_H);

    // (row 2): R/G/B
    const { rImg, gImg, bImg } = ImageOps.splitRGB(snap.img);
    image(rImg, cellX(0), cellY(1), CELL_W, CELL_H);
    image(gImg, cellX(1), cellY(1), CELL_W, CELL_H);
    image(bImg, cellX(2), cellY(1), CELL_W, CELL_H);

    // (row 3): thresholds per channel
    const { rOut, gOut, bOut } = ImageOps.thresholdRGB(
      snap.img, sliderR.value(), sliderG.value(), sliderB.value()
    );
    image(rOut, cellX(0), cellY(2), CELL_W, CELL_H);
    image(gOut, cellX(1), cellY(2), CELL_W, CELL_H);
    image(bOut, cellX(2), cellY(2), CELL_W, CELL_H);

    // (row 4): webcam image (repeat) + colour spaces
    image(snap.img, cellX(0), cellY(3), CELL_W, CELL_H);
    image(ImageOps.hsvHueVisual(snap.img), cellX(1), cellY(3), CELL_W, CELL_H);
    image(ImageOps.ycbcrY(snap.img), cellX(2), cellY(3), CELL_W, CELL_H);

     // Bottom row, col 2: Threshold from colour space 1 (HSV by Value)
    const hsvThresh = ImageOps.thresholdHSVHueBand(snap.img, sliderHSV.value(), 20); // 20° band
    image(hsvThresh, cellX(1), cellY(4), CELL_W, CELL_H);

    // Bottom row, col 3: Threshold from colour space 2 (YCbCr by Y/luma)
    const yThresh   = ImageOps.thresholdYCbCrCr(snap.img, sliderY.value());           // Cr threshold
    image(yThresh, cellX(2), cellY(4), CELL_W, CELL_H);

    // (row 5, col 1): Face detection & replaced face images (full snapshot with ROI replaced)
    let replaced = null;
    if (!faceRectSnap) {
      // try detect once if missing
      const srcEl2 = snap.img.canvas || snap.img.elt || snap.img;
      faceRectSnap = faceDetector.detectOnCanvas(srcEl2);
    }
    if (faceRectSnap) {
      replaced = ImageOps.replaceFaceInSnapshot(snap.img, faceRectSnap, faceMode);
      image(replaced, cellX(0), cellY(4), CELL_W, CELL_H);
    } else {
      placeholder(cellX(0), cellY(4));
    }

    
  } else {
    // placeholders for snapshot-dependent cells
    placeholder(cellX(1), cellY(0));
    for (let c=0;c<3;c++){ placeholder(cellX(c), cellY(1)); placeholder(cellX(c), cellY(2)); }
    for (let c=0;c<3;c++){ placeholder(cellX(c), cellY(3)); }
    for (let c=0;c<3;c++){ placeholder(cellX(c), cellY(4)); }
  }
}

// === Interactions ===
function keyPressed() {
  // If a slider/input is focused, blur it so number keys work
  const active = document.activeElement;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
    active.blur();
  }

  if (key === ' ') { pendingSnap = true; return false; }           // take snapshot
  if (key === 's' || key === 'S') { saveSnapshot(); return false; } // save snapshot

  // 1..4 to switch face replacement mode
  if (key === '1') { faceMode = 1; return false; }
  if (key === '2') { faceMode = 2; return false; }
  if (key === '3') { faceMode = 3; return false; }
  if (key === '4') { faceMode = 4; return false; }
}

function mousePressed() { pendingSnap = true; }

function saveSnapshot() {
  if (!snap.has() && video.isReady()) {
    pendingSnap = true;
  } else if (snap.has()) {
    snap.save();
  }
}
