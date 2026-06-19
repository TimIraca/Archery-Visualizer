const N = 72, ENDS = 12, PER = 6, R_FACE = 61, BAND = 6.1;
const MONTE_CARLO_N = 1000;
const $ = id => document.getElementById(id);
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

const ringColor = s => s >= 9 ? "#FEE12A" : s >= 7 ? "#E60E2A" : s >= 5 ? "#1f86df" : s >= 3 ? "#0F0F0F" : "#FFFFFF";
function score(x,y){ const r = Math.hypot(x,y); return r > R_FACE ? 0 : 11 - Math.max(1, Math.ceil(r / BAND)); }
function isX(x,y){ return Math.hypot(x,y) <= BAND; }
function point(x,y,i){ return {x, y, i, end: Math.floor(i / PER) + 1, s: score(x,y), x_ring: isX(x,y), r: Math.hypot(x,y)}; }
function total(pts){ return d3.sum(pts, d => d.s); }
function xCount(pts){ return pts.filter(d => d.x_ring).length; }
function fmt(v,d=0){ return Number.isFinite(v) ? v.toFixed(d) : "—"; }

function mulberry32(a){ return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function randn(rng){ const u = Math.max(1e-9, rng()), v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function shuffledIndexes(n, rng){ const a = d3.range(n); for(let i=n-1;i>0;i--){ const j = Math.floor(rng() * (i+1)); [a[i],a[j]] = [a[j],a[i]]; } return a; }

const REAL_XY = [[24.14,-9.55],[21.61,21.65],[13.02,-0.93],[28.55,6.57],[15.99,3.22],[11.06,20.99],[3.97,0.46],[-13.23,-0.7],[17.68,4.02],[28.57,26.84],[8.16,12.92],[-10.19,-14.7],[-3.43,8.57],[7.21,4.75],[0.48,-7.31],[9.68,16.33],[12.31,8.36],[3.92,10.3],[-5.95,20.73],[4.64,0.5],[5.63,10.19],[17.32,4.59],[6.23,-2.55],[11.07,9.47],[-0.48,-7.72],[0.31,4.25],[17.75,9.64],[-18.42,-5.64],[24.35,11.33],[0.42,8.33],[17.6,22.41],[7.7,-6.36],[15.66,3.56],[15.35,27.67],[4.66,26.49],[10.6,12.34],[-7.8,8.1],[6.57,-8.07],[11.01,4.43],[9.16,11.9],[12.42,19.56],[-2.05,-9.49],[23.03,10.49],[-9.13,-2.2],[10.01,9.01],[26.28,36.09],[10.13,-2.86],[8.78,11.68],[-11.11,0.32],[6.62,19.51],[-1.71,-6.98],[13.24,13.65],[4.16,7.53],[7.43,-8.53],[-1.28,-0.84],[-2.25,-5.03],[6.19,10.63],[-6.96,22.47],[10.25,-16.6],[6.05,7.68],[3.85,11.74],[-6.98,-8.48],[7.06,13.98],[1.56,14.17],[-1.62,-13.87],[-1.99,12.16],[-3.81,6.21],[-0.46,-8.14],[25.33,8.37],[7.54,7.89],[1.92,-8.63],[12.71,-13.22]];
const REAL = REAL_XY.map((d,i) => point(d[0], d[1], i));
const REAL_MEAN = {x: d3.mean(REAL_XY,d=>d[0]), y: d3.mean(REAL_XY,d=>d[1])};
const REAL_SD = {x: d3.deviation(REAL_XY,d=>d[0]) || 1, y: d3.deviation(REAL_XY,d=>d[1]) || 1};
const REAL_RESID = REAL_XY.map(d => ({x:d[0]-REAL_MEAN.x, y:d[1]-REAL_MEAN.y}));

const PROFILES = {
  Pro: {spread:.55, bx:0, by:0, fat:.55, blend:.82, jitter:.75, endWobble:.45, color:css("--pro")},
  Elite: {spread:.75, bx:-.8, by:.8, fat:.9, blend:.82, jitter:.85, endWobble:.65, color:css("--elite")},
  Intermediate: {spread:1.10, bx:2.8, by:1.8, fat:1.8, blend:.80, jitter:1.1, endWobble:1.0, color:css("--inter")},
  Beginner: {spread:1.70, bx:-4.0, by:-2.5, fat:3.6, blend:.76, jitter:1.6, endWobble:1.7, color:css("--beginner")}
};

const state = {
  page:"single",
  profileName:"Elite",
  profile:{...PROFILES.Elite},
  singleMode:"sim",
  singleSeed:4200,
  multiSeed:9100,
  singleRound:[],
  multiRounds:[],
  monteCarloRounds:[],
  singleShot:N,
  multiShot:N,
  timer:null,
  activePlay:null
};

function simulateRound(profile, seed){
  const rng = mulberry32(seed);
  const order = shuffledIndexes(N, rng);
  const endOffsets = d3.range(ENDS).map(() => ({
    x: randn(rng) * profile.endWobble * profile.spread,
    y: randn(rng) * profile.endWobble * profile.spread
  }));
  const pts = [];
  for(let i=0;i<N;i++){
    const emp = REAL_RESID[order[i] % REAL_RESID.length];
    const gx = randn(rng) * REAL_SD.x;
    const gy = randn(rng) * REAL_SD.y;
    const blendedX = profile.blend * emp.x + (1 - profile.blend) * gx;
    const blendedY = profile.blend * emp.y + (1 - profile.blend) * gy;
    const t = i / (N - 1);
    const e = endOffsets[Math.floor(i / PER)];
    const x = profile.bx + profile.spread * blendedX + e.x + profile.fat * (t - .5) + randn(rng) * profile.jitter;
    const y = profile.by + profile.spread * blendedY + e.y - .65 * profile.fat * (t - .5) + randn(rng) * profile.jitter;
    pts.push(point(x, y, i));
  }
  return pts;
}
function regenerateSingle(){
  state.singleRound = state.singleMode === "real" ? REAL.map(d => ({...d})) : simulateRound(state.profile, state.singleSeed);
}
function regenerateMulti(){
  state.multiRounds = d3.range(20).map(i => ({id:i+1, round:simulateRound(state.profile, state.multiSeed + i * 101)}));
}
function regenerateMonteCarlo(){
  // Separate seed stream from the visible 20 matches, so the distribution stays stable
  // while still changing when a new batch/profile is generated.
  state.monteCarloRounds = d3.range(MONTE_CARLO_N).map(i => simulateRound(state.profile, state.multiSeed + 50000 + i * 37));
}

function groupEllipse(pts){
  if(pts.length < 3) return null;
  const mx = d3.mean(pts,d=>d.x), my = d3.mean(pts,d=>d.y);
  let a=0,b=0,c=0;
  pts.forEach(p => { a += (p.x-mx)**2; b += (p.x-mx)*(p.y-my); c += (p.y-my)**2; });
  a /= pts.length - 1; b /= pts.length - 1; c /= pts.length - 1;
  const tr = a + c, det = a*c - b*b, disc = Math.sqrt(Math.max(0, tr*tr/4 - det));
  const l1 = tr/2 + disc, l2 = tr/2 - disc;
  const ang = Math.atan2(l1 - a, b || 1e-9);
  return {mx,my,rx:2*Math.sqrt(Math.max(0,l1)),ry:2*Math.sqrt(Math.max(0,l2)),deg:-ang*180/Math.PI};
}

function drawTarget(svgSel, pts, options={}){
  const size = options.size || 560;
  const color = options.color || state.profile.color;
  const mini = options.mini || false;
  const svg = svgSel.attr("viewBox", `0 0 ${size} ${size}`);
  svg.selectAll("*").remove();
  const sc = d3.scaleLinear().domain([-65,65]).range([0,size]);
  const cm = v => sc(v) - sc(0);
  const g = svg.append("g");
  for(let s=1;s<=10;s++){
    g.append("circle")
      .attr("cx",sc(0)).attr("cy",sc(0)).attr("r",cm(R_FACE-(s-1)*BAND))
      .attr("fill",ringColor(s)).attr("stroke","#0009").attr("stroke-width", mini ? .35 : .6);
  }
  g.append("circle").attr("cx",sc(0)).attr("cy",sc(0)).attr("r",cm(BAND)).attr("fill","none").attr("stroke","#0009").attr("stroke-width",mini?.35:.6);
  g.append("line").attr("x1",sc(-61)).attr("x2",sc(61)).attr("y1",sc(0)).attr("y2",sc(0)).attr("stroke","#0006").attr("stroke-width",mini?.6:1);
  g.append("line").attr("y1",sc(-61)).attr("y2",sc(61)).attr("x1",sc(0)).attr("x2",sc(0)).attr("stroke","#0006").attr("stroke-width",mini?.6:1);

  if(pts.length){
    const e = groupEllipse(pts);
    if(e && !mini){
      g.append("line").attr("x1",sc(0)).attr("y1",sc(0)).attr("x2",sc(e.mx)).attr("y2",sc(-e.my)).attr("stroke",color).attr("stroke-dasharray","4 4").attr("stroke-width",1.4).attr("opacity",.8);
      g.append("ellipse").attr("rx",cm(e.rx)).attr("ry",cm(e.ry)).attr("fill","none").attr("stroke",color).attr("stroke-width",2.3).attr("transform",`translate(${sc(e.mx)},${sc(-e.my)}) rotate(${e.deg})`);
      g.append("text").attr("x",sc(e.mx)).attr("y",sc(-e.my)).attr("text-anchor","middle").attr("dy",".35em").attr("font-size",24).attr("font-weight",800).attr("fill",color).attr("stroke","#fff").attr("stroke-width",.5).text("✕");
    }
    const arrows = g.selectAll("circle.arrow").data(pts).join("circle")
      .attr("class","arrow")
      .attr("cx",d=>sc(d.x)).attr("cy",d=>sc(-d.y))
      .attr("r",d=>d.i === pts[pts.length-1].i ? (mini?3.1:5.3) : (mini?2.3:4.2))
      .attr("fill",d=>d.i === pts[pts.length-1].i ? color : "#0c0c0c")
      .attr("stroke","#fff").attr("stroke-width",mini?.45:.8).attr("opacity",.9);
    if(!mini){
      arrows.on("mousemove", (ev,d) => {
        d3.select("#tip").style("opacity",1).style("left",ev.clientX+12+"px").style("top",ev.clientY+12+"px")
          .html(`Arrow ${d.i+1} · <b>${d.x_ring ? "X" : d.s}</b> · (${d.x.toFixed(1)}, ${d.y.toFixed(1)})`);
      }).on("mouseleave", () => d3.select("#tip").style("opacity",0));
    }
  }
}

function endScores(pts){
  const out = [];
  for(let e=0;e<ENDS;e++){
    const seg = pts.slice(e*PER, e*PER + PER);
    if(seg.length) out.push({end:e+1, total:total(seg), complete:seg.length === PER});
  }
  return out;
}
function drawTimeline(round, revealed, color){
  const svg = d3.select("#timeline"); svg.selectAll("*").remove();
  const w=360,h=180,m={l:32,r:12,t:12,b:28};
  const x=d3.scaleLinear().domain([1,12]).range([m.l,w-m.r]);
  const y=d3.scaleLinear().domain([0,60]).range([h-m.b,m.t]);
  svg.append("g").attr("transform",`translate(0,${h-m.b})`).call(d3.axisBottom(x).ticks(12).tickFormat(d3.format("d")).tickSize(3)).attr("color",css("--muted"));
  svg.append("g").attr("transform",`translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickSize(3)).attr("color",css("--muted"));
  const allEnds = endScores(round);
  const fullLine = d3.line().x(d=>x(d.end)).y(d=>y(d.total));
  svg.append("path").datum(allEnds).attr("d",fullLine).attr("fill","none").attr("stroke","#6f7785").attr("stroke-width",1.2).attr("opacity",.28);
  const current = endScores(revealed);
  const line = d3.line().x(d=>x(d.end)).y(d=>y(d.total));
  svg.append("path").datum(current).attr("d",line).attr("fill","none").attr("stroke",color).attr("stroke-width",2.5);
  svg.selectAll("circle.end").data(current).join("circle").attr("class","end").attr("cx",d=>x(d.end)).attr("cy",d=>y(d.total)).attr("r",d=>d.complete?3.8:4.8).attr("fill",d=>d.complete?color:"#0c0f13").attr("stroke",color).attr("stroke-width",1.4);
  svg.append("text").attr("x",w-m.r).attr("y",m.t+5).attr("text-anchor","end").attr("font-size",11).attr("font-weight",700).attr("fill",color).text(`${current.length} / 12 ends`);
}
function drawHistogram(pts){
  const svg = d3.select("#hist"); svg.selectAll("*").remove();
  const w=360,h=160,m={l:26,r:8,t:10,b:24};
  const x=d3.scaleBand().domain(d3.range(0,11)).range([m.l,w-m.r]).padding(.18);
  const counts = d3.range(0,11).map(s => pts.filter(p=>p.s===s).length);
  const y=d3.scaleLinear().domain([0,Math.max(6,d3.max(counts)||0)]).range([h-m.b,m.t]);
  svg.append("g").attr("transform",`translate(0,${h-m.b})`).call(d3.axisBottom(x).tickSize(3)).attr("color",css("--muted"));
  svg.append("g").attr("transform",`translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickSize(3)).attr("color",css("--muted"));
  svg.selectAll("rect").data(counts).join("rect")
    .attr("x",(_,i)=>x(i)).attr("width",x.bandwidth()).attr("y",d=>y(d)).attr("height",d=>h-m.b-y(d))
    .attr("fill",(_,i)=>i===0?"#3a4250":ringColor(i)).attr("stroke","rgba(255,255,255,.22)").attr("stroke-width",.5);
}

function drawMultiScoreHistogram(rounds, shot, color){
  const svg = d3.select("#multiScoreHist"); svg.selectAll("*").remove();
  const w=900,h=250,m={l:52,r:28,t:24,b:50};
  const mcRounds = state.monteCarloRounds && state.monteCarloRounds.length ? state.monteCarloRounds : rounds.map(d => d.round);
  const mcScores = mcRounds.map(r => total(r.slice(0, shot)));
  const batchScores = rounds.map(d => total(d.round.slice(0, shot)));
  if(!mcScores.length || !batchScores.length){ return; }

  const allScores = mcScores.concat(batchScores);
  const maxPossible = Math.max(10, shot * 10);
  const binWidth = shot >= N ? 5 : Math.max(2, Math.ceil(maxPossible / 36));
  const rawMin = Math.max(0, d3.min(allScores) - binWidth * 2);
  const rawMax = Math.min(maxPossible, d3.max(allScores) + binWidth * 2);
  const lo = Math.max(0, Math.floor(rawMin / binWidth) * binWidth);
  const hi = Math.max(lo + binWidth, Math.ceil(rawMax / binWidth) * binWidth);
  const thresholds = d3.range(lo, hi + binWidth, binWidth);
  const bins = d3.bin().domain([lo, hi]).thresholds(thresholds)(mcScores);

  const x = d3.scaleLinear().domain([lo, hi]).range([m.l, w - m.r]);
  const yMax = Math.max(1, d3.max(bins, d => d.length));
  const y = d3.scaleLinear().domain([0, yMax]).nice().range([h - m.b, m.t]);

  svg.append("g")
    .attr("transform",`translate(0,${h-m.b})`)
    .call(d3.axisBottom(x).ticks(9).tickSize(4))
    .attr("color",css("--muted"));
  svg.append("g")
    .attr("transform",`translate(${m.l},0)`)
    .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format("d")).tickSize(4))
    .attr("color",css("--muted"));

  // Main Monte Carlo distribution.
  svg.selectAll("rect.mc-bin").data(bins).join("rect")
    .attr("class","mc-bin")
    .attr("x",d=>x(d.x0)+1)
    .attr("width",d=>Math.max(1, x(d.x1)-x(d.x0)-2))
    .attr("y",d=>y(d.length))
    .attr("height",d=>h-m.b-y(d.length))
    .attr("fill",color)
    .attr("opacity",.42)
    .attr("stroke","#0008")
    .attr("stroke-width",.6);

  // Light density curve over the histogram, so the chart reads as a distribution.
  const density = bins.map(d => ({x:(d.x0+d.x1)/2, y:d.length}));
  const line = d3.line()
    .curve(d3.curveBasis)
    .x(d=>x(d.x))
    .y(d=>y(d.y));
  svg.append("path")
    .datum(density)
    .attr("d",line)
    .attr("fill","none")
    .attr("stroke",color)
    .attr("stroke-width",2.4)
    .attr("opacity",.95);

  const sorted = [...mcScores].sort((a,b)=>a-b);
  const q05 = d3.quantileSorted(sorted,.05);
  const q50 = d3.quantileSorted(sorted,.50);
  const q95 = d3.quantileSorted(sorted,.95);
  const mcMean = d3.mean(mcScores);
  const batchMean = d3.mean(batchScores);

  // Central 90% band.
  svg.append("rect")
    .attr("x",x(q05)).attr("y",m.t)
    .attr("width",Math.max(1,x(q95)-x(q05)))
    .attr("height",h-m.b-m.t)
    .attr("fill",css("--gold"))
    .attr("opacity",.08);
  svg.append("line")
    .attr("x1",x(mcMean)).attr("x2",x(mcMean))
    .attr("y1",m.t).attr("y2",h-m.b)
    .attr("stroke",css("--gold"))
    .attr("stroke-width",2)
    .attr("stroke-dasharray","4 4");
  svg.append("text")
    .attr("x",x(mcMean)+7).attr("y",m.t+12)
    .attr("font-family",css("--mono"))
    .attr("font-size",11)
    .attr("fill",css("--gold"))
    .text(`MC mean ${mcMean.toFixed(1)}`);

  // Overlay the 20 actually displayed matches as ticks below the axis.
  svg.selectAll("line.batch-rug").data(batchScores).join("line")
    .attr("class","batch-rug")
    .attr("x1",d=>x(d)).attr("x2",d=>x(d))
    .attr("y1",h-m.b+7).attr("y2",h-m.b+22)
    .attr("stroke",css("--ink"))
    .attr("stroke-width",1.5)
    .attr("opacity",.88);
  svg.append("circle")
    .attr("cx",x(batchMean)).attr("cy",h-m.b+30)
    .attr("r",4.5)
    .attr("fill",css("--ink"))
    .attr("stroke",color)
    .attr("stroke-width",1.5);

  svg.append("text")
    .attr("x",w-m.r).attr("y",h-10)
    .attr("text-anchor","end")
    .attr("font-family",css("--mono"))
    .attr("font-size",11)
    .attr("fill",css("--muted"))
    .text(shot >= N ? "final 72-arrow score" : `score after ${shot} arrows`);
  svg.append("text")
    .attr("x",m.l).attr("y",h-10)
    .attr("font-family",css("--mono"))
    .attr("font-size",11)
    .attr("fill",css("--muted"))
    .text(`central 90%: ${q05.toFixed(0)}–${q95.toFixed(0)} · median ${q50.toFixed(0)} · 20-match avg ${batchMean.toFixed(1)}`);
  svg.append("text")
    .attr("x",15).attr("y",m.t)
    .attr("font-family",css("--mono"))
    .attr("font-size",11)
    .attr("fill",css("--muted"))
    .attr("transform",`rotate(-90 15 ${m.t})`)
    .text("simulated matches");

  const meta = $("mHistMeta");
  if(meta) meta.textContent = `${MONTE_CARLO_N.toLocaleString()} simulated rounds · 20 shown`;
}

