#!/usr/bin/env python3
"""Run pre-commit hooks via prek. Usage: run_pre_commit.py [--all-files]"""

import subprocess
import sys

sys.exit(subprocess.run(["prek", "run", *sys.argv[1:]]).returncode)
