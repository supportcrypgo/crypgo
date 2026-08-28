"""Spam score analysis for email content"""
import re
import logging

logger = logging.getLogger('email_bot')


class SpamChecker:
    """Check email content for spam triggers"""

    # Common spam trigger phrases
    SPAM_PHRASES = [
        'click here', 'free', 'guaranteed', 'limited time',
        'act now', "don't wait", 'exclusive deal', 'special offer',
        'unsubscribe', 'opt out', 'remove me', '$$$', 'money back',
        'credit card', 'urgent', 'important message', 'final notice',
        'congratulations', 'you\'re a winner', 'act immediately',
        'limited offer', 'buy now', 'order now', 'call now',
        'double your', 'earn extra', 'extra cash', 'no obligation',
        'no questions asked', 'promise you', 'risk free',
        'satisfaction guaranteed', 'save up to', 'great offer',
    ]

    # Spam trigger words (individual)
    SPAM_WORDS = [
        'free', 'cash', 'bonus', 'win', 'winner', 'prize',
        'deal', 'amazing', 'incredible', 'exclusive',
        'limited', 'offer', 'discount', 'opportunity',
        'guarantee', 'guaranteed', 'earn', 'income',
        'extra', 'fast', 'immediate', 'instant',
        'mortgage', 'loan', 'credit', 'debt', 'rate',
        'click', 'here', 'visit', 'website', 'link',
        'act', 'now', 'today', 'don\'t', 'delete',
        'open', 'read', 'message', 'alert', 'notice',
        'urgent', 'important', 'confidential',
    ]

    FORMATTING_INDICATORS = {
        'excessive_exclamation': r'!{3,}',
        'excessive_caps': r'[A-Z]{5,}',
        'excessive_question': r'\?{2,}',
        'excessive_dollar': r'\${3,}',
    }

    @classmethod
    def check_content(cls, subject, html_content, plain_text=''):
        """Check content for spam indicators

        Returns a dict with:
            - score (0-10)
            - risk (low/medium/high)
            - warnings (list)
            - passed (bool, True if score < 5)
        """
        score = 0
        warnings = []

        # --- Check subject line ---
        subject_lower = subject.lower()
        for phrase in cls.SPAM_PHRASES:
            if phrase in subject_lower:
                score += 0.5
                warnings.append(f'Subject contains spam phrase: "{phrase}"')

        # --- Check HTML content ---
        html_lower = html_content.lower()

        # Spam phrases in body
        phrase_count = 0
        for phrase in cls.SPAM_PHRASES:
            count = html_lower.count(phrase)
            phrase_count += count
        if phrase_count > 3:
            score += 1
            warnings.append(f'Content contains {phrase_count} spam phrases')
        elif phrase_count > 0:
            score += 0.5

        # Spam trigger words
        word_count = 0
        text_no_tags = re.sub(r'<[^>]+>', ' ', html_content)
        words = text_no_tags.lower().split()
        for word in words:
            clean_word = word.strip('.,!?;:()[]{}"\'')
            if clean_word in cls.SPAM_WORDS:
                word_count += 1
        if word_count > 10:
            score += 1.5
            warnings.append(f'Contains {word_count} spam trigger words')
        elif word_count > 5:
            score += 0.5

        # --- Check for excessive formatting ---
        if re.search(cls.FORMATTING_INDICATORS['excessive_exclamation'], html_content):
            score += 0.5
            warnings.append('Contains excessive exclamation marks')

        if re.search(cls.FORMATTING_INDICATORS['excessive_caps'], html_content):
            score += 0.5
            warnings.append('Contains excessive capitalization')

        if re.search(cls.FORMATTING_INDICATORS['excessive_question'], html_content):
            score += 0.5
            warnings.append('Contains excessive question marks')

        if re.search(cls.FORMATTING_INDICATORS['excessive_dollar'], html_content):
            score += 0.5
            warnings.append('Contains excessive dollar signs')

        # --- Link to text ratio ---
        links = re.findall(r'<a\s+.*?>.*?</a>', html_content, re.DOTALL)
        text_length = len(re.sub(r'<[^>]+>', '', html_content))
        if links and text_length > 0:
            # links per 100 chars
            ratio = len(links) / (text_length / 100) if text_length > 0 else 0
            if ratio > 3:
                score += 1.5
                warnings.append(f'Very high link density: {ratio:.1f} links per 100 chars')
            elif ratio > 1.5:
                score += 0.5
                warnings.append(f'High link density: {ratio:.1f} links per 100 chars')

        # --- Image to text ratio (images without much text = spammy) ---
        images = re.findall(r'<img\s+.*?>', html_content)
        if images and text_length < 100:
            score += 1
            warnings.append('High image to text ratio')

        # --- HTML to text ratio (too much HTML = suspicious) ---
        html_length = len(html_content)
        if text_length > 0 and html_length > 0:
            html_ratio = html_length / text_length
            if html_ratio > 10:
                score += 0.5
                warnings.append('Excessive HTML overhead')

        # --- Check for hidden text (font-size: 0, display: none, etc) ---
        hidden_text = re.findall(
            r'(display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0)',
            html_content, re.IGNORECASE
        )
        if hidden_text:
            score += 1
            warnings.append('Contains hidden text (spam technique)')

        # Normalize score to 0-10 scale
        final_score = min(round(score, 1), 10)

        # Determine spam likelihood
        if final_score <= 3:
            risk = 'low'
        elif final_score <= 6:
            risk = 'medium'
        else:
            risk = 'high'

        return {
            'score': final_score,
            'risk': risk,
            'warnings': warnings,
            'passed': final_score < 5,
        }

    @classmethod
    def check_subject(cls, subject):
        """Check only the subject line for spam indicators"""
        score = 0
        warnings = []

        # Check length
        if len(subject) > 100:
            score += 0.5
            warnings.append(f'Subject is too long ({len(subject)} chars)')

        # Check for spam phrases
        subject_lower = subject.lower()
        for phrase in cls.SPAM_PHRASES:
            if phrase in subject_lower:
                score += 0.5
                warnings.append(f'Contains spam phrase: "{phrase}"')

        # Check for excessive punctuation
        if re.search(r'[!?]{3,}', subject):
            score += 0.5
            warnings.append('Excessive punctuation')

        # Check ALL CAPS words
        if re.search(r'\b[A-Z]{5,}\b', subject):
            score += 0.5
            warnings.append('Words in ALL CAPS')

        final_score = min(round(score, 1), 10)
        risk = 'low' if final_score <= 3 else ('medium' if final_score <= 6 else 'high')

        return {
            'score': final_score,
            'risk': risk,
            'warnings': warnings,
            'passed': final_score < 5,
        }