# actex: Improve VO2 Interval Analysis Export

## Goal

Improve the Markdown export so an LLM can compare structured VO2 workouts such as:

- 4 x 5 min
- 3 x 10 min 30/15
- 3 x 10 min 40/20
- 2 x 5 min + 2 x 10 min 30/15

The main objective is to avoid forcing the LLM to reconstruct interval sets from dozens of individual FIT laps.

## 1. Detect and group interval sets

Automatically identify repeated work/recovery patterns from FIT laps or workout steps.

Examples:

```text
13 x 30s / 15s
10 x 40s / 20s
4 x 5min / 4min
```

Group these into logical sets.

Example:

```text
Set 1: 13 x 30/15
Recovery: 5:09
Set 2: 13 x 30/15
Recovery: 5:37
Set 3: 13 x 30/15
```

Detection should allow small FIT timing inaccuracies such as 29s instead of 30s and 14s instead of 15s.

## 2. Export a summary for every interval set

For each detected set output:

```md
### Set 1 - 13 x 30/15

Repetitions: 13
Set Duration: 9:45
Hard Work Duration: 6:30

Work Power:
Average: 505 W
Minimum Rep Average: 491 W
Maximum Rep Average: 526 W
First Half Average: 503 W
Second Half Average: 507 W
Power Fade: -0.8%

Recovery Power:
Average: 249 W

Whole Set:
Average Power: 420 W
```

### Power fade

Compare average work power from the first half of the repetitions with the second half.

```text
fade = (firstHalf - secondHalf) / firstHalf * 100
```

Negative fade means power increased.

Do not treat recovery intervals as work when calculating work-power fade.

## 3. Add HR kinetics for every set

Heart-rate behavior is particularly important for VO2 analysis.

Output:

```md
Heart Rate:
Start: 145 bpm
Average: 169 bpm
Maximum: 177 bpm
End: 176 bpm
Time >= 90% HRmax: 5:42
Time >= 95% HRmax: 0:00
Time to first reach 90% HRmax: 3:11
```

Use the user-configured HRmax.

Also output the actual thresholds near the top of the activity export:

```text
Configured Max HR: 190 bpm
90% HRmax: 171 bpm
95% HRmax: 181 bpm
```

These are HR thresholds only. Never label them as percentages of VO2max.

## 4. Summarize recovery between sets

For every long recovery separating interval sets output:

```md
Recovery before Set 2:
Duration: 5:09
Average Power: 178 W
Lowest HR: 132 bpm
HR at Next Set Start: 144 bpm
```

This is important because recovery duration and HR drop substantially affect the VO2 response of the next interval set.

## 5. Keep individual laps optional

The current Markdown can become extremely long for workouts such as 30/15s.

Default behavior:

```text
Include individual laps: false
```

The standard LLM export should contain:

```text
Activity summary
Power / HR summary
Zones
Detected interval sets
Recovery between sets
Subjective notes
```

Provide an optional setting:

```text
Include individual laps
```

When enabled, append the existing lap output.

## 6. Add subjective workout fields

Add optional fields to the UI:

```text
RPE: 1-10
Freshness: 1-10
Position: seated / standing / mixed / unknown
Notes: free text
```

These should be appended to the Markdown:

```md
## Athlete Notes

RPE: 8/10
Freshness: 7/10
Position: mixed
Notes: 5-minute intervals seated. Most 30-second efforts standing.
```

Do not attempt to infer seated vs standing from cadence or power data.

## Desired Markdown example

```md
# Activity Data

actex schema: 2

## Activity

Sport: cycling
Date: Sep 9, 2026

## Power

FTP: 410 W

## Heart Rate

Configured Max HR: 190 bpm
90% HRmax: 171 bpm
95% HRmax: 181 bpm

## Interval Sets

### Set 1 - 13 x 30/15

Repetitions: 13
Set Duration: 9:45
Hard Work Duration: 6:30

Work Power:
Average: 505 W
Minimum Rep Average: 491 W
Maximum Rep Average: 526 W
First Half Average: 503 W
Second Half Average: 507 W
Power Fade: -0.8%

Recovery Power:
Average: 249 W

Whole Set:
Average Power: 420 W

Heart Rate:
Start: 145 bpm
Average: 169 bpm
Maximum: 177 bpm
End: 176 bpm
Time >= 90% HRmax: 5:42
Time >= 95% HRmax: 0:00
Time to first reach 90% HRmax: 3:11

Cadence:
Work Average: 98 rpm
Recovery Average: 103 rpm

### Recovery before Set 2

Duration: 5:09
Average Power: 178 W
Lowest HR: 132 bpm
HR at Next Set Start: 144 bpm

### Set 2 - 13 x 30/15

...
```

## Priority

Implementation priority:

1. Interval/set detection
2. Set-level power summary
3. Set-level HR kinetics
4. Recovery-between-set summary
5. Optional raw laps
6. Subjective workout notes

Do not add unrelated metrics until these are working reliably.
