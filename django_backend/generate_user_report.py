#!/usr/bin/env python3
"""
Generate a PDF report for a specific user with:
- Company logo
- User information
- Wallet balances (only assets with balance > 0)
- Transaction history table
- Black and white only
"""

import os
import sys
import django
from django.apps import apps
from datetime import datetime
from decimal import Decimal
from json import loads
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


def get_live_usd_prices(tickers):
    """Fetch current USD prices for report assets from CoinGecko."""
    requested_ids = sorted({COINGECKO_IDS[ticker] for ticker in tickers if ticker in COINGECKO_IDS})
    if not requested_ids:
        return {}

    query = urlencode({
        'ids': ','.join(requested_ids),
        'vs_currencies': 'usd',
    })
    request = Request(
        f'https://api.coingecko.com/api/v3/simple/price?{query}',
        headers={'Accept': 'application/json', 'User-Agent': 'Crypgo/1.0'},
    )

    try:
        with urlopen(request, timeout=10) as response:
            payload = loads(response.read().decode('utf-8'))
    except Exception as error:
        raise RuntimeError('Unable to fetch live CoinGecko prices for this report.') from error

    prices = {}
    for ticker, coingecko_id in COINGECKO_IDS.items():
        if coingecko_id in payload and 'usd' in payload[coingecko_id]:
            prices[ticker] = Decimal(str(payload[coingecko_id]['usd']))

    missing_tickers = [ticker for ticker in tickers if ticker not in prices]
    if missing_tickers:
        raise RuntimeError(
            f'CoinGecko did not return live USD prices for: {", ".join(sorted(set(missing_tickers)))}.'
        )

    return prices


