// Pure data operations shared by browser and Node tests. No browser globals.
export const DAY=86400000;
export const INTERVALS=[1,3,7,14];
export const MIX={oldReview:40,contextualTransfer:30,newExpressions:20,errorRepair:10};
export const normalize=s=>String(s??'').trim().replace(/\s+/g,' ').replace(/[.!?]+$/,'').toLowerCase();
export const exact=(a,b)=>normalize(a)===normalize(b);
const validDate=x=>x==null||(typeof x==='string'&&!Number.isNaN(Date.parse(x)))||(typeof x==='number'&&Number.isFinite(x));
export function validateImport(obj){
 if(!obj||typeof obj!=='object'||Array.isArray(obj)||!Array.isArray(obj.items)||obj.items.length>5000)throw Error('Invalid history: expected an items array (up to 5,000).');
 if(obj.schemaVersion&&obj.schemaVersion!=='daily-english-conversation-seed-v1'&&obj.version!==2&&obj.version!==3)throw Error('Unsupported history schema.');
 for(const x of obj.items){if(!x||typeof x.id!=='string'||!x.id.trim()||x.id.length>160)throw Error('Invalid expression ID.');if(typeof(x.text??x.target)!=='string'||!(x.text??x.target).trim())throw Error('Expression text/target is required.');if(x.attempts!==undefined&&(!Array.isArray(x.attempts)||x.attempts.length>10000))throw Error('Invalid attempts array.');if(x.reviewHistory!==undefined&&!Array.isArray(x.reviewHistory))throw Error('Invalid review history.');if(!validDate(x.lastReviewedAt)||!validDate(x.nextReviewAt))throw Error('Invalid review date.');}
 for(const key of ['paragraphs','errorPatterns'])if(obj[key]!==undefined&&!Array.isArray(obj[key]))throw Error('Invalid '+key+' array.');
 if(JSON.stringify(obj).length>3_000_000)throw Error('Import is too large.');
 return obj;
}
const canonical=s=>normalize(s).replace(/[’‘]/g,"'");
const knownText=x=>canonical(x.target||x.text||'');
const rank=s=>({'Learning':0,'Practiced':1,'Needs contextual transfer':1,'Memorized':2,'Mastered':3,'Mastered · Written':3}[s]??0);
const attemptKey=a=>[a.date??a.at??'',a.answer??'',a.kind??'',a.source??''].join('\u0001');
function uniqueMerge(a=[],b=[],key=x=>JSON.stringify(x)){const seen=new Set(a.map(key));const result=[...a];for(const x of b){const k=key(x);if(!seen.has(k)){seen.add(k);result.push(structuredClone(x))}}return result}
function convert(x){return {id:'history:'+x.id,title:x.text,expression:x.text,context:x.notes||'Use this expression naturally in a new context.',hint:'',target:null,status:x.status||'Practiced',streak:0,source:'Reconstructed conversation seed',provenance:x.provenance||'reconstructed',confidence:x.confidence||'unknown',category:x.category||'general',notes:x.notes||'',lastReviewedAt:x.lastReviewedAt??null,nextReviewAt:x.nextReviewAt??null,reviewHistory:structuredClone(x.reviewHistory||[]),reviewStep:0,due:null,attempts:[],kind:'expression'};}
export function previewMerge(state,incoming){validateImport(incoming);let added=0,matched=0,attempts=0;for(const x of incoming.items){const current=state.items.find(y=>y.id===x.id||y.id==='history:'+x.id||(knownText(y)&&knownText(y)===knownText(x)));if(current){matched++;attempts+=(x.attempts||[]).filter(a=>!(current.attempts||[]).some(b=>attemptKey(a)===attemptKey(b))).length}else added++}return {added,matched,attempts,paragraphs:(incoming.paragraphs||[]).length,errorPatterns:(incoming.errorPatterns||[]).length,source:incoming.source||'User JSON',reconstructed:incoming.schemaVersion==='daily-english-conversation-seed-v1'};}
export function mergeHistory(state,incoming){validateImport(incoming);const out=structuredClone(state);out.items??=[];out.paragraphs??=[];out.historicalPatterns??=[];out.importLog??=[];out.drafts??={};out.patterns??={};out.feedbacks??=[];out.daily??={};out.reviewStage??={};
 for(const x of incoming.items){let y=out.items.find(z=>z.id===x.id||z.id==='history:'+x.id||(knownText(z)&&knownText(z)===knownText(x)));if(!y){out.items.push(incoming.schemaVersion==='daily-english-conversation-seed-v1'?convert(x):structuredClone(x));continue}
 // Existing local data is authoritative: never overwrite its status, drafts, due date, or detailed attempts.
 y.attempts=uniqueMerge(y.attempts||[],x.attempts||[],attemptKey);
 y.contextUses=uniqueMerge(y.contextUses||[],x.contextUses||[]);
 y.reviewHistory=uniqueMerge(y.reviewHistory||[],x.reviewHistory||[]);
 y.historySources=uniqueMerge(y.historySources||[],[{source:incoming.source||'Imported JSON',status:x.status||null,notes:x.notes||null,confidence:x.confidence||null}]);
 if(!y.category&&x.category)y.category=x.category;
 if(!y.notes&&x.notes)y.notes=x.notes;
 if(!y.provenance&&x.provenance)y.provenance=x.provenance;
 if(!y.lastReviewedAt&&x.lastReviewedAt)y.lastReviewedAt=x.lastReviewedAt;
 if(!y.nextReviewAt&&x.nextReviewAt)y.nextReviewAt=x.nextReviewAt;
 // Existing status wins even if a reconstructed seed reports stronger mastery.
 }
 out.paragraphs=uniqueMerge(out.paragraphs,incoming.paragraphs||[],x=>x.id||JSON.stringify(x));
 out.historicalPatterns=uniqueMerge(out.historicalPatterns,incoming.errorPatterns||[],x=>x.pattern||JSON.stringify(x));
 if(incoming.drafts&&typeof incoming.drafts==='object'&&!Array.isArray(incoming.drafts))for(const [k,v] of Object.entries(incoming.drafts))if(!(k in out.drafts)&&typeof v==='string')out.drafts[k]=v;
 if(incoming.patterns&&typeof incoming.patterns==='object')for(const [k,v] of Object.entries(incoming.patterns))if(!(k in out.patterns)&&Number.isFinite(v))out.patterns[k]=v;
 for(const key of ['paragraphPracticeHistory','lessonPracticeHistory','dialoguePracticeHistory','materialReviewHistory','feedbacks','recentReviews'])if(Array.isArray(incoming[key]))out[key]=uniqueMerge(out[key]||[],incoming[key],x=>x.id||JSON.stringify(x));
 if(incoming.learningMemory){out.learningMemory??={events:[],suggestions:[]};for(const key of ['events','suggestions'])if(Array.isArray(incoming.learningMemory[key]))out.learningMemory[key]=uniqueMerge(out.learningMemory[key]||[],incoming.learningMemory[key],x=>x.id||JSON.stringify(x));}
 if(incoming.lessonContextIndexes&&typeof incoming.lessonContextIndexes==='object')out.lessonContextIndexes={...incoming.lessonContextIndexes,...out.lessonContextIndexes};
 for(const key of ['dialogueSessions','dialogueSceneIndexes','guidedHintsSeen'])if(incoming[key]&&typeof incoming[key]==='object'&&!Array.isArray(incoming[key]))out[key]={...structuredClone(incoming[key]),...(out[key]||{})};
 out.importLog=uniqueMerge(out.importLog,[{source:incoming.source||'User JSON',schema:incoming.schemaVersion||incoming.version||'unknown',reconstructed:incoming.schemaVersion==='daily-english-conversation-seed-v1'}],x=>JSON.stringify(x));
 return out;
}
export function reviewDate(item){if(item.nextReviewAt!=null)return Date.parse(item.nextReviewAt);if(item.due!=null)return typeof item.due==='number'?item.due:Date.parse(item.due);return null}
export function reviewQueue(items,now=Date.now(),limit=20){const due=[],unscheduled=[];for(const x of items){const d=reviewDate(x);if(d!==null&&Number.isFinite(d)&&d<=now)due.push({...x,overdueDays:Math.max(0,Math.floor((now-d)/DAY))});else if(d===null&&['Practiced','Memorized','Mastered','Mastered · Written','Needs contextual transfer'].includes(x.status))unscheduled.push({...x,overdueDays:null})}
 // Mix topic groups round-robin to prevent one category from monopolizing catch-up.
 due.sort((a,b)=>b.overdueDays-a.overdueDays||(reviewDate(a)-reviewDate(b)));
 const result=[];let lastCategory=null,run=0;while(due.length&&result.length<limit){let idx=due.findIndex(x=>(x.category||x.topic||'general')!==lastCategory||run<2);if(idx<0)idx=0;const [x]=due.splice(idx,1);const cat=x.category||x.topic||'general';run=cat===lastCategory?run+1:1;lastCategory=cat;result.push(x)}return {due:result,unscheduled:unscheduled.sort((a,b)=>String(a.title).localeCompare(String(b.title))),totalDue:result.length+due.length};}
