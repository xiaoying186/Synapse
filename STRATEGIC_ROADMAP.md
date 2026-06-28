# Strategic Roadmap Notes

This note records long-range product direction for Synapse. These ideas should
guide the plan, but they should not interrupt the current incremental
implementation rhythm.

## Naming Direction

- The lower knowledge and memory core should be described as `Zhishu`
  (智枢), with Intelligence Hub kept as the English explanatory name.
- The current direction and candidate module is the seed of the Task Center.
- The extension function layer should gradually evolve into the Arsenal.

The current implementation names can remain simple for now. Renaming should be
done deliberately after the underlying models stabilize.

## 1. Zhishu / Intelligence Hub

Zhishu is not only a knowledge base. It should become the
project's structured intelligence core.

### Knowledge Library

The knowledge library stores stable external or reusable knowledge, including:

- forensic identification laws and regulations
- industry standards and specifications
- document format templates
- code development rules
- trading-strategy development and coding rules
- Windows, computer maintenance, and common fault knowledge
- common AI project maintenance knowledge
- writing skills and reusable writing methods

### Memory Library

The memory library stores internal and personalized state, including:

- project self-portrait
- user profile
- rule memories at different levels
- session memory
- project progress memory
- decision traces and accepted audit results

### Reusable Skill Library

The reusable skill library is an instinct layer. Reusable workflows can be
stored as:

- pure skill procedures
- Python scripts or scripts in other languages
- callable external tools

Zhishu should store script calling rules, interfaces, constraints,
and usage policies. Script bodies should live in the extension function layer.

### Integration Guidance

- Keep the existing L0/L1/L2 model as the first implementation layer.
- Add type and gate metadata so items can later be classified into knowledge,
  memory, and skill-library areas.
- Keep durable Zhishu writes audit-gated.
- Avoid allowing raw model output to directly mutate Zhishu.

## 2. Task Center

The current task direction and candidate module should evolve into the full
Task Center.

### Positioning

The Task Center is the output and scheduling layer driven by Zhishu. It should support:

- deeply personalized opportunity mining
- scheduled task outputs
- self-growth entry points for Zhishu
- output classification and admission into memory or knowledge after rules
  confirm that the content is safe and useful

### Future Settings

Each direction or task should eventually support:

- automatic template selection by content type
- mining frequency: daily, weekly, or custom
- whether to use online information
- information aggregation through a dedicated aggregation module
- Zhishu association and reflection
- push interfaces for multi-device sync, such as WeChat, Feishu, or email

### Integration Guidance

- Keep current `TaskDirection` and `TaskCandidate` as the seed model.
- Avoid reintroducing a separate opportunity-only model boundary.
- The current Task Direction model already records schedule frequency, online
  preference, output-template preference, and preview-only push preferences as
  metadata.
- Add scheduling only after manual mining and review flows are reliable.
- Add online information only through the information aggregation module.

## 3. Arsenal

The Arsenal is the extension function module. It should support customizable
tool lists and multiple classes of local or external tools.

### Agent Submodule

The agent submodule should:

- scan locally installed callable agents
- connect stably to tools such as Claude Code CLI, Codex CLI, Hermes CLI, and
  Gemini CLI
- support native mode, where Synapse acts mainly as a front-end shell and keeps
  each agent's native ability
- support deep mode, where agents are constrained by Zhishu and
  Synapse runtime rules
- configure separate ingestion rules for native and deep mode outputs to avoid
  pollution
- include a local programming agent strongly linked to Zhishu,
  skills, and sub-agent calling rules
- support one-click team construction
- support linear workflow teams and round-table teams
- optimize team construction so token use, tool use, and process flow do not
  become too heavy or stall
- support scheduled runs and multi-device result pushes

### Computer Assistant Submodule

The computer assistant should combine open-source references, Windows system
knowledge, and Zhishu maintenance knowledge.

Priority capabilities:

