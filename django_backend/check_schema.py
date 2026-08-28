import yaml
import subprocess
import os

# Regenerate schema in the django_backend directory
result = subprocess.run(
    ['python', 'manage.py', 'spectacular', '--file', 'schema_test.json'],
    cwd='django_backend',
    capture_output=True,
    text=True,
    encoding='utf-8'
)

if result.returncode != 0:
    print("Schema generation failed:")
    print(result.stderr)
    exit(1)

schema_path = 'schema_test.json'
with open(schema_path, 'r', encoding='utf-8') as f:
    data = yaml.safe_load(f)

paths = data.get('paths', {})
api_paths = [p for p in paths if p.startswith('/api/')]
print(f'Total API paths: {len(api_paths)}')
print()
for p in sorted(api_paths):
    methods = list(paths[p].keys())
    print(f'{p} -> {methods}')