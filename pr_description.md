⚡ Optimize cross-file duplicate checking

💡 **What:**
Moved the `.strip()` string operation out of the tight loop in `find_cross_file_duplicates` in `Scripts/deduplicate.py`. The rule strings are now normalized immediately upon reading in `process_content` via `line = raw_line.strip()`.

🎯 **Why:**
Previously, the code invoked `rule.strip()` on every rule against every file combination during the cross-file duplicate check. This resulted in redundant string operations and truthiness checks inside a very tight loop. By normalizing the data earlier in the pipeline, we safely eliminate the need for per-rule operations downstream, improving CPU efficiency without altering the program's logic.

📊 **Measured Improvement:**
A benchmark with a synthetic dataset of 10 files (each containing 10,000 rules drawn from a pool of 50,000 unique UUIDs, including intentionally unstripped strings) demonstrated a noticeable performance increase:
- **Baseline:** ~0.6705 seconds (10 iterations)
- **Optimized:** ~0.5277 seconds (10 iterations)
- **Improvement:** ~21.29% reduction in execution time for the cross-file duplicate detection phase.

Additionally, this PR cleans up a lingering Git merge conflict marker `>>>>>>> origin/jules/...` in `Scripts/test_update_lists.py` that was causing `SyntaxError` failures during test discovery.