function zoneClass(p){
  if(p.s>=9) return "z-gold";
  if(p.s>=7) return "z-red";
  if(p.s>=5) return "z-blue";
  if(p.s>=3) return "z-black";
  if(p.s>=1) return "z-white";
  return "z-miss";
}
function drawScorecard(round, revealed){
  const el = $("scorecard"); if(!el) return;
  const shown = revealed.length;
  let running = 0, rows = "";
  for(let e=0;e<ENDS;e++){
    const seg = round.slice(e*PER, e*PER+PER);
    let cells = "", endTotal = 0, endHasShown = false;
    for(let a=0;a<PER;a++){
      const idx = e*PER + a, p = seg[a], isShown = idx < shown;
      if(isShown){
        const val = p.x_ring ? "X" : (p.s === 0 ? "M" : p.s);
        const cur = idx === shown - 1 ? " cur" : "";
        cells += `<td class="ac ${zoneClass(p)}${cur}">${val}</td>`;
        endTotal += p.s; endHasShown = true;
      } else {
        cells += `<td class="ac empty">·</td>`;
      }
    }
    let etStr = "·", rtStr = "·";
    if(endHasShown){ etStr = endTotal; running += endTotal; rtStr = running; }
    const live = (shown > e*PER && shown <= (e+1)*PER) ? " live" : "";
    rows += `<tr class="${live}"><td class="en">${e+1}</td>${cells}<td class="et">${etStr}</td><td class="rt">${rtStr}</td></tr>`;
  }
  el.innerHTML = `<table class="card-tbl"><thead><tr><th>End</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>Σ</th><th>Tot</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function syncSliders(){
  const p = state.profile;
  $("spread").value = p.spread; $("bx").value = p.bx; $("by").value = p.by; $("fat").value = p.fat; $("blend").value = p.blend;
  $("vSpread").textContent = p.spread.toFixed(2) + "×";
  $("vBx").textContent = (p.bx>0?"+":"") + p.bx.toFixed(1) + " cm";
  $("vBy").textContent = (p.by>0?"+":"") + p.by.toFixed(1) + " cm";
  $("vFat").textContent = p.fat.toFixed(2) + " cm";
  $("vBlend").textContent = Math.round(p.blend * 100) + "%";
}
function setActiveButtons(){
  d3.selectAll("[data-profile]").classed("on", function(){ return this.getAttribute("data-profile") === state.profileName; });
  $("realRoundBtn").classList.toggle("on", state.singleMode === "real");
}
function profileButton(name){
  const p = PROFILES[name];
  return d3.create("button").attr("class","btn").attr("data-profile",name).style("color",p.color).text(name).on("click", () => {
    state.profileName = name;
    state.profile = {...PROFILES[name]};
    state.singleMode = "sim";
    state.singleSeed += 17;
    state.multiSeed += 211;
    state.singleShot = N;
    state.multiShot = N;
    pause();
    regenerateSingle(); regenerateMulti(); regenerateMonteCarlo(); syncSliders(); setActiveButtons(); render();
  }).node();
}
function buildPresetButtons(){
  Object.keys(PROFILES).forEach(name => {
    $("singlePresets").appendChild(profileButton(name));
    $("multiPresets").appendChild(profileButton(name));
  });
}

function renderSingle(){
  const round = state.singleRound;
  const revealed = round.slice(0, state.singleShot);
  const color = state.singleMode === "real" ? css("--real") : state.profile.color;
  drawTarget(d3.select("#mainTarget"), revealed, {size:560, color});
  drawTimeline(round, revealed, color);
  drawHistogram(revealed);
  drawScorecard(round, revealed);
  $("sScore").textContent = `${total(revealed)}`;
  const last = revealed[revealed.length-1];
  $("sLast").textContent = last ? (last.x_ring ? "X" : last.s) : "—";
  $("sMeanR").textContent = revealed.length ? d3.mean(revealed,d=>d.r).toFixed(1) : "—";
  $("singleShotLbl").textContent = `end ${Math.ceil(state.singleShot / PER)}/12 · ${state.singleShot}/72`;
  $("singleScrub").value = state.singleShot;
  $("singlePlayBtn").textContent = state.timer && state.activePlay === "single" ? "⏸ Pause" : (state.singleShot >= N ? "▶ Replay round" : "▶ Play round");
  $("singleModeLabel").textContent = state.singleMode === "real" ? "Measured round" : state.profileName;
  $("singleModeLabel").style.color = color;
  d3.select("#mainTarget").attr("aria-label", `Target face: ${total(revealed)} points from ${revealed.length} of ${N} arrows, ${state.singleMode === "real" ? "measured round" : state.profileName} level`);
}
function renderMulti(){
  const color = state.profile.color;
  const grid = d3.select("#targetsGrid");
  const cards = grid.selectAll(".target-card").data(state.multiRounds, d=>d.id).join(enter => {
    const card = enter.append("div").attr("class","target-card");
    card.append("h3").html(d => `<span>Match ${String(d.id).padStart(2,"0")}</span><span class="mini-score" id="miniScore${d.id}"></span>`);
    card.append("svg").attr("id",d=>`miniTarget${d.id}`).attr("viewBox","0 0 170 170");
    return card;
  });
  cards.each(function(d){
    const revealed = d.round.slice(0, state.multiShot);
    drawTarget(d3.select(this).select("svg"), revealed, {size:170, color, mini:true});
    const label = state.multiShot === N ? `${total(d.round)} · ${xCount(d.round)}X` : `${total(revealed)}/${state.multiShot*10}`;
    d3.select(this).select(".mini-score").text(label);
    d3.select(this).select("svg").attr("role","img").attr("aria-label", `Match ${d.id}: ${total(d.round)} points, ${xCount(d.round)} inner tens`);
  });
  const scores = state.multiRounds.map(d => total(state.multiShot === N ? d.round : d.round.slice(0,state.multiShot)));
  drawMultiScoreHistogram(state.multiRounds, state.multiShot, color);
  $("mAvg").textContent = scores.length ? d3.mean(scores).toFixed(1) : "—";
  $("mBest").textContent = scores.length ? d3.max(scores) : "—";
  $("mWorst").textContent = scores.length ? d3.min(scores) : "—";
  $("multiShotLbl").textContent = `end ${Math.ceil(state.multiShot / PER)}/12 · ${state.multiShot}/72`;
  $("multiScrub").value = state.multiShot;
  $("multiPlayBtn").textContent = state.timer && state.activePlay === "multi" ? "⏸ Pause" : (state.multiShot >= N ? "▶ Replay 20" : "▶ Play 20 matches");
}
function render(){ setActiveButtons(); renderSingle(); renderMulti(); }

function pause(){ if(state.timer){ state.timer.stop(); state.timer = null; } state.activePlay = null; }
function play(kind){
  if(state.timer && state.activePlay === kind){ pause(); render(); return; }
  pause();
  state.activePlay = kind;
  if(kind === "single" && state.singleShot >= N) state.singleShot = 0;
  if(kind === "multi" && state.multiShot >= N) state.multiShot = 0;
  state.timer = d3.interval(() => {
    if(kind === "single") state.singleShot = Math.min(N, state.singleShot + 1);
    else state.multiShot = Math.min(N, state.multiShot + 1);
    if((kind === "single" && state.singleShot >= N) || (kind === "multi" && state.multiShot >= N)) pause();
    render();
  }, 60);
  render();
}
function showPage(page){
  pause(); state.page = page;
  $("singleView").classList.toggle("hidden", page !== "single");
  $("multiView").classList.toggle("hidden", page !== "multi");
  $("tabSingle").classList.toggle("on", page === "single");
  $("tabMulti").classList.toggle("on", page === "multi");
  $("tabSingle").setAttribute("aria-selected", page === "single");
  $("tabMulti").setAttribute("aria-selected", page === "multi");
  render();
}

buildPresetButtons();
regenerateSingle(); regenerateMulti(); regenerateMonteCarlo(); syncSliders(); setActiveButtons(); render();

$("tabSingle").addEventListener("click", () => showPage("single"));
$("tabMulti").addEventListener("click", () => showPage("multi"));
$("singlePlayBtn").addEventListener("click", () => play("single"));
$("multiPlayBtn").addEventListener("click", () => play("multi"));
$("singleScrub").addEventListener("input", e => { pause(); state.singleShot = +e.target.value; render(); });
$("multiScrub").addEventListener("input", e => { pause(); state.multiShot = +e.target.value; render(); });
$("singleResetBtn").addEventListener("click", () => { pause(); state.singleShot = 0; render(); });
$("multiResetBtn").addEventListener("click", () => { pause(); state.multiShot = 0; render(); });
$("newSingleBtn").addEventListener("click", () => { pause(); state.singleMode = "sim"; state.singleSeed += 503; state.singleShot = N; regenerateSingle(); setActiveButtons(); render(); });
$("newMultiBtn").addEventListener("click", () => { pause(); state.multiSeed += 997; state.multiShot = N; regenerateMulti(); regenerateMonteCarlo(); render(); });
$("realRoundBtn").addEventListener("click", () => { pause(); state.singleMode = "real"; state.singleShot = N; regenerateSingle(); setActiveButtons(); render(); });
// The calibration sliders fire many input events per drag. Recomputing the 1,000-round
// Monte Carlo (and the 20 matches) on every tick janks the drag, so update the single
// view live and debounce the heavy regen to fire once the drag settles.
let heavyTimer = null;
function scheduleHeavy(){
  if(heavyTimer) clearTimeout(heavyTimer);
  heavyTimer = setTimeout(() => { heavyTimer = null; regenerateMulti(); regenerateMonteCarlo(); renderMulti(); }, 140);
}
["spread","bx","by","fat","blend"].forEach(id => {
  $(id).addEventListener("input", e => {
    pause(); state.singleMode = "sim"; state.profileName = "Custom";
    state.profile = {...state.profile, [id]: +e.target.value, color:css("--custom")};
    state.singleSeed += 1; state.multiSeed += 3; state.singleShot = N; state.multiShot = N;
    regenerateSingle(); syncSliders(); setActiveButtons(); renderSingle(); scheduleHeavy();
  });
});
