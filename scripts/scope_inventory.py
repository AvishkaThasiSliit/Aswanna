import os
import re

patterns = ['forecastService', '/forecast', 'ForecastCard', 'FORECAST_MODE', 'conformalQuantiles', 'exportCycles', 'forecast']
ignore_dirs = {'node_modules', '.git', '.venv', '__pycache__', 'logs', 'dist', 'Profit Folder'}
valid_exts = {'.js', '.jsx', '.json', '.md', '.py', '.txt', '.env', '.example', '.html', '.css'}

results = []
for root, dirs, files in os.walk('.'):
    dirs[:] = [d for d in dirs if d not in ignore_dirs and not d.startswith('.')]
    for file in files:
        ext = os.path.splitext(file)[1].lower()
        if ext not in valid_exts and not file.startswith('.env'):
            continue
        filepath = os.path.join(root, file)
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            matched = []
            for p in patterns:
                if p in content:
                    matched.append(p)
            if matched:
                results.append((filepath.replace('\\', '/'), matched))
        except Exception:
            pass

os.makedirs('logs', exist_ok=True)
with open('logs/scope-inventory.txt', 'w', encoding='utf-8') as out:
    out.write('=== READ-ONLY INVENTORY: FILES/COMPONENTS REFERENCING FORECAST ===\n\n')
    for path, matched in sorted(results):
        out.write(f'{path} -> {", ".join(matched)}\n')
print(f'Inventory written: {len(results)} files')
