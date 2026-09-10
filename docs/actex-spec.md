# actex

> Activity data, ready for AI.

## Product and technical specification

### Document status

- Product name: `actex`
- Meaning: activity extract
- Primary platform: web
- MVP sport focus: cycling
- MVP file format: FIT
- Processing model: entirely local in the browser
- Backend: none
- Accounts: none
- Database: none
- AI integration: none

---

## 1. Product summary

`actex` is a privacy-first web app that converts an endurance activity file into clean, structured text that a user can paste into an LLM such as ChatGPT, Claude, Gemini, or another analysis tool.

The core workflow is intentionally small:

1. Drop or select a `.fit` file
2. Parse the activity locally in the browser
3. Inspect the activity summary and data quality
4. Enter or confirm FTP when power-based metrics are wanted
5. Select the whole activity, a session, a lap, or a custom range
6. Review the extracted metrics
7. Add optional context that cannot be known from the file
8. Press **Copy for AI**
9. Paste the result into the user's preferred LLM

The app does not analyze the workout, recommend training, score the athlete, or attempt to replace TrainingPeaks, Garmin Connect, Intervals.icu, Strava, or similar platforms.

Its job is extraction, normalization, calculation, and export.

---

## 2. Product principles

The implementation must follow these principles in priority order.

### 2.1 Privacy first

The uploaded activity must never leave the browser.

Do not:

- upload FIT files
- send activity records to analytics
- persist activity files to a server
- store GPS coordinates in localStorage
- include device serial numbers in copied output
- include geographic coordinates in copied output

The UI should state clearly:

> Your activity stays on this device.

### 2.2 Trustworthy before clever

If a value cannot be calculated reliably, omit it or mark it as unavailable.

Never fabricate missing samples, FTP, heart rate, cadence, power, altitude, laps, or timing data merely to make the output look complete.

### 2.3 Transparent calculations

For every derived metric, the codebase must have one documented calculation policy.

The UI should be able to distinguish between:

- values read from the FIT file
- values calculated by actex
- values entered by the user

This is especially important for power metrics because different services may produce slightly different results.

### 2.4 LLM-ready output

The main output is not designed for humans to archive. It is designed to be pasted into another model with minimal cleanup.

Output should therefore be:

- structured
- concise
- explicit about units
- explicit about selected range
- explicit about FTP and zone definitions
- explicit about warnings or data quality problems
- stable enough that an LLM can compare multiple exports

### 2.5 Small MVP

Do not turn the first release into an activity analytics platform.

The MVP should solve one problem extremely well:

> Convert a cycling FIT file into trustworthy, copyable activity text.

---

## 3. Technology

Use:

- Node.js LTS for development tooling
- Vite
- Vanilla JavaScript with ES modules
- Modern plain CSS
- `@garmin/fitsdk`
- Vitest
- browser File API
- browser Clipboard API
- `localStorage` for user preferences only

Do not use:

- React
- Vue
- Svelte
- Express
- MongoDB
- a backend API
- a database
- authentication
- server-side file processing
- a charting dependency unless there is a clear reason the simple timeline cannot be implemented with SVG or Canvas

Production output must be deployable as static files.

---

## 4. Browser support

Target current evergreen versions of:

- Chrome
- Edge
- Firefox
- Safari
- mobile Safari
- mobile Chrome

The core workflow must work on desktop and mobile.

If the Clipboard API is unavailable or denied, provide a selectable text fallback.

---

## 5. Garmin FIT SDK integration

Use the official Garmin JavaScript FIT SDK package:

```text
@garmin/fitsdk
```

The current Garmin SDK supports ECMAScript modules and browser `ArrayBuffer` input.

Use the SDK's stream and decoder abstractions rather than implementing FIT decoding manually.

Recommended decoding behavior:

```js
import { Decoder, Stream } from "@garmin/fitsdk";

export async function decodeFitFile(file) {
  const buffer = await file.arrayBuffer();
  const stream = Stream.fromArrayBuffer(buffer);

  if (!Decoder.isFIT(stream)) {
    throw new Error("The selected file is not a valid FIT file");
  }

  const decoder = new Decoder(stream);

  const { messages, errors } = decoder.read({
    applyScaleAndOffset: true,
    expandSubFields: true,
    expandComponents: true,
    convertTypesToStrings: true,
    convertDateTimesToDates: true,
    includeUnknownData: false,
    mergeHeartRates: true,
  });

  return { messages, errors };
}
```

Do not make the rest of the app depend on Garmin's decoded object shape. Decode first, then normalize immediately into an actex-owned model.

### 5.1 Integrity behavior

Use `Decoder.isFIT()` as the fast first validation.

Do not make strict CRC integrity checking a hard requirement for every file if doing so rejects files that can otherwise be decoded usefully. If integrity checking is added, treat it as a diagnostic and distinguish between:

- not a FIT file
- FIT file with integrity warning
- FIT file with decode warnings
- FIT file that cannot be decoded

### 5.2 Decode warnings

Garmin's decoder may return errors or warnings while still producing usable messages.

Do not fail the entire activity merely because the decoder reports a recoverable issue.

Collect decode diagnostics and surface them in a non-alarming data quality section.

---

## 6. File input

Accept `.fit` files through:

- file picker
- drag and drop

Validate both extension and decoded FIT signature.

Suggested default maximum file size: 100 MB.

The size limit should be a named constant and easy to change.

If a file exceeds the limit, explain why it was rejected.

Never render file-derived strings with unsafe HTML. Use text nodes or `textContent`.

---

## 7. Internal data model

The normalized model is a core architectural boundary.

Suggested top-level shape:

```js
{
  schemaVersion: 1,
  metadata: {},
  sessions: [],
  laps: [],
  records: [],
  timerEvents: [],
  devices: [],
  diagnostics: {}
}
```

The exact property names may change during implementation, but the following rules are mandatory:

- UI code does not read Garmin SDK message objects directly
- calculation modules operate on normalized actex records
- output modules consume calculated actex result objects
- FIT-specific quirks stay inside the FIT adapter layer

---

## 8. Metadata model

Normalize useful non-sensitive metadata where available:

```text
sport
subSport
startTime
endTime
fileCreationTime
manufacturer
productName
```

Do not expose by default:

- device serial number
- sensor serial number
- GPS coordinates
- home location
- raw developer identifiers

Device model information can be shown in an advanced details panel, but it should not be included in the default LLM export.

---

## 9. Session model

A FIT file can contain more than one session. Do not assume there is exactly one.

Normalize each available session with fields such as:

```text
index
sport
subSport
startTime
endTime
elapsedTimeSeconds
timerTimeSeconds
distanceMeters
totalAscentMeters
totalDescentMeters
averagePowerWatts
maxPowerWatts
averageHeartRateBpm
maxHeartRateBpm
averageCadenceRpm
maxCadenceRpm
averageSpeedMps
maxSpeedMps
workJoules
```

Every field must support `null`.

The app should automatically select the only session when there is exactly one.

If there are multiple sessions, provide a simple selector.

---

## 10. Record model

Normalize time-series records into a stable structure:

```js
{
  timestamp: Date,
  elapsedSeconds: Number,
  timerSeconds: Number | null,
  timerRunning: Boolean,
  powerWatts: Number | null,
  heartRateBpm: Number | null,
  cadenceRpm: Number | null,
  speedMps: Number | null,
  distanceMeters: Number | null,
  altitudeMeters: Number | null,
  temperatureC: Number | null
}
```

Do not store GPS coordinates in the normalized MVP model unless they become necessary for a future feature.

### 10.1 Missing versus zero

This distinction is mandatory.

Examples:

- `powerWatts: 0` means a real zero-power sample
- `powerWatts: null` means power is unavailable for that record
- `cadenceRpm: 0` may be a real zero-cadence sample
- `cadenceRpm: null` means cadence is unavailable

Never convert missing data to zero globally.

---

## 11. Timer handling

FIT timer events must be respected.

The app must distinguish between:

- elapsed time
- active timer time
- paused time

Most training calculations should operate on active timer time.

Paused periods must not contribute to:

- active duration
- average active power
- calculated work
- power-zone time
- cadence averages
- normalized power calculation

Coasting while the activity timer is running is still active time and must count.

### 11.1 Timer state reconstruction

Build a deterministic timer-state timeline from FIT event messages.

Do not infer pauses solely from large gaps between record timestamps.

Record gaps are a data-quality issue. Timer state is a separate concept.

---

## 12. Data quality diagnostics

This is an important improvement over a simple extractor.

Before showing derived metrics, calculate coverage and recording quality.

At minimum expose:

```text
record count
active timer duration
power coverage percentage
heart-rate coverage percentage
cadence coverage percentage
median record interval
largest record gap while timer was running
number of decode warnings
```

Example UI:

```text
Data quality
Power coverage: 99.7%
Heart-rate coverage: 99.9%
Median recording interval: 1 s
Largest active recording gap: 3 s
Warnings: none
```

If data quality is poor, add a warning to the copied LLM output.

This allows an LLM to avoid over-interpreting questionable numbers.

---

## 13. Sample duration policy

Do not calculate durations by counting FIT records.

Records can be irregularly spaced.

For duration-based metrics, use timestamps and active timer state.

### 13.1 Default sample ownership

For a sample at time `t0` followed by the next sample at `t1`, the value at `t0` represents the interval from `t0` until `t1`, provided:

- the timer is running during that interval
- the gap is within the accepted gap threshold