export function advanceReview(item,correct,now=Date.now()){const x=structuredClone(item),step=correct?Math.min((x.reviewStep||0)+1,3):0;const next=now+INTERVALS[step]*DAY;x.reviewStep=step;x.due=next;x.lastReviewedAt=new Date(now).toISOString();x.nextReviewAt=new Date(next).toISOString();x.reviewHistory=[...(x.reviewHistory||[]),{at:x.lastReviewedAt,correct,step,nextReviewAt:x.nextReviewAt,source:'Local review'}];return x;}
export function dailyPlan(items,now=Date.now(),slots=10,history=[]){const queue=reviewQueue(items,now,500);const quotas={oldReview:Math.round(slots*.4),contextualTransfer:Math.round(slots*.3),newExpressions:Math.round(slots*.2)};quotas.errorRepair=slots-quotas.oldReview-quotas.contextualTransfer-quotas.newExpressions;const recently=history.slice(-3).map(x=>x.id);const reviews=queue.due.filter(x=>!recently.includes(x.id)).concat(queue.due.filter(x=>recently.includes(x.id))).slice(0,quotas.oldReview);return {mix:MIX,quotas,reviews,unscheduledCount:queue.unscheduled.length,backlogCount:queue.totalDue,topics:[...new Set(reviews.map(x=>x.category||x.topic||'general'))]};}

