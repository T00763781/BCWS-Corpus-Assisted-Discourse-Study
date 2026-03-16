# Next Steps

1. Remove the remaining untracked local archive artifacts so the working directory is physically as clean as the pushed repo.
2. Decide whether demo connectors should be idempotent or intentionally append validation data on every run.
3. Add an automated browser regression that asserts the desktop web workspace loads and renders KPI counts from `/api/analytics/snapshot`.
4. Extend the connector smoke suite to cover `seed-demo.cmd` end to end on Windows.
5. Verify the Tauri shell against the same `/api` contract once the desktop runtime toolchain is available.
