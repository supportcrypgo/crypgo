import os, sys, re
os.environ['DJANGO_SETTINGS_MODULE'] = 'bot_project.settings'
sys.path.insert(0, os.getcwd())

import django
django.setup()

from apps.templates.models import EmailTemplate

# Get template 3
t = EmailTemplate.objects.get(id=3)
print(f"Template: {t.name}")
print(f"Contains '{{{{ email }}}}': {'{{ email }}' in t.html_content}")
print(f"Contains '{{{{ greeting }}}}': {'{{ greeting }}' in t.html_content}")

# Find all greeting patterns
matches = list(re.finditer(r'Hi.*?\{\{.*?\}\}', t.html_content))
print(f"\nGreeting lines found: {len(matches)}")
for m in matches:
    start = max(0, m.start() - 50)
    end = min(len(t.html_content), m.end() + 50)
    context = t.html_content[start:end]
    print(f"  At position {m.start()}: ...{repr(context)}...")

if '{{ email }}' in t.html_content:
    # Replace {{ email }} with {{ greeting }} in the greeting line
    # Be precise: only replace the greeting occurrence
    old = '<strong style="color: #0f172a;">Hi {{ email }},</strong>'
    new = '<strong style="color: #0f172a;">Hi {{ greeting }},</strong>'
    if old in t.html_content:
        t.html_content = t.html_content.replace(old, new)
        t.save()
        print(f"\nReplaced greeting line!")
    else:
        # Try alternate patterns
        if 'Hi {{ email }}' in t.html_content:
            t.html_content = t.html_content.replace('Hi {{ email }}', 'Hi {{ greeting }}')
            t.save()
            print(f"\nReplaced with alternate pattern!")
        else:
            print(f"\nCould not find exact pattern to replace")
            # Print what's around "Hi"
            idx = t.html_content.find('Hi {{')
            if idx >= 0:
                print(f"Found 'Hi {{' at {idx}: {repr(t.html_content[idx:idx+100])}")

# Verify
t2 = EmailTemplate.objects.get(id=3)
print(f"\nAfter fix:")
print(f"Contains '{{{{ email }}}}': {'{{ email }}' in t2.html_content}")
print(f"Contains '{{{{ greeting }}}}': {'{{ greeting }}' in t2.html_content}")