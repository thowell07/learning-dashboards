// All copy for the 14 stops. Flagship stops (4, 10, 11, 12) carry a full brief.

export const LAYERS = [
  { id: 1, name: 'Inside the model', place: 'The tower', where: 'The tower at the center. The prompt climbs it once for every token of the answer.' },
  { id: 2, name: 'How the model was made', place: 'The foundry', where: 'The foundry outside the wall. Its work ended before your prompt arrived, and one sealed conduit carries the finished weights to the tower.' },
  { id: 3, name: 'The system around the model', place: 'The ring', where: 'The ring platform around the tower. Ordinary software that feeds the model and acts on what it writes.' },
  { id: 4, name: 'Failure and control', place: 'The wall', where: 'The outer wall. A gate, a gauge, and a breach.' },
];

export const STOPS = [
  { n: 1, layer: 1, title: 'Tokens', claim: 'Text is cut into pieces called tokens, and each piece becomes a number.', why: 'Context limits and prices are counted in tokens, and "input" in a contract means the tokens sent to the model.' },
  { n: 2, layer: 1, title: 'Embeddings', claim: 'Meaning is stored as a position in a space with many dimensions.', why: 'A vector store holds derived copies of documents, so retention, deletion, and privilege questions follow them there.' },
  { n: 3, layer: 1, title: 'Attention', claim: 'Each token weighs the tokens before it to build its meaning in context.', why: 'Long documents can lose the middle, and the model has no step that looks facts up.' },
  { n: 4, layer: 1, title: 'Prediction and sampling', short: 'Prediction', flagship: true, claim: 'The model scores every possible next token, one token is drawn from those scores, and the draw repeats until the answer is done.', why: 'Hallucination, reproducibility, and consistency claims all trace back to this draw.' },
  { n: 5, layer: 2, title: 'Training', claim: 'Billions of numbers called weights are adjusted, a little at a time, to reduce prediction error.', why: 'Questions of training data provenance, copyright, and memorization all start here.' },
  { n: 6, layer: 2, title: 'Three levers', claim: 'Weights, the system prompt, and the context are three separate controls over what a model does.', why: 'The difference defines what "we don\'t train on your data" promises and what it leaves open.' },
  { n: 7, layer: 2, title: 'Model lifecycle', short: 'Lifecycle', claim: 'Models ship as fixed versions, each with a knowledge cutoff and a retirement date.', why: 'A version change calls for change management, revalidation, and a watch for drift.' },
  { n: 8, layer: 3, title: 'Context window', claim: 'The model works from a fixed-size working memory that holds everything it can see.', why: 'It explains what "memory" features persist and where they are stored.' },
  { n: 9, layer: 3, title: 'Retrieval (RAG)', short: 'Retrieval', claim: 'Documents are searched and the best passages are placed into the context before the model answers.', why: 'Grounding lowers error rates and guarantees nothing.' },
  { n: 10, layer: 3, title: 'Tools and agents', flagship: true, claim: 'A model only writes text. A separate program called the harness reads that text, runs the tools, and feeds the results back in a loop.', why: 'Authority, autonomous action, review points, and audit trails all live in the harness.' },
  { n: 11, layer: 3, title: 'Data flow map', short: 'Data flow', flagship: true, claim: 'A prompt and its attachment pass through several systems, and each system may keep a copy under its own rules.', why: 'Vendor terms, retention, subprocessors, privilege, and cross-border transfer attach to each copy.' },
  { n: 12, layer: 4, title: 'Failure modes', flagship: true, claim: 'An agent takes in everything it reads as text in one context, so a document from an outside party can carry instructions.', why: 'Third-party content becomes an attack surface once an agent can read it.' },
  { n: 13, layer: 4, title: 'Evaluation', claim: 'Quality is measured on test sets, and a headline number can mislead.', why: 'Vendor diligence depends on reading testing claims critically.' },
  { n: 14, layer: 4, title: 'Guardrails and oversight', short: 'Guardrails', claim: 'Filters, logs, and human review surround the model, and explanations of its reasoning have limits.', why: 'Auditability and accountability depend on these controls.' },
];
export const stopByN = (n) => STOPS.find((s) => s.n === Number(n));
export const FLAGSHIPS = [4, 10, 11, 12];

