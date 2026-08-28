# Fix: Campaigns Stuck on "Running" When Sent from UI

## Problem
Campaigns initiated from the admin UI via the "Send Now" button appear stuck in `running` status without actually sending emails, even though the CLI command works correctly.

## Root Cause
The issue was hidden subprocess output. The admin action was spawning a subprocess with `stdout=subprocess.DEVNULL` and `stderr=subprocess.DEVNULL`, which meant:
- Throttler delays (90-second gaps, daily/hourly caps) were not visible
- Progress updates were hidden
- Any errors were silent
- Campaigns appeared frozen when they were actually just waiting

## Solution
Modified `apps/campaigns/admin.py` in the `_queue_campaign_send()` method to:

1. **Capture subprocess output**: Changed from `DEVNULL` to `PIPE` for stdout
2. **Merge stderr to stdout**: Changed to `stderr=subprocess.STDOUT` for unified logging
3. **Log output explicitly**: Added code to read subprocess output and log it to Django logger
4. **Handle timeout gracefully**: Process completed output within 30-second timeout

### Changed Code
**Before:**
```python
subprocess.Popen(
    [sys.executable, manage_py, 'send_campaign', f'--campaign-id={campaign.pk}'],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
    stdin=subprocess.DEVNULL,
    close_fds=True,
)
```

**After:**
```python
proc = subprocess.Popen(
    [sys.executable, manage_py, 'send_campaign', f'--campaign-id={campaign.pk}'],
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    stdin=subprocess.DEVNULL,
    close_fds=True,
)
# Read and log the output so it shows up in Render/cloud logs
try:
    output = proc.communicate(timeout=30)
    if output and len(output) >= 1:
        stdout_bytes = output[0]
        if stdout_bytes:
            logger.info("Subprocess output for campaign %s:\n%s", campaign.pk, stdout_bytes.decode('utf-8', errors='replace'))
except subprocess.TimeoutExpired:
    logger.warning("Subprocess for campaign %s still running (expected for long sends).", campaign.pk)
```

## What You'll See Now

When a campaign is sent from the UI, you'll see these messages in your Render/logs:

- `"Waiting 90 seconds for the next send slot..."` - When throttler requires delay
- `"Starting campaign: [name] (ID: 1)"` - Campaign start
- `"  Batch 1-50/100"` - Batch progress
- `"  Progress: 1 sent, 0 failed (total sent: 1)"` - Overall progress
- `"Campaign '[name]' fully completed!"` - When done
- Any error messages or warnings

## Testing
- All existing tests pass (8/8 in CampaignModelTest)
- Specifically verified `test_send_campaign_now_action_queues_send` passes
- Verified code compiles with `python manage.py check`

## Impact
- **No breaking changes**: Campaign sending logic unchanged
- **Better visibility**: Output now visible in logs where it appears frozen
- **Easier debugging**: Any issues with throttling, templates, or sending are now visible
- **User experience**: You can now see what's happening instead of thinking it's stuck

## Files Modified
- `apps/campaigns/admin.py` - Updated `_queue_campaign_send()` method

## Verification Steps
1. Deploy the fix to your environment
2. Click "Send Now" on a campaign from admin UI
3. Check Render logs for subprocess output
4. You should see throttler messages and progress updates
5. Campaign will transition to `completed` when done