- deep but safe C drive cleanup
- memory usage cleanup
- common computer fault repair
- common agent installation and maintenance troubleshooting

### Python Tools Submodule

Python tools should provide scriptable local workflows. Zhishu
should store metadata, invocation policies, and interfaces; scripts should live
in the Arsenal.

### Local Application Calling Submodule

This submodule should use local app state where appropriate, including existing
login state, and allow users to configure an allowlist of callable applications.

### Current Seed Implementation

- The backend has a preview-only Arsenal registry model.
- It records tool category, native/deep mode, allowlist state, risk, and output
  ingestion policy.
- It performs PATH discovery previews for known command names, including
  Windows command shims, but does not execute external tools yet.

## 4. Permission and Guardrail System

Any flow that calls tools or modifies, deletes, moves, or writes content should
automatically invoke permission-tier settings.

Guardrail requirements:

- local Zhishu bottom-layer guardrails must be mandatory
- untrusted outputs cannot directly write durable memory or knowledge
- tool calls should be classified by risk
- destructive or high-risk tool calls should require explicit review
- native agent outputs and deep-mode outputs should have separate ingestion
  gates

This should extend the current audit and execution preview model, not bypass it.

## 5. Experience Reuse and Error Avoidance

Synapse should add a success experience reuse and error avoidance mechanism.
This can be inspired by Hermes-like behavior, but it must have stricter
multi-level admission rules.

Target artifacts:

- successful experience records
- reusable positive patterns
- error behavior blacklist
- tool-specific caution rules
- context-specific allow and deny patterns

Admission rules:

- do not store every successful or failed path
- require deduplication, confidence scoring, and scope assignment
- require review before durable admission
- keep failed-path records concise to avoid bloating Zhishu
- separate user preference, project rule, and tool behavior memories

Current seed implementation:

- Users can manually record success, avoid, allow, and deny experience records.
- These records are stored as reviewed L1 MemoryItems with explicit admission
  rules.
- Plan previews can surface matched accepted and reviewed experience records as
  context references so the user sees relevant reuse or avoidance hints before
  review.
- The system does not automatically harvest every success or failure yet.

## 6. Built-In Tool Modules

Some built-in tools may live inside the Arsenal but remain hidden from the
ordinary extension list.

### Information Aggregation Module

This module is the default online information channel for the project.

Requirements:

- reference tools similar in spirit to agent-reach and agent information
  retrieval systems
- classify information by type
- perform multi-source cross-checking when needed
- verify critical data authenticity and freshness
- defend against prompt injection and source pollution
- keep online information separate from durable Zhishu writes until it
  passes admission gates

Current seed implementation:

- The backend has an offline aggregation preview model.
- It classifies freshness needs, cross-check requirements, source quarantine,
  prompt-injection defense, and durable Zhishu admission gates.
- It does not perform network retrieval yet.

### Browser Automation Module

This module should be inspired by browser automation tools such as Playwright and
Clockwork-like flows.

Requirements:

- browser task execution
- controlled local app and web interactions
- traceable outputs
- permission-tier integration for write, submit, purchase, delete, or account
  actions
- clear separation between observation, proposal, and execution

## Development Rhythm

Do not implement these modules all at once.

Recommended rhythm:

1. Stabilize current memory, direction, and candidate models.
2. Add review and promotion for Task Center candidates.
3. Split the storage and command boundaries before the store and Tauri command
   layer become too broad.
4. Add Zhishu classification metadata.
5. Add permission-tier policy around existing audit and execution gates before
   any real tool, browser, agent, local app, script, cleanup, write, move, or
   delete workflow.
6. Add Task Center scheduling previews before real scheduling.
7. Add the Arsenal only after the guardrail model is stable.
8. Add information aggregation and browser automation through isolated, reviewed
   channels.

See `ARCHITECTURE_REVIEW.md` for the current difficulty and timing assessment.
