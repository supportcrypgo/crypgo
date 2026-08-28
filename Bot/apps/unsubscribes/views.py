from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction
from django.contrib import messages
from django.utils import timezone
from apps.campaigns.models import CampaignLead, Campaign
from .models import UnsubscribedLead
import logging

logger = logging.getLogger('email_bot')


def unsubscribe_landing(request):
    """Serve the new unsubscribe landing page with email auto-filled from query param"""
    email = request.GET.get('email', '')
    return render(request, 'unsubscribes/unsubscribe_landing.html', {'email': email})


@csrf_exempt
def unsubscribe_process_ajax(request):
    """Process unsubscribe via AJAX POST (new endpoint)"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    email = request.POST.get('email')
    if not email:
        return JsonResponse({'error': 'Email is required'}, status=400)
    
    reason = request.POST.get('reason', 'User requested unsubscribe')
    
    try:
        with transaction.atomic():
            existing, created = UnsubscribedLead.objects.get_or_create(
                email=email,
                defaults={
                    'document_id': None,
                    'campaign_name': '',
                    'reason': reason,
                }
            )
            
            # Update CampaignLead records
            campaign_leads = CampaignLead.objects.filter(
                recipient_email__iexact=email,
                status__in=['pending', 'queued', 'sent']
            )
            for cl in campaign_leads:
                cl.status = 'unsubscribed'
                cl.unsubscribed_at = timezone.now()
                cl.save()
            
            # Update Campaign unsubscribe_count
            for campaign_id in campaign_leads.values_list('campaign', flat=True).distinct():
                campaign_obj = Campaign.objects.get(id=campaign_id)
                campaign_obj.unsubscribe_count += 1
                campaign_obj.save()
            
            logger.info(f'User unsubscribed via AJAX: {email}')
            return JsonResponse({'success': True, 'message': f'{email} unsubscribed successfully'})
            
    except Exception as e:
        logger.error(f'Unsubscribe failed for {email}: {str(e)}')
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


def unsubscribe_confirm(request, email):
    """Show unsubscribe confirmation page"""
    context = {'email': email}
    return render(request, 'unsubscribes/confirm.html', context)


def unsubscribe_success(request, email):
    """Show unsubscribe success page"""
    context = {
        'email': email,
        'already_unsubscribed': False,
    }
    return render(request, 'unsubscribes/unsubscribed.html', context)


def unsubscribe_process(request, email):
    """Process unsubscribe request"""
    if request.method != 'POST':
        return redirect('unsubscribes:unsubscribe_confirm', email=email)
    
    reason = request.POST.get('reason', 'User requested unsubscribe')
    
    try:
        with transaction.atomic():
            existing, created = UnsubscribedLead.objects.get_or_create(
                email=email,
                defaults={
                    'document_id': None,
                    'campaign_name': '',
                    'reason': reason,
                }
            )
            
            if not created:
                messages.info(request, f'Email {email} was already unsubscribed.')
                return render(request, 'unsubscribes/unsubscribed.html', {
                    'email': email,
                    'already_unsubscribed': True,
                })
            
            # Update CampaignLead records
            campaign_leads = CampaignLead.objects.filter(
                recipient_email__iexact=email,
                status__in=['pending', 'queued', 'sent']
            )
            for cl in campaign_leads:
                cl.status = 'unsubscribed'
                cl.unsubscribed_at = timezone.now()
                cl.save()
            
            # Update Campaign unsubscribe_count
            for campaign_id in campaign_leads.values_list('campaign', flat=True).distinct():
                campaign_obj = Campaign.objects.get(id=campaign_id)
                campaign_obj.unsubscribe_count += 1
                campaign_obj.save()
            
            logger.info(f'User unsubscribed: {email}')
            
    except Exception as e:
        logger.error(f'Unsubscribe failed for {email}: {str(e)}')
        messages.error(request, 'There was an error processing your unsubscribe request.')
        return redirect('unsubscribes:unsubscribe_confirm', email=email)
    
    return render(request, 'unsubscribes/unsubscribed.html', {
        'email': email,
        'already_unsubscribed': False,
    })
