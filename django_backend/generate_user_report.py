#!/usr/bin/env python3
"""
Generate a PDF report for a specific user with:
- Company logo
- User information
- Wallet balances (only assets with balance > 0)
- Transaction history table
- Black and white only
"""

import argparse
import base64
from contextlib import redirect_stdout
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / '.env')
load_dotenv(BASE_DIR.parent / '.env')

import django
from django.apps import apps
from datetime import datetime, timedelta, timezone as datetime_timezone
from decimal import Decimal
from json import dumps, loads
from urllib.parse import urlencode
from urllib.request import Request, urlopen

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if not apps.ready:
    django.setup()

from apps.users.models import CustomUser, WalletAsset, Transaction
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import black, white, Color
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
)
from reportlab.platypus.flowables import Flowable
from io import BytesIO
from svglib.svglib import svg2rlg


# ============================================================
# Black & White Color Palette
# ============================================================
BLACK = black
WHITE = white
GRAY_LIGHT = Color(0.85, 0.85, 0.85)   # Light gray for alternating rows
GRAY_MEDIUM = Color(0.6, 0.6, 0.6)      # Medium gray for borders
GRAY_DARK = Color(0.5, 0.5, 0.5)        # Medium-light gray for headers
TRANSPARENT = Color(0, 0, 0, alpha=0)


# ============================================================
# Custom Flowables
# ============================================================
class ColoredRect(Flowable):
    """A simple colored rectangle flowable."""
    def __init__(self, width, height, color):
        Flowable.__init__(self)
        self.width = width
        self.height = height
        self.color = color

    def draw(self):
        self.canv.setFillColor(self.color)
        self.canv.rect(0, 0, self.width, self.height, fill=1, stroke=0)


class RoundedRect(Flowable):
    """A rounded rectangle background for cards."""
    def __init__(self, width, height, radius=8, fill_color=WHITE, stroke_color=GRAY_MEDIUM, stroke_width=1):
        Flowable.__init__(self)
        self.width = width
        self.height = height
        self.radius = radius
        self.fill_color = fill_color
        self.stroke_color = stroke_color
        self.stroke_width = stroke_width

    def draw(self):
        canvas = self.canv
        canvas.setFillColor(self.fill_color)
        canvas.setStrokeColor(self.stroke_color)
        canvas.setLineWidth(self.stroke_width)
        canvas.roundRect(0, 0, self.width, self.height, self.radius, fill=1, stroke=1)


# ============================================================
# Image Loading Helper
# ============================================================
def load_image_for_reportlab(image_path):
    """Verify PNG/JPG file exists and is readable for ReportLab.
    Returns the path if successful, None if failed.
    ReportLab's Image class handles loading and sizing automatically."""
    try:
        from PIL import Image as PILImage
        # Verify the image can be opened
        pil_img = PILImage.open(image_path)
        pil_img.verify()  # Verify it's a valid image
        return image_path
    except Exception as e:
        print(f"Image load error: {e}")
        return None


COINGECKO_IDS = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'USDT': 'tether',
    'BNB': 'binancecoin',
    'SOL': 'solana',
    'LTC': 'litecoin',
    'XRP': 'ripple',
    'ADA': 'cardano',
    'DOT': 'polkadot',
    'DOGE': 'dogecoin',
    'LINK': 'chainlink',
}
MARKET_PRICE_AS_OF = None
PRICE_LOOKUP_TIMEOUT_SECONDS = 3
PRICE_CACHE_MAX_AGE = timedelta(hours=24)
PRICE_CACHE_PATH_OVERRIDE = None


def _price_cache_file_path():
    configured_path = PRICE_CACHE_PATH_OVERRIDE or os.environ.get('CRYPGO_REPORT_PRICE_CACHE')
    if configured_path:
        cache_path = Path(configured_path).expanduser()
        if not cache_path.is_absolute():
            raise ValueError('CRYPGO_REPORT_PRICE_CACHE must be an absolute path.')
        return str(cache_path)
    return str(Path.home() / '.cache' / 'crypgo' / 'report_market_prices.json')


