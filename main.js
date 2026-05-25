// Boot
window._introComplete=false;
window.AISLE_APP_URL='https://your-app-url.vercel.app'; // ← replace with your app URL

// Run intro animation
runIntro();

// Init room in background
initRoom();

// Listen for scroll after intro completes → switch to room scene
let touchStartY=0;
window.addEventListener('wheel',onScrollIntent,{passive:true});
window.addEventListener('touchstart',e=>{touchStartY=e.touches[0].clientY;},{passive:true});
window.addEventListener('touchmove',e=>{
  if(touchStartY-e.touches[0].clientY>30)onScrollIntent();
},{passive:true});

function onScrollIntent(){
  if(!window._introComplete)return;
  if(document.getElementById('room-scene').classList.contains('active'))return;
  switchToRoom();
}

function switchToRoom(){
  document.getElementById('intro-scene').classList.add('hidden');
  document.getElementById('room-scene').classList.add('active');
  roomT0=null; // reset room timer so camera starts fresh
}

// Rotating words in USP
const rotWords=['your vibe','your size','the occasion','body type'];
let rotIdx=0;
setInterval(()=>{
  rotIdx=(rotIdx+1)%rotWords.length;
  const el=document.getElementById('rotating-word');
  if(el){el.style.opacity='0';setTimeout(()=>{el.textContent=rotWords[rotIdx];el.style.opacity='1';},200);}
},1800);
