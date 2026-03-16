#!/usr/bin/env python3
import json
import re
from pathlib import Path
from urllib import request

ROOT = Path(__file__).resolve().parents[1]
CONFIG = json.loads((Path(__file__).with_name('recon_config.json')).read_text(encoding='utf-8'))
SPECIMENS = ROOT / 'specimens'
OUTPUT = ROOT / 'output'
NOTES = ROOT / 'notes'
for path in (SPECIMENS, OUTPUT, NOTES):
    path.mkdir(parents=True, exist_ok=True)


def slug_name(url: str) -> str:
    cleaned = re.sub(r'[^A-Za-z0-9]+', '_', url).strip('_')
    return cleaned[:80] or 'specimen'


def extension_for(url: str, content_type: str) -> str:
    lowered = content_type.lower()
    if 'json' in lowered:
        return '.json'
    if 'javascript' in lowered or url.endswith('.js'):
        return '.js'
    if 'html' in lowered or url.endswith('.html') or url.endswith('/'):
        return '.html'
    if 'xml' in lowered:
        return '.xml'
    return '.txt'


specimen_results = []
opener = request.build_opener()
opener.addheaders = [('User-Agent', 'OpenFiresideRecon/1.0')]

for spec_url in CONFIG['specimen_urls']:
    result = {'url': spec_url, 'saved': False, 'path': None, 'status': None, 'content_type': None, 'error': None}
    try:
        with opener.open(spec_url, timeout=60) as resp:
            data = resp.read()
            content_type = resp.headers.get('Content-Type', '')
            suffix = extension_for(spec_url, content_type)
            out_path = SPECIMENS / f"{slug_name(spec_url)}{suffix}"
            out_path.write_bytes(data)
            result.update({'saved': True, 'path': str(out_path.relative_to(ROOT)), 'status': getattr(resp, 'status', 200), 'content_type': content_type})
    except Exception as exc:
        result['error'] = str(exc)
    specimen_results.append(result)

(OUTPUT / 'endpoints.json').write_text(json.dumps(CONFIG['endpoints'], indent=2), encoding='utf-8')
(OUTPUT / 'widget_candidates.json').write_text(json.dumps(CONFIG['widgets'], indent=2), encoding='utf-8')
(OUTPUT / 'run_summary.json').write_text(json.dumps({'source_id': CONFIG['source_id'], 'specimens': specimen_results}, indent=2), encoding='utf-8')

specimen_count = sum(1 for item in specimen_results if item['saved'])
specimen_status = f'{specimen_count} saved' if specimen_count else 'none saved'
lines = [
    '# Recon Summary',
    '',
    f"- source label: {CONFIG['source_label']}",
    f"- canonical URL: {CONFIG['canonical_url']}",
    f"- what the page appears to provide: {CONFIG['what_page_provides']}",
    '- likely data-bearing endpoint families:'
]
lines.extend(f"  - {item}" for item in CONFIG['likely_endpoint_families'])
lines.append('- likely map/layer families:')
lines.extend(f"  - {item}" for item in CONFIG['likely_layer_families'])
lines.append(f"- specimen status: {specimen_status}")
lines.append(f"- auth/cors/anti-automation observations if relevant: {CONFIG['auth_notes']}")
lines.append('- widget candidate ideas:')
lines.extend(f"  - {item['label']}: {item['notes']}" for item in CONFIG['widgets'])
lines.append(f"- confidence level: {CONFIG['confidence']}")
lines.append(f"- recommendation: {CONFIG['recommendation']}")
lines.append('')
lines.append('## specimen files')
if specimen_count:
    lines.extend(f"- {item['path']}" for item in specimen_results if item['saved'])
else:
    lines.append('- none')
errors = [item for item in specimen_results if item['error']]
if errors:
    lines.append('')
    lines.append('## specimen fetch notes')
    lines.extend(f"- {item['url']}: {item['error']}" for item in errors)
(NOTES / 'recon_summary.md').write_text('\n'.join(lines).rstrip() + '\n', encoding='utf-8')
print(json.dumps({'source_id': CONFIG['source_id'], 'specimen_count': specimen_count, 'endpoint_count': len(CONFIG['endpoints']), 'widget_candidate_count': len(CONFIG['widgets'])}, indent=2))
