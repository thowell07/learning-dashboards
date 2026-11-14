// Stop 10. Tools and agents: the loop, the permission lever, the audit log.
import { createAgentStop } from './loop.js';
import { h, esc } from './kit.js';

const TASK = 'Find the termination notice period in the Northgate supply agreement, save a note to the file, and email the note to the deal team.';
const DOC = '[38 pages of contract text enter the context]\n…\n14.2 Either party may terminate this Agreement on ninety (90) days’ written notice to the other party.\n…';
const CALLS = [
  { tool: 'search_files', kind: 'read', tokens: 18, display: 'search_files({"query": "Northgate supply agreement"})', result: { text: '2 files found: Northgate_Supply_Agreement.pdf, Northgate_Side_Letter.pdf', tokens: 28, short: '2 files found', logText: '2 file names' } },
  { tool: 'read_file', kind: 'read', tokens: 16, display: 'read_file({"path": "Northgate_Supply_Agreement.pdf"})', result: { text: DOC, tokens: 2900, short: '38 pages of text', logText: 'the full text, about 2,900 tokens', say: 'The whole document returns as text and joins the context. <b>The context just grew by thousands of tokens.</b>' } },
  { tool: 'write_file', kind: 'act', tokens: 40, display: 'write_file({"path": "notes/northgate-termination.md",\n "text": "Termination: either party, 90 days’ written notice (clause 14.2)."})', result: { text: 'Saved notes/northgate-termination.md', tokens: 12, short: 'saved', logText: 'a confirmation' } },
  { tool: 'send_email', kind: 'act', tokens: 48, display: 'send_email({"to": "deal-team@northgate-project.example",\n "subject": "Northgate: termination notice period",\n "body": "Either party may terminate on 90 days’ written notice (clause 14.2)."})', result: { text: 'Sent to deal-team@northgate-project.example', tokens: 12, short: 'sent', logText: 'a confirmation' } },
];
const MODES = { read: 'Read only', ask: 'Ask before acting', free: 'Act freely' };
const MODE_SAY = {
  read: '<b>Read only.</b> The harness will refuse write_file and send_email. The model can still ask for them.',
  ask: '<b>Ask before acting.</b> Reading runs straight through. Writing and sending pause until you approve.',
  free: '<b>Act freely.</b> The harness runs every request without a pause. Nothing inside the model changed.',
};

