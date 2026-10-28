import os
import sys

os.environ["TEMP"] = r"D:\Aswanna\temp"
os.environ["TMP"] = r"D:\Aswanna\temp"
os.environ["MPLCONFIGDIR"] = r"D:\Aswanna\temp\mpl-config"

service_dir = os.path.dirname(os.path.abspath(__file__))
if service_dir not in sys.path:
    sys.path.insert(0, service_dir)

import uvicorn

if __name__ == "__main__":
    uvicorn.run("prediction_api:app", host="127.0.0.1", port=8000, log_level="info")
