import os
import runpy
from pathlib import Path


SOURCE = Path(__file__).resolve()
os.environ["OF_BCWS_SOURCE_ROOT"] = str(SOURCE.parents[1])
runpy.run_path(str(SOURCE.parents[2] / "02_bcws_dashboard" / "scripts" / "deepen_bcws_recon.py"), run_name="__main__")
