#!/bin/bash
# Simulates streaming CSV data — a new data point every 50ms
echo "time,value,series"
i=0
while [ $i -lt 200 ]; do
  t=$(echo "scale=2; $i * 0.1" | bc)
  v1=$(echo "scale=2; 50 + 30 * s($t)" | bc -l)
  v2=$(echo "scale=2; 40 + 20 * c($t)" | bc -l)
  echo "$t,$v1,sine"
  echo "$t,$v2,cosine"
  sleep 0.05
  i=$((i + 1))
done