This is a step-hold policy, not linear interpolation.

### 13.2 Gap policy

Define constants such as:

```text
NORMAL_SAMPLE_GAP_SECONDS = 5
HARD_GAP_LIMIT_SECONDS = 30
```

Recommended behavior:

- gap <= normal limit: hold the previous sample value across the gap
- gap > normal limit: mark the excess interval as missing rather than fabricating data
- gap >= hard limit: add a data-quality warning

The exact constants can be tuned after testing real files, but the policy must be centralized and tested.

Do not silently interpolate power across long gaps.

---

## 14. Selection model

Every metric shown after parsing should belong to an explicit selection.

Support these selection types:

1. whole activity
2. session
3. lap
4. custom time range

Represent a selection internally with a stable shape such as:

```js
{
  type: 'activity' | 'session' | 'lap' | 'range',
  startTimestamp: Date,
  endTimestamp: Date,
  sessionIndex: Number | null,
  lapIndex: Number | null
}
```

All calculations should receive a selection rather than reading global state.

---

## 15. Custom range selector

Custom range selection is a core feature because real activity files often contain warm-up, race, cooldown, or travel before the intended analysis period.

Provide:

- a lightweight time-series timeline
- power as the primary series when available
- heart rate as fallback when power is unavailable
- draggable start and end handles
- exact time inputs

Example:

```text
Start  00:17:00
End    02:55:50
```

The chart can use SVG or Canvas.

Do not add a large charting dependency for the MVP.

### 15.1 Selection recalculation

Changing the selected range must recalculate:

- duration
- distance delta
- average speed
- average power
- max power
- work
- calculated normalized power
- VI
- IF
- power-zone times
- heart rate values
- cadence values
- elevation values where supported

---

## 16. FTP model

FTP is user context, not something actex should guess.

FTP source priority:

1. FTP explicitly entered for the current activity
2. user's locally saved default FTP
3. FTP found in FIT metadata, but only after showing where it came from and allowing the user to override it
4. unavailable

Never silently infer FTP from ride data.

Store only the default FTP preference in `localStorage`.

Example control:

```text
FTP
[ 405 ] W

Source: saved default
```

Allow a user to change FTP for the current file without automatically changing the saved default.

Provide a separate **Save as default** action.

---

## 17. Default cycling power zones

Use this default zone model:

| Zone            |        Internal rule |
| --------------- | -------------------: |
| Coasting        |          exactly 0 W |
| Active Recovery |      >0 and <55% FTP |
| Endurance       |   >=55% and <76% FTP |
| Tempo           |   >=76% and <88% FTP |
| Sweet Spot      |   >=88% and <95% FTP |
| Threshold       |  >=95% and <106% FTP |
| VO2 Max         | >=106% and <121% FTP |
| Anaerobic       |           >=121% FTP |

Keep zone boundaries as decimal percentages internally.

Do not use rounded watt values for classification.

### 17.1 Displayed zone boundaries

When displaying watt boundaries, avoid ambiguous overlapping ranges caused by integer rounding.

Prefer:

```text
Endurance: >=223 W and <308 W
Tempo: >=308 W and <356 W
```

rather than:

```text
223-308 W
308-356 W
```

### 17.2 Zone customization

Provide editable percentage boundaries in Settings.

Persist zone preferences in localStorage.

Provide **Reset to defaults**.

---

## 18. Power-zone duration

For every active interval with valid power data:

1. classify the sample using unrounded FTP percentages
2. assign its valid duration to exactly one zone
3. accumulate duration

Zone percentages should use the total duration with valid power coverage as the denominator by default.

Also show power coverage so the user can see when this denominator differs materially from active timer duration.

If power coverage is high, the percentages will effectively represent active ride time.

If power coverage is low, add a warning.

---

## 19. Core cycling metrics

For the selected range calculate, where possible:

```text
active duration
elapsed duration
distance
average speed
maximum speed
average power
maximum power
mechanical work
calculated normalized power
variability index
intensity factor
average heart rate
maximum heart rate
average cadence
maximum cadence
elevation gain
elevation loss
```

Only show values supported by the available data.

---

## 20. Average power

The canonical actex average power should be time-weighted across valid active power data.

Explicit zero-power samples while the timer is running must be included.

Missing power must not automatically become zero.

Formula conceptually:

```text
sum(power * valid_seconds) / sum(valid_power_seconds)
```

Also report power coverage.

If the FIT session contains a device-reported average power, retain it as optional reference metadata but do not silently replace the actex-calculated value.

---

## 21. Maximum power

Maximum power is the highest valid recorded power sample in the selected range.

Because single-sample peaks can be sensor spikes, also calculate short peak-power values for diagnostics even if they are not all part of the MVP UI.

Recommended internal metrics:

```text
1 s max
5 s best average
30 s best average
1 min best average
```

For MVP output, `Maximum Power` may remain the 1-second maximum, but a future UI can prefer 5-second power for robustness.

If a clearly impossible isolated spike is detected, do not auto-delete it. Flag it as a possible outlier.

---

## 22. Mechanical work

Calculate cycling mechanical work from valid power samples:

```text
work_joules = sum(power_watts * valid_seconds)
```

Display in kilojoules:

```text
3270 kJ
```

Do not confuse mechanical work with calories burned.

---

## 23. Normalized Power calculation

actex should calculate a Normalized Power-compatible value for cycling power data.

The implementation should follow the commonly documented TrainingPeaks method:

1. construct a one-second active power series
2. calculate a 30-second rolling average
3. raise each 30-second average to the fourth power
4. average those fourth-power values
5. take the fourth root

### 23.1 One-second reconstruction

Use the same centralized step-hold and gap policy defined earlier.

Do not linearly interpolate power.

Do not bridge paused timer periods.

Do not bridge long missing-data gaps.

### 23.2 Short selections

Normalized Power is not a useful metric for very short selections because of the 30-second rolling window.

Policy:

- under 30 seconds: do not calculate NP
- 30 seconds to under 10 minutes: calculate only if useful for consistency, but display a `short selection` warning
- 10 minutes or longer: display normally

Keep this warning in copied output when relevant.

### 23.3 Naming

Use the UI label:

```text
Normalized Power
```

Optionally annotate:

```text
Calculated by actex
```

Do not promise byte-for-byte parity with TrainingPeaks, Garmin, WKO, or another service because reconstruction, pause, zero-value, and missing-data policies can differ.

### 23.4 Device/reference value

If the FIT file includes a device-reported normalized-power field, preserve it separately when available:

```text
Calculated NP: 395 W
Device NP: 394 W
```

The default LLM export should use the actex-calculated value and may include a difference warning if the two values disagree materially.

---

## 24. Variability Index

When calculated normalized power and average power are available:

```text
VI = normalizedPower / averagePower
```

Display to two decimals.

Example:

```text
VI: 1.14
```

---

## 25. Intensity Factor

When calculated normalized power and FTP are available:

```text
IF = normalizedPower / FTP
```

Display to two decimals.

Example:

```text
IF: 0.98
```

Do not calculate IF without FTP.

---

## 26. TSS

TSS is not required for the first MVP.

The architecture should allow it later, but do not let TSS delay the core product.

---

## 27. Heart rate

For the selected range calculate:

```text
average heart rate
maximum heart rate
heart-rate coverage
```

Average heart rate should be time-weighted across valid active HR data.

Missing heart rate is not zero.

Heart-rate zones are out of scope for MVP.

Future support may add:

- user max HR
- threshold HR
- time above a user-selected HR threshold
- time above a percentage of HRmax

---

## 28. Cadence

For the selected range calculate:

```text
average cadence
maximum cadence
cadence coverage
```

Do not confuse missing cadence with zero cadence.

A valid zero cadence sample may represent coasting and can be included depending on the selected average policy.

For MVP use a time-weighted average of valid cadence samples, including explicit zeros.

---

## 29. Speed and distance

Prefer time-series distance deltas for custom selections.

For full-session summary, FIT session distance may be shown as a reference value.

For a custom selection:

```text
selected_distance = end_distance - start_distance
```

with defensive handling for resets or invalid values.

Calculate average active speed from selected distance and active timer duration when reliable.

Output metric units by default:

```text
112.02 km
42.5 km/h
```

Imperial formatting can be added through Settings without changing internal SI units.

---

## 30. Elevation

Priority for whole-session elevation gain:

1. reliable FIT session/lap ascent field
2. calculated fallback from altitude records

For custom ranges, a calculated range-specific ascent value may be needed.

Do not sum every tiny positive altitude fluctuation directly.

Use a documented smoothing or minimum-change policy for fallback ascent calculations.

If fallback elevation is used, mark the value as calculated.

Do not make elevation perfection a blocker for MVP.

---

## 31. Laps

Decode and normalize FIT lap messages.

Display a table with:

```text
Title
Duration
NP
Power
HR
Cadence
Speed
Distance
Start
End
```

Recommended desktop columns:

| Column   | Meaning                      |
| -------- | ---------------------------- |
| Title    | Lap 1, Lap 2, etc.           |
| Duration | active lap duration          |
| NP       | calculated lap NP when valid |
| Power    | average power                |
| HR       | average heart rate           |
| Cadence  | average cadence              |
| Speed    | average speed                |
| Distance | lap distance                 |
| Start    | relative activity time       |
| End      | relative activity time       |

On mobile, use a stacked lap card rather than forcing a wide table.

