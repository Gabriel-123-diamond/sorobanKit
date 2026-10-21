# Grafana Alerting: `StellarTagsDBPoolWaiting`

This document explains how to import and configure the `StellarTagsDBPoolWaiting` alert in Grafana. The alert notifies operators when the database connection pool is saturated, i.e. when queries are waiting for a free pool connection.

## Alert Overview

| Property | Value |
| --- | --- |
| Alert name | `StellarTagsDBPoolWaiting` |
| Metric | `stellar_tags_db_pool_queries_waiting` |
| Condition | `> 5` |
| Duration (`for`) | `30s` |
| Severity | `warning` |
| Summary | DB pool saturation: queries are waiting for a free connection |

The metric `stellar_tags_db_pool_queries_waiting` is a gauge that tracks the number of queries currently waiting for a free connection from the database pool. A sustained value above `5` indicates pool saturation and imminent query timeouts.

## Option 1: Import the Prometheus Alerting Rule

The canonical rule definition lives in [`docs/prometheus-alerts.yml`](./prometheus-alerts.yml). If you run Prometheus with Grafana, load the rule file into Prometheus and let Grafana display the resulting alerts.

### 1. Load the rule into Prometheus

Add the rule file to your Prometheus configuration:

```yaml
# prometheus.yml
rule_files:
  - /etc/prometheus/rules/prometheus-alerts.yml
```

Copy `docs/prometheus-alerts.yml` to the path referenced above (e.g. `/etc/prometheus/rules/prometheus-alerts.yml`) and reload Prometheus:

```bash
curl -X POST http://localhost:9090/-/reload
```

Verify the rule is loaded under **Status → Rules** in the Prometheus UI.

### 2. Add Prometheus as a Grafana data source

1. In Grafana, go to **Connections → Data sources → Add data source**.
2. Select **Prometheus**.
3. Set the URL to your Prometheus server (e.g. `http://prometheus:9090`).
4. Click **Save & test**.

### 3. View the alert in Grafana

Once Prometheus evaluates the rule, the alert appears in Grafana under **Alerting → Alert rules** (grouped by the Prometheus data source) and in **Alerting → Alert groups**. Firing alerts are visible in the **Alerting** view and can be routed to contact points as described below.

## Option 2: Create a Grafana-Managed Alert

If you prefer Grafana to evaluate the alert directly (no Prometheus rule file required), create a Grafana-managed alert rule.

### 1. Create the alert rule

1. Go to **Alerting → Alert rules → New alert rule**.
2. **Rule name:** `StellarTagsDBPoolWaiting`
3. **Folder:** choose or create a folder (e.g. `Stellar Tags`).
4. **Evaluation group:** create a group (e.g. `stellar-tags-db`) with an evaluation interval of `10s` (must be shorter than the `30s` duration).
5. **Data source:** select your Prometheus data source.
6. **Query:** enter the following PromQL:

   ```promql
   stellar_tags_db_pool_queries_waiting
   ```

7. **Condition:** set the reducer to **Last** and the threshold to **Is above** `5`.
8. **Pending period:** set to `30s` (equivalent to the Prometheus `for: 30s`).
9. **Labels:** add `severity: warning` and `component: database`.
10. **Annotations:**
    - **Summary:** `DB pool saturation: queries are waiting for a free connection`
    - **Description:** `stellar_tags_db_pool_queries_waiting is {{ $values.A.Value }} (threshold 5) for more than 30s.`
11. Click **Save rule and exit**.

### 2. Equivalent PromQL (for reference)

The rule fires when the gauge exceeds `5` for more than `30s`:

```promql
stellar_tags_db_pool_queries_waiting > 5
```

## Configure Notification Channels (Contact Points)

Notification delivery (Slack, PagerDuty, email, etc.) is an operator choice and is out of scope for the repository. To wire up notifications:

1. Go to **Alerting → Contact points → New contact point**.
2. Choose an integration type (e.g. Slack, PagerDuty, Email, Webhook) and fill in the required settings.
3. Go to **Alerting → Notification policies**.
4. Add a policy that matches the alert label `severity=warning` (or `alertname=StellarTagsDBPoolWaiting`) and routes it to the contact point created above.

## Testing the Alert

You can validate the rule with a mock time series before relying on it in production:

1. In Grafana **Explore**, select the Prometheus data source.
2. Run the query `stellar_tags_db_pool_queries_waiting` and confirm the metric is being scraped.
3. To simulate a firing alert, temporarily lower the threshold to `0` in a test copy of the rule, or use a recording rule / test exporter that emits a value above `5`.
4. Confirm the alert transitions to **Pending** and then **Firing** after `30s`.

Alternatively, validate the Prometheus rule file with `promtool`:

```bash
promtool check rules docs/prometheus-alerts.yml
```

## Related Files

- [`docs/prometheus-alerts.yml`](./prometheus-alerts.yml) — Prometheus alerting rule definition.
- [`docs/grafana-dashboard.json`](./grafana-dashboard.json) — Grafana dashboard, including the embedded alert panel for this metric.
- [`README.md`](../README.md) — Monitoring section referencing the alert file.