// Catch-up categorization never infers missing review dates.
export function catchupBuckets(state,now=Date.now()){
 const queue=reviewQueue(state.items||[],now,10000);
 const paragraphs=(state.paragraphs||[]).filter(p=>!['Memorized','Mastered','Mastered · Written'].includes(p.status));
 const mastered=(state.items||[]).filter(x=>String(x.status||'').startsWith('Mastered') && !((state.retestHistory||[]).some(r=>r.id===x.id && r.passed===true && Number.isFinite(Date.parse(r.at)) && now-Date.parse(r.at)<14*DAY)));
 const seen=new Set();
 const baseline=queue.unscheduled.filter(x=>{if(seen.has(x.id))return false;seen.add(x.id);return true});
 return {overdue:queue.due,baseline,paragraphs,mastered,counts:{overdue:queue.totalDue,baseline:baseline.length,paragraphs:paragraphs.length,mastered:mastered.length}};
}
export function catchupPlan(state,now=Date.now(),limit=8){
 const b=catchupBuckets(state,now),groups=[['overdue',b.overdue],['paragraph',b.paragraphs],['baseline',b.baseline],['mastered',b.mastered]];
 const result=[],used=new Set();
 while(result.length<limit&&groups.some(g=>g[1].length)){
  for(const [kind,arr] of groups){if(result.length>=limit)break;let x;while(arr.length){const candidate=arr.shift();const key=kind+':'+candidate.id;if(!used.has(key)){used.add(key);x=candidate;break}}if(x)result.push({kind,id:x.id,title:x.title||x.text||x.id});}
 }
 return result;
}
