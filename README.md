# Vellam

**வெள்ளம்** is the Tamil word for flood. Vellam tells a Chennai resident whether their own street
is likely to flood in the next 48 hours, why, and what to do about it. Then it checks its own
forecast against the rain that fell.

**Live:** https://vellam.d3tsllqujf4lwr.amplifyapp.com

Built for [Environmental Hacks](https://www.wemakedevs.org/aws/env), event two of the
WeMakeDevs x AWS Bharat Builds Tour, 8 to 11 October 2026. Track: **Heat and Water**. Path:
**Ship It**, deployed on AWS.

## 1. The problem

Flood warnings in India are issued for a district. Floods happen street by street.

In December 2015 and again in December 2023, large parts of Chennai went under water, and
many of the same neighbourhoods were hit both times. A resident reading "heavy rain likely
over Chennai district" still does not know the thing they need: will my street flood, when,
and should I move the bike tonight?

The northeast monsoon, which brings Chennai most of its rain, starts in October.

## 2. What Vellam does

| For a resident | How |
|---|---|
| **Will my street flood?** | Pick a locality, use your location, or tap any spot on the map. One of four levels, LOW, WATCH, HIGH or SEVERE, for each six hours of the next 48 |
| **Why?** | Every fact behind the answer, each marked as a forecast, a measurement, terrain, a map, the 2015 record, or Vellam's own judgement |
| **What should I do?** | Steps for that level, the Chennai helplines as tap-to-call buttons, and one tap to send the warning to a street WhatsApp group |
| **Is it flooding near me now?** | Neighbours report water as none, ankle, knee or waist deep. Reports stay on the map for 48 hours and store nothing about the person |
| **Can I trust it?** | For any spot, the last 30 days of day-ahead rain forecasts beside the rain that fell |
| **What would it have said in 2023?** | Replay Cyclone Michaung and three other storms through the same rules |
| **Tell me when it matters** | The whole city is reassessed every three hours, and an email goes out when risk appears |

The interface is in English and Tamil, in a light and a dark theme, and is laid out for a
phone first. Five pages: the landing page, Check, Replay, Prepare and How it works.

## 3. How it decides

Two questions, kept separate, then combined in one table.

**How much rain?** The hourly forecast for the spot, summed over every 24 hours of the next two
days and named with the India Meteorological Department's classes: moderate from 15.6 mm,
heavy from 64.5 mm, very heavy from 115.6 mm, extremely heavy from 204.5 mm.

**What kind of place?**

| Factor | Counts when | Weight | Source |
|---|---|---|---|
| This street flooded in 2015 | A street residents marked as flooded is within 60 m | 2 | [osm-in/flood-map](https://github.com/osm-in/flood-map) |
| Streets nearby flooded in 2015 | One is within 200 m | 1 | same |
| Close to a water body | A lake, marsh, river or canal within 300 m (within 100 m counts double) | 1 or 2 | OpenStreetMap |
| Low ground | Five metres above sea level or less | 1 | Copernicus elevation model |
| Lower than its surroundings | At least five metres below the ground a kilometre around | 1 | same |
| Ground already soaked | More than 115.6 mm in the previous 72 hours | 1 | rain record |
| On raised ground | At least ten metres above its surroundings | -1 | Copernicus elevation model |

A total of 0 or less is no exposure, 1 is some, 2 or more is high.

| Rain in 24 hours | No exposure | Some | High |
|---|---|---|---|
| Light or none | LOW | LOW | LOW |
| Moderate | LOW | LOW | WATCH |
| Heavy | WATCH | WATCH | HIGH |
| Very heavy | WATCH | HIGH | SEVERE |
| Extremely heavy | HIGH | SEVERE | SEVERE |

Rain alone can raise the level. The place alone cannot: a low street under a dry sky is not
at risk today.

There is no machine learning and no language model in this path. The same street and the same
forecast always give the same answer, and the answer lists every fact it used.

## 4. What we measured, including what went wrong

The thresholds above are judgements. Three of them were wrong on the first attempt, and the
data said so:

| First value | What the data showed | Now |
|---|---|---|
| Flooded street within 150 m, nearby within 400 m | 150 m reached 52% of random points in the core city and 400 m reached 79%, so the factor said yes to almost everyone | 60 m and 200 m, which reach 25% and 62% |
| Height differences of 2 m and 3 m | The elevation model is a 90 m grid that includes rooftops. It described Velachery, one of the most flooded parts of Chennai, as raised ground | 5 m and 10 m |
| Ground soaked after 64.5 mm in 72 hours | Replaying 15 October 2024, every locality counted as soaked after one wet day and 47 of 65 came out HIGH | 115.6 mm |

**Backtest, Cyclone Michaung, 4 December 2023** ([full table](docs/backtest-2023-12-04.md))

- 65 localities replayed with the rain on record: 50 SEVERE, 12 HIGH, 3 WATCH.
- 17 of them were named as flooded by Sphere India's situation report or the press. Vellam
  rated 16 HIGH or SEVERE.
- **It missed Perungudi**, rated WATCH although it was still under water five days later. No
  street within 200 m of the locality's centre point was marked in 2015, and no water body is
  mapped within 300 m of it.
- **This result is weak evidence on its own.** Vellam rated 62 of 65 localities HIGH or
  SEVERE that day, so a rule that warned everyone would have caught the documented ones too.
  Michaung flooded most of the city, and the replay cannot show whether Vellam would stay
  quiet where it should.

**Backtest, heavy rain of 15 October 2024** ([full table](docs/backtest-2024-10-15.md))

- The same 65 localities under 50 to 90 mm: 0 SEVERE, 33 HIGH, 27 WATCH, 5 LOW.
- No list of flooded localities was collected for this date, so this shows that the levels
  spread out under ordinary heavy rain, not that they were right.

**Forecast record.** The dashboard shows, for any spot, how the day-ahead forecast compared
with the rain that fell on each of the last 30 days. Since the build week was dry, no heavy
rain day falls in that window yet, and the page says so instead of reporting a score that has
not been tested on the days that matter.

## 5. Where not to trust it

- The level is a rule of thumb. Vellam does not model how water moves through drains.
- The 2015 map was drawn by volunteers during the flood. A street missing from it may still
  have flooded, and nothing since 2015, including new storm drains, is reflected.
- A forecast can be wrong. Cloudbursts and reservoir releases are not predicted here.
- A locality on the city map is assessed at one point. The place page for an exact spot is the
  answer to read.
- Vellam is not an official warning. Follow IMD and Greater Chennai Corporation advisories.

## 6. Architecture

```mermaid
flowchart LR
  R[Resident's phone] --> A[Amplify Hosting<br/>dashboard]
  A --> G[API Gateway<br/>HTTP API]
  G --> L[Lambda<br/>assess, reports, record]
  L --> D[(DynamoDB<br/>terrain, assessments,<br/>reports, snapshots)]
  L --> O[Open-Meteo<br/>forecast, record, elevation]
  S[EventBridge Scheduler<br/>every 3 hours] --> N[Lambda<br/>city snapshot]
  N --> D
  N --> O
  N --> T[SNS<br/>email alerts]
  L --> T
```

| AWS service | What it does here |
|---|---|
| Lambda (Node.js 22, arm64) | Two functions: the API, and the job that assesses every locality |
| API Gateway HTTP API | The public API, throttled to 2 requests a second with a burst of 10, since it has no sign-in |
| DynamoDB | One on-demand table. Terrain is kept for good, assessments for the hour, reports for 48 hours, using time-to-live so nothing needs a cleanup job |
| EventBridge Scheduler | Rebuilds the city snapshot every three hours |
| SNS | Email alerts. A message goes out when risk appears, not every three hours while it lasts |
| Amplify Hosting | Serves the dashboard over HTTPS |
| CloudFormation, through SAM | The whole stack is one template, `infrastructure/template.yaml` |
| CloudWatch Logs | Function logs. Upstream errors are logged in full and shown to the visitor as a plain message |
| IAM | The API function can read and write its table and subscribe to the topic. Only the snapshot function can publish |

Everything is pay per request, and at this project's traffic sits inside the free tier.

## 7. Repository

```
engine/src/core      the rules: rain classes, place factors, the level table, forecast checks
engine/src/sources   Open-Meteo: forecast, historical record, elevation, earlier forecasts
engine/src/api       the service, router, DynamoDB storage and the two Lambda handlers
engine/src/data      Chennai water bodies, localities and 2015 flooded streets
engine/scripts       local API server, Lambda build, and the backtest
scripts              the scripts that produced the data files
web                  the dashboard: React, Vite, Leaflet
infrastructure       SAM template and the dashboard deploy script
tests                48 tests, run without a network or an AWS account
docs                 backtest results
```

`engine/src/core` does no input or output, which is why the rules can be tested without a
network.

## 8. Run it

Needs Node.js 22.18 or later.

```bash
npm install
npm test            # 48 tests
npm run dev:api     # API on http://localhost:8787, in-memory storage, real weather
npm run dev:web     # dashboard on http://localhost:5183
```

No AWS account or API key is needed to run it locally.

```bash
npm run backtest                  # replay Cyclone Michaung across all localities
npm run backtest -- 2024-10-15    # or any other date
```

## 9. Deploy it

Needs the AWS CLI and SAM CLI.

```bash
npm run deploy:platform   # API, functions, table, schedule, topic
npm run deploy:web        # build the dashboard against the API and publish it
```

New AWS accounts are limited to very few Amplify apps. To publish as a branch of an app you
already have, set `ExistingAmplifyAppId` and `DashboardBranchName` in
`infrastructure/samconfig.toml`.

To store the replay of a past storm for the city map:

```bash
aws lambda invoke --function-name <SnapshotFunctionName> --payload '{"date":"2023-12-04"}' --cli-binary-format raw-in-base64-out out.json
```

## 10. Data and licences

| Data | Source | Licence |
|---|---|---|
| Rain forecast, earlier forecasts, rain record, elevation | [Open-Meteo](https://open-meteo.com) | CC BY 4.0 |
| Streets flooded in December 2015 | [osm-in/flood-map](https://github.com/osm-in/flood-map), crowd-sourced during the flood | MIT |
| Water bodies, locality names | [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors | ODbL |
| Rain classes | [India Meteorological Department](https://rsmcnewdelhi.imd.gov.in/uploads/archive/8/8_f9822f_heavy%20rainfall%201506.pdf) bulletins | |
| What to do | Based on the [National Disaster Management Authority](https://ndma.gov.in/Natural-Hazards/Floods/Dos-Donts)'s flood guidance | |
| Helplines | [Tamil Nadu State Disaster Management Authority](https://www.tnsdma.tn.gov.in/app/webroot/img/2022/DisasterTelephoneBook_2023.pdf) directory | |
| Map tiles | OpenStreetMap contributors | ODbL |
| Illustrations | [unDraw](https://undraw.co), recoloured | unDraw licence |
| Typefaces | Plus Jakarta Sans and Noto Sans Tamil | SIL Open Font Licence |
| Icons | [Phosphor](https://phosphoricons.com) | MIT |

The code is under the MIT licence.

## 11. Team and tools

Built by team **DoodleByte** during the event:

- Gowtham K, team lead
- Jaya Suriya T R
- Pranav A S
- Kannan K

We used Claude Code (Anthropic) as an AI pair programmer for the code, tests, infrastructure
template and documentation. Two things come from our own earlier projects: the deploy script
for the dashboard, and the cloud mascot, which is recoloured to red here. Vellam's own answers come from fixed rules, never from a model.
