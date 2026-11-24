// Local-first learning memory. No AI response is required to retain attempts.
export const normalizePhrase = s => String(s||'').toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9' ]/g,' ').replace(/\s+/g,' ').trim();
export function containsPhrase(answer,phrase){const a=normalizePhrase(answer),b=normalizePhrase(phrase);return !!b && (' '+a+' ').includes(' '+b+' ')}
export function recordParagraphMemory(state,entry,now=new Date().toISOString()){
 state.learningMemory??={events:[],suggestions:[]};
 const event={id:entry.id,at:now,scenarioId:entry.scenarioId,answer:entry.answer,mode:entry.mode,kind:entry.kind,observed:[],feedbackStatus:'pending'};
 const hintsShown=entry.mode==='guided';
 for(const phrase of entry.chunks||[]){
  const used=containsPhrase(entry.answer,phrase);
  const item=(state.items||[]).find(x=>[x.expression,x.title,x.target,x.text].some(v=>normalizePhrase(v)===normalizePhrase(phrase)));
  event.observed.push({phrase,used,independent:used&&!hintsShown,itemId:item?.id||null});
  if(item&&used){item.contextUses??=[];item.contextUses.push({at:now,scenarioId:entry.scenarioId,independent:!hintsShown,source:'paragraph-practice',assessment:'unverified'});item.contextUses=item.contextUses.slice(-100);item.lastPracticedAt=now;}
 }
 state.learningMemory.events.push(event);state.learningMemory.events=state.learningMemory.events.slice(-500);
 return event;
}
export function applyMemoryFeedback(state,eventId,feedback){
 const event=state.learningMemory?.events?.find(e=>e.id===eventId);if(!event)return false;
 event.feedbackStatus=feedback?.error?'unavailable':'received';
 event.feedbackSummary=typeof feedback?.summary==='string'?feedback.summary.slice(0,250):null;
 // AI feedback is advisory: no automatic Memorized/Mastered promotion.
 return true;
}
export function suggestExpression(state,phrase,sourceEventId){
 const value=String(phrase||'').trim();if(!value||value.length>240)return false;
 const key=normalizePhrase(value);if(!key)return false;
 state.learningMemory??={events:[],suggestions:[]};
 if((state.items||[]).some(x=>[x.expression,x.target,x.text].some(t=>normalizePhrase(t)===key)))return false;
 if(state.learningMemory.suggestions.some(x=>normalizePhrase(x.text)===key))return false;
 state.learningMemory.suggestions.push({id:'suggestion:'+Date.now()+':'+Math.random().toString(36).slice(2,7),text:value,sourceEventId,status:'suggested'});return true;
}
export function acceptSuggestion(state,id,now=new Date().toISOString()){
 const s=state.learningMemory?.suggestions?.find(x=>x.id===id&&x.status==='suggested');if(!s)return false;
 if(!(state.items||[]).some(x=>normalizePhrase(x.expression||x.target||x.text)===normalizePhrase(s.text))){
  state.items.push({id:'memory:'+Date.now()+':'+Math.random().toString(36).slice(2,7),title:s.text.slice(0,75),expression:s.text,target:s.text,text:s.text,context:'Use this expression in a new context.',hint:'',status:'Saved',streak:0,reviewStep:0,due:null,nextReviewAt:null,createdAt:now,source:'Accepted AI practice suggestion',attempts:[],kind:'expression'});
 }
 s.status='accepted';s.acceptedAt=now;return true;
}
