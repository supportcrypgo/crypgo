import os
files_to_check = [
    'src/app/dashboard/components/BottomNav.tsx',
    'src/app/dashboard/components/DesktopSidebar.tsx',
    'src/app/dashboard/components/QuickActionsCard.tsx',
    'src/app/dashboard/components/NotificationBell.tsx',
    'src/app/dashboard/components/RecentActivityCard.tsx',
    'src/app/dashboard/components/Profile/PreferencesContent.tsx',
    'src/context/UnifiedContext.tsx',
    'src/data/store.ts',
    'src/types/unified.ts',
    'src/data/api.ts',
    'django_backend/apps/users/models.py',
    'django_backend/apps/users/views.py',
    'django_backend/apps/users/urls.py',
    'django_backend/apps/users/serializers.py',
]
for filepath in files_to_check:
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        matches = [line.strip() for line in content.split('\n') if any(x in line.lower() for x in ['p2p', 'advertiser'])]
        if matches:
            print(f'{filepath}: {len(matches)} matches')
            for m in matches[:5]:
                print(f'  {m[:80]}')
        else:
            print(f'{filepath}: CLEAN')
    else:
        print(f'{filepath}: NOT FOUND')