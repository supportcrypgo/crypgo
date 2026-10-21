import io
import logging
import os
import re
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from django.core.files.storage import default_storage
from pypdf.errors import PdfReadError
import pycountry


DATE_PATTERN = re.compile(r'\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b')
LABELED_DOB_PATTERN = re.compile(
    r'\b(?:date\s+of\s+birth|birth\s+date|dob)\s*[:#-]?\s*'
    r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|'
    r'\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})\b',
    re.IGNORECASE,
)
LABELED_REGION_PATTERN = re.compile(
    r'^\s*(?:state(?:\s*/\s*(?:province|region))?|province(?:\s*/\s*state)?|region|county)'
    r'\s*[:#-]\s*([A-Za-z][A-Za-z .\'-]{1,48})\s*$',
    re.IGNORECASE | re.MULTILINE,
)
LABELED_COUNTRY_PATTERN = re.compile(
    r'^\s*(?:country|nationality|issuing\s+country)\s*[:#-]\s*'
    r'([A-Za-z][A-Za-z .\'-]{1,48})\s*$',
    re.IGNORECASE | re.MULTILINE,
)
US_STATE_POSTAL_PATTERN = re.compile(r'\b([A-Z]{2})\s+\d{5}(?:-\d{4})?\b')
MRZ_LINE_PATTERN = re.compile(r'^[A-Z0-9<]{20,}$')
ID_NUMBER_PATTERN = re.compile(r'\b[A-Z0-9]{6,14}\b', re.IGNORECASE)
ID_KEYWORDS = {
    'passport', 'nationality', 'date of birth', 'date of expiry', 'expiry',
    'identity', 'identification', 'driver', 'license', 'licence', 'government',
    'surname', 'given names', 'mrz', 'address', 'republic', 'country',
}
logger = logging.getLogger(__name__)


def _country_from_text(text: str):
    labeled_country = LABELED_COUNTRY_PATTERN.search(text)
    if labeled_country:
        value = labeled_country.group(1).strip()
        if value:
            try:
                return pycountry.countries.lookup(value)
            except LookupError:
                pass

    for line in text.splitlines():
        normalized_line = line.strip().upper()
        if normalized_line.startswith('P<') and len(normalized_line) >= 5:
            country = pycountry.countries.get(alpha_3=normalized_line[2:5])
            if country:
                return country

    normalized = text.casefold()
    for country in sorted(pycountry.countries, key=lambda item: len(item.name), reverse=True):
        names = [country.name]
        if hasattr(country, 'official_name'):
            names.append(country.official_name)
        if hasattr(country, 'common_name'):
            names.append(country.common_name)
        if any(re.search(rf'\b{re.escape(name.casefold())}\b', normalized) for name in names):
            return country
    return None


def _date_of_birth_candidate(text: str) -> str | None:
    match = LABELED_DOB_PATTERN.search(text)
    if match:
        value = match.group(1)
        parts = re.split(r'[/-]', value)
        try:
            if len(parts[0]) == 4:
                candidate = date(int(parts[0]), int(parts[1]), int(parts[2]))
            elif len(parts) == 1:
                candidate = None
                for date_format in ('%d %B %Y', '%d %b %Y', '%B %d %Y', '%b %d %Y'):
                    try:
                        candidate = datetime.strptime(value.replace(',', ''), date_format).date()
                        break
                    except ValueError:
                        continue
                if candidate is None:
                    return None
            else:
                first, second, raw_year = (int(part) for part in parts)
                year = raw_year
                if year < 100:
                    year += 2000 if year <= date.today().year % 100 else 1900
                country = _country_from_text(text)
                if country and country.alpha_2 == 'US':
                    month, day_value = first, second
                else:
                    day_value, month = first, second
                candidate = date(year, month, day_value)
        except (OverflowError, ValueError):
            return None

        if candidate <= date.today():
            return candidate.isoformat()
        return None

    for line in text.splitlines():
        normalized_line = line.strip().upper()
        if MRZ_LINE_PATTERN.fullmatch(normalized_line) and not normalized_line.startswith('P<'):
            birth_value = normalized_line[13:19]
            if len(birth_value) == 6 and birth_value.isdigit():
                year = int(birth_value[:2])
                year += 2000 if year <= date.today().year % 100 else 1900
                try:
                    candidate = date(year, int(birth_value[2:4]), int(birth_value[4:6]))
                except ValueError:
                    return None
                if candidate > date.today():
                    try:
                        candidate = candidate.replace(year=candidate.year - 100)
                    except ValueError:
                        return None
                return candidate.isoformat()
    return None


def _region_candidate(text: str, country: Any | None) -> str | None:
    match = LABELED_REGION_PATTERN.search(text)
    if match:
        return match.group(1).strip(' ,')

    if country:
        state_match = US_STATE_POSTAL_PATTERN.search(text)
        if country.alpha_2 == 'US' and state_match:
            subdivision = pycountry.subdivisions.get(code=f'US-{state_match.group(1)}')
            if subdivision:
                return subdivision.name

        for subdivision in pycountry.subdivisions.get(country_code=country.alpha_2):
            if re.search(rf'\b{re.escape(subdivision.name)}\b', text, re.IGNORECASE):
                return subdivision.name

    return country.name if country else None


def _extract_text(path: str, content_type: str) -> str:
    extension = os.path.splitext(path)[1].lower()
    try:
        if extension == '.pdf':
            from pypdf import PdfReader  # type: ignore[import-not-found]
            with default_storage.open(path, 'rb') as source:
                pdf_data = source.read()
            text = '\n'.join(page.extract_text() or '' for page in PdfReader(io.BytesIO(pdf_data)).pages)
            if text.strip():
                return text

            import pypdfium2 as pdfium  # type: ignore[import-not-found]
            import pytesseract  # type: ignore[import-not-found]
            if os.environ.get('TESSERACT_CMD'):
                pytesseract.pytesseract.tesseract_cmd = os.environ['TESSERACT_CMD']
            document = pdfium.PdfDocument(pdf_data)
            page_text = []
            for page_index in range(len(document)):
                page = document[page_index]
                bitmap = page.render(scale=2)
                page_text.append(pytesseract.image_to_string(bitmap.to_pil()))
                bitmap.close()
                page.close()
            document.close()
            return '\n'.join(page_text)

        if content_type.startswith('image/'):
            import pytesseract  # type: ignore[import-not-found]
            from PIL import Image
            if os.environ.get('TESSERACT_CMD'):
                pytesseract.pytesseract.tesseract_cmd = os.environ['TESSERACT_CMD']
            with default_storage.open(path, 'rb') as source:
                return pytesseract.image_to_string(Image.open(source))
    except (ImportError, OSError, ValueError, RuntimeError, PdfReadError) as error:
        logger.warning('Local KYC OCR could not read an uploaded document: %s', type(error).__name__)
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
        'extraction_status': 'complete' if text.strip() else 'unavailable',
        'text_length': len(text),
        'word_count': word_count,
        'keywords': keywords,
        'dates': dates[:10],
        'id_candidates': id_candidates[:10],
        'document_type_requested': document_type,
    }
    country = _country_from_text(text) if text else None
    if country:
        extracted_data['country_candidate'] = country.name
    if document_type == 'id_front':
        extracted_data['date_of_birth_candidate'] = _date_of_birth_candidate(text)
    if document_type == 'proof_address':
        region = _region_candidate(text, country)
        if region:
            extracted_data['region_candidate'] = region

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