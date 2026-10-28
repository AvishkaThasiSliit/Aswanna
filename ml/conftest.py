import sys
from pathlib import Path

# Add D:\Aswanna to sys.path so 'ml' module is recognized
repo_root = Path(__file__).resolve().parent.parent
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))