def _load_cached_usd_prices(tickers):
    try:
        with open(_price_cache_file_path(), encoding='utf-8') as cache_file:
            cached = loads(cache_file.read())
        if cached.get('schema_version') != 1:
            return {}, None
        cached_at = datetime.fromisoformat(cached['fetched_at'])
        if cached_at.tzinfo is None:
            return {}, None
        age = datetime.now(datetime_timezone.utc) - cached_at.astimezone(datetime_timezone.utc)
        if age < timedelta(0) or age > PRICE_CACHE_MAX_AGE:
            return {}, None
        cached_prices = cached.get('prices', {})
        if not isinstance(cached_prices, dict):
            return {}, None
        prices = {
            ticker: Decimal(str(price))
            for ticker, price in cached_prices.items()
            if ticker in tickers and ticker in COINGECKO_IDS and Decimal(str(price)) > 0
        }
        return prices, cached_at.astimezone(datetime_timezone.utc)
    except (ArithmeticError, OSError, KeyError, TypeError, ValueError):
        return {}, None


def _cache_usd_prices(prices, fetched_at, quote_timestamps=None):
    if not prices:
        return
    cache_path = _price_cache_file_path()
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    temporary_path = f'{cache_path}.{os.getpid()}.tmp'
    try:
        with open(temporary_path, 'w', encoding='utf-8') as cache_file:
            cache_file.write(dumps({
                'schema_version': 1,
                'fetched_at': fetched_at.isoformat(),
                'source': 'coingecko',
                'prices': {ticker: str(price) for ticker, price in prices.items()},
                'quote_timestamps': quote_timestamps or {},
            }))
        os.replace(temporary_path, cache_path)
    except OSError as error:
        print(f'Could not update report price cache: {error}')
        try:
            os.remove(temporary_path)
        except OSError:
            pass
        raise OSError(f'Could not publish report price snapshot to {cache_path}.') from error


def refresh_report_price_snapshot():
    """Fetch all supported report prices once and atomically publish a snapshot."""
    global MARKET_PRICE_AS_OF

    requested_ids = sorted(set(COINGECKO_IDS.values()))
    query = urlencode({
        'ids': ','.join(requested_ids),
        'vs_currencies': 'usd',
        'include_last_updated_at': 'true',
    })
    api_key = (
        os.environ.get('CAMPAIGN_REPORT_COINGECKO_API_KEY')
        or os.environ.get('CRYPGO_COINGECKO_API_KEY')
        or os.environ.get('COINGECKO_API_KEY')
        or ''
    ).strip()
    api_key_tier = (
        os.environ.get('CAMPAIGN_REPORT_COINGECKO_API_KEY_TIER')
        or os.environ.get('CRYPGO_COINGECKO_API_KEY_TIER')
        or os.environ.get('COINGECKO_API_KEY_TIER')
        or 'demo'
    ).strip().lower()
    headers = {'Accept': 'application/json', 'User-Agent': 'Crypgo/1.0'}
    api_base_url = 'https://api.coingecko.com'
    if api_key:
        if api_key_tier not in {'demo', 'pro'}:
            raise ValueError('COINGECKO_API_KEY_TIER must be either "demo" or "pro".')
        headers[f'x-cg-{api_key_tier}-api-key'] = api_key
        if api_key_tier == 'pro':
            api_base_url = 'https://pro-api.coingecko.com'

    request = Request(
        f'{api_base_url}/api/v3/simple/price?{query}',
        headers=headers,
    )
    with urlopen(request, timeout=PRICE_LOOKUP_TIMEOUT_SECONDS) as response:
        payload = loads(response.read().decode('utf-8'))
    fetched_at = datetime.now(datetime_timezone.utc)
    prices = {}
    quote_timestamps = {}
    for ticker, coingecko_id in COINGECKO_IDS.items():
        market = payload.get(coingecko_id, {})
        raw_price = market.get('usd') if isinstance(market, dict) else None
        if raw_price is None:
            continue
        price = Decimal(str(raw_price))
        if not price.is_finite() or price <= 0:
            continue
        prices[ticker] = price
        quote_timestamp = market.get('last_updated_at')
        if isinstance(quote_timestamp, (int, float)):
            quote_timestamps[ticker] = datetime.fromtimestamp(
                quote_timestamp, datetime_timezone.utc
            ).isoformat()
    if not prices:
        raise ValueError('CoinGecko returned no valid report prices.')

    _cache_usd_prices(prices, fetched_at, quote_timestamps)

    MARKET_PRICE_AS_OF = fetched_at.strftime('%B %d, %Y at %H:%M UTC')
    print(f'Cached {len(prices)} live CoinGecko prices at {MARKET_PRICE_AS_OF}.')
    return prices