### 31.1 Lap NP warning

Because NP is weak for short intervals, display the same short-duration warning policy for short laps.

### 31.2 Custom selection and laps

When the current selection is a custom range, do not automatically append every full-activity lap to the copied output.

Provide an option:

```text
Include overlapping laps
```

Default: off.

---

## 32. Main UI

The application should be a single-page tool.

### 32.1 Empty state

```text
actex
Activity data, ready for AI.

Drop a FIT file here
or
Choose file

Your activity stays on this device.
```

### 32.2 Parsed state

Recommended sections:

```text
Activity header
Selection
Summary
Power zones
Laps
Context for AI
Export
Data quality
```

Do not hide the most important action behind tabs.

The primary CTA should remain visible after parsing:

```text
Copy for AI
```

---

## 33. Activity header

Show useful context without exposing sensitive metadata:

```text
Cycling
9 Aug 2026
2:38:50
112.02 km
```

Optional secondary information:

```text
Garmin Edge 1050
```

Do not show serial numbers.

---

## 34. Summary panel

Show only valid metrics.

Suggested order:

```text
Duration
Distance
Average Speed

Average Power
Normalized Power
Maximum Power
Mechanical Work
FTP
IF
VI

Average HR
Maximum HR

Average Cadence
Maximum Cadence

Elevation Gain
```

Each derived metric should be able to show a small source label on hover, focus, or details view:

```text
FIT
Calculated
User
```

---

## 35. Context for AI

The FIT file does not know race tactics, result, perceived effort, meter reliability, illness, weather, or training goal.

Provide optional fields:

```text
Activity type / context
Race result
Goal or question
Power meter notes
Perceived effort
Additional notes
```

Example:

```text
Activity type / context:
Rolling 3-hour road race. Team finished second. Winner escaped solo early.

Power meter notes:
Power meter believed to be accurate.
```

These fields exist only in memory for the current page session unless the user explicitly chooses to save a preference later.

Do not persist personal notes by default.

---

## 36. Primary export format

The primary button is:

```text
Copy for AI
```

It should copy Markdown-flavored plain text with stable headings.

Include a schema identifier so exports can be compared reliably:

```text
actex schema: 1
```

Example output:

```markdown
# Activity Data

actex schema: 1

## Activity

Sport: Cycling
Date: 2026-08-09
Selection: Custom range
Start: 00:17:00
End: 02:55:50

## Summary

Active Duration: 2:38:50
Elapsed Duration: 2:38:50
Distance: 112.02 km
Average Speed: 42.5 km/h
Elevation Gain: 1136 m

## Power

FTP: 405 W
Average Power: 345 W
Normalized Power: 395 W
Maximum Power: 1327 W
Variability Index: 1.14
Intensity Factor: 0.98
Mechanical Work: 3270 kJ
Power Coverage: 99.8%

## Heart Rate

Average HR: 165 bpm
Maximum HR: 190 bpm
HR Coverage: 99.9%

## Cadence

Average Cadence: 104 rpm
Maximum Cadence: 145 rpm
Cadence Coverage: 99.5%

## Power Zones

Coasting: 0:12:21, 7.8%, 0 W
Active Recovery: 0:21:27, 13.6%, >0 and <55% FTP
Endurance: 0:30:56, 19.6%, >=55% and <76% FTP
Tempo: 0:20:36, 13.0%, >=76% and <88% FTP
Sweet Spot: 0:11:28, 7.3%, >=88% and <95% FTP
Threshold: 0:17:08, 10.8%, >=95% and <106% FTP
VO2 Max: 0:16:53, 10.7%, >=106% and <121% FTP
Anaerobic: 0:27:19, 17.3%, >=121% FTP

## Data Quality

Median Record Interval: 1 s
Largest Active Record Gap: 3 s
Warnings: None

## User Context

Activity Context: Rolling road race
Race Result: Team finished second
Power Meter Notes: Power meter believed to be accurate
```

Do not add analysis or recommendations to this output.

---

## 37. Compact export option

Provide an optional compact mode for users who want to minimize token usage.

Example:

```text
Cycling, 2026-08-09
2:38:50, 112.02 km, 42.5 km/h
FTP 405 W, Avg 345 W, NP 395 W, Max 1327 W, IF 0.98, VI 1.14, Work 3270 kJ
HR 165 avg / 190 max
Cadence 104 avg / 145 max
Elevation 1136 m
Zones: Z0 12:21, Recovery 21:27, Endurance 30:56, Tempo 20:36, SS 11:28, Threshold 17:08, VO2 16:53, Anaerobic 27:19
```

Primary default should remain the structured Markdown format because it is easier for LLMs to interpret safely.

---

## 38. Include laps option

Provide a toggle:

```text
Include laps in AI copy
```

Default: off.

When enabled, append:

