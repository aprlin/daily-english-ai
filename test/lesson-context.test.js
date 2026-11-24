import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import * as memory from '../public/learning-memory.js';
import * as core from '../public/learning-core.js';
function app(fail=false,response=null){
 const store=new Map(),requests=[];
 const sandbox={...memory,...core,coreExact:core.exact,coreAdvanceReview:core.advanceReview,structuredClone,console,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},alert:()=>{},fetch:async(url,options)=>{requests.push(JSON.parse(options.body));return {ok:!fail,json:async()=>fail?{error:'offline'}:response||{naturalness:'Natural',summary:'Fits this situation.',patterns:[]}}}};
 const c=vm.createContext(sandbox);
 let source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
 source=source.slice(0,source.lastIndexOf('\nrender();'));
 vm.runInContext(source+'\nrender=()=>{};',c);
 return {run:code=>vm.runInContext(code,c),requests,store};
}
test('every lesson uses distinct contexts without displaying its study answer',()=>{
 const a=app();
 for(let i=0;i<5;i++){a.run(`openLesson(${i})`);assert.equal(a.run('new Set(lessonContexts[newLessons[ui.lessonIndex].id]).size'),3);assert.notEqual(a.run('lessonScenario()'),a.run('newLessons[ui.lessonIndex].context'));assert.equal(a.run('learn().includes(newLessons[ui.lessonIndex].example)'),false)}
});
test('switching contexts preserves independent drafts and clears old feedback',()=>{
 const a=app();a.run("openLesson(2);updateLessonDraft('First draft');ui.ai={summary:'old'};nextLessonContext();updateLessonDraft('Second draft');");
 assert.equal(a.run('ui.ai'),null);assert.equal(a.run("state.drafts['lesson-context:n3:0']"),'First draft');
 a.run('nextLessonContext();nextLessonContext()');assert.equal(a.run('state.drafts[lessonDraftKey()]'),'First draft');
});
test('new-context verification saves answer, requests contextual AI assessment and never awards exact recall',async()=>{
 const a=app();a.run("openLesson(2);updateLessonDraft('Could we squeeze in a call before my next meeting?')");await a.run('submitLesson()');
 assert.match(a.requests[0].context,/colleague needs ten minutes/);assert.match(a.requests[0].target,/No fixed target/);
 assert.equal(a.run("getItem('n3').streak"),0);assert.equal(a.run("getItem('n3').status"),'Learning');assert.equal(a.run("getItem('n3').attempts.at(-1).exact"),null);
 assert.equal(a.run('state.lessonPracticeHistory.length'),1);assert.equal(a.run('state.learningMemory.events.at(-1).feedbackStatus'),'received');
 assert.match(a.run('state.drafts[lessonDraftKey()]'),/squeeze in/);
 a.run('nextLessonContext();updateLessonDraft("I hope to squeeze in a museum visit before the train.")');await a.run('submitLesson()');
 assert.match(a.requests[1].context,/museum visit/);assert.equal(a.run('state.lessonPracticeHistory.length'),2);
});
test('AI failure retains history and existing mastery; pending feedback locks context',async()=>{
 const a=app(true);a.run("openLesson(2);state.items.push({...newLessons[2],status:'Mastered',streak:2,attempts:[]});ui.busy=true;nextLessonContext()");assert.equal(a.run('lessonContextIndex()'),0);
 a.run("ui.busy=false;ui.lessonExample=true;updateLessonDraft('Could we squeeze in a call?')");await a.run('submitLesson()');
 assert.equal(a.run("getItem('n3').status"),'Mastered');assert.equal(a.run("getItem('n3').streak"),2);assert.equal(a.run('state.learningMemory.events.at(-1).feedbackStatus'),'unavailable');assert.equal(a.run('state.lessonPracticeHistory.at(-1).mode'),'guided');
 assert.equal(a.run('state.lessonPracticeHistory.length'),1);assert.match(a.run('ui.ai.error'),/offline/);
});
test('paragraph lessons hide English cues, keep submitted writing and carry tutor context across checks',async()=>{
 const a=app();a.run("startParagraphSession('new');updateLessonDraft('legacy');state.drafts[guidedDraftKey()]=\"I can squeeze in a visit. Let's head out at noon. Are we on the same page?\"");
 assert.equal(a.run('guidedSelected().chunks.length'),3);assert.equal(a.run('guidedPractice().includes("squeeze in")'),true); // own draft remains visible
 assert.equal(a.run('guidedPractice().includes("Useful expressions")'),false);
 await a.run('saveGuided()');assert.match(a.run('state.drafts[guidedDraftKey()]'),/head out/);assert.equal(a.run('state.paragraphPracticeHistory.length'),1);
 const original=a.run('guidedDraftKey()');a.run('nextGuided()');assert.notEqual(a.run('guidedDraftKey()'),original);assert.equal(a.run('state.drafts[guidedDraftKey()]'),undefined);
 a.run("state.drafts[guidedDraftKey()]='I can meet after lunch.'");await a.run('saveGuided()');assert.equal(a.requests[1].learningContext.recentAttempts.length,1);assert.match(a.requests[1].context,/酒店/);
 a.run('nextGuided();nextGuided()');assert.equal(a.run('state.drafts[guidedDraftKey()]'),'I can meet after lunch.');
});
test('targeted tutor follow-up preserves expression group, prompt and distinct answer draft',()=>{
 const a=app();a.run("startParagraphSession('new');ui.ai={practicePassed:false,practiceFocus:'时间表达',coachingZh:'明确活动发生的时间',followUpQuestionZh:'你会在什么时候出发？',nextContextZh:'你只能午休时和朋友见面。请说明出发时间、活动安排以及如何确认计划。'}");assert.match(a.run('tutorBlock()'),/Keep practicing/);
 a.run('tutorFollowup()');assert.match(a.run('guidedDraftKey()'),/tutor-/);assert.match(a.run('state.guidedTransfer.zh'),/午休/);assert.equal(a.run('guidedSelected().id'),'new-time');
 a.run('nextGuided()');assert.equal(a.run('state.guidedTransfer.index'),0);
});
test('backup merge restores paragraph history and learning memory idempotently',()=>{
 const original={version:2,items:[],paragraphPracticeHistory:[{id:'p1',answer:'saved'}],lessonPracticeHistory:[{id:'l1'}],learningMemory:{events:[{id:'m1'}],suggestions:[{id:'s1'}]},drafts:{'guided:new-time':'draft'}};
 const merged=core.mergeHistory({items:[]},original);const twice=core.mergeHistory(merged,original);
 assert.equal(twice.paragraphPracticeHistory.length,1);assert.equal(twice.lessonPracticeHistory.length,1);assert.equal(twice.learningMemory.events.length,1);assert.equal(twice.drafts['guided:new-time'],'draft');
});
test('default recall, transfer and paragraph routes all render dialogue without revealing English targets',()=>{
 const a=app();a.run("setActive('i')");const screen=a.run('dialoguePractice()');assert.match(screen,/难得今天不用加班/);assert.match(screen,/你想说/);assert.equal(screen.includes('make the most of'),false);assert.equal(screen.includes('The weather is sunny'),false);assert.equal(screen.includes('Fixed target'),false);
 assert.equal(a.run('pages.practice===pages.guidedPractice && pages.paragraphRecall===pages.practice && pages.masteryRetest===pages.practice && pages.transfer===pages.practice'),true);
 const label=screen.indexOf('你的英文回应');assert.ok(screen.indexOf('id="dialogue-hint"')>label);assert.ok(screen.indexOf('id="dialogue-hint"')<screen.indexOf('id="dialogue-answer"'));
});
test('dialogue checks retain original text, save history, and continue only after successful assessment',async()=>{
 const feedback={practicePassed:true,naturalness:'Natural',coachingZh:'自然地回应了对方。',partnerReplyZh:'好啊，去海边怎么样？',learnerIntentZh:'听起来不错。我们带点吃的，下午就出发吧。',patterns:[]};
 const a=app(false,feedback);a.run("setActive('i');state.drafts[dialogueDraftKey()]=\"Let's make the most of this afternoon. Would you prefer the park or the beach?\"");const key=a.run('dialogueDraftKey()');await a.run('submitDialogue()');
 assert.equal(a.run('state.dialoguePracticeHistory.length'),1);assert.match(a.run(`state.drafts[${JSON.stringify(key)}]`),/most of/);assert.equal(a.run("getItem('i').streak"),0);assert.equal(a.run('dialogueSession().turns[0].feedback.practicePassed'),true);
 const payload=JSON.parse(a.requests[0].context);assert.match(payload.learnerIntendedZh,/天气这么好/);assert.match(a.requests[0].target,/No fixed English target/);
 a.run('continueDialogue()');assert.equal(a.run('dialogueSession().turn'),1);assert.match(a.run('dialogueSession().turns[1].partner'),/海边/);assert.equal(a.run('state.drafts[dialogueDraftKey()]'),undefined);assert.match(a.run(`state.drafts[${JSON.stringify(key)}]`),/most of/);
});
test('failed or unavailable assessment never advances dialogue or loses the attempt',async()=>{
 const a=app(true);a.run("setActive('i');state.drafts[dialogueDraftKey()]='We go outside.'");await a.run('submitDialogue()');a.run('continueDialogue()');assert.equal(a.run('dialogueSession().turn'),0);assert.equal(a.run('state.dialoguePracticeHistory.length'),1);assert.equal(a.run('state.drafts[dialogueDraftKey()]'),'We go outside.');assert.match(a.run('dialogueSession().turns[0].feedback.error'),/offline/);
 a.run('changeDialogueContext()');assert.equal(a.run('dialogueSession().turn'),0);assert.notEqual(a.run('dialogueSession().id'),'item:i:0');
});
test('dialogue session backup restores multi-turn history and drafts without overwriting current sessions',()=>{
 const backup={items:[],dialoguePracticeHistory:[{id:'d1',answer:'hello'}],dialogueSessions:{s1:{turn:1,turns:[{answer:'hello'},{partner:'next'}]}},drafts:{'dialogue:s1:1':'draft'}};
 const merged=core.mergeHistory({items:[]},backup);assert.equal(merged.dialogueSessions.s1.turn,1);assert.equal(merged.dialoguePracticeHistory.length,1);assert.equal(merged.drafts['dialogue:s1:1'],'draft');
 const local=core.mergeHistory({...merged,dialogueSessions:{s1:{turn:2}}},backup);assert.equal(local.dialogueSessions.s1.turn,2);
});
test('interface stays English while dialogue practice retains Chinese prompts',()=>{
 const a=app();assert.equal(/[\u3400-\u9fff]/u.test(a.run('dashboard()')),false);
 a.run("setActive('i')");const screen=a.run('dialoguePractice()');
 assert.match(screen,/Your English/);assert.match(screen,/Independent/);assert.match(screen,/Show hints/);assert.match(screen,/New context/);assert.match(screen,/Next expression group/);
 assert.match(screen,/难得今天不用加班/);assert.match(screen,/天气这么好/);assert.equal(screen.includes('make the most of'),false);
});
test('home has one practice action and features before statistics; free response is removed',()=>{
 const a=app();const home=a.run('dashboard()');assert.equal((home.match(/id="primary-practice"/g)||[]).length,1);assert.equal(home.includes('id="continue"'),false);assert.ok(home.indexOf('id="start-capture"')<home.indexOf('Saved learning material'));
 a.run("setActive('i');state.dialogueFreeResponse=true");assert.equal(a.run('dialoguePractice().includes("Free response")'),false);assert.equal(a.run('dialoguePractice().includes("你想说")'),true);
});
test('continue restores exact conversation source, scene and turn instead of a different expression',()=>{
 const a=app();a.run("startParagraphSession('new');dialogueSession();state.drafts[dialogueDraftKey()]='unfinished';rememberDialogueProgress();setActive('i');resumePractice()");assert.equal(a.run('state.view'),'guidedPractice');assert.equal(a.run('state.guidedSession'),'new');assert.equal(a.run('state.drafts[dialogueDraftKey()]'),'unfinished');assert.match(a.run('dashboard()'),/Continue practice/);
});
test('AI material review does not save anything until selection is confirmed',async()=>{
 const response={summary:'Two corrections.',correctedText:'I have some time. I will follow up tomorrow.',candidates:[{text:'I have some time.',original:'I has time.',explanation:'Use have with I.',context:'Offering help.'},{text:'I will follow up tomorrow.',original:'I follow tomorrow.',explanation:'Use follow up.',context:'A work update.'}]};
 const a=app(false,response);a.run("state.captureDraft={text:'I has time. I follow tomorrow.',context:'A colleague',source:'Work'}");const before=a.run('state.items.length');await a.run('analyzeCapture()');assert.equal(a.run('state.items.length'),before);assert.equal(a.run('state.captureDraft.review.candidates.length'),2);
 a.run('state.captureDraft.review.candidates[1].selected=false;saveCapture()');assert.equal(a.run('state.items.length'),before+1);assert.equal(a.run('state.items.at(-1).target'),'I have some time.');assert.equal(a.run('state.items.at(-1).status'),'Saved');assert.equal(a.run('state.items.at(-1).originalText'),'I has time.');assert.match(a.run('state.captureDraft.text'),/I has/);
 a.run('state.captureDraft.review.candidates[0].selected=true;saveCapture()');assert.equal(a.run('state.items.length'),before+1);
});
test('material review is invalidated by changed input and failure retains raw writing',async()=>{
 const a=app(false,{summary:'ok',correctedText:'I have time.',candidates:[{text:'I have time.',original:'I has time.',explanation:'verb',context:'work'}]});a.run("state.captureDraft={text:'I has time.'}");await a.run('analyzeCapture()');const before=a.run('state.items.length');a.run("state.captureDraft.text='A different sentence';saveCapture()");assert.equal(a.run('state.items.length'),before);
 const b=app(true);b.run("state.captureDraft={text:'Keep my writing.'}");await b.run('analyzeCapture()');assert.equal(b.run('state.captureDraft.text'),'Keep my writing.');assert.match(b.run('state.captureDraft.error'),/offline/);assert.equal(b.run('state.captureDraft.review'),undefined);
});
test('material review keeps one suggestion per original snippet',async()=>{
 const a=app(false,{summary:'review',correctedText:'I have time.',candidates:[{text:'I have time.',original:'I has time.'},{text:'I have availability.',original:'I has time.'}]});a.run("state.captureDraft={text:'I has time.'}");await a.run('analyzeCapture()');assert.equal(a.run('state.captureDraft.review.candidates.length'),1);
});
test('existing dialogue progress can be resumed after upgrading without a saved resume pointer',()=>{
 const a=app();a.run("startParagraphSession('new');dialogueSession().turn=1;dialogueSession().turns.push({partner:'下一句',intent:'想表达的话'});state.drafts[dialogueDraftKey()]='draft from the previous version';delete state.lastPractice;state.view='dashboard'");assert.equal(a.run('hasPracticeToResume()'),true);a.run('resumePractice()');assert.equal(a.run('state.guidedSession'),'new');assert.equal(a.run('dialogueSession().turn'),1);assert.equal(a.run('state.drafts[dialogueDraftKey()]'),'draft from the previous version');
});
