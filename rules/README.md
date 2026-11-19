# Rules guide

This folder holds what Rollfix knows about the law: one YAML file per state with a
wheelchair repair law, a federal file for Medicare, and holiday calendars for counting business
days. The letter templates are in [`../letters/`](../letters/). Everything here is plain text,
licensed [CC BY 4.0](LICENSE.md), so advocates, legal aid groups and other tools can reuse it.

You don't need to write code to add or fix a state. If YAML is new to you, open an issue with
the **Rules correction or new law** form and a maintainer will turn it into a file.

```
rules/
  federal.yaml          Medicare rules that apply in every state
  states/ct.yaml        one file per state, named by its USPS code
  holidays/us-federal.yaml
letters/
  supplier.yaml         the letter to the supplier
  insurer.yaml          the letter to the insurer or Medicaid plan
  agency.yaml           the complaint to a state office
schema/                 JSON Schemas generated from src/lib/engine/schema.ts
```

## Ground rules

1. **Cite the primary source.** Every law links to the statute or the enrolled bill on the
   legislature's own site. News articles and advocacy pages can go in `sources`, not in `url`.
2. **Say exactly what the law says.** Put the statute's own words for each deadline in `quote`,
   and count days the way it does (`calendar` or `business`).
3. **Only encode what is in force, or clearly enacted.** Use `status: enacted` with an
   `effective` date for laws that have passed but haven't started; Rollfix ignores them until
   then. Pending bills can be listed with `status: pending` for context, but never get deadlines.
4. **Update `last_checked`** to the day you compared the file with the source.
5. **Plain language.** Write descriptions for a person who is stuck in bed waiting for a chair,
   not for a lawyer.

## A state file

```yaml
# yaml-language-server: $schema=../../schema/jurisdiction.schema.json
schema_version: 1
id: CT # the USPS code; the file is ct.yaml
name: Connecticut # must match the official state name
last_checked: 2026-11-19
summary: One or two sentences people see first.

laws:
  - id: repair-act # referenced by deadlines and protections below
    title: An Act Concerning Wheelchair Repairs
    bill: SB 1 (2024), Public Act 24-1
    citation: Conn. Gen. Stat. § 00-000
    status: in_force # in_force | enacted | pending | failed
    effective: 2024-10-01
    url: https://www.cga.ct.gov/... # the primary source
    summary: What the law does, in plain language.
    applies_to: [supplier] # supplier | manufacturer | insurer | medicaid | medicare

deadlines:
  - id: assessment
    law: repair-act
    title: Supplier assesses the chair
    who: supplier
    description: Plain-language explanation.
    quote: "The exact words of the statute."
    starts:
      events: [reported] # what starts the clock (see the list below)
      when: first # first | last | all (see below)
      label: you reported the problem # finishes "after …"
    period: { days: 10, count: business } # calendar | business
    pauses: # optional: time that doesn't count
      - from: auth_requested
        until: [auth_approved, auth_denied]
        label: waiting for prior authorization
    met_by: [repaired] # what stops the clock
    met_party: [supplier] # optional: only entries with this party count
    met_label: the repair
    applies_if: { payers: [medicaid] } # optional
    recipients: [supplier, agency] # which letters mention it
    letter: >-
      Under {{law_citation}}, ... by {{due_date}}.{{#if status == "missed"}} That deadline passed
      {{days_late}} ago.{{/if}}

protections: # rules without a deadline, e.g. a right to parts
  - id: parts
    law: repair-act
    title: Parts and manuals available
    description: ...
    recipients: [supplier]
    letter: Under {{law_citation}}, ...

agencies: # where to complain; letters to "the state" pick from these
  - id: ag
    name: Office of the Attorney General, Consumer Protection
    handles: What they handle, in plain language.
    url: https://... # the official complaint page
    phone: (000) 000-0000
    address: |
      Street
      City, ST 00000

holidays:
  extends: [us-federal] # used to count business days
  add: [] # state holidays
  remove: [] # federal holidays the state doesn't observe

sources:
  - label: Where you checked the rules
    url: https://...
```

### Timeline events

These are the things a person can log. Use them in `starts.events` and `met_by`
(`broke`, the day the chair stopped working, can only start a clock):

