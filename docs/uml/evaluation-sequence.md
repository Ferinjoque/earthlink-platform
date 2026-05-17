# Evaluation Flow — Sequence Diagram

Shows how `EvaluationService.evaluate()` orchestrates the FP calc engine
and OOP repositories to produce an `EvaluationTotals`.

```mermaid
sequenceDiagram
    autonumber
    actor Auditor
    participant ES as EvaluationService
    participant RPRepo as ReportingPeriodRepository
    participant AERepo as ActivityEntryRepository
    participant EFRepo as EmissionFactorRepository
    participant UCRepo as UnitConversionRepository
    participant Calc as calc/pipeline (FP)
    participant ERRepo as EmissionResultRepository

    Auditor->>ES: evaluate(periodId)

    ES->>RPRepo: findById(periodId)
    RPRepo-->>ES: ReportingPeriod { supplierId }

    par Load entries & tables in parallel
        ES->>AERepo: findByPeriodId(periodId)
        AERepo-->>ES: ActivityEntry[]
    and
        ES->>EFRepo: buildFactorTable()
        EFRepo-->>ES: FactorTable (ReadonlyMap)
    and
        ES->>UCRepo: buildConversionTable()
        UCRepo-->>ES: ConversionTable (ReadonlyMap)
    end

    loop For each ActivityEntry
        ES->>ES: entry.toActivityRecord(supplierId)
        ES->>Calc: _internals.resolveFactor(activity, factors)
        Calc-->>ES: EmissionFactor | CalcError

        alt factor resolved
            ES->>Calc: calculate(record, factors, conversions)
            Note right of Calc: validateActivity →<br/>normalizeUnit →<br/>resolveFactor →<br/>applyFactor →<br/>stampProvenance (sha256)
            Calc-->>ES: CalcResult<EmissionResult>
        else factor missing
            ES->>ES: record error, continue
        end
    end

    ES->>ERRepo: insertMany(results)
    Note right of ERRepo: Append-only — trigger<br/>prevents UPDATE/DELETE

    ES->>Calc: aggregate(results)
    Calc-->>ES: EvaluationTotals

    ES-->>Auditor: EvaluationOutcome { totals, errors }
```

## Lock Flow (AuditService)

```mermaid
sequenceDiagram
    autonumber
    actor Auditor
    participant AuS as AuditService
    participant RPRepo as ReportingPeriodRepository
    participant ALRepo as AuditLogRepository (append-only)

    Auditor->>AuS: lock(periodId, userId)
    AuS->>RPRepo: findById(periodId)
    RPRepo-->>AuS: ReportingPeriod

    alt period not found
        AuS-->>Auditor: throw Error("not found")
    else period already locked
        AuS-->>Auditor: throw Error("already locked")
    else period is lockable
        AuS->>RPRepo: updateStatus(periodId, "locked")
        RPRepo-->>AuS: ReportingPeriod (locked)
        AuS->>ALRepo: log("LOCK", "reporting_periods", periodId, userId)
        Note right of ALRepo: Immutable row written;<br/>DB trigger prevents mutation
        AuS-->>Auditor: ReportingPeriod (locked)
    end
```

## Anomaly Detection Flow (AnomalyService)

```mermaid
sequenceDiagram
    autonumber
    participant Caller
    participant AnS as AnomalyService (pure FP)

    Caller->>AnS: detect(currentEntries, historicalEntries)

    loop For each current ActivityEntry
        AnS->>AnS: filter historical by sourceType
        alt baseline.length < 2
            AnS->>AnS: skip (insufficient data)
        else baseline sufficient
            AnS->>AnS: compute mean(baseline)
            AnS->>AnS: compute stddev(baseline, mean)
            AnS->>AnS: zScore = |value - mean| / stddev
            alt z >= Z_THRESHOLD_LOW (2.0)
                AnS->>AnS: push DetectedAnomaly { severity }
            end
        end
    end

    AnS-->>Caller: DetectedAnomaly[]
```