def get_report_usd_prices(tickers):
    """Read a fresh campaign snapshot; never make network calls during PDF generation."""
    global MARKET_PRICE_AS_OF

    prices, fetched_at = _load_cached_usd_prices(tickers)
    if fetched_at:
        MARKET_PRICE_AS_OF = fetched_at.strftime('%B %d, %Y at %H:%M UTC')
    else:
        MARKET_PRICE_AS_OF = None
    return prices
    _cache_usd_prices(prices, fetched_at)
    return prices


def get_transaction_fiat_display(transaction, spot_prices):
    """Format recorded or derived USD transaction value, marking spot estimates."""
    if transaction.fiat_amount is not None:
        return f"${Decimal(str(transaction.fiat_amount)):,.2f}"

    amount = Decimal(str(transaction.amount))
    if transaction.price_at_time is not None:
        return f"${amount * Decimal(str(transaction.price_at_time)):,.2f}"

    spot_price = spot_prices.get(transaction.asset.upper())
    if spot_price is not None:
        return f"~${amount * spot_price:,.2f}"

    return "\u2014"


def get_report_transaction_type(transaction_type, display_label):
    return {
        'transfer_out': 'Sent',
        'transfer_in': 'Received',
    }.get(transaction_type.lower(), display_label)


# ============================================================
# PDF Generation
# ============================================================
def generate_user_report_bytes(user):
    """Generate and return a PDF report for an already-resolved user."""
    
    assets = WalletAsset.objects.filter(user=user)
    transactions = Transaction.objects.filter(user=user).order_by('-created_at')
    
    # Filter assets with balance > 0
    assets_with_balance = [a for a in assets if Decimal(str(a.quantity)) > Decimal('0')]
    price_tickers = {asset.ticker.upper() for asset in assets_with_balance}
    price_tickers.update(transaction.asset.upper() for transaction in transactions)
    prices = get_report_usd_prices(price_tickers)
    
    # Calculate total portfolio value early (needed for header)
    total_usd = Decimal('0')
    available_usd = Decimal('0')
    pending_usd = Decimal('0')
    missing_asset_prices = False
    
    for asset in assets_with_balance:
        qty = Decimal(str(asset.quantity))
        price = prices.get(asset.ticker.upper())
        if price is None:
            missing_asset_prices = True
            continue
        total_usd += qty * price
        available_usd += Decimal(str(asset.available_quantity)) * price
        pending_usd += Decimal(str(asset.locked_quantity)) * price
    
    # ============================================================
    # Document Setup
    # ============================================================
    output_buffer = BytesIO()
    doc = SimpleDocTemplate(
        output_buffer,
        pagesize=A4,
        leftMargin=20*mm,
        rightMargin=20*mm,
        topMargin=20*mm,
        bottomMargin=20*mm,
    )
    
    page_width, page_height = A4
    content_width = page_width - 40*mm
    
    # ============================================================
    # Styles
    # ============================================================
    styles = getSampleStyleSheet()
    
    style_title = ParagraphStyle(
        'CustomTitle',
        parent=styles['Title'],
        fontName='Times-Bold',
        fontSize=20,
        leading=24,
        textColor=BLACK,
        alignment=TA_CENTER,
        spaceAfter=6,
    )
    
    style_subtitle = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Normal'],
        fontName='Times-Roman',
        fontSize=10,
        leading=14,
        textColor=GRAY_DARK,
        alignment=TA_CENTER,
        spaceAfter=12,
    )
    
    style_section = ParagraphStyle(
        'SectionHeader',
        parent=styles['Heading2'],
        fontName='Times-Bold',
        fontSize=12,
        leading=15,
        textColor=BLACK,
        spaceBefore=16,
        spaceAfter=7,
        borderWidth=0,
        borderPadding=0,
    )
    
    style_label = ParagraphStyle(
        'Label',
        parent=styles['Normal'],
        fontName='Times-Roman',
        fontSize=10,
        leading=13,
        textColor=GRAY_DARK,
        spaceAfter=2,
    )
    
    style_value = ParagraphStyle(
        'Value',
        parent=styles['Normal'],
        fontName='Times-Roman',
        fontSize=10,
        leading=13,
        textColor=BLACK,
        spaceAfter=8,
    )
    
    style_table_header = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Times-Bold',
        fontSize=9,
        leading=12,
        textColor=BLACK,
        alignment=TA_LEFT,
    )
    
    style_table_cell = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Times-Roman',
        fontSize=8.5,
        leading=11,
        textColor=BLACK,
        alignment=TA_LEFT,
    )
    
    style_table_cell_left = ParagraphStyle(
        'TableCellLeft',
        parent=style_table_cell,
        alignment=TA_LEFT,
    )
    
    style_table_cell_right = ParagraphStyle(
        'TableCellRight',
        parent=style_table_cell,
        alignment=TA_RIGHT,
    )
    
    style_report_label = ParagraphStyle(
        'ReportLabel',
        parent=ParagraphStyle('Normal', parent=styles['Normal']),
        fontName='Times-Bold',
        fontSize=10,
        leading=13,
        textColor=GRAY_DARK,
        alignment=TA_RIGHT,
        spaceAfter=8,
    )
    
    style_footer = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontName='Times-Roman',
        fontSize=8,
        leading=10,
        textColor=GRAY_MEDIUM,
        alignment=TA_CENTER,
    )
    
    # Footer confidential notice style (justified, small, gray)
    style_footer_notice = ParagraphStyle(
        'FooterNotice',
        parent=styles['Normal'],
        fontName='Times-Roman',
        fontSize=6.5,
        leading=9,
        textColor=GRAY_MEDIUM,
        alignment=TA_JUSTIFY,
    )
    
    # Confidential notice text
    CONFIDENTIAL_NOTICE = (
        "Transaction report generated by Crypgo Platform, Inc. This document contains confidential financial information and is intended solely for the authorized recipient. "
        "Unauthorized reproduction, distribution, or use of this material is strictly prohibited. "
        "All data presented is for informational purposes only and may not reflect final settlement values. "
        "Crypgo Platform, Inc. assumes no liability for errors, omissions, or reliance on this report. "
        "This document is not a legal or financial advisory statement and should not be construed as such. "
        "All rights reserved. Crypgo Platform, Inc."
    )
    
    def draw_footer(canvas, doc):
        """Draw the confidential notice in the bottom margin on every page."""
        canvas.saveState()
        # Create a Paragraph for justified rendering
        from reportlab.platypus import Paragraph
        p = Paragraph(CONFIDENTIAL_NOTICE, style_footer_notice)
        # Available width in footer area (same as content width)
        footer_width = content_width
        # Calculate required height
        w, h = p.wrap(footer_width, 20*mm)
        # Position at bottom margin area (10mm from page bottom = half of bottomMargin)
        y_pos = 10 * mm
        x_pos = 20 * mm  # leftMargin
        p.drawOn(canvas, x_pos, y_pos)
        canvas.restoreState()
    
    # ============================================================
    # Build Story
    # ============================================================
    story = []
    
    # ---- FORMAL REPORT HEADER ----
    # Use SVG logo for better quality
    logo_svg_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'images', 'logo', 'logo.svg')
    logo_svg_path = os.path.normpath(logo_svg_path)
    
    def create_svg_logo_badge(svg_path, container_width, container_height, logo_size):
        """Create a centered, borderless logo flowable."""
        class SVGLogoBadge(Flowable):
            def __init__(self, svg_path, container_width, container_height, logo_size):
                Flowable.__init__(self)
                self.svg_path = svg_path
                self.container_width = container_width
                self.container_height = container_height
                self.logo_size = logo_size
                self.width = container_width
                self.height = container_height
                self.hAlign = 'CENTER'
                self.spaceBefore = 0
                self.spaceAfter = 0
            
            def draw(self):
                canvas = self.canv
                try:
                    # Convert SVG to ReportLab drawing
                    drawing = svg2rlg(self.svg_path)
                    if drawing:
                        # Scale the drawing to fit within logo_size (maintaining aspect ratio)
                        scale = self.logo_size / max(drawing.width, drawing.height)
                        # Calculate actual rendered dimensions
                        rendered_width = drawing.width * scale
                        rendered_height = drawing.height * scale
                        # Center the rendered logo in the container
                        logo_x = (self.container_width - rendered_width) / 2
                        logo_y = (self.container_height - rendered_height) / 2
                        canvas.saveState()
                        canvas.translate(logo_x, logo_y)
                        canvas.scale(scale, scale)
                        drawing.drawOn(canvas, 0, 0)
                        canvas.restoreState()
                except Exception as e:
                    print(f"SVG rendering error: {e}")
        
        return SVGLogoBadge(svg_path, container_width, container_height, logo_size)
    
    # ---- USER INFO (top left, bold labels, opposite logo) ----
    style_user_info_title = ParagraphStyle(
        'UserInfoTitle',
        parent=ParagraphStyle('Normal', parent=styles['Normal']),
        fontName='Times-Roman',
        fontSize=10,
        leading=14,
        textColor=BLACK,
        alignment=TA_LEFT,
        spaceAfter=4,
    )
    
    # Set generated_at for header
    generated_at = datetime.now().strftime("%B %d, %Y at %H:%M UTC")
    
    style_report_title = ParagraphStyle(
        'ReportTitle',
        parent=ParagraphStyle('Normal', parent=styles['Normal']),
        fontName='Times-Bold',
        fontSize=20,
        leading=24,
        textColor=BLACK,
        alignment=TA_CENTER,
        spaceAfter=4,
        spaceBefore=0,
    )
    
    # Style for "TRANSACTION REPORT" - same as report title (16pt bold, black)
    style_transaction_report = ParagraphStyle(
        'TransactionReport',
        parent=ParagraphStyle('Normal', parent=styles['Normal']),
        fontName='Times-Bold',
        fontSize=12,
        leading=15,
        textColor=BLACK,
        alignment=TA_CENTER,
        spaceAfter=0,
        spaceBefore=0,
    )
    
    # Style for company name under logo
    style_company_name = ParagraphStyle(
        'CompanyName',
        parent=ParagraphStyle('Normal', parent=styles['Normal']),
        fontName='Times-Roman',
        fontSize=8.5,
        leading=11,
        textColor=GRAY_DARK,
        alignment=TA_CENTER,
        spaceAfter=0,
        spaceBefore=2,
    )
    
    full_name = f"{user.first_name} {user.last_name}".strip().upper()
    
    # Name paragraph with label, same style as other user info fields
    user_name_para = Paragraph(f"<b>Name:</b> {full_name}", style_user_info_title)
    user_email_para = Paragraph(f"<b>Email:</b> {user.email}", style_user_info_title)
    currency_para = Paragraph(f"<b>Currency:</b> USD", style_user_info_title)
    total_label = 'Unavailable' if missing_asset_prices or not MARKET_PRICE_AS_OF else f'${total_usd:,.2f}'
    available_label = 'Unavailable' if missing_asset_prices or not MARKET_PRICE_AS_OF else f'${available_usd:,.2f}'
    pending_label = 'Unavailable' if missing_asset_prices or not MARKET_PRICE_AS_OF else f'${pending_usd:,.2f}'
    value_para = Paragraph(f"<b>Value:</b> {total_label}", style_user_info_title)
    available_value_para = Paragraph(f"<b>Available:</b> {available_label}", style_user_info_title)
    pending_value_para = Paragraph(f"<b>Pending:</b> {pending_label}", style_user_info_title)
    date_para = Paragraph(f"<b>Date:</b> {generated_at}", style_user_info_title)
    
    # Use SVG logo
    if os.path.exists(logo_svg_path):
        try:
            logo_badge = create_svg_logo_badge(logo_svg_path, 60, 36, 34)
            
            metadata_table = Table(
                [[user_name_para, user_email_para],
                 [currency_para, date_para]],
                colWidths=[content_width / 2] * 2,
            )
            metadata_table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('LEFTPADDING', (0, 0), (-1, -1), 0),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                ('TOPPADDING', (0, 0), (-1, -1), 2),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
            ]))
            header_table = Table([
                [Paragraph("CRYPGO PLATFORM, INC.", style_company_name)],
                [logo_badge],
                [Paragraph("ACCOUNT PORTFOLIO REPORT", style_report_title)],
                [Paragraph("Confidential account statement", style_subtitle)],
                [metadata_table],
            ], colWidths=[content_width])
            header_table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('LEFTPADDING', (0, 0), (-1, -1), 0),
                ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                ('TOPPADDING', (0, 0), (-1, -1), 0),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            story.append(header_table)
            story.append(Spacer(1, 8))
            story.append(Paragraph("1.01 — Account Identification", style_section))
            story.append(Paragraph(
                "This report presents the account identity, portfolio position, and transaction activity maintained by Crypgo Platform, Inc. for the account holder identified above.",
                ParagraphStyle('Intro', parent=style_value, alignment=TA_JUSTIFY, spaceAfter=5),
            ))
            story.append(Paragraph("1.02 — Portfolio Summary", style_section))
            holding_rows = [[
                Paragraph("Asset", style_table_header),
                Paragraph("Balance", style_table_header),
                Paragraph("Available", style_table_header),
                Paragraph("Pending", style_table_header),
                Paragraph("Unit Price", style_table_header),
                Paragraph("Fiat Value", style_table_header),
            ]]
            for asset in assets_with_balance:
                ticker = asset.ticker.upper()
                quantity = Decimal(str(asset.quantity))
                available_quantity = Decimal(str(asset.available_quantity))
                pending_quantity = Decimal(str(asset.locked_quantity))
                unit_price = prices.get(ticker)
                unit_price_label = f'${unit_price:,.2f}' if unit_price is not None else 'Unavailable'
                fiat_value_label = f'${quantity * unit_price:,.2f}' if unit_price is not None else 'Unavailable'
                holding_rows.append([
                    Paragraph(ticker, style_table_cell_left),
                    Paragraph(f"{quantity:,.8f}", style_table_cell_left),
                    Paragraph(f"{available_quantity:,.8f}", style_table_cell_left),
                    Paragraph(f"{pending_quantity:,.8f}", style_table_cell_left),
                    Paragraph(unit_price_label, style_table_cell_left),
                    Paragraph(fiat_value_label, style_table_cell_left),
                ])
            story.append(Table(
                holding_rows,
                colWidths=[content_width * width for width in (0.10, 0.19, 0.19, 0.15, 0.17, 0.20)],
                repeatRows=1,
                style=TableStyle([
                    ('LINEABOVE', (0, 0), (-1, 0), 0.5, GRAY_MEDIUM),
                    ('LINEBELOW', (0, 0), (-1, 0), 0.5, GRAY_MEDIUM),
                    ('LINEBELOW', (0, 1), (-1, -1), 0.25, GRAY_LIGHT),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('LEFTPADDING', (0, 0), (-1, -1), 3),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 3),
                    ('TOPPADDING', (0, 0), (-1, -1), 5),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ]),
            ))
            story.append(Table(
                [[value_para, available_value_para, pending_value_para]],
                colWidths=[content_width / 3] * 3,
                style=TableStyle([
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('LEFTPADDING', (0, 0), (-1, -1), 0),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                    ('TOPPADDING', (0, 0), (-1, -1), 7),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
                ]),
            ))
            price_caption = (
                f'Campaign market snapshot captured {MARKET_PRICE_AS_OF}. '
                'Prices are not live at report-generation time.'
                if MARKET_PRICE_AS_OF else
                'Campaign market snapshot unavailable. Portfolio fiat valuations are unavailable.'
            )
            story.append(Paragraph(
                price_caption,
                ParagraphStyle('MarketPriceAsOf', parent=styles['Normal'], fontName='Times-Roman', fontSize=8, leading=10, textColor=GRAY_DARK, leftIndent=-3, firstLineIndent=0, spaceBefore=3, spaceAfter=0),
            ))
            story.append(Paragraph("1.03 — Transaction Activity", style_section))
        except Exception as e:
            print(f"SVG logo load error in header: {e}")
            story.append(Paragraph("Crypgo", style_title))
    else:
        print(f"SVG logo file not found at: {logo_svg_path}")
        story.append(Paragraph("Crypgo", style_title))
    
    # ---- TRANSACTION HISTORY ----
    tx_rows = []
    tx_rows.append([
        Paragraph("Date", style_table_header),
        Paragraph("Type", style_table_header),
        Paragraph("Asset", style_table_header),
        Paragraph("Amount", style_table_header),
        Paragraph("Fiat (USD)", style_table_header),
    ])
    
    for tx in transactions:
        tx_type = tx.transaction_type.lower()
        
        tx_rows.append([
            Paragraph(tx.created_at.strftime("%Y-%m-%d %H:%M"), style_table_cell),
            Paragraph(get_report_transaction_type(tx.transaction_type, tx.get_transaction_type_display()), style_table_cell),
            Paragraph(tx.asset, style_table_cell),
            Paragraph(f"{tx.asset} {tx.amount}", style_table_cell),
            Paragraph(get_transaction_fiat_display(tx, prices), style_table_cell),
        ])
    
    tx_table = Table(
        tx_rows,
        colWidths=[
            content_width * 0.22,
            content_width * 0.15,
            content_width * 0.12,
            content_width * 0.25,
            content_width * 0.26,
        ],
        repeatRows=1,
    )
    
    tx_table.setStyle(TableStyle([
        # Header row: formal rules without a boxed outline.
        ('TEXTCOLOR', (0, 0), (-1, 0), BLACK),
        ('FONTNAME', (0, 0), (-1, 0), 'Times-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('LINEABOVE', (0, 0), (-1, 0), 0.6, BLACK),
        ('LINEBELOW', (0, 0), (-1, 0), 0.6, BLACK),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
        ('TOPPADDING', (0, 0), (-1, 0), 6),
        
        # Data rows
        ('FONTNAME', (0, 1), (-1, -1), 'Times-Roman'),
        ('FONTSIZE', (0, 1), (-1, -1), 8.5),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        ('LINEBELOW', (0, 1), (-1, -1), 0.25, GRAY_LIGHT),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    
    story.append(tx_table)
    story.append(Paragraph(
        "Fiat uses recorded transaction values when available; otherwise it is calculated from the stored transaction price. Values marked ~ are estimates using report-date spot prices.",
        ParagraphStyle('TransactionFiatNote', parent=styles['Normal'], fontName='Times-Roman', fontSize=8, leading=10, textColor=GRAY_DARK, spaceBefore=4, spaceAfter=0),
    ))
    story.append(Spacer(1, 24))
    
    # ============================================================
    # Build PDF
    # ============================================================
    doc.build(story, onFirstPage=draw_footer, onLaterPages=draw_footer)
    return output_buffer.getvalue()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Generate a Crypgo portfolio PDF report for a user.')
    parser.add_argument('--email', help='Email address of the user to generate the report for.')
    parser.add_argument('--output', help='Optional output file path. Defaults to a generated file next to this script.')
    parser.add_argument('--stdout', action='store_true', help='Write the generated PDF bytes to stdout instead of an output file.')
    parser.add_argument('--stdout-base64', action='store_true', help='Write base64-encoded PDF bytes to stdout for text-mode subprocess capture.')
    parser.add_argument('--refresh-market-prices', action='store_true', help='Fetch and atomically cache live market prices, then exit.')
    parser.add_argument('--cache-path', help='Absolute path for the shared campaign market-price snapshot.')
    args = parser.parse_args()

    if args.cache_path:
        PRICE_CACHE_PATH_OVERRIDE = args.cache_path

    if args.refresh_market_prices:
        try:
            refresh_report_price_snapshot()
        except Exception as error:
            print(f'CoinGecko snapshot refresh failed: {error}', file=sys.stderr)
            raise SystemExit(1)
        raise SystemExit(0)

    if not args.email:
        raise SystemExit('Provide --email.')

    user = CustomUser.objects.filter(email__iexact=args.email).first()

    if not user:
        raise SystemExit(f'User {args.email} not found!')

    if args.stdout or args.stdout_base64:
        with redirect_stdout(sys.stderr):
            report_bytes = generate_user_report_bytes(user)
    else:
        report_bytes = generate_user_report_bytes(user)

    if args.stdout:
        sys.stdout.buffer.write(report_bytes)
        sys.stdout.buffer.flush()
        raise SystemExit(0)

    if args.stdout_base64:
        print(base64.b64encode(report_bytes).decode('ascii'))
        raise SystemExit(0)

    if args.output:
        output_path = args.output
    else:
        identifier = args.email.replace('@', '_').replace('.', '_')
        output_path = os.path.join(
            os.path.dirname(__file__),
            f"user_report_{identifier}.pdf",
        )

    with open(output_path, 'wb') as output_file:
        output_file.write(report_bytes)