export const BRIEFS = {
  4: {
    define: 'A token is a piece of text, often a word or part of a word. Temperature is a setting that sharpens or flattens the scores before the draw.',
    misconceptions: [
      { wrong: 'It looks the answer up.', right: 'Each token comes from the same two moves. Score the candidates, then draw one. A model on its own has no step that opens a database, a case reporter, or the web. A product can add a search step around the model (stop 9). The model\'s own step stays the same.', demo: 'lookup', demoLabel: 'Search the run for a lookup' },
      { wrong: 'Temperature zero means accurate.', right: 'At temperature zero the model takes the top-scoring token every time. The output becomes repeatable, or very nearly so on a hosted service, where hardware and serving details can still shift an answer. Whether it is true is unchanged.', demo: 'zero', demoLabel: 'Run it three times at zero' },
      { wrong: 'It knows when it does not know.', right: 'An admission of doubt is one more candidate in the same draw. It appears when it scores well as text. No separate step checks the answer first.', demo: 'doubt', demoLabel: 'Show the doubt candidate' },
    ],
    legal: 'Fluent output is evidence of fluency. A citation, a quotation, or a figure produced by a model is unverified until a person or a separate system checks it against a source. Repeatable output supports a consistency claim and says nothing about accuracy. Responsibility for a filing or an advice note stays with the person who signs it, and courts have sanctioned lawyers who filed citations a model invented.',
    ask: [
      'What temperature and sampling settings does this product use, and can we fix them and log them?',
      'When the system states a fact or a citation, which step checked it against a source, and can I see that source?',
      'If we run the same input twice, how often does the answer change, and how did you measure that?',
    ],
    say: 'The model writes one piece of a word at a time by drawing from a list of likely next pieces, so the same question can come back with different answers. Turning the randomness down makes it consistent, and consistent is a different property from correct.',
    checks: [
      { q: 'You set temperature to zero and get the same citation five times. What have you learned about the citation?', a: 'That the model\'s top-scoring continuation is stable. You have learned nothing about whether the case exists. Verification needs a source outside the model.' },
      { q: 'Where in the prediction step does the model consult a legal database?', a: 'Nowhere. The step scores candidate tokens and draws one. Retrieval is a separate system that some products add around the model.' },
      { q: 'Why can two runs of one prompt disagree?', a: 'Each token is drawn at random in proportion to its probability. One different draw early on changes the text that every later step builds on.' },
    ],
  },
  10: {
    define: 'A tool is a function the harness can run, such as searching files or sending an email. An agent is a model, a harness, and tools running in a loop.',
    misconceptions: [
      { wrong: 'The model does things itself.', right: 'The model\'s whole output is text. A tool call is a short structured message that asks for an action. The harness reads it and decides whether to carry it out.', demo: 'unplug', demoLabel: 'Unplug the harness' },
      { wrong: 'An agent is a smarter model.', right: 'An agent is a model placed in a loop with tools. The same model can sit behind a chat window or inside an agent. The harness, the tools, and the permissions make the difference.', demo: 'passes', demoLabel: 'Count the model calls' },
    ],
    legal: 'Authority to act comes from the configuration of the harness. It decides which tools are connected, which actions need approval, and whose credentials the tools use. An organization that deploys an agent has chosen those settings, so questions of authorization and responsibility point at the deployment as well as the model. The harness can record every proposal, approval, and result, which makes the audit log the natural record of what the agent did and who allowed it.',
    ask: [
      'Which tools can this agent call, and which of them change something outside the conversation?',
      'Which actions pause for a person\'s approval, and who can change that setting?',
      'What does the audit log record for each step, how long is it kept, and can we export it?',
    ],
    say: 'An agent is a language model in a loop. It asks for an action in text, ordinary software carries it out, and the result goes back in for the next round. The permissions sit in that software, so what the agent can do is a configuration choice we can inspect.',
    checks: [
      { q: 'The agent sent an email. Which component sent it?', a: 'The harness, using an email tool and the credentials it was configured with. The model produced the text of the request.' },
      { q: 'You switch the agent to read only. What changes inside the model?', a: 'Nothing. The model can still ask for any action. The harness now refuses the ones that write or send.' },
      { q: 'Why does the context grow on every turn?', a: 'Each proposal and each tool result is appended to the context so the next model call can see it. The model keeps no state between calls, so the context is its working memory.' },
    ],
  },
  11: {
    define: 'A retrieval store holds pieces of your documents so they can be searched. A subprocessor is a third party that handles data on a vendor\'s behalf.',
    misconceptions: [
      { wrong: 'The data goes to the model and stays there.', right: 'The model endpoint holds the prompt in memory while it computes, and its weights do not change. The lasting copies sit in the systems around it: conversation history, the retrieval store, and the logs.', demo: 'stayed', demoLabel: 'Send a prompt and show what stayed' },
      { wrong: 'No training on our data means no storage of our data.', right: 'Training use and retention are separate promises. A provider can exclude your data from training and still keep request logs for a period, for example to monitor abuse. Read each term on its own.', demo: 'notrain', demoLabel: 'Cut training, keep the logs' },
    ],
    legal: 'Each resting copy raises its own questions of confidentiality, retention, deletion, and access. A control over one system, such as a no-training term with the model provider, leaves the other copies governed by other terms or by the organization\'s own policies. A deployment choice moves systems across the trust boundary and changes which parties count as vendors or subprocessors. Data rests where the servers are, so location can raise cross-border transfer questions. Placing confidential material in a third party\'s system can raise confidentiality and privilege questions that turn on the terms and the facts.',
    ask: [
      'List every system that stores our prompts, files, or outputs, with the retention period for each.',
      'Which subprocessors handle our data, in which regions, and under which terms?',
      'If we delete a document, which derived copies remain, including embeddings, caches, logs, and backups?',
    ],
    say: 'Our prompt passes through the model and leaves copies in the app\'s history, the search index, and the logs. Each copy is governed by a different contract term or by our own policy.',
    checks: [
      { q: 'A vendor says it never trains on customer data. What have you learned about retention?', a: 'Nothing yet. Training use and retention are separate terms. Ask what is logged, for how long, and who can read it.' },
      { q: 'You move from a consumer app to a model in your own cloud account. Which copies disappear?', a: 'None by default. The history, the retrieval store, and the logs still exist. They now sit in your account, under your retention settings and your cloud provider\'s terms.' },
      { q: 'What is kept in a retrieval store?', a: 'Chunks of your documents and numeric representations of them called embeddings. Both are derived copies, so deletion and retention rules need to reach them.' },
    ],
  },
  12: {
    define: 'Prompt injection is text, planted in content the model reads, that tries to redirect what the model does. The context is everything the model can see on a given call.',
    misconceptions: [
      { wrong: 'The model can tell my instructions from a document\'s text.', right: 'Both arrive as tokens in one context. Role markers label who said what, and the model is trained to weigh them. That training lowers the odds that it obeys a document. The odds stay above zero.', demo: 'modelview', demoLabel: 'See it as the model sees it' },
      { wrong: 'Enough defenses make an agent safe to connect to anything.', right: 'Each defense closes one path. In this simulator the tilted summary still reaches the user with every defense switched on.', demo: 'alldef', demoLabel: 'Turn every defense on and run' },
    ],
    legal: 'Any content an agent reads can act as an instruction, so email, shared documents, web pages, and counterparty files become an attack surface once an agent can read them. Connecting an agent to a data source or a tool is a security decision with the same weight as granting a person access. Layered controls reduce the likelihood and the impact of an attack, and the risk that remains needs an owner. The audit log is the evidence of what the agent read and what it did.',
    ask: [
      'Which outside content can this agent read, and which tools can it use in the same session?',
      'What stops text inside a document from triggering a send, a write, or a payment, and how was that tested?',
      'When an injection attempt is caught, or succeeds, what do we see in the logs?',
    ],
    say: 'Anything the agent reads lands in the same stream as our own instructions, so a document can try to give it orders. We limit what it can do, require approval for anything that leaves the building, and assume some attempts will still get through.',
    checks: [
      { q: 'Why is a hidden line in a vendor\'s letter dangerous to an agent and harmless to a spell checker?', a: 'The agent\'s model reads the line as part of its context and can act on it through tools. A spell checker has no tools and takes no instructions from the text.' },
      { q: 'The send tool is blocked. What can the hidden instruction still affect?', a: 'Anything the agent is still allowed to do, including the words of its answer. In the simulator the summary stays tilted.' },
      { q: 'Who writes the reason shown on an approval request?', a: 'The model that read the document. The harness displays the request, and an injected instruction can shape the reason a person sees.' },
    ],
  },
};

export const FAILURE_CARDS = [
  { id: 'hallucination', title: 'Hallucination', claim: 'A fluent continuation that no step checked against a source.', legal: 'Unverified output can enter a filing, an advice note, or a contract. Responsibility stays with the person who relies on it.', link: { href: '#/stop/4', text: 'See the mechanism in stop 4' } },
  { id: 'leakage', title: 'Data leakage', claim: 'Text placed in a context, a memory feature, or a training set can resurface in a later output.', legal: 'Confidential or personal material can reach a person who was never entitled to see it. Access controls on retrieval and memory matter as much as the model terms.' },
  { id: 'bias', title: 'Bias', claim: 'A model reproduces the patterns in its training text, including the skewed ones.', legal: 'Skewed output in hiring, lending, or screening can produce discriminatory outcomes. Testing across groups before deployment is the usual control.' },
  { id: 'sycophancy', title: 'Sycophancy', claim: 'A model tends to lean toward the view its user signals, including a mistaken one.', legal: 'A leading question can produce confirming analysis. Keep the question neutral and ask for the strongest opposing case when the answer matters.' },
];
