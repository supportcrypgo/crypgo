"""Email validation with syntax and MX record check"""
import re
import logging

logger = logging.getLogger('email_bot')

try:
    import dns.resolver
    HAS_DNS = True
except ImportError:
    HAS_DNS = False
    logger.warning("dnspython not installed. MX record validation disabled.")


class EmailValidator:
    """Complete email validation with syntax and MX record check"""

    EMAIL_REGEX = re.compile(
        r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    )

    SPAM_TRAP_PATTERNS = [
        r'@(mailinator|guerrillamail|tempmail|10minutemail|yopmail)\.',
        r'@(throwaway|trashmail|sharklasers|spambox)\.',
        r'test@', r'example@', r'user@', r'admin@',
    ]

    @classmethod
    def validate_syntax(cls, email):
        """Validate email syntax"""
        if not email or not email.strip():
            return {'valid': False, 'error': 'Email address is required'}

        email = email.strip().lower()

        if not cls.EMAIL_REGEX.match(email):
            return {'valid': False, 'error': f'Invalid email format: {email}'}

        if len(email) > 254:
            return {'valid': False, 'error': 'Email too long (max 254 characters)'}

        local_part = email.split('@')[0]
        if len(local_part) > 64:
            return {'valid': False, 'error': 'Local part too long (max 64 characters)'}

        return {'valid': True, 'email': email}

    @classmethod
    def validate_domain(cls, email):
        """Validate domain has MX records"""
        if not HAS_DNS:
            logger.debug('DNS validation skipped (dnspython not available)')
            return {'valid': True, 'skipped': True}

        try:
            domain = email.split('@')[1].lower()
            dns.resolver.resolve(domain, 'MX')
            return {'valid': True}
        except dns.resolver.NoAnswer:
            return {'valid': False, 'error': f'Domain {domain} has no MX records'}
        except dns.resolver.NXDOMAIN:
            return {'valid': False, 'error': f'Domain {domain} does not exist'}
        except Exception as e:
            logger.warning(f'DNS check failed for {email}: {str(e)}')
            return {'valid': True, 'skipped': True}

    @classmethod
    def check_spam_trap_domains(cls, email):
        """Check for known spam trap / disposable email domains"""
        import re
        email_lower = email.lower()
        for pattern in cls.SPAM_TRAP_PATTERNS:
            if re.search(pattern, email_lower):
                return {'valid': False, 'error': 'Disposable or test email detected'}
        return {'valid': True}

    @classmethod
    def validate(cls, email, check_mx=True):
        """Complete email validation"""
        # Syntax check
        syntax_result = cls.validate_syntax(email)
        if not syntax_result['valid']:
            return syntax_result

        clean_email = syntax_result['email']

        # Spam trap check
        trap_result = cls.check_spam_trap_domains(clean_email)
        if not trap_result['valid']:
            return trap_result

        # MX record check
        if check_mx:
            mx_result = cls.validate_domain(clean_email)
            if not mx_result['valid']:
                return mx_result

        return {'valid': True, 'email': clean_email}

    @classmethod
    def validate_bulk(cls, emails, check_mx=True):
        """Validate multiple emails"""
        results = []
        valid_count = 0
        invalid_count = 0

        for email in emails:
            result = cls.validate(email, check_mx)
            if result['valid']:
                valid_count += 1
            else:
                invalid_count += 1
            results.append(result)

        return {
            'results': results,
            'valid_count': valid_count,
            'invalid_count': invalid_count,
            'total': len(emails),
        }