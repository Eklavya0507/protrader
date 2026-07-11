const $ = (s, r=document) => r.querySelector(s);
    const $$ = (s, r=document) => [...r.querySelectorAll(s)];
    const state = {
      theme: document.documentElement.dataset.theme || 'dark',
      entryView: 'cards',
      simpleAction: null,
      journalCompleted: false,
      entries: [
        {date:'10 Jul 2026',type:'Daily Journal',title:'Disciplined London Session',pnl:248.60,trades:3,emotion:'Calm',score:83,lesson:'Judge process before outcome.',status:'Draft',tags:['Outside Session','Outcome Bias']},
        {date:'9 Jul 2026',type:'Daily Journal',title:'Patience After First Loss',pnl:121.30,trades:4,emotion:'Focused',score:91,lesson:'A pause after loss prevented revenge trading.',status:'Completed',tags:['Patience','Risk Control']},
        {date:'8 Jul 2026',type:'Mistake Note',title:'Why I Closed EURUSD Too Early',pnl:-36.20,trades:2,emotion:'Fearful',score:68,lesson:'Manage from structure, not floating P&L.',status:'Completed',tags:['Early Exit','Loss Aversion']},
        {date:'7 Jul 2026',type:'Strategy Note',title:'Breakout Retest Checklist',pnl:0,trades:0,emotion:'Calm',score:100,lesson:'Two confirmations reduce low-quality entries.',status:'Completed',tags:['Breakout','Checklist']},
        {date:'6 Jul 2026',type:'Weekly Review',title:'Week 27 Process Review',pnl:684.20,trades:18,emotion:'Confident',score:86,lesson:'Risk consistency is becoming automatic.',status:'Completed',tags:['Weekly Review','Improvement']},
        {date:'4 Jul 2026',type:'Daily Journal',title:'Overtrading After Target',pnl:-94.80,trades:7,emotion:'Frustrated',score:52,lesson:'Stop after target; more trades are not more opportunity.',status:'Completed',tags:['Overtrading','Greed']}
      ]
    };

    const weeklyDatasets = {
      current:{
        label:'Week of 6–12 July 2026', pnl:684.20, trades:18, wins:11, losses:6, breakeven:1, winRate:61.1, avgR:.84, profitFactor:2.84, expectancy:38.01, adherence:86, psychology:79, grade:'A−',
        grossProfit:1056.80, grossLoss:-372.60, averageWin:96.07, averageLoss:-62.10, largestWin:218.20, largestLoss:-82.50, maxDrawdown:-118.60, aSetupRate:72, planAdherence:84, riskConsistency:91, journalCompletion:100, bestEmotion:'Calm',
        summaryTitle:'Strong profitable week with improving discipline', summaryText:'Tuesday produced the highest return. London session remained your strongest edge, while early exits were the main performance leak.',
        days:[
          {day:'Monday',short:'Mon',trades:3,wins:2,losses:1,be:0,pnl:145.20,avgR:.72,rules:88,psych:81},
          {day:'Tuesday',short:'Tue',trades:4,wins:3,losses:1,be:0,pnl:312.40,avgR:1.24,rules:94,psych:86},
          {day:'Wednesday',short:'Wed',trades:3,wins:1,losses:2,be:0,pnl:-78.60,avgR:-.31,rules:71,psych:63},
          {day:'Thursday',short:'Thu',trades:4,wins:3,losses:1,be:0,pnl:186.80,avgR:.88,rules:89,psych:82},
          {day:'Friday',short:'Fri',trades:4,wins:2,losses:1,be:1,pnl:118.40,avgR:.54,rules:86,psych:83}
        ],
        sessions:[{name:'London',trades:10,winRate:70,pnl:512.40},{name:'New York',trades:6,winRate:50,pnl:142.60},{name:'Asian',trades:2,winRate:50,pnl:29.20}],
        strategies:[{name:'Breakout + Retest',trades:8,winRate:75,pnl:476.50},{name:'Liquidity Sweep',trades:5,winRate:60,pnl:168.20},{name:'Supply & Demand',trades:5,winRate:40,pnl:39.50}],
        bestTrade:'EURUSD London breakout, +2.7R with full plan adherence.', worstTrade:'XAUUSD revenge entry after loss, -1R and two rule violations.', improvement:'Risk consistency improved from 74% to 91% this week.', repeatedMistake:'Early Exit'
      },
      previous:{
        label:'Week of 29 June–5 July 2026', pnl:392.50, trades:16, wins:9, losses:6, breakeven:1, winRate:56.3, avgR:.52, profitFactor:1.87, expectancy:24.53, adherence:78, psychology:72, grade:'B+',
        grossProfit:843.10, grossLoss:-450.60, averageWin:93.68, averageLoss:-75.10, largestWin:192.40, largestLoss:-110.30, maxDrawdown:-186.40, aSetupRate:63, planAdherence:76, riskConsistency:82, journalCompletion:80, bestEmotion:'Focused',
        summaryTitle:'Profitable week, but execution quality was inconsistent', summaryText:'Thursday was the strongest day. New York session produced mixed results, and overtrading after losses reduced overall expectancy.',
        days:[
          {day:'Monday',short:'Mon',trades:3,wins:2,losses:1,be:0,pnl:88.40,avgR:.46,rules:79,psych:74},
          {day:'Tuesday',short:'Tue',trades:3,wins:1,losses:2,be:0,pnl:-64.30,avgR:-.29,rules:66,psych:61},
          {day:'Wednesday',short:'Wed',trades:4,wins:2,losses:1,be:1,pnl:104.60,avgR:.41,rules:81,psych:73},
          {day:'Thursday',short:'Thu',trades:3,wins:2,losses:1,be:0,pnl:213.20,avgR:1.08,rules:88,psych:82},
          {day:'Friday',short:'Fri',trades:3,wins:2,losses:1,be:0,pnl:50.60,avgR:.26,rules:76,psych:70}
        ],
        sessions:[{name:'London',trades:8,winRate:62.5,pnl:286.40},{name:'New York',trades:6,winRate:50,pnl:91.80},{name:'Asian',trades:2,winRate:50,pnl:14.30}],
        strategies:[{name:'Breakout + Retest',trades:7,winRate:71,pnl:301.20},{name:'Supply & Demand',trades:5,winRate:40,pnl:28.60},{name:'Liquidity Sweep',trades:4,winRate:50,pnl:62.70}],
        bestTrade:'NAS100 New York continuation, +2.3R with patient execution.', worstTrade:'XAUUSD oversized position, -1.4R after missing the first entry.', improvement:'Journal completion improved, but risk consistency remained below target.', repeatedMistake:'Overtrading'
      }
    };
    let activeWeeklyKey='current';

    const weekDateMap={
      current:['2026-07-06','2026-07-07','2026-07-08','2026-07-09','2026-07-10'],
      previous:['2026-06-29','2026-06-30','2026-07-01','2026-07-02','2026-07-03']
    };
    const chartPalette=['#16a085','#4c7fe5','#8b5cf6','#f3a93d','#ef5b67','#30c980'];
    const symbols=['EURUSD','XAUUSD','NAS100','GBPUSD','USDJPY'];
    const sessionsCycle=['London','London','New York','London','New York','Asian','London','New York','London'];
    const strategiesCycle=['Breakout + Retest','Liquidity Sweep','Supply & Demand','Breakout + Retest','Liquidity Sweep'];
    const emotionsCycle=['Calm','Focused','Confident','Calm','Fearful','Frustrated'];
    const mistakesCycle=['None','Early Exit','Outside Session','FOMO','Overtrading','Late Entry'];

    function allocateAmount(total,count,seed=1){
      if(count<=0)return[];const weights=Array.from({length:count},(_,i)=>1+((seed+i*3)%5)*.11),sum=weights.reduce((a,b)=>a+b,0);let used=0;
      return weights.map((w,i)=>{const v=i===count-1?total-used:+(total*w/sum).toFixed(2);used+=v;return +v.toFixed(2)})
    }
    function buildTradesForDay(date,day,seed=1){
      const lossBase=day.losses?Math.max(day.losses*(42+(seed%4)*7),day.pnl<0?Math.abs(day.pnl)+day.wins*38:0):0;
      const grossLoss=+lossBase.toFixed(2),grossProfit=+(day.pnl+grossLoss).toFixed(2);
      const wins=allocateAmount(Math.max(0,grossProfit),day.wins,seed),losses=allocateAmount(grossLoss,day.losses,seed+7).map(v=>-v),bes=Array(day.be).fill(0);
      const outcomes=[...wins.map(p=>['win',p]),...losses.map(p=>['loss',p]),...bes.map(p=>['breakeven',p])];
      return outcomes.map((o,i)=>{
        const direction=(i+seed)%2===0?'Long':'Short',setup=(i+seed)%5===0?'B':(i+seed)%3===0?'A+':'A';
        const risk=+(0.28+((seed+i)%5)*.055).toFixed(2),psych=Math.max(35,Math.min(96,day.psych+((i%3)-1)*4));
        return {id:date+'-'+seed+'-'+i,date,symbol:symbols[(seed+i)%symbols.length],direction,session:sessionsCycle[(seed+i)%sessionsCycle.length],strategy:strategiesCycle[(seed+i*2)%strategiesCycle.length],outcome:o[0],pnl:+o[1].toFixed(2),r:+(o[1]===0?0:(o[1]>0?o[1]/70:o[1]/65)).toFixed(2),risk,ruleAdherence:Math.max(45,Math.min(100,day.rules+((i%4)-1)*3)),psychology:psych,focus:Math.max(30,Math.min(100,psych+4)),stress:Math.max(5,Math.min(95,100-psych+8)),control:Math.max(30,Math.min(100,psych+2)),setupGrade:setup,emotion:emotionsCycle[(seed+i)%emotionsCycle.length],mistake:o[0]==='loss'?mistakesCycle[1+(seed+i)%5]:((i+seed)%7===0?'Early Exit':'None'),journalComplete:(seed+i)%9!==0,account:(i+seed)%4===0?'Personal Account':'Funding Account'}
      })
    }
    const masterTradeData=[];
    Object.entries(weeklyDatasets).forEach(([key,d])=>d.days.forEach((day,i)=>masterTradeData.push(...buildTradesForDay(weekDateMap[key][i],day,key==='current'?20+i:5+i))));
    const extraDailySummaries=[
      ['2026-06-22',3,2,1,0,126.40,.66,82,78],['2026-06-23',4,2,2,0,-48.20,-.20,69,64],['2026-06-24',3,2,1,0,94.60,.51,84,80],['2026-06-25',5,3,2,0,176.80,.62,76,71],['2026-06-26',2,1,1,0,22.40,.18,88,83],
      ['2026-07-13',3,2,1,0,96.40,.48,84,76],['2026-07-14',4,3,1,0,228.30,.92,91,84],['2026-07-15',3,1,2,0,-74.20,-.34,68,61],['2026-07-16',4,2,1,1,118.60,.46,87,81],['2026-07-17',3,2,1,0,84.90,.42,82,79],
      ['2026-07-20',4,3,1,0,265.70,1.02,93,88],['2026-07-21',3,1,2,0,-92.50,-.41,64,58],['2026-07-22',2,2,0,0,142.20,1.10,95,90],['2026-07-23',5,3,2,0,67.80,.22,78,72],['2026-07-24',3,2,1,0,110.40,.56,89,85]
    ];
    extraDailySummaries.forEach((x,i)=>masterTradeData.push(...buildTradesForDay(x[0],{trades:x[1],wins:x[2],losses:x[3],be:x[4],pnl:x[5],avgR:x[6],rules:x[7],psych:x[8]},40+i)));

    function tradesForWeek(key=activeWeeklyKey){const set=new Set(weekDateMap[key]||[]),account=$('#weeklyAccount')?.value||'All Accounts';return masterTradeData.filter(t=>set.has(t.date)&&(account==='All Accounts'||t.account===account))}
    function tradesForMonth(month){const account=$('#calendarAccount')?.value||'All Accounts';return masterTradeData.filter(t=>t.date.startsWith(month)&&(account==='All Accounts'||t.account===account))}
    function groupBy(list,keyFn){return list.reduce((m,x)=>{const k=keyFn(x);(m[k]??=[]).push(x);return m},{})}
    function sum(list,key='pnl'){return list.reduce((a,x)=>a+(+x[key]||0),0)}
    function average(list,key){return list.length?list.reduce((a,x)=>a+(+x[key]||0),0)/list.length:0}
    function formatMonth(month){const [y,m]=month.split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString('en-US',{month:'long',year:'numeric'})}
    function analyticsTrades(){
      const range=$('#analyticsRange')?.value||'30',strategy=$('#analyticsStrategy')?.value||'all',session=$('#analyticsSession')?.value||'all',account=$('#accountSelect')?.value||'All Accounts';
      const maxDate='2026-07-24',cutoff=range==='all'?'1900-01-01':(()=>{const d=new Date(maxDate+'T00:00:00');d.setDate(d.getDate()-Number(range)+1);return d.toISOString().slice(0,10)})();
      return masterTradeData.filter(t=>t.date>=cutoff&&(strategy==='all'||t.strategy===strategy)&&(session==='all'||t.session===session)&&(account==='All Accounts'||t.account===account))
    }


    function toast(message, type='success'){
      const el=document.createElement('div');
      el.className='toast '+type;
      el.innerHTML='<span>'+(type==='success'?'✓':type==='warn'?'!':'i')+'</span><span>'+message+'</span>';
      $('#toastContainer').appendChild(el);
      setTimeout(()=>{el.style.opacity='0';el.style.transform='translateX(30px)';setTimeout(()=>el.remove(),280)},2600);
    }

    function openModal(id){const node=$('#'+id);if(!node)return;node.classList.add('open');document.body.style.overflow='hidden'}
    function closeModal(id){const node=$('#'+id);if(!node)return;node.classList.remove('open');document.body.style.overflow=''}
    $$('[data-close]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.close)));
    $$('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeModal(m.id)}));
    document.addEventListener('keydown',e=>{if(e.key==='Escape')$$('.modal.open').forEach(m=>closeModal(m.id))});

    function setTheme(theme){
      state.theme=theme;
      document.documentElement.dataset.theme=theme; localStorage.setItem('protrade-theme',theme);
      $('#themeLabel').textContent=theme==='dark'?'Dark Mode':'Light Mode';
      requestAnimationFrame(drawAllCharts);
    }
    $('#themeSwitch')?.addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='light'?'dark':'light'));

    $('#mobileMenuBtn')?.addEventListener('click',()=>document.body.classList.add('sidebar-open'));
    document.addEventListener('click',e=>{
      if(innerWidth<=980 && !e.target.closest('#sidebar') && !e.target.closest('#mobileMenuBtn')) document.body.classList.remove('sidebar-open');
    });

    $$('.tab-btn').forEach(btn=>btn.addEventListener('click',()=>{
      $$('.tab-btn').forEach(b=>b.classList.remove('active'));
      $$('.tab-panel').forEach(p=>p.classList.remove('active'));
      btn.classList.add('active'); $('#panel-'+btn.dataset.tab).classList.add('active');
      if(btn.dataset.tab==='entries') renderEntries();
      if(btn.dataset.tab==='calendar') setTimeout(()=>renderCalendar($('#calendarMonth')?.value||'2026-07',true),60);
      if(btn.dataset.tab==='analytics'||btn.dataset.tab==='weekly') setTimeout(drawAllCharts,80);
    }));

    $$('.collapse-btn').forEach(btn=>btn.addEventListener('click',()=>btn.closest('.card').classList.toggle('collapsed')));
    $$('.segment').forEach(btn=>btn.addEventListener('click',()=>{
      btn.parentElement.querySelectorAll('.segment').forEach(x=>x.classList.remove('active'));btn.classList.add('active');
      $('#planStatus').textContent='Unsaved';$('#planStatus').className='badge warn';
    }));

    function animateCounters(){
      $$('.counter,.counter-money,.counter-percent').forEach(el=>{
        const target=parseFloat(el.dataset.target), start=performance.now(), duration=900;
        const step=now=>{
          const p=Math.min(1,(now-start)/duration), v=target*(1-Math.pow(1-p,3));
          if(el.classList.contains('counter-money')) el.textContent='$'+v.toFixed(2);
          else if(el.classList.contains('counter-percent')) el.textContent=(target%1?v.toFixed(1):Math.round(v))+'%';
          else el.textContent=Math.round(v);
          if(p<1)requestAnimationFrame(step);
        };requestAnimationFrame(step);
      });
      setTimeout(()=>$$('.mini-progress span').forEach(s=>s.style.width=s.dataset.width+'%'),120);
      setTimeout(()=>$$('.ring').forEach(updateRing),180);
    }
    function updateRing(ring){
      const v=+ring.dataset.value||0, c=ring.querySelector('.value');
      if(c)c.style.strokeDashoffset=226-(226*v/100);
    }

    const planDefaults={
      instruments:'EURUSD, XAUUSD, NAS100',levels:'EURUSD 1.0820 / 1.0865 · XAUUSD 2358 / 2376',
      maxTrades:'3',maxLoss:'$100',riskPerTrade:'0.5%',profitTarget:'$250',
      dailyGoal:'Take only A+ setups, remain patient, and stop after three trades.'
    };
    $('#savePlan').addEventListener('click',()=>{
      $('#planStatus').textContent='Saved';$('#planStatus').className='badge success';
      toast('Pre-market plan saved successfully.');
    });
    $('#resetPlan').addEventListener('click',()=>{
      Object.entries(planDefaults).forEach(([k,v])=>$('#'+k).value=v);
      $$('#biasGroup .segment').forEach((x,i)=>x.classList.toggle('active',i===0));
      toast('Plan restored to default values.','info');
    });
    $$('#planCard input,#planCard textarea,#planCard select').forEach(el=>el.addEventListener('input',()=>{
      $('#planStatus').textContent='Unsaved';$('#planStatus').className='badge warn';
    }));

    function calcReadiness(){
      const vals={}; $$('#mentalSliders input').forEach(i=>vals[i.dataset.key]=+i.value);
      const score=Math.round((vals.confidence+vals.focus+vals.energy+vals.sleep+(100-vals.stress)+(100-vals.fomo)+(100-vals.revenge))/7);
      $('#readinessScore').textContent=score+'/100';
      $('#psychMetric').textContent=score;$('#psychMetric').dataset.target=score;$('#psychMetricBar').style.width=score+'%';
      const r=$('#readiness');
      if(score>=72){r.innerHTML='<span>● Ready to Trade</span><b>'+score+'/100</b>';r.style.background='var(--positive-soft)';r.style.color='var(--positive)'}
      else if(score>=50){r.innerHTML='<span>● Trade with Caution</span><b>'+score+'/100</b>';r.style.background='var(--warning-soft)';r.style.color='var(--warning)'}
      else{r.innerHTML='<span>● Trading Not Recommended</span><b>'+score+'/100</b>';r.style.background='var(--negative-soft)';r.style.color='var(--negative)'}
    }
    $$('#mentalSliders input').forEach(i=>i.addEventListener('input',()=>{i.nextElementSibling.textContent=i.value;calcReadiness()}));
    $$('#emotionGrid .emotion').forEach(b=>b.addEventListener('click',()=>{$$('#emotionGrid .emotion').forEach(x=>x.classList.remove('active'));b.classList.add('active')}));

    function updateRules(){
      const checks=$$('#ruleList input'), done=checks.filter(c=>c.checked).length, pct=Math.round(done/checks.length*100);
      checks.forEach(c=>c.closest('.rule-row').classList.toggle('completed',c.checked));
      $('#ruleSub').textContent=done+' of '+checks.length+' rules followed.';
      $('#rulePercent').textContent=pct+'%';$('#ruleBar').style.width=pct+'%';
      $('#metricAdherence').textContent=pct+'%';$('#metricAdherence').dataset.target=pct;$('#metricAdherenceBar').style.width=pct+'%';
      updateCompletion();
    }
    $$('#ruleList input').forEach(c=>c.addEventListener('change',updateRules));

    function simpleModal(title,label,action){
      $('#simpleModalTitle').textContent=title;$('#simpleModalLabel').textContent=label;$('#simpleModalInput').value='';
      state.simpleAction=action;openModal('simpleModal');setTimeout(()=>$('#simpleModalInput').focus(),200)
    }
    $('#addRuleBtn').addEventListener('click',()=>simpleModal('Add Custom Rule','Rule name','rule'));
    $('#customTagBtn').addEventListener('click',()=>simpleModal('Add Custom Tag','Tag name','tag'));
    $('#simpleModalConfirm').addEventListener('click',()=>{
      const v=$('#simpleModalInput').value.trim();if(!v)return toast('Please enter a value.','warn');
      if(state.simpleAction==='rule'){
        const label=document.createElement('label');label.className='rule-row';label.innerHTML='<input type="checkbox"/><span>'+escapeHtml(v)+'</span>';
        $('#ruleList').appendChild(label);label.querySelector('input').addEventListener('change',updateRules);updateRules();
      }else{
        const b=document.createElement('button');b.className='tag active';b.textContent=v;b.addEventListener('click',()=>b.classList.toggle('active'));$('#mistakeTags').appendChild(b)
      }
      closeModal('simpleModal');toast(state.simpleAction==='rule'?'Custom rule added.':'Custom tag added.');
    });
    $$('.tag').forEach(t=>t.addEventListener('click',()=>t.classList.toggle('active')));

    function updateTradeSummary(){
      const cards=$$('#tradeList .trade-card');
      const pnl=cards.reduce((a,c)=>a+(+c.dataset.pnl||0),0);
      $('#linkedCount').textContent=cards.length+' linked';
      $('#linkedPnl').textContent=(pnl>=0?'+':'')+'$'+pnl.toFixed(2);
      $('#linkedPnl').className=pnl>=0?'positive':'negative';
    }
    function attachTradeListeners(){
      $$('.unlink-trade').forEach(b=>{b.onclick=()=>{b.closest('.trade-card').remove();updateTradeSummary();toast('Trade unlinked from journal.','warn')}});
    }
    attachTradeListeners();
    $('#linkTradeBtn').addEventListener('click',()=>openModal('tradeModal'));
    $('#newTradeBtn').addEventListener('click',()=>openModal('tradeModal'));
    $('#addTradeConfirm').addEventListener('click',()=>{
      const sym=$('#tradeSymbol').value.trim().toUpperCase()||'GBPUSD',dir=$('#tradeDirection').value,pnl=+$ ('#tradePnl').value||0;
      const card=document.createElement('div');card.className='trade-card';card.dataset.pnl=pnl;
      card.innerHTML='<div class="trade-head"><span class="trade-symbol">'+escapeHtml(sym)+'</span><span class="badge '+(dir==='Long'?'success':'danger')+'">'+dir.toUpperCase()+'</span><span class="badge">Closed</span><span class="trade-pnl '+(pnl>=0?'positive':'negative')+'">'+(pnl>=0?'+':'')+'$'+pnl.toFixed(2)+'</span></div>'+
      '<div class="trade-meta"><div>Entry<strong>'+escapeHtml($('#tradeEntry').value)+'</strong></div><div>Exit<strong>'+escapeHtml($('#tradeExit').value)+'</strong></div><div>Stop<strong>Auto</strong></div><div>Target<strong>Auto</strong></div><div>Session<strong>'+escapeHtml($('#tradeSession').value)+'</strong></div><div>Result<strong>'+escapeHtml($('#tradeR').value)+'</strong></div></div>'+
      '<div class="trade-actions"><button class="btn btn-secondary btn-sm">Review Trade</button><button class="btn btn-ghost btn-sm">Open</button><button class="btn btn-danger btn-sm unlink-trade">Unlink</button></div>';
      $('#tradeList').prepend(card);attachTradeListeners();updateTradeSummary();
      masterTradeData.push({id:'manual-'+Date.now(),date:'2026-07-10',symbol:sym,direction:dir,session:$('#tradeSession').value,strategy:'Breakout + Retest',outcome:pnl>0?'win':pnl<0?'loss':'breakeven',pnl,r:+String($('#tradeR').value).replace(/[^0-9.-]/g,'')||0,risk:.5,ruleAdherence:82,psychology:78,focus:80,stress:28,control:79,setupGrade:'A',emotion:'Calm',mistake:'None',journalComplete:false,account:'Funding Account'});
      updateWeeklyReview(activeWeeklyKey,false);renderCalendar($('#calendarMonth')?.value||'2026-07',false);drawAllCharts(false);closeModal('tradeModal');toast(sym+' added and synced across Weekly Review, Calendar and Analytics.');
    });

    $$('#ratings .rating-row').forEach(row=>{
      const wrap=row.querySelector('.rating-dots'), current=+row.dataset.rating;
      for(let i=1;i<=10;i++){
        const b=document.createElement('button');b.className='rating-dot'+(i<=current?' active':'');b.title=i+'/10';
        b.addEventListener('click',()=>{row.dataset.rating=i;row.querySelector('.rating-number').textContent=i;[...wrap.children].forEach((x,idx)=>x.classList.toggle('active',idx<i));$('#reflectionStatus').textContent='Draft';$('#reflectionStatus').className='badge warn'});
        wrap.appendChild(b);
      }
    });
    $('#saveDraftBtn').addEventListener('click',()=>{state.journalCompleted=false;$('#reflectionStatus').textContent='Draft Saved';$('#reflectionStatus').className='badge info';toast('Journal draft saved.')});
    $('#completeJournalBtn').addEventListener('click',()=>{
      state.journalCompleted=true;$('#reflectionStatus').textContent='Completed';$('#reflectionStatus').className='badge success';
      const last=$$('#ruleList input').at(-1);last.checked=true;updateRules();updateCompletion();toast('Journal completed. Analytics and review data updated.');
    });

    const drop=$('#dropzone'), fileInput=$('#attachmentInput');
    drop.addEventListener('click',()=>fileInput.click());
    ['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('drag')}));
    ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('drag')}));
    drop.addEventListener('drop',e=>handleFiles([...e.dataTransfer.files]));
    fileInput.addEventListener('change',()=>handleFiles([...fileInput.files]));
    function handleFiles(files){
      files.forEach(f=>{
        const el=document.createElement('div');el.className='attachment';
        el.innerHTML='<b>'+(f.type.startsWith('image')?'🖼':f.type.startsWith('video')?'🎬':f.type.startsWith('audio')?'🎙':'📄')+'</b><span title="'+escapeHtml(f.name)+'">'+escapeHtml(f.name)+'</span><button class="modal-close" style="width:22px;height:22px;margin-left:auto">×</button>';
        el.querySelector('button').onclick=()=>{el.remove();updateAttachmentCount()};$('#attachmentList').appendChild(el)
      });updateAttachmentCount();toast(files.length+' attachment'+(files.length>1?'s':'')+' added.')
    }
    function updateAttachmentCount(){
      const n=$$('#attachmentList .attachment').length;$('#attachmentCount').textContent=n+' file'+(n===1?'':'s');updateCompletion()
    }
    function updateCompletion(){
      const doneRules=$$('#ruleList input:checked').length, totalRules=$$('#ruleList input').length;
      const attachments=$$('#attachmentList .attachment').length;
      let pct=Math.round((doneRules/totalRules)*60 + (attachments?15:0) + ($('#wentWell').value.trim()?10:0)+($('#mainLesson').value.trim()?10:0)+(state.journalCompleted?5:0));
      pct=Math.min(100,pct);$('#completionRing').dataset.value=pct;updateRing($('#completionRing'));$('#completionText').textContent=pct+'%';
      $('#completionTitle').textContent=pct===100?'Journal complete':pct>=75?'Almost finished':'Keep building your review';
      $('#completionHint').textContent=pct===100?'All key journal sections are complete.':attachments?'Complete remaining checklist items.':'Add screenshots and complete the final checklist rule.';
    }
    ['wentWell','mainLesson'].forEach(id=>$('#'+id).addEventListener('input',updateCompletion));

    function aiType(text){
      const insight=document.createElement('div');insight.className='insight';
      insight.innerHTML='<div class="insight-icon" style="background:var(--purple);color:white">✦</div><div class="typing"></div>';
      $('#aiInsights').prepend(insight);const target=insight.querySelector('div:last-child');let i=0;
      const timer=setInterval(()=>{target.textContent=text.slice(0,i++);target.classList.add('typing');if(i>text.length){clearInterval(timer);target.classList.remove('typing')}},14)
    }
    $('#generateAiBtn').addEventListener('click',()=>{
      const b=$('#generateAiBtn');b.disabled=true;b.textContent='✦ Analyzing journal...';
      setTimeout(()=>{
        const activeTags=$$('.tag.active').map(t=>t.textContent).slice(0,2).join(' and ');
        aiType('Fresh analysis: Your strongest process today was risk control. Watch '+(activeTags||'session discipline')+' tomorrow, and pause for two minutes before any unplanned entry.');
        b.disabled=false;b.textContent='✦ Generate Fresh Analysis';toast('Fresh AI analysis generated.')
      },850)
    });
    $('#askAiBtn').addEventListener('click',()=>{
      const q=$('#askAiInput').value.trim();if(!q)return toast('Type a question for the AI coach.','warn');
      aiType('Coach response: Focus on the decision process behind “'+q+'”. Compare it with your written plan, rule checklist and emotional state before judging the P&L.');
      $('#askAiInput').value='';
    });

    $('#newEntryBtn').addEventListener('click',()=>{
      $('#entryDate').value='2026-07-10';openModal('entryModal');
    });
    $('#createEntryConfirm').addEventListener('click',()=>{
      const title=$('#entryTitle').value.trim();if(!title)return toast('Please add an entry title.','warn');
      const d=new Date($('#entryDate').value+'T00:00:00');
      state.entries.unshift({
        date:d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}),
        type:$('#entryType').value,title,pnl:0,trades:0,emotion:$('#entryEmotion').value,score:0,
        lesson:$('#entryNote').value.trim()||'New journal entry created.',status:$('#entryStatus').value,tags:['New Entry']
      });
      closeModal('entryModal');$('#entryTitle').value='';$('#entryNote').value='';toast('New journal entry created.');
      $$('.tab-btn').find(b=>b.dataset.tab==='entries').click();
    });

    function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
    function filteredEntries(){
      const q=$('#entrySearch')?.value.toLowerCase()||'',type=$('#entryTypeFilter')?.value||'all',emotion=$('#entryEmotionFilter')?.value||'all';
      return state.entries.filter(e=>(type==='all'||e.type===type)&&(emotion==='all'||e.emotion===emotion)&&([e.title,e.lesson,e.type,e.emotion,...e.tags].join(' ').toLowerCase().includes(q)));
    }
    function entryCard(e){
      return '<article class="entry-card"><div class="entry-top"><span class="badge info">'+escapeHtml(e.type)+'</span><span class="badge '+(e.status==='Completed'?'success':'warn')+'">'+e.status+'</span></div>'+
      '<h3>'+escapeHtml(e.title)+'</h3><p>'+escapeHtml(e.lesson)+'</p>'+
      '<div class="entry-stats"><div class="entry-stat"><span>P&amp;L</span><strong class="'+(e.pnl>=0?'positive':'negative')+'">'+(e.pnl>=0?'+':'')+'$'+Math.abs(e.pnl).toFixed(2)+'</strong></div><div class="entry-stat"><span>Trades</span><strong>'+e.trades+'</strong></div><div class="entry-stat"><span>Discipline</span><strong>'+e.score+'%</strong></div></div>'+
      '<div class="tag-cloud">'+e.tags.map(t=>'<span class="tag active">'+escapeHtml(t)+'</span>').join('')+'</div>'+
      '<div class="entry-footer"><span style="font-size:9px;color:var(--muted)">'+e.date+' · '+e.emotion+'</span><button class="btn btn-ghost btn-sm more">Open</button></div></article>'
    }
    function renderEntries(){
      const data=filteredEntries(),box=$('#entriesContainer');
      if(!data.length){box.innerHTML='<div class="empty-state">No journal entries match the selected filters.</div>';return}
      if(state.entryView==='cards') box.innerHTML='<div class="entries-grid">'+data.map(entryCard).join('')+'</div>';
      if(state.entryView==='timeline') box.innerHTML='<div class="timeline">'+data.map(entryCard).join('')+'</div>';
      if(state.entryView==='table') box.innerHTML='<div class="table-view"><table><thead><tr><th>Date</th><th>Entry</th><th>Type</th><th>P&amp;L</th><th>Trades</th><th>Emotion</th><th>Discipline</th><th>Status</th></tr></thead><tbody>'+data.map(e=>'<tr><td>'+e.date+'</td><td><b>'+escapeHtml(e.title)+'</b></td><td>'+e.type+'</td><td class="'+(e.pnl>=0?'positive':'negative')+'">'+(e.pnl>=0?'+':'')+'$'+Math.abs(e.pnl).toFixed(2)+'</td><td>'+e.trades+'</td><td>'+e.emotion+'</td><td>'+e.score+'%</td><td><span class="badge '+(e.status==='Completed'?'success':'warn')+'">'+e.status+'</span></td></tr>').join('')+'</tbody></table></div>'
    }
    ['entrySearch','entryTypeFilter','entryEmotionFilter'].forEach(id=>$('#'+id).addEventListener('input',renderEntries));
    $$('.view-btn').forEach(b=>b.addEventListener('click',()=>{$$('.view-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.entryView=b.dataset.view;renderEntries()}));

    function renderCalendar(month=$('#calendarMonth')?.value||'2026-07',animate=true){
      const grid=$('#calendarGrid');if(!grid)return;const [year,monthNum]=month.split('-').map(Number),daysInMonth=new Date(year,monthNum,0).getDate(),startOffset=(new Date(year,monthNum-1,1).getDay()+6)%7;
      const monthTrades=tradesForMonth(month),byDate=groupBy(monthTrades,t=>t.date),weekdays=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];let html=weekdays.map(d=>'<div class="cal-head">'+d+'</div>').join('');
      for(let i=0;i<startOffset;i++)html+='<div class="cal-day empty"></div>';
      let best=null;
      for(let day=1;day<=daysInMonth;day++){
        const key=month+'-'+String(day).padStart(2,'0'),list=byDate[key]||[],pnl=sum(list),score=Math.round(average(list,'ruleAdherence'));
        if(list.length&&(!best||pnl>best.pnl))best={day,pnl};
        const color=!list.length?'var(--surface-3)':pnl>0?'var(--positive)':pnl<0?'var(--negative)':'var(--warning)';
        html+='<div class="cal-day '+(list.length?'has-trades':'')+'" data-date="'+key+'" style="--day-color:'+color+'"><div class="cal-date">'+day+'</div>'+(list.length?'<span class="cal-score">'+score+'%</span><div class="cal-pnl '+(pnl>=0?'positive':'negative')+'">'+money(pnl)+'</div><div class="cal-trades">'+list.length+' trades · '+list.filter(t=>t.outcome==='win').length+'W</div>':'')+'</div>'
      }
      grid.innerHTML=html;$('#calendarTitle').textContent=formatMonth(month)+' Journal Calendar';
      $$('.cal-day[data-date]',grid).forEach(el=>el.addEventListener('click',()=>{const list=byDate[el.dataset.date]||[];if(!list.length)return toast('No trades recorded on '+el.dataset.date+'.','info');const pnl=sum(list),wins=list.filter(t=>t.outcome==='win').length;toast(el.dataset.date+': '+list.length+' trades, '+wins+' wins, '+money(pnl)+'.','info')}));
      const dayGroups=Object.values(byDate),active=dayGroups.length,winning=dayGroups.filter(x=>sum(x)>0).length,completed=dayGroups.filter(x=>x.every(t=>t.journalComplete)).length,pnl=sum(monthTrades);
      $('#calendarTradeCount').textContent=monthTrades.length;$('#calendarMonthPnl').textContent=money(pnl);$('#calendarMonthPnl').className=pnl>=0?'positive':'negative';$('#calendarActiveDays').textContent=active;$('#calendarWinningDays').textContent=winning;$('#calendarCompletion').textContent=(active?Math.round(completed/active*100):0)+'%';$('#calendarBestDay').textContent=best?'Best day · '+best.day+' ('+money(best.pnl)+')':'Best day · —';$('#calendarLastSync').textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
      drawCalendarAdvanced(monthTrades,month,animate)
    }

    $('#exportBtn').addEventListener('click',()=>{
      const payload={exportedAt:new Date().toISOString(),journal:{plan:{
        bias:$('#biasGroup .segment.active').dataset.value,instruments:$('#instruments').value,session:$('#session').value,
        maxTrades:$('#maxTrades').value,dailyGoal:$('#dailyGoal').value
      },mental:Object.fromEntries($$('#mentalSliders input').map(i=>[i.dataset.key,+i.value])),
      rules:$$('#ruleList .rule-row').map(r=>({name:r.querySelector('span').textContent,followed:r.querySelector('input').checked})),
      entries:state.entries}};
      const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');
      a.href=URL.createObjectURL(blob);a.download='protrade-journal-export.json';a.click();URL.revokeObjectURL(a.href);toast('Journal data exported as JSON.')
    });
    $('#importBtn').addEventListener('click',()=>$('#importFile').click());
    $('#importFile').addEventListener('change',async()=>{
      const f=$('#importFile').files[0];if(!f)return;
      try{
        const data=JSON.parse(await f.text());
        if(data.journal?.entries)state.entries=data.journal.entries;
        toast('Journal data imported successfully.');renderEntries()
      }catch{toast('Invalid JSON file. Import failed.','warn')}
    });

    $('#notificationBtn').addEventListener('click',e=>{
      const p=$('#notificationPopover'),r=e.currentTarget.getBoundingClientRect();
      p.style.top=(r.bottom+10)+'px';p.style.left=Math.max(12,r.right-320)+'px';p.classList.toggle('open')
    });
    document.addEventListener('click',e=>{if(!e.target.closest('#notificationBtn')&&!e.target.closest('#notificationPopover'))$('#notificationPopover').classList.remove('open')});
    $('#generateWeekly').addEventListener('click',()=>{updateWeeklyReview(activeWeeklyKey,true);toast('Weekly statistics and charts regenerated.');aiType('Weekly review updated: the strongest edge came from '+weeklyDatasets[activeWeeklyKey].sessions[0].name+' session, while '+weeklyDatasets[activeWeeklyKey].repeatedMistake.toLowerCase()+' remains the main process leak.')});
    $('#weeklyRange').addEventListener('change',e=>{activeWeeklyKey=e.target.value;updateWeeklyReview(activeWeeklyKey,true);toast('Weekly review changed to '+weeklyDatasets[activeWeeklyKey].label+'.','info')});
    $('#weeklyAccount').addEventListener('change',e=>{updateWeeklyReview(activeWeeklyKey,true);toast('Weekly charts filtered by '+e.target.value+'.','info')});
    $('#saveNextWeekPlan').addEventListener('click',()=>toast('Next week plan saved successfully.'));
    $('#exportWeekly').addEventListener('click',()=>{const data=weeklyDatasets[activeWeeklyKey],blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='protrade-weekly-review-'+activeWeeklyKey+'.json';a.click();URL.revokeObjectURL(a.href);toast('Weekly statistics exported as JSON.')});
    $('#refreshCharts').addEventListener('click',()=>{drawAllCharts(true);$('#analyticsLastSync').textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});toast('Analytics charts recalculated from trade data.','info')});
    ['analyticsRange','analyticsStrategy','analyticsSession'].forEach(id=>$('#'+id)?.addEventListener('change',()=>drawAllCharts(true)));
    $('#calendarMonth')?.addEventListener('change',e=>renderCalendar(e.target.value,true));
    $('#calendarAccount')?.addEventListener('change',e=>{renderCalendar($('#calendarMonth').value,true);toast('Calendar account filter: '+e.target.value+'.','info')});
    $('#calendarRefresh')?.addEventListener('click',()=>{renderCalendar($('#calendarMonth').value,true);toast('Calendar synchronized with latest trade data.')});
    function shiftCalendarMonth(delta){const input=$('#calendarMonth'),[y,m]=input.value.split('-').map(Number),d=new Date(y,m-1+delta,1);input.value=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');renderCalendar(input.value,true)}
    $('#calendarPrev')?.addEventListener('click',()=>shiftCalendarMonth(-1));$('#calendarNext')?.addEventListener('click',()=>shiftCalendarMonth(1));
    $('#globalRange')?.addEventListener('change',e=>toast('Dashboard range changed to '+e.target.value+'.','info'));
    $('#accountSelect')?.addEventListener('change',e=>{drawAllCharts(true);toast('Analytics account filter: '+e.target.value+'.','info')});

    function money(v){return (v>=0?'+':'-')+'$'+Math.abs(v).toFixed(2)}
    function signedR(v){return (v>=0?'+':'')+v.toFixed(2)+'R'}
    function updateWeeklyReview(key='current',animate=true){
      activeWeeklyKey=key;const d=weeklyDatasets[key];
      const set=(id,val)=>{const el=$('#'+id);if(el)el.textContent=val};
      const synced=tradesForWeek(key);set('weeklySyncedTrades',synced.length);
      set('weekPnl',money(d.pnl));$('#weekPnl').className=d.pnl>=0?'positive':'negative';
      set('weekTrades',d.trades);set('weekWinRate',d.winRate.toFixed(1)+'%');set('weekAvgR',signedR(d.avgR));set('weekProfitFactor',d.profitFactor.toFixed(2));set('weekExpectancy',money(d.expectancy));set('weekAdherence',d.adherence+'%');set('weekPsychology',d.psychology+'/100');
      set('weeklySummaryTitle',d.summaryTitle);set('weeklySummaryText',d.summaryText);set('weeklyGrade',d.grade);
      set('grossProfit',money(d.grossProfit));set('grossLoss',money(d.grossLoss));set('averageWin',money(d.averageWin));set('averageLoss',money(d.averageLoss));set('largestWin',money(d.largestWin));set('largestLoss',money(d.largestLoss));set('maxDrawdown',money(d.maxDrawdown));set('aSetupRate',d.aSetupRate+'%');
      set('planAdherenceStat',d.planAdherence+'%');set('riskConsistencyStat',d.riskConsistency+'%');set('journalCompletionStat',d.journalCompletion+'%');set('bestEmotionStat',d.bestEmotion);set('outcomeTotal',d.trades);
      const best=[...d.days].sort((a,b)=>b.pnl-a.pnl)[0], profitable=d.days.filter(x=>x.pnl>0).length;
      set('bestDayValue',money(best.pnl));$('#bestDayValue').className=best.pnl>=0?'positive':'negative';set('bestDayLabel','Best day · '+best.day);set('profitableDays',profitable+' / '+d.days.length);set('activeDaysBadge',d.days.length+' active days');set('equityGrowth',(d.pnl/5000*100>=0?'+':'')+(d.pnl/5000*100).toFixed(2)+'%');
      $('#weeklyStatsBody').innerHTML=d.days.map((x,i)=>'<tr><td><span class="day-rank '+(x.day===best.day?'top':'')+'">'+(i+1)+'</span><b>'+x.day+'</b></td><td>'+x.trades+'</td><td>'+x.wins+' / '+x.losses+' / '+x.be+'</td><td>'+((x.wins/x.trades)*100).toFixed(0)+'%</td><td class="'+(x.pnl>=0?'positive':'negative')+'"><b>'+money(x.pnl)+'</b></td><td>'+signedR(x.avgR)+'</td><td>'+x.rules+'%</td><td>'+x.psych+'/100</td></tr>').join('');
      const maxSession=Math.max(...d.sessions.map(x=>Math.abs(x.pnl))),maxStrategy=Math.max(...d.strategies.map(x=>Math.abs(x.pnl)));
      $('#sessionBreakdown').innerHTML=d.sessions.map(x=>'<div class="breakdown-row"><div class="breakdown-name"><strong>'+x.name+'</strong><span>'+x.trades+' trades · '+x.winRate+'% win</span></div><div class="breakdown-track"><span style="width:'+(Math.abs(x.pnl)/maxSession*100)+'%"></span></div><div class="breakdown-value '+(x.pnl>=0?'positive':'negative')+'">'+money(x.pnl)+'</div></div>').join('');
      $('#strategyBreakdown').innerHTML=d.strategies.map(x=>'<div class="breakdown-row"><div class="breakdown-name"><strong>'+x.name+'</strong><span>'+x.trades+' trades · '+x.winRate+'% win</span></div><div class="breakdown-track"><span style="width:'+(Math.abs(x.pnl)/maxStrategy*100)+'%"></span></div><div class="breakdown-value '+(x.pnl>=0?'positive':'negative')+'">'+money(x.pnl)+'</div></div>').join('');
      set('bestEdgeBadge','Best: '+[...d.sessions].sort((a,b)=>b.pnl-a.pnl)[0].name);
      $('#weeklyHighlights').innerHTML='<div class="insight"><div class="insight-icon">★</div><div><b>Best trade</b><br/>'+d.bestTrade+'</div></div><div class="insight"><div class="insight-icon" style="background:var(--negative-soft);color:var(--negative)">↓</div><div><b>Worst trade</b><br/>'+d.worstTrade+'</div></div><div class="insight"><div class="insight-icon">✓</div><div><b>Improvement</b><br/>'+d.improvement+'</div></div>';
      const legend=[['Wins',d.wins,'var(--positive)'],['Losses',d.losses,'var(--negative)'],['Breakeven',d.breakeven,'var(--warning)']];
      $('#weeklyOutcomeLegend').innerHTML=legend.map(x=>'<span><i class="legend-dot" style="background:'+x[2]+'"></i>'+x[0]+' <b>'+x[1]+'</b></span>').join('');
      requestAnimationFrame(()=>{drawWeeklyCharts(d,animate);drawWeeklyAdvanced(synced,animate)});
    }

    function animateCanvas(draw,duration=750){
      const started=performance.now();
      function frame(now){const p=Math.min(1,(now-started)/duration),ease=1-Math.pow(1-p,3);draw(ease);if(p<1)requestAnimationFrame(frame)}
      requestAnimationFrame(frame)
    }
    function weeklyBarChart(id,labels,values,animate=true){
      const canvas=$('#'+id);if(!canvas)return;const render=progress=>{const p=prepCanvas(canvas);if(!p)return;const {ctx,w,h}=p,padL=42,padR=18,padT=22,padB=32,max=Math.max(...values.map(Math.abs))*1.22||1,plotH=h-padT-padB,zero=padT+plotH/2;
        ctx.clearRect(0,0,w,h);ctx.strokeStyle=cssVar('--line');ctx.lineWidth=1;ctx.font='9px Inter';ctx.fillStyle=cssVar('--muted');ctx.textAlign='right';
        [-max,-max/2,0,max/2,max].forEach(v=>{const y=zero-(v/max)*(plotH/2);ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(w-padR,y);ctx.stroke();ctx.fillText((v===0?'$0':(v>0?'+$':'-$')+Math.abs(v).toFixed(0)),padL-6,y+3)});
        const gap=(w-padL-padR)/labels.length,bw=gap*.52;labels.forEach((l,i)=>{const x=padL+gap*(i+.5),bh=(Math.abs(values[i])/max)*(plotH/2)*progress,y=values[i]>=0?zero-bh:zero;ctx.fillStyle=values[i]>=0?cssVar('--positive'):cssVar('--negative');roundRect(ctx,x-bw/2,y,bw,bh,6);ctx.fill();ctx.textAlign='center';ctx.fillStyle=cssVar('--muted');ctx.fillText(l,x,h-10);if(progress>.88){ctx.fillStyle=values[i]>=0?cssVar('--positive'):cssVar('--negative');ctx.font='800 9px Inter';ctx.fillText(money(values[i]),x,values[i]>=0?y-7:y+bh+13)}});ctx.textAlign='left'};
      animate?animateCanvas(render):render(1)
    }
    function weeklyPieChart(id,values,colors,animate=true){
      const canvas=$('#'+id);if(!canvas)return;const render=progress=>{const p=prepCanvas(canvas);if(!p)return;const {ctx,w,h}=p,cx=w/2,cy=h/2,r=Math.min(w,h)*.34,total=values.reduce((a,b)=>a+b,0);ctx.clearRect(0,0,w,h);let start=-Math.PI/2;
        values.forEach((v,i)=>{const full=Math.PI*2*v/total,end=start+full*progress;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,start,end);ctx.closePath();ctx.fillStyle=colors[i];ctx.fill();ctx.strokeStyle=cssVar('--surface');ctx.lineWidth=3;ctx.stroke();if(progress>.94&&v){const mid=start+full/2,tx=cx+Math.cos(mid)*r*.63,ty=cy+Math.sin(mid)*r*.63;ctx.fillStyle='#fff';ctx.font='800 11px Inter';ctx.textAlign='center';ctx.fillText(Math.round(v/total*100)+'%',tx,ty+4)}start+=full*progress});ctx.textAlign='left'};
      animate?animateCanvas(render):render(1)
    }
    function weeklyLineChart(id,labels,values,animate=true){
      const canvas=$('#'+id);if(!canvas)return;const render=progress=>{const p=prepCanvas(canvas);if(!p)return;const {ctx,w,h}=p,padL=45,padR=18,padT=22,padB=34,min=Math.min(0,...values),max=Math.max(...values)*1.12||1,range=max-min||1;ctx.clearRect(0,0,w,h);ctx.strokeStyle=cssVar('--line');ctx.font='9px Inter';ctx.fillStyle=cssVar('--muted');
        for(let i=0;i<=4;i++){const y=padT+(h-padT-padB)*i/4;ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(w-padR,y);ctx.stroke();ctx.textAlign='right';ctx.fillText('$'+(max-range*i/4).toFixed(0),padL-6,y+3)}
        const pts=values.map((v,i)=>({x:padL+(w-padL-padR)*i/(values.length-1),y:padT+(h-padT-padB)*(1-(v-min)/range)}));const count=Math.max(2,Math.ceil(pts.length*progress)),shown=pts.slice(0,count);const grad=ctx.createLinearGradient(0,padT,0,h-padB);grad.addColorStop(0,cssVar('--brand')+'55');grad.addColorStop(1,cssVar('--brand')+'00');ctx.beginPath();ctx.moveTo(shown[0].x,h-padB);shown.forEach((pt,i)=>i?ctx.lineTo(pt.x,pt.y):ctx.lineTo(pt.x,pt.y));ctx.lineTo(shown.at(-1).x,h-padB);ctx.closePath();ctx.fillStyle=grad;ctx.fill();ctx.beginPath();shown.forEach((pt,i)=>i?ctx.lineTo(pt.x,pt.y):ctx.moveTo(pt.x,pt.y));ctx.strokeStyle=cssVar('--brand');ctx.lineWidth=3;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();shown.forEach(pt=>{ctx.beginPath();ctx.arc(pt.x,pt.y,4,0,Math.PI*2);ctx.fillStyle=cssVar('--surface');ctx.fill();ctx.strokeStyle=cssVar('--brand');ctx.lineWidth=2;ctx.stroke()});labels.forEach((l,i)=>{ctx.fillStyle=cssVar('--muted');ctx.font='9px Inter';ctx.textAlign='center';ctx.fillText(l,pts[i].x,h-10)});ctx.textAlign='left'};
      animate?animateCanvas(render):render(1)
    }
    function weeklyRankBars(id,items,animate=true){
      const canvas=$('#'+id);if(!canvas)return;const sorted=[...items].sort((a,b)=>b.pnl-a.pnl),values=sorted.map(x=>x.pnl),max=Math.max(...values.map(Math.abs))||1;const render=progress=>{const p=prepCanvas(canvas);if(!p)return;const {ctx,w,h}=p,pad=18,labelW=76,row=(h-pad*2)/sorted.length;ctx.clearRect(0,0,w,h);sorted.forEach((x,i)=>{const y=pad+i*row+row*.2,bh=row*.55,available=w-labelW-pad-54,bw=available*(Math.abs(x.pnl)/max)*progress;ctx.fillStyle=cssVar('--surface-3');roundRect(ctx,labelW,y,available,bh,6);ctx.fill();ctx.fillStyle=x.pnl>=0?cssVar('--positive'):cssVar('--negative');roundRect(ctx,labelW,y,bw,bh,6);ctx.fill();ctx.fillStyle=cssVar('--muted');ctx.font='9px Inter';ctx.textAlign='right';ctx.fillText(x.day,labelW-8,y+bh*.72);ctx.textAlign='left';ctx.fillStyle=x.pnl>=0?cssVar('--positive'):cssVar('--negative');ctx.font='800 9px Inter';ctx.fillText(money(x.pnl),labelW+bw+6,y+bh*.72)});ctx.textAlign='left'};animate?animateCanvas(render):render(1)
    }
    function drawWeeklyCharts(d=weeklyDatasets[activeWeeklyKey],animate=false){
      if(!$('#panel-weekly')?.classList.contains('active'))return;
      const daily=d.days.map(x=>x.pnl),labels=d.days.map(x=>x.short),cumulative=[];daily.reduce((sum,v)=>{cumulative.push(sum+v);return sum+v},0);
      weeklyBarChart('weeklyDailyPnlCanvas',labels,daily,animate);weeklyPieChart('weeklyOutcomeCanvas',[d.wins,d.losses,d.breakeven],[cssVar('--positive'),cssVar('--negative'),cssVar('--warning')],animate);weeklyLineChart('weeklyEquityCanvas',labels,cumulative,animate);weeklyRankBars('weeklyBestDaysCanvas',d.days,animate)
    }



    function setCanvasHitAreas(canvas,areas){
      canvas._hitAreas=areas||[];if(canvas.dataset.tooltipBound)return;canvas.dataset.tooltipBound='1';
      const tip=$('#chartTooltip');canvas.addEventListener('mousemove',e=>{const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,hit=(canvas._hitAreas||[]).find(a=>a.contains?a.contains(x,y):(x>=a.x&&x<=a.x+a.w&&y>=a.y&&y<=a.y+a.h));if(!hit){tip.style.display='none';return}tip.innerHTML='<strong>'+hit.title+'</strong>'+hit.detail;tip.style.display='block';tip.style.left=Math.min(innerWidth-235,e.clientX+14)+'px';tip.style.top=Math.min(innerHeight-80,e.clientY+14)+'px'});canvas.addEventListener('mouseleave',()=>tip.style.display='none')
    }
    function drawStackedColumns(id,groups,animate=true){
      const canvas=$('#'+id);if(!canvas)return;const render=progress=>{const p=prepCanvas(canvas);if(!p)return;const{ctx,w,h}=p,padL=30,padR=14,padT=18,padB=30,max=Math.max(1,...groups.map(g=>g.win+g.loss+g.be)),plotH=h-padT-padB,bw=(w-padL-padR)/groups.length*.5,areas=[];ctx.clearRect(0,0,w,h);ctx.strokeStyle=cssVar('--line');ctx.fillStyle=cssVar('--muted');ctx.font='8px Inter';for(let i=0;i<=max;i++){const y=padT+plotH*(1-i/max);ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(w-padR,y);ctx.stroke();ctx.fillText(i,6,y+3)}
        groups.forEach((g,i)=>{const x=padL+(w-padL-padR)*(i+.5)/groups.length-bw/2;let y=padT+plotH;[['win',g.win,cssVar('--positive'),'Wins'],['loss',g.loss,cssVar('--negative'),'Losses'],['be',g.be,cssVar('--warning'),'Breakeven']].forEach(([k,v,c,label])=>{const bh=plotH*(v/max)*progress;if(!v)return;y-=bh;ctx.fillStyle=c;roundRect(ctx,x,y,bw,bh,4);ctx.fill();areas.push({x,y,w:bw,h:bh,title:g.label,detail:label+': '+v})});ctx.fillStyle=cssVar('--muted');ctx.textAlign='center';ctx.fillText(g.short||g.label,x+bw/2,h-9)});ctx.textAlign='left';setCanvasHitAreas(canvas,areas)};animate?animateCanvas(render):render(1)
    }
    function drawDivergingBars(id,items,animate=true){
      const canvas=$('#'+id);if(!canvas)return;const render=progress=>{const p=prepCanvas(canvas);if(!p)return;const{ctx,w,h}=p,pad=16,labelW=105,mid=labelW+(w-labelW-pad)*.5,row=(h-pad*2)/Math.max(1,items.length),max=Math.max(1,...items.flatMap(x=>[Math.abs(x.positive||0),Math.abs(x.negative||0)])),areas=[];ctx.clearRect(0,0,w,h);ctx.strokeStyle=cssVar('--line');ctx.beginPath();ctx.moveTo(mid,pad);ctx.lineTo(mid,h-pad);ctx.stroke();items.forEach((item,i)=>{const y=pad+i*row+row*.22,bh=row*.52,left=(mid-labelW-10)*(Math.abs(item.negative||0)/max)*progress,right=(w-pad-mid)*(Math.abs(item.positive||0)/max)*progress;ctx.fillStyle=cssVar('--negative');roundRect(ctx,mid-left,y,left,bh,5);ctx.fill();ctx.fillStyle=cssVar('--positive');roundRect(ctx,mid,y,right,bh,5);ctx.fill();ctx.fillStyle=cssVar('--muted');ctx.font='8px Inter';ctx.textAlign='right';ctx.fillText(item.label,labelW-6,y+bh*.72);areas.push({x:mid-left,y,w:left,h:bh,title:item.label,detail:'Gross loss: '+money(-Math.abs(item.negative||0))},{x:mid,y,w:right,h:bh,title:item.label,detail:'Gross profit: '+money(Math.abs(item.positive||0))})});ctx.textAlign='left';setCanvasHitAreas(canvas,areas)};animate?animateCanvas(render):render(1)
    }
    function drawPopulationPyramid(id,items,animate=true){
      const canvas=$('#'+id);if(!canvas)return;const render=progress=>{const p=prepCanvas(canvas);if(!p)return;const{ctx,w,h}=p,pad=16,labelW=66,mid=w/2,row=(h-pad*2)/Math.max(1,items.length),max=Math.max(1,...items.flatMap(x=>[Math.abs(x.left||0),Math.abs(x.right||0)])),areas=[];ctx.clearRect(0,0,w,h);ctx.strokeStyle=cssVar('--line');ctx.beginPath();ctx.moveTo(mid,pad);ctx.lineTo(mid,h-pad);ctx.stroke();items.forEach((item,i)=>{const y=pad+i*row+row*.23,bh=row*.48,space=mid-labelW-pad,left=space*(Math.abs(item.left||0)/max)*progress,right=space*(Math.abs(item.right||0)/max)*progress;ctx.fillStyle=cssVar('--info');roundRect(ctx,mid-left,y,left,bh,5);ctx.fill();ctx.fillStyle=cssVar('--purple');roundRect(ctx,mid,y,right,bh,5);ctx.fill();ctx.fillStyle=cssVar('--muted');ctx.font='800 8px Inter';ctx.textAlign='center';ctx.fillText(item.label,mid,y-3);areas.push({x:mid-left,y,w:left,h:bh,title:item.label+' · Long',detail:'P&L: '+money(item.left||0)},{x:mid,y,w:right,h:bh,title:item.label+' · Short',detail:'P&L: '+money(item.right||0)})});ctx.textAlign='left';setCanvasHitAreas(canvas,areas)};animate?animateCanvas(render):render(1)
    }
    function drawIconArray(id,value,animate=true){
      const canvas=$('#'+id);if(!canvas)return;value=Math.max(0,Math.min(100,Math.round(value)));const render=progress=>{const p=prepCanvas(canvas);if(!p)return;const{ctx,w,h}=p,cols=10,rows=10,gap=Math.min(8,w*.025),size=Math.min((w-gap*(cols-1)-28)/cols,(h-gap*(rows-1)-28)/rows),startX=(w-(size*cols+gap*(cols-1)))/2,startY=(h-(size*rows+gap*(rows-1)))/2,filled=Math.round(value*progress),areas=[];ctx.clearRect(0,0,w,h);for(let i=0;i<100;i++){const x=startX+(i%cols)*(size+gap),y=startY+Math.floor(i/cols)*(size+gap);ctx.beginPath();ctx.arc(x+size/2,y+size/2,size*.38,0,Math.PI*2);ctx.fillStyle=i<filled?cssVar('--brand'):cssVar('--surface-3');ctx.fill();areas.push({x,y,w:size,h:size,title:'Win rate',detail:value+'% winning trades'})}setCanvasHitAreas(canvas,areas)};animate?animateCanvas(render,600):render(1)
    }
    function drawWaffle(id,value,animate=true,colorVar='--brand'){
      const canvas=$('#'+id);if(!canvas)return;value=Math.max(0,Math.min(100,Math.round(value)));const render=progress=>{const p=prepCanvas(canvas);if(!p)return;const{ctx,w,h}=p,cols=10,rows=10,gap=4,size=Math.min((w-gap*(cols-1)-24)/cols,(h-gap*(rows-1)-24)/rows),startX=(w-(size*cols+gap*(cols-1)))/2,startY=(h-(size*rows+gap*(rows-1)))/2,filled=Math.round(value*progress),areas=[];ctx.clearRect(0,0,w,h);for(let i=0;i<100;i++){const x=startX+(i%cols)*(size+gap),y=startY+(rows-1-Math.floor(i/cols))*(size+gap);ctx.fillStyle=i<filled?cssVar(colorVar):cssVar('--surface-3');roundRect(ctx,x,y,size,size,3);ctx.fill();areas.push({x,y,w:size,h:size,title:'Score',detail:value+' of 100 cells'})}setCanvasHitAreas(canvas,areas)};animate?animateCanvas(render,650):render(1)
    }
    function drawSemiGauge(id,value,max,label,animate=true){
      const canvas=$('#'+id);if(!canvas)return;const ratio=Math.max(0,Math.min(1,max?value/max:0)),render=progress=>{const p=prepCanvas(canvas);if(!p)return;const{ctx,w,h}=p,cx=w/2,cy=h*.72,r=Math.min(w*.34,h*.52),start=Math.PI,end=Math.PI*2;ctx.clearRect(0,0,w,h);ctx.lineWidth=Math.max(16,r*.24);ctx.lineCap='round';ctx.beginPath();ctx.arc(cx,cy,r,start,end);ctx.strokeStyle=cssVar('--surface-3');ctx.stroke();ctx.beginPath();ctx.arc(cx,cy,r,start,start+(end-start)*ratio*progress);ctx.strokeStyle=ratio>.92?cssVar('--warning'):cssVar('--brand');ctx.stroke();ctx.fillStyle=cssVar('--text');ctx.textAlign='center';ctx.font='850 25px Inter';ctx.fillText(label,cx,cy-4);ctx.fillStyle=cssVar('--muted');ctx.font='9px Inter';ctx.fillText(Math.round(ratio*100)+'% of target',cx,cy+15);ctx.textAlign='left';setCanvasHitAreas(canvas,[{contains:(x,y)=>Math.hypot(x-cx,y-cy)<=r+20,title:'Gauge',detail:label+' · '+Math.round(ratio*100)+'% of target'}])};animate?animateCanvas(render,700):render(1)
    }
    function drawDonutAdvanced(id,segments,centerLabel,animate=true){
      const canvas=$('#'+id);if(!canvas)return;const total=segments.reduce((a,x)=>a+x.value,0)||1,render=progress=>{const p=prepCanvas(canvas);if(!p)return;const{ctx,w,h}=p,cx=w/2,cy=h/2,r=Math.min(w,h)*.3,line=Math.max(18,r*.36);ctx.clearRect(0,0,w,h);let start=-Math.PI/2,areas=[];segments.forEach((s,i)=>{const span=Math.PI*2*s.value/total,end=start+span*progress;ctx.beginPath();ctx.arc(cx,cy,r,start,end);ctx.strokeStyle=s.color;ctx.lineWidth=line;ctx.lineCap='butt';ctx.stroke();const a0=start,a1=start+span;areas.push({contains:(x,y)=>{const dx=x-cx,dy=y-cy,rr=Math.hypot(dx,dy),ang=(Math.atan2(dy,dx)+Math.PI*2)%(Math.PI*2),s0=(a0+Math.PI*2)%(Math.PI*2),s1=(a1+Math.PI*2)%(Math.PI*2);const inAngle=s0<s1?ang>=s0&&ang<=s1:ang>=s0||ang<=s1;return rr>=r-line/2&&rr<=r+line/2&&inAngle},title:s.label,detail:s.value+' trades · '+Math.round(s.value/total*100)+'%'});start+=span});ctx.fillStyle=cssVar('--text');ctx.font='850 22px Inter';ctx.textAlign='center';ctx.fillText(total,cx,cy+2);ctx.fillStyle=cssVar('--muted');ctx.font='9px Inter';ctx.fillText(centerLabel,cx,cy+18);ctx.textAlign='left';setCanvasHitAreas(canvas,areas)};animate?animateCanvas(render,700):render(1)
    }
    function drawSunburst(id,trades,animate=true){
      const canvas=$('#'+id);if(!canvas)return;const sessionGroups=groupBy(trades,t=>t.session),sessionNames=Object.keys(sessionGroups),total=Math.max(1,trades.length),render=progress=>{const p=prepCanvas(canvas);if(!p)return;const{ctx,w,h}=p,cx=w/2,cy=h/2,maxR=Math.min(w,h)*.42,innerR=maxR*.34,midR=maxR*.61,outerR=maxR*.94;ctx.clearRect(0,0,w,h);let start=-Math.PI/2,areas=[];sessionNames.forEach((session,si)=>{const list=sessionGroups[session],span=Math.PI*2*list.length/total,sEnd=start+span*progress,color=chartPalette[si%chartPalette.length];ctx.beginPath();ctx.arc(cx,cy,midR,start,sEnd);ctx.arc(cx,cy,innerR,sEnd,start,true);ctx.closePath();ctx.fillStyle=color;ctx.globalAlpha=.88;ctx.fill();ctx.globalAlpha=1;const stratGroups=groupBy(list,t=>t.strategy);let oStart=start;Object.entries(stratGroups).forEach(([strategy,sList],j)=>{const oSpan=span*sList.length/list.length,oEnd=oStart+oSpan*progress;ctx.beginPath();ctx.arc(cx,cy,outerR,oStart,oEnd);ctx.arc(cx,cy,midR+3,oEnd,oStart,true);ctx.closePath();ctx.fillStyle=chartPalette[(si+j+1)%chartPalette.length];ctx.globalAlpha=.62+.1*(j%3);ctx.fill();ctx.globalAlpha=1;const a0=oStart,a1=oStart+oSpan;areas.push({contains:(x,y)=>{const dx=x-cx,dy=y-cy,rr=Math.hypot(dx,dy),ang=(Math.atan2(dy,dx)+Math.PI*2)%(Math.PI*2),s0=(a0+Math.PI*2)%(Math.PI*2),s1=(a1+Math.PI*2)%(Math.PI*2),inside=s0<s1?ang>=s0&&ang<=s1:ang>=s0||ang<=s1;return rr>=midR&&rr<=outerR&&inside},title:session+' · '+strategy,detail:sList.length+' trades · '+money(sum(sList))});oStart+=oSpan});start+=span});ctx.beginPath();ctx.arc(cx,cy,innerR-3,0,Math.PI*2);ctx.fillStyle=cssVar('--surface');ctx.fill();ctx.fillStyle=cssVar('--text');ctx.font='850 20px Inter';ctx.textAlign='center';ctx.fillText(trades.length,cx,cy+1);ctx.fillStyle=cssVar('--muted');ctx.font='8px Inter';ctx.fillText('synced trades',cx,cy+16);ctx.textAlign='left';setCanvasHitAreas(canvas,areas)};animate?animateCanvas(render,850):render(1)
    }
    function drawCalendarWaffle(id,monthTrades,month,animate=true){
      const canvas=$('#'+id);if(!canvas)return;const[y,m]=month.split('-').map(Number),days=new Date(y,m,0).getDate(),byDate=groupBy(monthTrades,t=>t.date),render=progress=>{const p=prepCanvas(canvas);if(!p)return;const{ctx,w,h}=p,cols=7,rows=Math.ceil(days/7),gap=7,size=Math.min((w-gap*(cols-1)-28)/cols,(h-gap*(rows-1)-28)/rows),sx=(w-(size*cols+gap*(cols-1)))/2,sy=(h-(size*rows+gap*(rows-1)))/2,areas=[];ctx.clearRect(0,0,w,h);for(let d=1;d<=days;d++){const key=month+'-'+String(d).padStart(2,'0'),list=byDate[key]||[],pnl=sum(list),x=sx+((d-1)%cols)*(size+gap),yy=sy+Math.floor((d-1)/cols)*(size+gap);ctx.fillStyle=!list.length?cssVar('--surface-3'):pnl>=0?cssVar('--positive'):cssVar('--negative');ctx.globalAlpha=!list.length?.55:Math.min(1,.45+Math.abs(pnl)/300)*progress;roundRect(ctx,x,yy,size,size,4);ctx.fill();ctx.globalAlpha=1;ctx.fillStyle=!list.length?cssVar('--muted'):'#fff';ctx.font='800 8px Inter';ctx.textAlign='center';ctx.fillText(d,x+size/2,yy+size*.64);areas.push({x,y:yy,w:size,h:size,title:key,detail:list.length?list.length+' trades · '+money(pnl):'No trades'})}ctx.textAlign='left';setCanvasHitAreas(canvas,areas)};animate?animateCanvas(render,650):render(1)
    }
    function drawWeeklyAdvanced(trades,animate=true){
      if(!$('#panel-weekly')?.classList.contains('active'))return;const byDate=groupBy(trades,t=>t.date),groups=Object.entries(byDate).sort().map(([date,list])=>({label:new Date(date+'T00:00:00').toLocaleDateString('en-US',{weekday:'long'}),short:new Date(date+'T00:00:00').toLocaleDateString('en-US',{weekday:'short'}),win:list.filter(t=>t.outcome==='win').length,loss:list.filter(t=>t.outcome==='loss').length,be:list.filter(t=>t.outcome==='breakeven').length}));
      const bySymbol=groupBy(trades,t=>t.symbol),pyramid=Object.entries(bySymbol).map(([label,list])=>({label,left:sum(list.filter(t=>t.direction==='Long')),right:sum(list.filter(t=>t.direction==='Short'))})).sort((a,b)=>Math.abs(b.left)+Math.abs(b.right)-Math.abs(a.left)-Math.abs(a.right)).slice(0,5);
      const adherence=Math.round(average(trades,'ruleAdherence')),winRate=trades.length?Math.round(trades.filter(t=>t.outcome==='win').length/trades.length*100):0,risk=+sum(trades,'risk').toFixed(2);
      drawStackedColumns('weeklyStackedCanvas',groups,animate);drawPopulationPyramid('weeklyPyramidCanvas',pyramid,animate);drawSunburst('weeklySunburstCanvas',trades,animate);drawWaffle('weeklyWaffleCanvas',adherence,animate);drawIconArray('weeklyIconArrayCanvas',winRate,animate);drawSemiGauge('weeklyGaugeCanvas',risk,9,risk.toFixed(1)+'%',animate);
      $('#weeklyWaffleValue').textContent=adherence+'%';$('#weeklyIconValue').textContent=winRate+'%';$('#weeklyRiskLabel').textContent=risk.toFixed(2)+'% used'
    }
    function drawCalendarAdvanced(trades,month,animate=true){
      if(!$('#panel-calendar')?.classList.contains('active'))return;const byDate=Object.values(groupBy(trades,t=>t.date)),wins=trades.filter(t=>t.outcome==='win').length,losses=trades.filter(t=>t.outcome==='loss').length,be=trades.length-wins-losses,winningDays=byDate.filter(x=>sum(x)>0).length,active=byDate.length,completed=byDate.filter(x=>x.every(t=>t.journalComplete)).length,dayRate=active?Math.round(winningDays/active*100):0,completion=active?Math.round(completed/active*100):0;
      drawCalendarWaffle('calendarWaffleCanvas',trades,month,animate);drawIconArray('calendarIconArrayCanvas',dayRate,animate);drawDonutAdvanced('calendarOutcomeDonutCanvas',[{label:'Wins',value:wins,color:cssVar('--positive')},{label:'Losses',value:losses,color:cssVar('--negative')},{label:'Breakeven',value:be,color:cssVar('--warning')}],'trades',animate);drawSemiGauge('calendarGaugeCanvas',completion,100,completion+'%',animate);$('#calendarWinDayRate').textContent=dayRate+'%';$('#calendarGaugeLabel').textContent=completed+' of '+active+' days'
    }
    function drawAnalyticsAdvanced(trades,animate=true){
      if(!$('#panel-analytics')?.classList.contains('active'))return;const strat=groupBy(trades,t=>t.strategy),diverging=Object.entries(strat).map(([label,list])=>({label,positive:sum(list.filter(t=>t.pnl>0)),negative:Math.abs(sum(list.filter(t=>t.pnl<0)))}));const symbolsGrouped=groupBy(trades,t=>t.symbol),pyramid=Object.entries(symbolsGrouped).map(([label,list])=>({label,left:sum(list.filter(t=>t.direction==='Long')),right:sum(list.filter(t=>t.direction==='Short'))})).sort((a,b)=>Math.abs(b.left)+Math.abs(b.right)-Math.abs(a.left)-Math.abs(a.right)).slice(0,5);const quality=trades.length?Math.round(trades.filter(t=>['A','A+'].includes(t.setupGrade)).length/trades.length*100):0,winRate=trades.length?Math.round(trades.filter(t=>t.outcome==='win').length/trades.length*100):0,avgRisk=average(trades,'risk');
      drawSunburst('analyticsSunburstCanvas',trades,animate);drawDivergingBars('analyticsDivergingCanvas',diverging,animate);drawPopulationPyramid('analyticsPyramidCanvas',pyramid,animate);drawWaffle('analyticsWaffleCanvas',quality,animate,'--purple');drawIconArray('analyticsIconArrayCanvas',winRate,animate);drawSemiGauge('analyticsGaugeCanvas',avgRisk,.5,avgRisk.toFixed(2)+'%',animate);$('#analyticsWaffleValue').textContent=quality+'%';$('#analyticsIconValue').textContent=winRate+'%';$('#analyticsRiskLabel').textContent=avgRisk.toFixed(2)+'% average';$('#analyticsTradeCount').textContent=trades.length+' synced trades'
    }

    function cssVar(name){return getComputedStyle(document.documentElement).getPropertyValue(name).trim()}
    function prepCanvas(canvas){
      if(!canvas)return null;
      const dpr=Math.min(devicePixelRatio||1,2),rect=canvas.getBoundingClientRect();
      if(rect.width===0||rect.height===0)return null;
      canvas.width=rect.width*dpr;canvas.height=rect.height*dpr;
      const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);return {ctx,w:rect.width,h:rect.height}
    }
    function grid(ctx,w,h,pad,max=100){
      ctx.strokeStyle=cssVar('--line');ctx.lineWidth=1;ctx.fillStyle=cssVar('--muted');ctx.font='9px Inter, sans-serif';
      for(let i=0;i<=4;i++){const y=pad+(h-pad*2)*i/4;ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(w-pad,y);ctx.stroke();ctx.fillText(Math.round(max-(max*i/4)),4,y+3)}
    }
    function lineChart(id,series,opts={}){
      const c=$('#'+id),p=prepCanvas(c);if(!p)return;const {ctx,w,h}=p,pad=28,max=opts.max||100,min=opts.min||0;
      ctx.clearRect(0,0,w,h);grid(ctx,w,h,pad,max);
      series.forEach((s,si)=>{
        const color=s.color||cssVar('--brand'),grad=ctx.createLinearGradient(0,pad,0,h-pad);grad.addColorStop(0,color+'44');grad.addColorStop(1,color+'00');
        const pts=s.data.map((v,i)=>({x:pad+(w-pad*2)*(i/(s.data.length-1)),y:pad+(h-pad*2)*(1-(v-min)/(max-min))}));
        if(series.length===1){ctx.beginPath();ctx.moveTo(pts[0].x,h-pad);pts.forEach(pt=>ctx.lineTo(pt.x,pt.y));ctx.lineTo(pts.at(-1).x,h-pad);ctx.closePath();ctx.fillStyle=grad;ctx.fill()}
        ctx.beginPath();pts.forEach((pt,i)=>i?ctx.lineTo(pt.x,pt.y):ctx.moveTo(pt.x,pt.y));ctx.strokeStyle=color;ctx.lineWidth=2.5;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();
        pts.forEach(pt=>{ctx.beginPath();ctx.arc(pt.x,pt.y,3,0,Math.PI*2);ctx.fillStyle=cssVar('--surface');ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke()})
      })
    }
    function barChart(id,labels,values,colors){
      const p=prepCanvas($('#'+id));if(!p)return;const {ctx,w,h}=p,pad=32,max=Math.max(...values.map(Math.abs))*1.2||1;
      ctx.clearRect(0,0,w,h);const zero=h/2;ctx.strokeStyle=cssVar('--line');ctx.beginPath();ctx.moveTo(pad,zero);ctx.lineTo(w-pad,zero);ctx.stroke();
      const bw=(w-pad*2)/labels.length*.52;
      labels.forEach((l,i)=>{
        const x=pad+(w-pad*2)*(i+.5)/labels.length,bh=(Math.abs(values[i])/max)*(h/2-pad);
        ctx.fillStyle=colors?.[i]||(values[i]>=0?cssVar('--positive'):cssVar('--negative'));
        const y=values[i]>=0?zero-bh:zero;roundRect(ctx,x-bw/2,y,bw,bh,5);ctx.fill();
        ctx.fillStyle=cssVar('--muted');ctx.font='9px Inter';ctx.textAlign='center';ctx.fillText(l,x,h-8);
        ctx.fillStyle=values[i]>=0?cssVar('--positive'):cssVar('--negative');ctx.fillText((values[i]>=0?'+':'')+values[i],x,values[i]>=0?y-6:y+bh+12)
      });ctx.textAlign='left'
    }
    function horizontalBars(id,labels,values){
      const p=prepCanvas($('#'+id));if(!p)return;const {ctx,w,h}=p,pad=18,labelW=86,max=Math.max(...values);
      ctx.clearRect(0,0,w,h);const row=(h-pad*2)/labels.length;
      labels.forEach((l,i)=>{
        const y=pad+i*row+row*.22,bh=row*.5,bw=(w-labelW-pad*2)*(values[i]/max);
        ctx.fillStyle=cssVar('--surface-3');roundRect(ctx,labelW,y,w-labelW-pad,bh,6);ctx.fill();
        ctx.fillStyle=i<2?cssVar('--warning'):cssVar('--brand');roundRect(ctx,labelW,y,bw,bh,6);ctx.fill();
        ctx.fillStyle=cssVar('--muted');ctx.font='9px Inter';ctx.textAlign='right';ctx.fillText(l,labelW-8,y+bh*.72);ctx.textAlign='left';ctx.fillText(values[i],labelW+bw+6,y+bh*.72)
      })
    }
    function donut(id,values,colors){
      const p=prepCanvas($('#'+id));if(!p)return;const {ctx,w,h}=p,cx=w/2,cy=h/2,r=Math.min(w,h)*.31,total=values.reduce((a,b)=>a+b,0);let a=-Math.PI/2;
      ctx.clearRect(0,0,w,h);
      values.forEach((v,i)=>{const end=a+Math.PI*2*v/total;ctx.beginPath();ctx.arc(cx,cy,r,a,end);ctx.strokeStyle=colors[i];ctx.lineWidth=22;ctx.lineCap='round';ctx.stroke();a=end+.03});
      ctx.fillStyle=cssVar('--text');ctx.font='800 24px Inter';ctx.textAlign='center';ctx.fillText(Math.round(values[0]/total*100)+'%',cx,cy+4);
      ctx.fillStyle=cssVar('--muted');ctx.font='9px Inter';ctx.fillText('Completed',cx,cy+20);ctx.textAlign='left'
    }
    function roundRect(ctx,x,y,w,h,r){if(w<0){x+=w;w=-w}ctx.beginPath();ctx.roundRect?ctx.roundRect(x,y,w,h,r):(ctx.rect(x,y,w,h))}
    function drawAllCharts(animate=false){
      const trades=analyticsTrades(),byDate=groupBy(trades,t=>t.date),dates=Object.keys(byDate).sort().slice(-14),dayLists=dates.map(d=>byDate[d]);
      const discipline=dayLists.map(x=>average(x,'ruleAdherence')),focus=dayLists.map(x=>average(x,'focus')),stress=dayLists.map(x=>average(x,'stress')),control=dayLists.map(x=>average(x,'control'));
      if($('#panel-analytics')?.classList.contains('active')){
        lineChart('disciplineCanvas',[{data:discipline.length>1?discipline:[0,discipline[0]||0],color:cssVar('--brand')}]);
        lineChart('psychologyCanvas',[{data:focus.length>1?focus:[0,focus[0]||0],color:cssVar('--brand')},{data:stress.length>1?stress:[0,stress[0]||0],color:cssVar('--negative')},{data:control.length>1?control:[0,control[0]||0],color:cssVar('--purple')}]);
        const emotions=groupBy(trades,t=>t.emotion),emotionItems=Object.entries(emotions).map(([k,v])=>[k,Math.round(sum(v))]).sort((a,b)=>b[1]-a[1]).slice(0,5);barChart('emotionCanvas',emotionItems.map(x=>x[0]),emotionItems.map(x=>x[1]));
        const mistakes=groupBy(trades.filter(t=>t.mistake!=='None'),t=>t.mistake),mistakeItems=Object.entries(mistakes).map(([k,v])=>[k,v.length]).sort((a,b)=>b[1]-a[1]).slice(0,5);horizontalBars('mistakeCanvas',mistakeItems.map(x=>x[0]),mistakeItems.map(x=>x[1]));
        const execution=dayLists.map(x=>x.length?x.reduce((a,t)=>a+(['A','A+'].includes(t.setupGrade)?92:65),0)/x.length:0);lineChart('planCanvas',[{data:discipline.length>1?discipline:[0,discipline[0]||0],color:cssVar('--info')},{data:execution.length>1?execution:[0,execution[0]||0],color:cssVar('--brand')}]);
        const completed=dayLists.filter(x=>x.every(t=>t.journalComplete)).length,draft=dayLists.filter(x=>x.some(t=>t.journalComplete)&&!x.every(t=>t.journalComplete)).length,missing=Math.max(0,30-completed-draft);donut('completionCanvas',[completed,draft,missing],[cssVar('--brand'),cssVar('--warning'),cssVar('--surface-3')]);drawAnalyticsAdvanced(trades,animate);$('#analyticsLastSync').textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})
      }
      drawWeeklyCharts(weeklyDatasets[activeWeeklyKey],animate);drawWeeklyAdvanced(tradesForWeek(activeWeeklyKey),animate);
      if($('#panel-calendar')?.classList.contains('active'))drawCalendarAdvanced(tradesForMonth($('#calendarMonth')?.value||'2026-07'),$('#calendarMonth')?.value||'2026-07',animate)
    }
    addEventListener('resize',()=>{clearTimeout(window.__chartTimer);window.__chartTimer=setTimeout(drawAllCharts,120)});

    animateCounters();updateRules();calcReadiness();updateCompletion();renderEntries();renderCalendar('2026-07',false);updateWeeklyReview('current',false);
    setTimeout(drawAllCharts,150);
