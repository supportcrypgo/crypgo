import io
import os
import re
from decimal import Decimal
from typing import Any

from django.core.files.storage import default_storage
from django.utils import timezone


DATE_PATTERN = re.compile(r'\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b')
ID_NUMBER_PATTERN = re.compile(r'\b[A-Z0-9]{6,14}\b', re.IGNORECASE)
ID_KEYWORDS = {
    'passport', 'nationality', 'date of birth', 'date of expiry', 'expiry',
    'identity', 'identification', 'driver', 'license', 'licence', 'government',
    'surname', 'given names', 'mrz', 'address', 'republic', 'country',
}


def _extract_text(path: str, content_type: str) -> str:
    extension = os.path.splitext(path)[1].lower()
    try:
        if extension == '.pdf':
            from pypdf import PdfReader  # type: ignore[import-not-found]
            with default_storage.open(path, 'rb') as source:
                return '\n'.join(page.extract_text() or '' for page in PdfReader(source).pages)

        if content_type.startswith('image/'):
            import pytesseract  # type: ignore[import-not-found]
            from PIL import Image
            with default_storage.open(path, 'rb') as source:
                return pytesseract.image_to_string(Image.open(source))
    except (ImportError, OSError, ValueError):
        return ''
    return ''


def screen_document(path: str, content_type: str, document_type: str) -> dict[str, Any]:
    text = _extract_text(path, content_type)
    normalized = ' '.join(text.lower().split())
    keywords = sorted(keyword for keyword in ID_KEYWORDS if keyword in normalized)
    dates = DATE_PATTERN.findall(text)
    id_candidates = ID_NUMBER_PATTERN.findall(text)
    word_count = len(normalized.split())

    extracted_data = {
        'text_length': len(text),
        'word_count': word_count,
        'keywords': keywords,
        'dates': dates[:10],
        'id_candidates': id_candidates[:10],
        'document_type_requested': document_type,
    }

    if not text:
        return {
            'screening_status': 'manual_review',
            'screening_score': Decimal('0'),
            'screening_reason': 'OCR is unavailable or produced no readable text; manual review required.',
            'extracted_data': extracted_data,
        }

    signal_count = len(keywords) + min(len(dates), 2) + (1 if id_candidates else 0)
    score = min(Decimal('0.99'), Decimal(signal_count) / Decimal('8'))
    if word_count > 250 and signal_count < 3:
        return {
            'screening_status': 'rejected',
            'screening_score': score,
            'screening_reason': 'The uploaded file appears to be general text rather than an identity document.',
            'extracted_data': extracted_data,
        }

    if signal_count < 2:
        return {
            'screening_status': 'manual_review',
            'screening_score': score,
            'screening_reason': 'Insufficient identity-document signals; manual review required.',
            'extracted_data': extracted_data,
        }

    return {
        'screening_status': 'manual_review',
        'screening_score': score,
        'screening_reason': 'Document signals detected; authenticity and identity still require verification.',
        'extracted_data': extracted_data,
    }