export function createStop10(ctx) {
  let mode = 'ask', a;
  const verdictFor = (call) => (call.kind === 'read' ? 'run' : mode === 'read' ? 'refuse' : mode === 'ask' ? 'ask' : 'run');
  const segIn = {};
  const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Permission setting' }, Object.entries(MODES).map(([k, label]) => { segIn[k] = h('input', { type: 'radio', name: 's10-mode', value: k, checked: k === mode, onchange: () => setMode(k) }); return h('label', {}, segIn[k], h('span', {}, label)); }));
  const plug = h('input', { type: 'checkbox', checked: true, onchange: (e) => setHarness(e.target.checked) });
  function setMode(k, quiet) { mode = k; segIn[k].checked = true; a.S3.setLever({ read: 0, ask: 1, free: 2 }[k]); a.renderStrip(); if (!quiet) a.say(MODE_SAY[k]); }
  function setHarness(on) { plug.checked = on; a.setHarness(on); a.say(on ? '<b>Harness plugged in.</b> The model\'s requests have a reader again.' : '<b>Harness unplugged.</b> Press Next turn and watch what the model can do alone.'); a.renderStrip(); }

  const view = createAgentStop(ctx, {
    n: 10, lever: true, window: 6000, auditFloat: true, tz: 2.0,
    cap: 'Stop 10 · On the ring, beside the tower',
    simlabel: [['Scripted', 'The task, the requests, the tool results. No model runs.'], ['Real', 'The loop, where permissions sit, your approvals.'], ['Simplified', 'Token counts are illustrative.']],
    task: TASK, taskNote: 'Northgate, its files, and every address here are invented.',
    system: 'You are an assistant for a contracts team. Use the tools you are given.', systemTokens: 40, taskTokens: 34,
    tools: [
      { id: 'search_files', kind: 'read', icon: 'search', note: 'Finds files by name' },
      { id: 'read_file', kind: 'read', icon: 'read', note: 'Returns a file’s text' },
      { id: 'write_file', kind: 'act', icon: 'write', note: 'Saves a file' },
      { id: 'send_email', kind: 'act', icon: 'mail', note: 'Sends a message' },
    ],
    script(state) {
      if (state.turn < 4) return { call: CALLS[state.turn], result: CALLS[state.turn].result };
      const w = state.flags.write_file === 'ran', s = state.flags.send_email === 'ran';
      const text = `The notice period is 90 days’ written notice by either party (clause 14.2). ${w ? 'I saved the note.' : 'I could not save the note.'} ${s ? 'I emailed the deal team.' : 'I could not send the email.'}${w && s ? '' : ' The harness did not run those steps, so they are left for you.'}`;
      return { final: { text, tokens: 55 } };
    },
    decide: (state, call) => verdictFor(call),
    refuseText: () => 'The harness is set to read only.',
    refuseSay: 'The setting lives in the harness. The model asked, and the answer was no.',
    plan(state) {
      const rows = CALLS.map((cl, i) => {
        if (i < state.turn) { const f = state.flags[cl.tool]; return { label: cl.tool, status: f === 'ran' ? 'runs' : 'refused', text: f === 'ran' ? 'ran' : f === 'denied' ? 'you said no' : 'refused' }; }
        if (!a || !a.isHarnessOn()) return { label: cl.tool, status: 'refused', text: 'no harness' };
        const v = verdictFor(cl); return { label: cl.tool, status: v === 'run' ? 'runs' : v === 'ask' ? 'asks' : 'refused', text: v === 'run' ? 'runs' : v === 'ask' ? 'asks you' : 'refused' };
      });
      rows.push({ label: 'final answer', status: 'ends', text: state.done ? 'delivered' : 'ends the loop' });
      return rows;
    },
    deck: () => [h('div', { class: 'grp col' }, h('span', { class: 'cap' }, 'Permissions live in the harness'), seg), h('label', { class: 'switch' }, plug, h('i'), 'Harness plugged in')],
    onFinish(state, { say }) {
      const ran = ['search_files', 'read_file', 'write_file', 'send_email'].filter((t) => state.flags[t] === 'ran').length;
      say(`<b>${state.calls} model calls. ${ran} tool runs.</b> The model wrote text each time. The harness did everything else.`);
    },
  });
  a = view.api;
  a.reset(); setMode('ask', true);

  view.demos = {
    unplug: () => a.guard(async () => { a.reset(); setHarness(false); await a.step(); }),
    passes: () => a.guard(async () => {
      if (!a.isHarnessOn()) setHarness(true);
      if (a.state.done) a.reset();
      const keep = mode; setMode('free', true); a.say('Running the whole task with no pauses. Count the model calls.');
      await a.runAll(); if (!a.live()) return; setMode(keep, true);
      a.say(`<b>${a.state.calls} separate calls to the same model.</b> Each one read the whole context from the top and wrote one piece of text. The loop, the tools, and the memory sat outside it.`);
    }),
  };
  const idle = async () => { while (a.state.busy && a.live()) await new Promise((r) => setTimeout(r, 80)); };
  const beat = (fn) => async () => { await idle(); return a.guard(fn); };
  view.beats = [
    { title: 'A sealed box that writes text', note: 'The model has one slot in and one slot out. Everything else on the table is ordinary software: the harness, the gate, the tools, the audit tape.', run: beat(async () => { if (!a.isHarnessOn()) setHarness(true); setMode('ask', true); a.reset(); }) },
    { title: 'Turn one: the model asks', note: 'The harness feeds the whole context into the model. The model answers with a request written as text, and the harness decides what to do with it.', run: beat(async () => { if (!a.isHarnessOn()) setHarness(true); if (a.state.turn !== 0 || a.state.done) a.reset(); await a.step(); }) },
    { title: 'The context grows', note: 'The file comes back as text and lands on the context stack. Every later call re-reads all of it.', run: beat(async () => { if (!a.isHarnessOn()) setHarness(true); if (a.state.turn > 1 || a.state.done) a.reset(); while (a.live() && a.state.turn < 2 && !a.state.stalled) await a.step(); }) },
    { title: 'The harness asks you', note: 'Writing a file changes something, so the harness pauses. Approve or deny it. The model waits either way, because the decision was never its to make.', run: beat(async () => { if (!a.isHarnessOn()) setHarness(true); setMode('ask', true); if (a.state.turn > 2 || a.state.done) a.reset(); while (a.live() && a.state.turn < 3 && !a.state.stalled) await a.step(); }) },
    { title: 'Read only: same model, new setting', note: 'The lever moves on the harness. The model still asks to write and to send, and the harness now says no.', run: beat(async () => { if (!a.isHarnessOn()) setHarness(true); a.reset(); setMode('read', true); await a.runAll(); }) },
    { title: 'Unplug the harness', note: 'The model still writes its request. With nothing to read it, the request is a slip of paper on the table.', run: async () => { await idle(); return view.demos.unplug(); } },
  ];
  view.textAlt = () => {
    const st = a.state, plan = view.planNow();
    return `<p>The model is a sealed box with one slot in and one slot out. It only produces text. Next to it stands the harness, an ordinary program with a three-position permission lever. Beyond a gate stand four tools: search_files and read_file read, write_file and send_email act. A stack of slabs, the context, sits in front of the model inside a fixed frame.</p>
    <p>Each turn the harness feeds the whole context stack into the model. The model writes a request as text. The harness reads it, checks the lever, and either runs the tool, refuses, or pauses to ask you. The result returns as text and lands on the context stack, which grows every turn. When the model answers with no tool request, the loop ends. Every step is written to an audit log by the harness.</p>
    <h3>Task (invented)</h3><p>${esc(TASK)}</p>
    <h3>The turns under the current setting: ${esc(MODES[mode])}${a.isHarnessOn() ? '' : ', harness unplugged'}</h3>
    <table><tr><th>Turn</th><th>Model asks for</th><th>Harness</th></tr>${plan.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.label)}</td><td>${esc(p.text)}</td></tr>`).join('')}</table>
    <h3>Context now (${st.items.reduce((x, y) => x + y.tokens, 0).toLocaleString()} illustrative tokens)</h3><ol>${st.items.map((it) => `<li><b>${esc(a.ORIGIN[it.origin].label)}:</b> ${esc(it.text)}</li>`).join('')}</ol>
    <h3>Audit log</h3><ol>${st.log.map((l) => `<li>${esc(l.who)} ${esc(l.what)}</li>`).join('')}</ol>
    <p>Scripted: the task, the requests, and the tool results. Real: the loop, the place where permissions sit, and your approvals.</p>`;
  };
  view.planNow = () => {
    const rows = CALLS.map((cl, i) => { if (i < a.state.turn) { const f = a.state.flags[cl.tool]; return { label: cl.tool, text: f === 'ran' ? 'ran' : f === 'denied' ? 'denied by you' : 'refused' }; } if (!a.isHarnessOn()) return { label: cl.tool, text: 'nothing happens, no harness' }; const v = verdictFor(cl); return { label: cl.tool, text: v === 'run' ? 'runs it' : v === 'ask' ? 'pauses and asks you' : 'refuses' }; });
    rows.push({ label: 'final answer, no tool request', text: 'returns it to you and stops' }); return rows;
  };
  return view;
}
