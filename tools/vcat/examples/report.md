# Q1 Incident Report

## Revenue Impact

Revenue was strongest in NA, with APAC trailing:

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "mark": "bar",
  "title": "Q1 Revenue by Region",
  "data": {
    "values": [
      {"region": "EMEA", "revenue": 4.2},
      {"region": "NA", "revenue": 7.1},
      {"region": "APAC", "revenue": 3.8}
    ]
  },
  "encoding": {
    "x": {"field": "region", "type": "nominal", "title": "Region"},
    "y": {"field": "revenue", "type": "quantitative", "title": "Revenue (M USD)"}
  }
}
```

## Latency During Incident

The API Gateway saw a dip during the Feb deploy, while database latency remained stable:

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "mark": "line",
  "title": "Latency P99 Over Time",
  "data": {
    "values": [
      {"date": "2026-01", "service": "API Gateway", "latency": 120},
      {"date": "2026-02", "service": "API Gateway", "latency": 95},
      {"date": "2026-03", "service": "API Gateway", "latency": 110},
      {"date": "2026-01", "service": "Database", "latency": 45},
      {"date": "2026-02", "service": "Database", "latency": 42},
      {"date": "2026-03", "service": "Database", "latency": 48}
    ]
  },
  "encoding": {
    "x": {"field": "date", "type": "temporal", "title": "Date"},
    "y": {"field": "latency", "type": "quantitative", "title": "Latency (ms)"},
    "color": {"field": "service", "type": "nominal"}
  }
}
```

## Conclusion

The latency dip correlated with the Feb 1 deploy. No lasting impact on revenue.