```markdown
## Laps

### Lap 1

Duration: 0:05:02
Normalized Power: 467 W
Average Power: 475 W
Average HR: 170 bpm
Average Cadence: 105 rpm
Average Speed: 25.6 km/h
Distance: 2.15 km
Start: 0:19:17
End: 0:24:19
```

This prevents interval-heavy activities from producing unnecessarily large prompts unless the user wants the detail.

---

## 39. JSON export

Provide a secondary action:

```text
Copy JSON
```

The JSON contract should be versioned.

Suggested structure:

```js
{
  schemaVersion: 1,
  activity: {},
  selection: {},
  summary: {},
  power: {},
  heartRate: {},
  cadence: {},
  elevation: {},
  powerZones: [],
  dataQuality: {},
  laps: [],
  userContext: {}
}
```

Use stable property names and SI-derived numeric values where practical.

Human-formatted strings should be generated at the output boundary rather than stored as the canonical metric values.

---

## 40. Clipboard UX

On successful copy:

```text
Copied
```

Show the success state for roughly two seconds.

If copying fails:

1. open the generated output in a textarea
2. select the text
3. explain that the browser blocked direct clipboard access

Never discard generated output because the Clipboard API failed.

---

## 41. Privacy design

No activity content should be sent over the network by actex.

The only network requests in production should be those needed to load the static app itself.

If analytics are ever introduced later, they must not contain:

- file names
- timestamps tied to an activity
- workout metrics
- GPS data
- device identifiers
- copied text
- user-entered context

For MVP, use no analytics.

### 41.1 localStorage allowlist

Only persist preference-like data such as:

```text
default FTP
zone percentages
units
UI preferences
```

Do not persist:

```text
activity records
FIT binary data
user context notes
GPS data
device serial numbers
```

---

## 42. Error states

Provide specific errors for:

- unsupported extension
- file too large
- not a FIT file
- corrupt or unreadable FIT file
- no activity/session data
- no record messages
- missing timestamps
- impossible timestamp ordering
- selected range contains no active timer time
- selected range contains no valid power data
- FTP required for requested power-zone metrics

Do not use a generic `Something went wrong` when the cause is known.

---

## 43. Partial-data behavior

The app must remain useful when sensors are missing.

### No power

Still provide:

- duration
- distance
- speed
- heart rate
- cadence
- elevation
- laps

Hide or disable:

- normalized power
- VI
- IF
- power zones
- work derived from power

### No heart rate

Do not block power extraction.

### No cadence

Do not block activity extraction.

### No altitude

Do not block activity extraction.

---

## 44. Data quality warnings

Warnings should be factual and non-judgmental.

Examples:

```text
Power data is present for 71% of active time. Power-zone durations may be incomplete.
```

```text
The activity contains an active recording gap of 42 seconds. actex did not fabricate samples across this gap.
```

```text
Calculated NP differs from the device value by 4.8%.
```

```text
This selection is shorter than 10 minutes. Normalized Power is less useful for short ranges.
```

Include important warnings in the AI export.

---

## 45. Outlier handling

Do not automatically delete suspicious sensor values.

For MVP:

- detect obvious isolated spikes when practical
- mark them as warnings
- show the raw maximum
- allow future manual exclusion architecture

Possible future feature:

```text
Exclude suspicious sample
```

Do not silently mutate the athlete's data.

---

## 46. Settings

MVP settings:

```text
Default FTP
Power zone boundaries
Units
Reset settings
```

Units:

```text
Metric
Imperial
```

Internal calculations should remain in SI units regardless of display preference.

---

## 47. Suggested project structure

```text
src/
  main.js

  fit/
    decode-fit.js
    normalize-fit.js
    normalize-session.js
    normalize-lap.js
    normalize-record.js
    normalize-events.js
    diagnostics.js

  activity/
    build-timer-state.js
    select-records.js
    selection.js
    sample-durations.js
    reconstruct-power.js

  metrics/
    summary.js
    power.js
    normalized-power.js
    peak-power.js
    power-zones.js
    heart-rate.js
    cadence.js
    speed-distance.js
    work.js
    elevation.js
    coverage.js

  output/
    build-export-model.js
    markdown.js
    compact-text.js
    json.js

  ui/
    file-drop.js
    activity-header.js
    selection-controls.js
    timeline.js
    summary.js
    power-zones.js
    laps.js
    data-quality.js
    context-form.js
    export-actions.js
    settings.js

  storage/
    settings.js

  utils/
    time.js
    units.js
    format.js
    math.js
    constants.js
```

Calculation modules must not manipulate the DOM.

UI modules must not contain metric formulas.

Output modules must not re-calculate metrics.

---

## 48. Calculation result model

Create one calculated result object for the current selection.

Example:

```js
{
  selection: {},
  summary: {},
  power: {},
  heartRate: {},
  cadence: {},
  elevation: {},
  zones: [],
  laps: [],
  quality: {},
  warnings: []
}
```

The UI and exporters should consume this object.

This prevents the Markdown exporter, JSON exporter, and UI from disagreeing because each implemented its own calculations.

---

## 49. Recalculation strategy

Parse and normalize the FIT file once.

Recalculate metrics only when inputs that affect them change:

- selection
- FTP
- zone boundaries
- units only affects formatting, not calculations

Do not re-decode the FIT file on every change.

A several-hour cycling FIT file should remain responsive on a normal phone.

A Web Worker is not mandatory for MVP. Add one only if profiling shows decoding or calculation creates noticeable UI blocking.

---

## 50. Testing strategy

Use Vitest.

The calculation layer must have strong tests before UI polish.

### 50.1 Required unit tests

Test:

- FIT timestamp normalization
- timer start and stop reconstruction
- paused time exclusion
- elapsed versus active duration
- explicit zero power
- missing power
- irregular record spacing
- short record gaps
- long record gaps
- time-weighted average power
- work calculation
- power-zone classification at every exact boundary
- power-zone duration
- FTP changes
- 30-second rolling power
- normalized power
- short-selection NP behavior
- VI
- IF
- HR averages with missing data
- cadence averages with explicit zero and null
- selection clipping
- custom range crossing a pause
- lap selection
- distance delta
- coverage percentages
- output formatting

### 50.2 Synthetic test data

Build small deterministic synthetic time series where expected results are known exactly.

Examples:

- 10 minutes at exactly 300 W
- 20 minutes alternating 30 seconds at 500 W and 30 seconds at 0 W
- activity with a 2-minute pause
- activity with a 20-second missing-data gap
- activity with explicit 0 W coasting

### 50.3 FIT fixtures

Include a small set of non-personal test FIT files in the repository.

Prefer:

- Garmin SDK sample files
- synthetic FIT files generated for tests

Do not commit a real user's private activity file unless it is intentionally anonymized and approved for repository use.

### 50.4 Golden export tests

For a known calculated result object, assert the exact Markdown and JSON output.

This protects the copy format from accidental breaking changes.

---

## 51. Accessibility

Support:

- keyboard file selection
- drag and drop plus equivalent button
- visible focus states
- semantic buttons
- explicit form labels
- sufficient color contrast
- range selection that has numeric input alternatives to dragging
- status messages for copy success and parse errors

Do not make chart interaction the only way to define a custom range.

---

## 52. Mobile behavior

The core mobile workflow is:

```text
Choose FIT file
-> review summary
-> enter FTP if needed
-> Copy for AI
-> switch to LLM app
-> paste
```

Mobile requirements:

- no horizontal scrolling for primary controls
- lap table becomes cards or a horizontally contained detail view
- timeline handles are touch-friendly
- copy button remains easy to reach
- file picker works with files stored in the device Files app

---

## 53. UI style direction

The app should feel like a utility, not a dashboard product.

Prefer:

- strong typography
- generous spacing
- clear numeric hierarchy
- neutral surfaces
- minimal decoration
- one clear primary action

Avoid:

- giant hero sections after a file is loaded
- gamification
- excessive charts
- training-score colors implying good or bad performance
- AI branding beyond explaining that the text is designed for LLM use

---

## 54. MVP pages and states

The MVP can be one route with these states:

### State A: no file

File drop and privacy message.

### State B: parsing

Short progress state.

### State C: parsed

Full extraction UI.

### State D: parse failure

Specific error plus option to choose another file.

No router is required for MVP.

---

## 55. Definition of done

The MVP is complete when all of the following work reliably:

1. User opens actex without an account
2. User selects a cycling FIT file
3. File is decoded entirely in the browser
4. App displays activity/session summary
5. App displays data-quality coverage
6. User can enter FTP
7. App calculates the default cycling power zones
8. App calculates time in each power zone from timestamps rather than record counts
9. App shows FIT laps
10. User can select whole activity, session, lap, or custom range
11. All metrics recalculate for the selection
12. App calculates time-weighted average power and work
13. App calculates a documented Normalized Power-compatible metric
14. App calculates VI and IF when inputs exist
15. User can add optional race/training/power-meter context
16. **Copy for AI** produces clean structured Markdown
17. User can optionally include laps
18. User can copy stable JSON
19. Clipboard fallback works
20. No activity data leaves the browser
21. Reloading the page removes the activity
22. Saved settings survive reload
23. Core calculation tests pass
24. Mobile workflow is usable

---

## 56. Explicit MVP non-goals

Do not build any of these for the first release:

- user accounts
- cloud storage
- activity history
- Garmin Connect authentication
- Strava authentication
- Intervals.icu authentication
- TrainingPeaks authentication
- direct LLM API calls
- built-in AI analysis
- coaching recommendations
- automatic FTP estimation
- automatic power-meter correction
- social features
- subscriptions
- payments
- route maps
- live GPS
- weather lookup
- segment matching
- comparison dashboard
- training calendar
- CTL, ATL, TSB
- automatic TSS if it delays MVP

---

## 57. Post-MVP roadmap

Potential next features, roughly in product-value order:

### 57.1 Peak power table

Add:

```text
5 s
15 s
30 s
1 min
2 min
5 min
10 min
20 min
```

This is highly useful for LLM race and workout analysis.

### 57.2 Multi-file comparison

Allow multiple activities to be dropped and produce one normalized comparison export.

Example use case:

```text
Same race, 2024 vs 2025 vs 2026
```

The output should make meter notes and data-quality warnings explicit for each activity.

### 57.3 More input formats

Consider:

- TCX
- GPX
- CSV

Do not add another format until FIT extraction is stable.

### 57.4 Heart-rate analysis

Potential fields:

- HR zones
- time above user-defined HR
- time above percentage of max HR
- cardiac drift
- power-to-HR decoupling

### 57.5 Additional cycling analysis

Potential fields:

- best power by duration
- time above FTP
- time above 110%, 120%, 130% FTP
- coasting time
- low-cadence versus high-cadence work
- seated/standing only if a reliable source field exists
- power distribution histogram

### 57.6 More sports

Running and other sports can be added after the cycling model is stable.

The internal architecture should allow sport-specific metric modules rather than forcing cycling logic onto every activity.

---

## 58. Product copy

### Name

**actex**

The name is short, distinct, and broad enough to support more than FIT files later.

Do not rename it to something FIT-specific unless the product deliberately decides to remain FIT-only.

### Tagline

Preferred:

> Activity data, ready for AI.

Alternative:

> Extract your activity. Paste it anywhere.

### Privacy line

> Your activity stays on this device.

### Primary action

> Copy for AI

---

## 59. Implementation priorities for the coding agent

Build in this order.

### Phase 1: parser and normalized model

- Vite project
- file input
- Garmin FIT decoding
- normalized session, lap, record, and event data
- timer reconstruction
- diagnostics

Do not build visual polish before this layer is reliable.

### Phase 2: calculation engine

- selection model
- sample duration logic
- active duration
- average power
- work
- HR
- cadence
- distance
- power zones
- normalized power
- VI
- IF
- coverage

Add tests alongside each metric.

### Phase 3: core UI

- summary
- FTP input
- zones
- laps
- data quality
- selection controls

### Phase 4: custom timeline range

- lightweight timeline
- start/end inputs
- drag handles
- recalculation

### Phase 5: export

- export model
- Markdown export
- compact export
- JSON export
- clipboard fallback
- user context fields

### Phase 6: hardening

- mobile
- accessibility
- error cases
- large files
- malformed files
- browser testing

---

## 60. Engineering rules

The coding agent must follow these rules:

1. Do not add a backend
2. Do not add a framework without explicit approval
3. Do not add scope outside this specification merely because a library makes it easy
4. Keep calculations independent from UI code
5. Keep Garmin-specific objects inside the FIT adapter layer
6. Use timestamps for duration calculations
7. Preserve the difference between zero and missing values
8. Never silently repair questionable sensor data
9. Never invent FTP
10. Never expose GPS coordinates or serial numbers in the default AI export
11. Every derived metric needs unit tests
12. Every exported metric must come from the same calculated result model used by the UI
13. Prefer deterministic behavior over heuristics
14. If a calculation policy is ambiguous, document the decision in code and tests rather than hiding it
15. Keep the first release fast, local, and boring in the best sense

---

## 61. Technical reference notes

The implementation should be checked against the current official documentation for:

- Garmin FIT SDK
- Garmin official `fit-javascript-sdk`
- `@garmin/fitsdk`
- TrainingPeaks documentation for Normalized Power, Intensity Factor, and Variability Index

Important verified assumptions at the time of this specification:

- Garmin provides an official JavaScript FIT SDK
- the SDK supports browser-compatible ECMAScript modules
- `Stream.fromArrayBuffer()` is supported
- `Decoder.isFIT()` is supported
- `Decoder.read()` can apply scaling, expand fields/components, convert FIT date-times to JavaScript dates, and merge HR messages into records
- TrainingPeaks documents Normalized Power around a 30-second rolling average and the established fourth-power calculation method
- Variability Index is Normalized Power divided by average power
- Intensity Factor is Normalized Power divided by FTP

Do not assume external platforms will exactly match actex calculations. Differences in recording density, pauses, missing data, zero handling, and range semantics can legitimately produce small differences.

---

# End of specification