# ============================================================
# PDF Generation
# ============================================================
def generate_user_report_bytes(user):
    """Generate and return a PDF report for an already-resolved user."""
    
    assets = WalletAsset.objects.filter(user=user)
    transactions = Transaction.objects.filter(user=user).order_by('-created_at')
    
    # Filter assets with balance > 0
    assets_with_balance = [a for a in assets if Decimal(str(a.quantity)) > Decimal('0')]
    prices = get_live_usd_prices({asset.ticker.upper() for asset in assets_with_balance})
    
    # Calculate total portfolio value early (needed for header)
    total_usd = Decimal('0')
    available_usd = Decimal('0')
    pending_usd = Decimal('0')
    
    for asset in assets_with_balance:
        qty = Decimal(str(asset.quantity))
        price = prices[asset.ticker.upper()]
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
        fontName='Helvetica-Bold',
        fontSize=28,
        leading=34,
        textColor=BLACK,
        alignment=TA_LEFT,
        spaceAfter=4,
    )
    
    style_subtitle = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=13,
        leading=18,
        textColor=GRAY_DARK,
        alignment=TA_LEFT,
        spaceAfter=16,
    )
    
    style_section = ParagraphStyle(
        'SectionHeader',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=22,
        textColor=BLACK,
        spaceBefore=18,
        spaceAfter=10,
        borderWidth=0,
        borderPadding=0,
    )
    
    style_label = ParagraphStyle(
        'Label',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=GRAY_DARK,
        spaceAfter=2,
    )
    
    style_value = ParagraphStyle(
        'Value',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=16,
        textColor=BLACK,
        spaceAfter=8,
    )
    
    style_table_header = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=WHITE,
        alignment=TA_CENTER,
    )
    
    style_table_cell = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=BLACK,
        alignment=TA_CENTER,
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
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=GRAY_DARK,
        alignment=TA_RIGHT,
        spaceAfter=8,
    )
    
    style_footer = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10,
        textColor=GRAY_MEDIUM,
        alignment=TA_CENTER,
    )
    
    # Footer confidential notice style (justified, small, gray)
    style_footer_notice = ParagraphStyle(
        'FooterNotice',
        parent=styles['Normal'],
        fontName='Helvetica',
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
    
    # ---- HEADER WITH LOGO ----
    # Use SVG logo for better quality
    logo_svg_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'images', 'logo', 'logo.svg')
    logo_svg_path = os.path.normpath(logo_svg_path)
    
    # Charcoal green background for logo container
    CHARCOAL_GREEN = Color(0.12, 0.25, 0.18)  # Dark charcoal green
    
    def create_svg_logo_badge(svg_path, container_width, container_height, logo_size, bg_color):
        """Create a Flowable that renders an SVG logo in a colored container."""
        class SVGLogoBadge(Flowable):
            def __init__(self, svg_path, container_width, container_height, logo_size, bg_color):
                Flowable.__init__(self)
                self.svg_path = svg_path
                self.container_width = container_width
                self.container_height = container_height
                self.logo_size = logo_size
                self.bg_color = bg_color
                self.width = container_width
                self.height = container_height
                self.hAlign = 'RIGHT'
                self.spaceBefore = 0
                self.spaceAfter = 0
            
            def draw(self):
                canvas = self.canv
                # Draw rectangular background (sharp corners)
                canvas.setFillColor(self.bg_color)
                canvas.rect(0, 0, self.container_width, self.container_height, fill=1, stroke=0)
                # Draw SVG logo centered
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
        
        return SVGLogoBadge(svg_path, container_width, container_height, logo_size, bg_color)
    
    # ---- USER INFO (top left, bold labels, opposite logo) ----
    style_user_info_title = ParagraphStyle(
        'UserInfoTitle',
        parent=ParagraphStyle('Normal', parent=styles['Normal']),
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=BLACK,
        alignment=TA_LEFT,
        spaceAfter=4,
    )
    
    # Calculate primary asset (largest USD value)
    primary_asset = None
    max_value = Decimal('0')
    for asset in assets_with_balance:
        price = prices[asset.ticker.upper()]
        value = Decimal(str(asset.quantity)) * price
        if value > max_value:
            max_value = value
            primary_asset = asset
    
    primary_asset_qty = Decimal('0')
    primary_asset_ticker = ''
    if primary_asset:
        qty = Decimal(str(primary_asset.quantity))
        primary_asset_qty = qty
        primary_asset_ticker = primary_asset.ticker
    
    # Format primary asset quantity (same logic as table)
    if primary_asset_qty == 0:
        primary_asset_qty_str = "0.00000000"
    elif primary_asset_qty < Decimal('0.0001'):
        primary_asset_qty_str = f"{primary_asset_qty:.8f}"
    elif primary_asset_qty < Decimal('1'):
        primary_asset_qty_str = f"{primary_asset_qty:.6f}"
    else:
        primary_asset_qty_str = f"{primary_asset_qty:,.4f}"
    
    # Set generated_at for header
    generated_at = datetime.now().strftime("%B %d, %Y at %H:%M UTC")
    
    # Style for report title (used in right column)
    # Style for report title at top-left (above asset info) - same size as "PORTFOLIO & TRANSACTION REPORT" was
    style_report_title = ParagraphStyle(
        'ReportTitle',
        parent=ParagraphStyle('Normal', parent=styles['Normal']),
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=22,
        textColor=BLACK,
        alignment=TA_LEFT,
        spaceAfter=0,
        spaceBefore=0,
    )
    
    # Style for "TRANSACTION REPORT" - same as report title (16pt bold, black)
    style_transaction_report = ParagraphStyle(
        'TransactionReport',
        parent=ParagraphStyle('Normal', parent=styles['Normal']),
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=22,
        textColor=BLACK,
        alignment=TA_LEFT,
        spaceAfter=0,
        spaceBefore=0,
    )
    
    # Style for company name under logo
    style_company_name = ParagraphStyle(
        'CompanyName',
        parent=ParagraphStyle('Normal', parent=styles['Normal']),
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=GRAY_DARK,
        alignment=TA_RIGHT,
        spaceAfter=0,
        spaceBefore=2,
    )
    
    # Style for public ID - 16pt bold but gray
    style_public_id = ParagraphStyle(
        'PublicID',
        parent=ParagraphStyle('Normal', parent=styles['Normal']),
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=22,
        textColor=GRAY_DARK,
        alignment=TA_LEFT,
        spaceAfter=2,
        spaceBefore=0,
    )
    
    full_name = f"{user.first_name} {user.last_name}".strip().upper()
    public_id = user.public_id
    
    # Name paragraph with label, same style as other user info fields
    user_name_para = Paragraph(f"<b>Name:</b> {full_name}", style_user_info_title)
    user_email_para = Paragraph(f"<b>Email:</b> {user.email}", style_user_info_title)
    user_phone_para = Paragraph(f"<b>Phone:</b> {user.phone or '\u2014'}", style_user_info_title)
    asset_para = Paragraph(f"<b>Asset:</b> {primary_asset_qty_str} {primary_asset_ticker}", style_user_info_title)
    currency_para = Paragraph(f"<b>Currency:</b> USD", style_user_info_title)
    value_para = Paragraph(f"<b>Value:</b> ${total_usd:,.2f}", style_user_info_title)
    available_value_para = Paragraph(f"<b>Available:</b> ${available_usd:,.2f}", style_user_info_title)
    pending_value_para = Paragraph(f"<b>Pending:</b> ${pending_usd:,.2f}", style_user_info_title)
    date_para = Paragraph(f"<b>Date:</b> {generated_at}", style_user_info_title)
    
    # Use SVG logo
    if os.path.exists(logo_svg_path):
        try:
            # Rectangular container - shorter height, wider width
            logo_container_width = 72   # Wider container
            logo_container_height = 48  # Shorter height (less empty space)
            logo_display_size = 50      # Maximum logo size - nearly fills container
            
            logo_badge = create_svg_logo_badge(logo_svg_path, logo_container_width, logo_container_height, logo_display_size, CHARCOAL_GREEN)
            
            # Create two independent vertical stacks in a single-row, 2-column table
            # Left column: title + asset info + contact info (flows independently)
            # Right column: logo + company name + public ID + full name (flows independently, far right)
            
            # Left stack - independent vertical flow
            left_stack = [
                Paragraph("TRANSACTION REPORT", style_report_title),
                Spacer(1, 16),
                currency_para,
                asset_para,
                value_para,
                available_value_para,
                pending_value_para,
                user_name_para,
                user_phone_para,
                user_email_para,
                date_para,
            ]
            
            # Right stack - independent vertical flow, aligned right
            right_stack = [
                logo_badge,
                Spacer(1, 2),
                Paragraph("Crypgo Platform, Inc.", style_company_name),
                Spacer(1, 4),
                Paragraph(public_id, ParagraphStyle('PublicIDRight', parent=style_public_id, alignment=TA_RIGHT)),
            ]
            
            header_table = Table(
                [[left_stack, right_stack]],
                colWidths=[content_width * 0.6, content_width * 0.4],
            )
            header_table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('ALIGN', (0, 0), (0, -1), 'LEFT'),
                ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
                ('LEFTPADDING', (0, 0), (-1, -1), 0),
                ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                ('TOPPADDING', (0, 0), (-1, -1), 0),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
                ('BOX', (0, 0), (-1, -1), 0, WHITE),
                ('INNERGRID', (0, 0), (-1, -1), 0, WHITE),
            ]))
            story.append(header_table)
            # Spacer between header and Wallet Balances section
            story.append(Spacer(1, 16))
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
            Paragraph(tx.get_transaction_type_display(), style_table_cell),
            Paragraph(tx.asset, style_table_cell),
            Paragraph(f"{tx.asset} {tx.amount}", style_table_cell),
            Paragraph(f"${tx.fiat_amount:,.2f}" if tx.fiat_amount else "\u2014", style_table_cell),
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
        # Header row
        ('BACKGROUND', (0, 0), (-1, 0), BLACK),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        
        # Data rows
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 8.5),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, GRAY_LIGHT]),
        
        # Grid
        ('GRID', (0, 0), (-1, -1), 0.5, GRAY_MEDIUM),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    
    story.append(tx_table)
    story.append(Spacer(1, 24))
    
    # ============================================================
    # Build PDF
    # ============================================================
    doc.build(story, onFirstPage=draw_footer, onLaterPages=draw_footer)
    return output_buffer.getvalue()


if __name__ == "__main__":
    user_email = "allvalleyacoustics@gmail.com"
    output_path = os.path.join(os.path.dirname(__file__), f"user_report_{user_email.replace('@', '_').replace('.', '_')}.pdf")
    user = CustomUser.objects.filter(email=user_email).first()
    if not user:
        raise SystemExit(f"User {user_email} not found!")
    with open(output_path, "wb") as output_file:
        output_file.write(generate_user_report_bytes(user))