| Event            | Meaning                                        |
| ---------------- | ---------------------------------------------- |
| `broke`          | The chair stopped working (Day 1)              |
| `reported`       | The person first reported it to the supplier   |
| `call`           | A phone call                                   |
| `message`        | An email, text or portal message               |
| `visit`          | A technician visit or assessment               |
| `no_show`        | A visit or call that didn't happen             |
| `auth_requested` | Sent to the insurer for prior authorization    |
| `auth_approved`  | The insurer approved the repair                |
| `auth_denied`    | The insurer denied it or asked for more        |
| `parts_ordered`  | Parts were ordered                             |
| `parts_arrived`  | Parts reached the supplier                     |
| `loaner`         | A loaner chair was provided                    |
| `letter`         | A letter or complaint was sent                 |
| `impact`         | How the delay affected the person              |
| `repaired`       | The chair works again (also closes the repair) |
| `note`           | Anything else                                  |

### How deadlines are counted

The day the clock starts doesn't count; the last day does. Business days skip weekends and the
holidays in the file's `holidays` calendar.

`starts.when` decides which event starts the clock when there are several:

- `first`: the earliest of the events on the timeline;
- `last`: the latest of the events on the timeline (e.g. "after the assessment, or after the
  insurer approves", whichever came later);
- `all`: only once every event has happened, from the latest.

`pauses` are stretches that don't count, such as Connecticut's "time spent waiting for prior
authorization … or for delivery of necessary parts". A pause runs from its `from` event to the
next `until` event (both days excluded from the count); while a pause is still open, the clock
waits.

A deadline is:

- **not started** until its starting event is on the timeline,
- **running** until the due date, then **due today**, or **paused** while a pause is open,
- **met** when a `met_by` event (or closing the repair) happens by the due date,
- **met late** or **missed** otherwise, with the number of days late.

## Letter templates

Letters use the small template language from
[Tenantkit](https://github.com/lobojoel2003/Tenantkit). It can only produce text:

| Write                                  | To                                           |
| -------------------------------------- | -------------------------------------------- |
| `{{supplier_name}}`                    | insert a value                               |
| `{{#if is_stranded}} … {{/if}}`        | show text only when something is true or set |
| `{{#if status == "missed"}} … {{/if}}` | compare a value                              |
| `{{#unless has_loaner}} … {{/unless}}` | the opposite of `#if`                        |
| `{{! a note for other volunteers }}`   | a comment, never shown                       |

A single line break is a space; a blank line starts a new paragraph. A line holding only a block
tag disappears, so conditional paragraphs leave no gaps.

**Values in every letter:** `my_name`, `my_address`, `my_phone`, `my_email`, `letter_date`,
`recipient_name`, `supplier_name`, `account_number`, `payer_name`, `payer_kind`, `member_id`,
`claim_number`, `chair`, `chair_serial`, `problem`, `problem_details`, `broke_date`,
`day_number`, `days_without`, `reported_date`, `fixed_date`, `contact_count`,
`missed_promise_count`, `missed_promises`, `impact`, `impact_list`, `auth_requested_date`,
`parts_ordered_date`, `state_name`, `state_rules`, `response_date`, `response_days`,
`timeline_count`.

**Yes/no values:** `is_stranded`, `is_unsafe`, `is_limited`, `is_fixed`, `is_medicare`,
`is_medicaid`, `has_reported`, `has_missed_promises`, `has_state_rules`, `has_impact`,
`has_loaner`, `auth_pending`, `auth_denied`, `parts_pending`, `has_phone`, `has_email`, plus
each letter's own `options`.

**Extra values in a rule's `letter` paragraph:** `law_title`, `law_citation`, `deadline_title`,
`start_label`, `start_date`, `due_date`, `period_text`, `met_label`, `met_date`, `days_late`,
`days_left`, `days_used`, `paused_since`, `paused_for`, `status` (`running`, `paused`,
`due_today`, `missed` or `met_late`).

## Checking your work

```bash
npm run rules:validate
```

It checks every file against the schema, that templates only use names that exist, that
deadlines point at real laws, and more, and prints problems with the file and line number. CI
runs it on every pull request. Editors with the YAML extension (VS Code: `redhat.vscode-yaml`)
check files as you type, using the schemas in `schema/`.

If you change `src/lib/engine/schema.ts`, regenerate the schemas with `npm run rules:schema`.
