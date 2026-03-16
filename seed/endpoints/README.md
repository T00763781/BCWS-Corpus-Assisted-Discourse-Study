The BCWS endpoint catalog is seeded from the user-provided reconnaissance CSV.

The live connector code does not trust every discovered endpoint automatically. It filters the catalog down
to queryable incident, attachment, statistics, and FeatureServer-style service candidates.
