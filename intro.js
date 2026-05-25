const ALL_IDS=['g1','g2','g3','g4','g5','g6','g7','g8','g9','g10','g11','g12','g13','g14','g15','g16','g17','g18'];
let introTimers=[];
window._introComplete=false;

function generatePositions(){
  const cols=6,rows=3,cellW=680/cols,cellH=600/rows,positions=[];
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
    positions.push({x:Math.round(c*cellW+10+Math.random()*(cellW-90)),y:Math.round(r*cellH+10+Math.random()*(cellH-130))});
  }
  for(let i=positions.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[positions[i],positions[j]]=[positions[j],positions[i]];}
  return positions;
}

let POSITIONS=[];
let fallingRAFs=[];

function T(fn,ms){const id=setTimeout(fn,ms);introTimers.push(id);}
function setWord(w){const d=document.getElementById('word-display');d.style.opacity='0';setTimeout(()=>{d.textContent=w;d.style.opacity='1';},100);}
function clearWord(){document.getElementById('word-display').style.opacity='0';}
function placeG(id,idx){const p=POSITIONS[idx]||{x:50+idx*60,y:50};document.getElementById(id).setAttribute('transform',`translate(${p.x},${p.y})`);}
function showG(id){document.getElementById(id).classList.add('show');}

function animateFall(id,delay){
  setTimeout(()=>{
    const el=document.getElementById(id);if(!el)return;
    const t=el.getAttribute('transform')||'translate(0,0)';
    const m=t.match(/translate\(([^,]+),([^)]+)\)/);
    const x=m?parseFloat(m[1]):0,y=m?parseFloat(m[2]):0;
    const startTime=performance.now(),dur=680,endY=y+750;
    function step(now){
      let p=Math.min((now-startTime)/dur,1);
      const ease=p*p*(2.5-1.5*p)*p;
      el.setAttribute('transform',`translate(${x},${y+(endY-y)*ease})`);
      if(p<1)fallingRAFs.push(requestAnimationFrame(step));
    }
    fallingRAFs.push(requestAnimationFrame(step));
  },delay);
}

function animateS3Fall(){
  const el=document.getElementById('s3-line');
  const startTime=performance.now(),dur=650;
  function step(now){
    const p=Math.min((now-startTime)/dur,1);
    const ease=p*p*(2.5-1.5*p)*p;
    el.style.transform=`translate(-50%,calc(-50% + ${ease*130}vh))`;
    el.style.opacity=String(1-Math.max(0,(p-0.6)/0.4));
    if(p<1)fallingRAFs.push(requestAnimationFrame(step));
  }
  fallingRAFs.push(requestAnimationFrame(step));
}

function fallAll(){
  ALL_IDS.forEach((id,i)=>animateFall(id,i*10));
  animateS3Fall();
  // Fade out entire garment layer after drop completes
  setTimeout(()=>{
    const layer=document.getElementById('garment-layer');
    layer.style.transition='opacity 0.6s ease';
    layer.style.opacity='0';
  }, 800);
}

function resetAll(){
  introTimers.forEach(clearTimeout);introTimers=[];
  fallingRAFs.forEach(cancelAnimationFrame);fallingRAFs=[];
  window._introComplete=false;
  POSITIONS=generatePositions();
  ALL_IDS.forEach((id,i)=>{
    const el=document.getElementById(id);
    el.classList.remove('show');placeG(id,i);
    el.style.transform='';el.style.opacity='';
  });
  // Restore garment layer
  const layer=document.getElementById('garment-layer');
  layer.style.transition='none';layer.style.opacity='1';
  const s3=document.getElementById('s3-line');
  s3.classList.remove('show');s3.style.cssText='';
  document.getElementById('word-display').textContent='';
  document.getElementById('word-display').style.opacity='1';
  document.getElementById('intro-wrap').classList.remove('show');
  document.getElementById('aisle-reveal').classList.remove('show');
  document.getElementById('scroll-ind').classList.remove('show');
  document.getElementById('replay-btn').classList.remove('show');
  roomT0=null;
}

function startMarquee(onExit){
  const inner=document.getElementById('marquee-inner');
  inner.style.transform='translateX(105vw)';inner.style.transition='none';
  void inner.offsetWidth;
  inner.style.transition='transform 5s cubic-bezier(0.22,1,0.36,1)';
  inner.style.transform='translateX(-110%)';
  setTimeout(onExit,4000);
}

function runIntro(){
  let c=0;
  POSITIONS=generatePositions();
  ALL_IDS.forEach((id,i)=>placeG(id,i));

  T(()=>{setWord('Too');placeG('g1',0);showG('g1');},c);
  c+=650;T(()=>{setWord('many');placeG('g3',1);showG('g3');},c);
  c+=650;T(()=>{setWord('options');placeG('g5',2);showG('g5');},c);
  c+=1300;
  T(()=>{setWord('Too');placeG('g2',3);showG('g2');},c);
  c+=650;T(()=>{setWord('little');placeG('g8',4);showG('g8');},c);
  c+=650;T(()=>{setWord('time');placeG('g7',5);showG('g7');},c);
  const s3T=c+1000;
  T(()=>{clearWord();setTimeout(()=>document.getElementById('s3-line').classList.add('show'),120);},s3T);
  const flood=['g4','g6','g9','g10','g11','g12','g13','g14','g15','g16','g17','g18'];
  const floodStart=s3T+120;
  flood.forEach((id,i)=>T(()=>{placeG(id,6+i);showG(id);},floodStart+i*55));
  const dropT=floodStart+flood.length*55+1000;
  T(()=>fallAll(),dropT);
  const introT=dropT+900;
  T(()=>{
    document.getElementById('intro-wrap').classList.add('show');
    startMarquee(()=>{
      document.getElementById('aisle-reveal').classList.add('show');
      setTimeout(()=>{
        document.getElementById('scroll-ind').classList.add('show');
        document.getElementById('replay-btn').classList.add('show');
        window._introComplete=true;
      },700);
    });
  },introT);
}

function replayIntro(){resetAll();setTimeout(runIntro,80);}
